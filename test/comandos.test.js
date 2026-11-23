const { criarBotDeTeste, mensagem, foto } = require('./ajuda');
const test = require('node:test');
const assert = require('node:assert');
const { gerarDia } = require('../src/casa/distribuicao');

const DIA = '2026-11-09';

function loucaDa(bot, pessoa) {
  return gerarDia(bot.estado, DIA).itens.find(item => item.pessoa === pessoa && item.tarefaId === 'louca');
}

function deixarDevendo(bot, pessoa, valor) {
  bot.estado.multas.push({ pessoa, valor, motivo: 'teste', data: DIA });
}

test('feito no grupo marca a tarefa e responde no grupo', async () => {
  const bot = criarBotDeTeste({ agora: { data: DIA, hora: '21:00' } });
  const louca = loucaDa(bot, 'Bia');
  const msg = mensagem('Bia', `Feito ${louca.n}`, { noGrupo: true });
  await bot.tratar(msg);
  assert.strictEqual(louca.feita, true);
  assert.match(msg.respostas[0], /feito!/);
});

test('mensagem de quem não é da casa é ignorada', async () => {
  const bot = criarBotDeTeste();
  const msg = mensagem('Ana', 'feito 1');
  msg.from = '5511988887777@c.us';
  await bot.tratar(msg);
  assert.deepStrictEqual(msg.respostas, []);
});

test('contestação no grupo é recusada, para não expor quem contestou', async () => {
  const bot = criarBotDeTeste({ agora: { data: DIA, hora: '21:00' } });
  const louca = loucaDa(bot, 'Carol');
  await bot.tratar(mensagem('Carol', `feito ${louca.n}`, { noGrupo: true }));

  const msg = mensagem('Bia', `contestar Carol ${louca.n}`, { noGrupo: true, midia: foto() });
  await bot.tratar(msg);
  assert.match(msg.respostas[0], /privado do bot/);
  assert.strictEqual(louca.feita, true);
});

test('contestação no privado é anônima e devolve a tarefa', async () => {
  const bot = criarBotDeTeste({ agora: { data: DIA, hora: '21:00' } });
  const louca = loucaDa(bot, 'Carol');
  await bot.tratar(mensagem('Carol', `feito ${louca.n}`, { noGrupo: true }));
  bot.limpar();

  const semFoto = mensagem('Bia', `contestar Carol ${louca.n}`);
  await bot.tratar(semFoto);
  assert.match(semFoto.respostas[0], /mande uma \*foto\*/);
  assert.strictEqual(louca.feita, true);

  const msg = mensagem('Bia', `contestar Carol ${louca.n}`, { midia: foto() });
  await bot.tratar(msg);
  assert.strictEqual(louca.feita, false);

  const noGrupo = bot.mensagensPara('grupo').join('\n');
  assert.match(noGrupo, /foi contestada/);
  assert.doesNotMatch(noGrupo, /Bia/, 'o grupo não pode saber quem contestou');
  assert.match(bot.mensagensPara('Carol')[0], /lista de hoje foi atualizada/);
});

test('paguei sem comprovante não dá baixa', async () => {
  const bot = criarBotDeTeste();
  deixarDevendo(bot, 'Ana', 11);
  const msg = mensagem('Ana', 'paguei 11', { noGrupo: true });
  await bot.tratar(msg);
  assert.match(msg.respostas[0], /comprovante/);
  assert.strictEqual(bot.estado.pagamentos.length, 0);
});

test('paguei no grupo com o comprovante responde quanto ainda falta', async () => {
  const bot = criarBotDeTeste();
  deixarDevendo(bot, 'Ana', 11);
  const msg = mensagem('Ana', 'paguei 8', { noGrupo: true, midia: foto() });
  await bot.tratar(msg);
  assert.match(msg.respostas[0], /Agora você deve \*R\$ 3,00\*/);
  assert.strictEqual(bot.mensagensPara('grupo').length, 0, 'o comprovante já está no grupo, não precisa reenviar');
});

test('foto sem legenda no grupo e depois "paguei" também vale', async () => {
  const bot = criarBotDeTeste();
  deixarDevendo(bot, 'Ana', 3);
  const fotoSozinha = mensagem('Ana', '', { noGrupo: true, midia: foto() });
  await bot.tratar(fotoSozinha);
  assert.deepStrictEqual(fotoSozinha.respostas, [], 'no grupo o bot fica quieto com uma foto qualquer');

  const msg = mensagem('Ana', 'paguei 3', { noGrupo: true });
  await bot.tratar(msg);
  assert.match(msg.respostas[0], /quitou todas as multas/);
});

test('paguei no privado manda o comprovante para o grupo', async () => {
  const bot = criarBotDeTeste();
  deixarDevendo(bot, 'Carol', 5);
  await bot.tratar(mensagem('Carol', 'paguei 5', { midia: foto() }));
  assert.match(bot.mensagensPara('grupo')[0], /\[foto\].*Carol\* pagou R\$ 5,00/);
});

test('o mesmo comprovante não vale duas vezes', async () => {
  const bot = criarBotDeTeste();
  deixarDevendo(bot, 'Ana', 10);
  await bot.tratar(mensagem('Ana', 'paguei 5', { noGrupo: true, midia: foto('pix-unico') }));
  const repetido = mensagem('Ana', 'paguei 5', { noGrupo: true, midia: foto('pix-unico') });
  await bot.tratar(repetido);
  assert.match(repetido.respostas[0], /já foi usado/);
  assert.strictEqual(bot.estado.pagamentos.length, 1);
});

test('áudio não serve como comprovante', async () => {
  const bot = criarBotDeTeste();
  deixarDevendo(bot, 'Ana', 5);
  const msg = mensagem('Ana', 'paguei 5', { noGrupo: true, midia: { mimetype: 'audio/ogg', data: 'AAAA' } });
  await bot.tratar(msg);
  assert.match(msg.respostas[0], /foto\/print ou um PDF/);
});

test('troca pelo WhatsApp: pedido no privado e aceite', async () => {
  const bot = criarBotDeTeste();
  const daAna = gerarDia(bot.estado, DIA).itens.find(item => item.pessoa === 'Ana' && item.tipo === 'rodizio');
  await bot.tratar(mensagem('Ana', `trocar ${daAna.n} carol`, { noGrupo: true }));
  assert.match(bot.mensagensPara('Carol')[0], /Ana pediu para você fazer/);

  await bot.tratar(mensagem('Carol', 'aceito'));
  assert.strictEqual(daAna.pessoa, 'Carol');
  assert.match(bot.mensagensPara('Ana').pop(), /aceitou a troca/);
});

test('viagem avisada pelo bot vai para o grupo', async () => {
  const bot = criarBotDeTeste();
  const msg = mensagem('Bia', 'viajo 14/11 a 17/11');
  await bot.tratar(msg);
  assert.match(msg.respostas[0], /Boa viagem/);
  assert.match(bot.mensagensPara('grupo')[0], /Bia\* vai viajar de 14\/11 a 17\/11/);
});

test('mensagem desconhecida: ajuda no privado, silêncio no grupo', async () => {
  const bot = criarBotDeTeste();
  const noPrivado = mensagem('Ana', 'oi bot');
  const noGrupo = mensagem('Ana', 'alguém viu meu carregador?', { noGrupo: true });
  await bot.tratar(noPrivado);
  await bot.tratar(noGrupo);
  assert.match(noPrivado.respostas[0], /Comandos do bot/);
  assert.deepStrictEqual(noGrupo.respostas, []);
});
