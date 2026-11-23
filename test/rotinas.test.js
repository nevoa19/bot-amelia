const { criarBotDeTeste } = require('./ajuda');
const test = require('node:test');
const assert = require('node:assert');
const { somarDias } = require('../src/util/datas');
const { gerarDia } = require('../src/casa/distribuicao');
const { marcarFeita } = require('../src/casa/tarefas');

const DIA = '2026-11-09';

function fazerTudo(bot, data, exceto = () => false) {
  for (const item of gerarDia(bot.estado, data).itens) {
    if (!exceto(item)) marcarFeita(bot.estado, data, item.pessoa, item.n, '21:00');
  }
}

// Vive os dias de verdade, chamando as rotinas como o cron chamaria.
async function viverComRotinas(bot, inicio, fim, exceto) {
  for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
    bot.agora = { data, hora: '08:00' };
    await bot.rotinas.mensagemDaManha();
    fazerTudo(bot, data, item => exceto && exceto(item, data));
    bot.agora = { data: somarDias(data, 1), hora: '00:00' };
    await bot.rotinas.fechamento();
  }
}

test('de manhã cada uma recebe a sua lista no privado e o grupo recebe a de todas', async () => {
  const bot = criarBotDeTeste({ agora: { data: DIA, hora: '08:00' } });
  await bot.rotinas.mensagemDaManha();
  for (const nome of ['Ana', 'Bia', 'Carol']) {
    assert.match(bot.mensagensPara(nome)[0], new RegExp(`Bom dia, ${nome}`));
  }
  const doGrupo = bot.mensagensPara('grupo')[0];
  assert.match(doGrupo, /Tarefas de segunda, 09\/11/);
  assert.match(doGrupo, /\*Ana\*[\s\S]*\*Bia\*[\s\S]*\*Carol\*/);
});

test('lembrete vai só para quem ainda tem tarefa, e nunca no grupo', async () => {
  const bot = criarBotDeTeste({ agora: { data: DIA, hora: '20:00' } });
  fazerTudo(bot, DIA, item => item.pessoa === 'Bia');
  await bot.rotinas.lembrete();
  assert.strictEqual(bot.mensagensPara('Ana').length, 0);
  assert.strictEqual(bot.mensagensPara('Carol').length, 0);
  assert.match(bot.mensagensPara('Bia')[0], /ainda faltam/);
  assert.strictEqual(bot.mensagensPara('grupo').length, 0);
});

test('fechamento do dia no grupo: parabéns quando tudo foi feito', async () => {
  const bot = criarBotDeTeste();
  fazerTudo(bot, DIA);
  bot.agora = { data: somarDias(DIA, 1), hora: '00:00' };
  await bot.rotinas.fechamento();
  assert.deepStrictEqual(bot.mensagensPara('grupo'), ['🌙 Tudo foi feito hoje, parabéns! 👏 Boa noite, meninas 💛']);
});

test('fechamento do dia no grupo: o que ficou para trás e de quem', async () => {
  const bot = criarBotDeTeste();
  fazerTudo(bot, DIA, item => item.pessoa === 'Carol' && item.tarefaId === 'louca');
  bot.agora = { data: somarDias(DIA, 1), hora: '00:00' };
  await bot.rotinas.fechamento();
  const texto = bot.mensagensPara('grupo')[0];
  assert.match(texto, /\*Carol\*\n• Lavar a sua louça: multa R\$ 8,00/);
  assert.match(texto, /Ana e Bia fizeram tudo/);
  assert.strictEqual(bot.mensagensPara('Carol').length, 0, 'a multa do dia não vai no privado');
});

test('calendário da caixinha: fim do mês, vencimento no dia 8 e cobrança sem desconto no dia 10', async () => {
  const bot = criarBotDeTeste();
  bot.estado.creditos.push({ pessoa: 'Ana', valor: 4, motivo: 'crédito anterior', tipo: 'teste' });
  const esqueceLouca = (item, data) => data === '2026-12-16' && item.pessoa === 'Ana' && item.tarefaId === 'louca';

  await viverComRotinas(bot, DIA, '2026-12-31', esqueceLouca);
  const fimDoMes = bot.mensagensPara('Ana').pop();
  assert.match(fimDoMes, /dezembro ficaram em \*R\$ 2,40\*.*sem ele seriam R\$ 4,00.*Vencimento: \*08\/01\*/s);
  assert.match(bot.mensagensPara('grupo').join('\n'), /Fechamento de dezembro/);

  bot.limpar();
  await viverComRotinas(bot, '2027-01-01', '2027-01-08');
  assert.ok(bot.mensagensPara('Ana').some(texto => /vence hoje.*R\$ 2,40.*passa a dever R\$ 4,00/s.test(texto)));

  bot.limpar();
  await viverComRotinas(bot, '2027-01-09', '2027-01-10');
  assert.ok(bot.mensagensPara('Ana').some(texto => /desconto de R\$ 1,60 foi cancelado.*Valor atualizado: \*R\$ 4,00\*/s.test(texto)));
});

test('nas férias o bot fica em silêncio', async () => {
  const bot = criarBotDeTeste();
  bot.estado.ferias.push({ inicio: '2026-11-20', fim: '2026-11-25' });
  bot.agora = { data: '2026-11-22', hora: '08:00' };
  await bot.rotinas.mensagemDaManha();
  bot.agora = { data: '2026-11-23', hora: '00:00' };
  await bot.rotinas.fechamento();
  assert.strictEqual(bot.enviadas.length, 0);
});
