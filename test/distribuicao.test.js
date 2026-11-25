const { viverDia, viverPeriodo } = require('./ajuda');
const test = require('node:test');
const assert = require('node:assert');
const { estadoVazio } = require('../src/estado');
const { somarDias } = require('../src/util/datas');
const { gerarDia } = require('../src/casa/distribuicao');
const { fecharDia } = require('../src/casa/tarefas');

const INICIO = '2026-11-09';

function pontosDoRodizio(estado, inicio, fim) {
  const pontos = { Ana: 0, Bia: 0, Carol: 0 };
  for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
    for (const item of estado.dias[data].itens) {
      if (item.tipo === 'rodizio' && !item.atrasada && !item.foraDoEquilibrio) pontos[item.pessoa] += item.pontos;
    }
  }
  return pontos;
}

function itensDa(estado, data, pessoa) {
  return gerarDia(estado, data).itens.filter(item => item.pessoa === pessoa);
}

test('o rodízio equilibra o esforço entre as três', () => {
  const estado = estadoVazio();
  const fim = somarDias(INICIO, 8 * 7 - 1);
  viverPeriodo(estado, INICIO, fim);
  const pontos = Object.values(pontosDoRodizio(estado, INICIO, fim));
  assert.ok(Math.max(...pontos) - Math.min(...pontos) <= 4, `pontos desequilibrados: ${pontos}`);
});

test('banheiro só entre as pessoas configuradas, alternando', () => {
  const estado = estadoVazio();
  viverPeriodo(estado, INICIO, somarDias(INICIO, 59));
  const vezes = { Ana: 0, Bia: 0, Carol: 0 };
  for (const data in estado.dias) {
    for (const item of estado.dias[data].itens) {
      if (item.tarefaId === 'banheiro') vezes[item.pessoa]++;
    }
  }
  assert.strictEqual(vezes.Bia, 0);
  assert.ok(Math.abs(vezes.Ana - vezes.Carol) <= 1);
});

test('caixa de areia alterna só entre as donas dos gatos e fica fora dos pontos', () => {
  const estado = estadoVazio();
  viverPeriodo(estado, INICIO, somarDias(INICIO, 27));

  const vezes = { Ana: 0, Bia: 0, Carol: 0 };
  let pontosQueContam = 0;
  for (const data in estado.dias) {
    for (const item of estado.dias[data].itens) {
      if (item.tarefaId === 'gata') vezes[item.pessoa]++;
      else if (item.tipo === 'rodizio' && !item.atrasada) pontosQueContam += item.pontos;
    }
  }
  assert.strictEqual(vezes.Carol, 0);
  assert.strictEqual(vezes.Ana + vezes.Bia, 28, 'uma vez por dia');
  assert.ok(Math.abs(vezes.Ana - vezes.Bia) <= 1, `Ana ${vezes.Ana} x Bia ${vezes.Bia}`);

  // a carga de esforço só soma as outras tarefas
  const cargaTotal = estado.carga.Ana + estado.carga.Bia + estado.carga.Carol;
  assert.strictEqual(cargaTotal, pontosQueContam);
});

test('a louça é de cada uma', () => {
  const louca = gerarDia(estadoVazio(), INICIO).itens.filter(item => item.tarefaId === 'louca');
  assert.deepStrictEqual(louca.map(item => item.pessoa).sort(), ['Ana', 'Bia', 'Carol']);
});

test('tarefa fixa é sempre da mesma pessoa e não entra nos pontos', () => {
  const { config } = require('../src/configuracao');
  // o exemplo não tem tarefa fixa, então coloco uma só neste teste
  config.tarefas.push({ id: 'planta', nome: 'Regar as plantas', tipo: 'fixa', responsavel: 'Carol', frequencia: 1, pontos: 1, multa: 1 });
  try {
    const estado = estadoVazio();
    viverPeriodo(estado, INICIO, somarDias(INICIO, 6));
    for (const data in estado.dias) {
      const regar = estado.dias[data].itens.filter(item => item.tarefaId === 'planta');
      assert.deepStrictEqual(regar.map(item => item.pessoa), ['Carol'], data);
    }
  } finally {
    config.tarefas.pop();
  }
});

test('quem estende a roupa nunca é quem recolhe', () => {
  const estado = estadoVazio();
  viverPeriodo(estado, INICIO, somarDias(INICIO, 8 * 7 - 1));
  let semanasConferidas = 0;
  for (const data in estado.dias) {
    const recolher = estado.dias[data].itens.find(item => item.tarefaId === 'recolher');
    if (!recolher) continue;
    const estender = estado.dias[somarDias(data, -1)].itens.find(item => item.tarefaId === 'roupas');
    assert.notStrictEqual(recolher.pessoa, estender.pessoa, data);
    semanasConferidas++;
  }
  assert.strictEqual(semanasConferidas, 8);
});

test('tarefa atrasada continua com quem atrasou, que recebe as tarefas normais por cima', () => {
  const tarefaDaBia = itensDa(estadoVazio(), INICIO, 'Bia').find(item => item.tipo === 'rodizio');

  // cenário 1: todas cumprem a segunda
  const emDia = estadoVazio();
  viverDia(emDia, INICIO);
  const terca = somarDias(INICIO, 1);
  const normaisDaBia = itensDa(emDia, terca, 'Bia').map(item => item.tarefaId);

  // cenário 2: a Bia não faz a tarefa dela na segunda
  const atrasou = estadoVazio();
  viverDia(atrasou, INICIO, item => item === atrasou.dias[INICIO].itens.find(i => i.n === tarefaDaBia.n));
  const daBia = itensDa(atrasou, terca, 'Bia');
  const atrasada = daBia.find(item => item.atrasada);

  assert.ok(atrasada, 'a tarefa atrasada tem que estar com a Bia');
  assert.strictEqual(atrasada.tarefaId, tarefaDaBia.tarefaId);
  assert.deepStrictEqual(daBia.filter(item => !item.atrasada).map(item => item.tarefaId), normaisDaBia);
});

test('atrasar não muda a divisão das semanas seguintes (ninguém sai ganhando)', () => {
  const tarefasNovas = (estado, inicio, fim) => {
    const lista = [];
    for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
      for (const item of estado.dias[data].itens) {
        if (!item.atrasada) lista.push(`${data} ${item.tarefaId} ${item.pessoa}`);
      }
    }
    return lista;
  };
  const fim = somarDias(INICIO, 15);

  const emDia = estadoVazio();
  viverPeriodo(emDia, INICIO, fim);

  // uma tarefa da Bia que não cai de novo no dia seguinte (senão as duas viram uma só)
  const { config } = require('../src/configuracao');
  const naoDiaria = item => config.tarefas.some(t => t.id === item.tarefaId && t.frequencia > 1 && !t.foraDoEquilibrio);
  const escolhida = gerarDia(estadoVazio(), INICIO).itens.find(item => item.pessoa === 'Bia' && item.tipo === 'rodizio' && naoDiaria(item));
  assert.ok(escolhida, 'a Bia precisa ter uma tarefa não diária no primeiro dia');

  const atrasou = estadoVazio();
  viverPeriodo(atrasou, INICIO, fim, (item, data) => data === INICIO && item.tarefaId === escolhida.tarefaId);

  assert.deepStrictEqual(tarefasNovas(atrasou, somarDias(INICIO, 1), fim), tarefasNovas(emDia, somarDias(INICIO, 1), fim));
});

test('se a atrasada também cai hoje, vira uma só e continua com quem atrasou', () => {
  const estado = estadoVazio();
  const varrer = gerarDia(estado, INICIO).itens.find(item => item.tarefaId === 'varrer');
  viverDia(estado, INICIO, item => item === varrer);

  const terca = gerarDia(estado, somarDias(INICIO, 1));
  const varrerDeHoje = terca.itens.filter(item => item.tarefaId === 'varrer');
  assert.strictEqual(varrerDeHoje.length, 1);
  assert.strictEqual(varrerDeHoje[0].pessoa, varrer.pessoa);
  assert.match(varrerDeHoje[0].nome, /a de ontem \+ a de hoje/);
});

test('se a atrasada ficar de novo, a multa dobra (só uma vez)', () => {
  const estado = estadoVazio();
  const pano = gerarDia(estado, INICIO).itens.find(item => item.tarefaId === 'pano');
  const naoFazPano = item => item.tarefaId === 'pano' && item.pessoa === pano.pessoa;

  const multasDia1 = viverDia(estado, INICIO, naoFazPano);
  const multasDia2 = viverDia(estado, somarDias(INICIO, 1), naoFazPano);
  const multasDia3 = viverDia(estado, somarDias(INICIO, 2), naoFazPano);

  assert.strictEqual(multasDia1.find(m => m.pessoa === pano.pessoa).valor, 3);
  assert.strictEqual(multasDia2.find(m => m.pessoa === pano.pessoa).valor, 6);
  assert.strictEqual(multasDia3.find(m => m.pessoa === pano.pessoa && m.motivo.includes('atrasada')).valor, 6);
});

test('fechar o mesmo dia duas vezes não duplica multa', () => {
  const estado = estadoVazio();
  gerarDia(estado, INICIO);
  const primeira = fecharDia(estado, INICIO);
  const segunda = fecharDia(estado, INICIO);
  assert.ok(primeira.length > 0);
  assert.strictEqual(segunda.length, 0);
});

test('ninguém pega a mesma tarefa de rodízio dois dias seguidos', () => {
  const estado = estadoVazio();
  const fim = somarDias(INICIO, 8 * 7 - 1);
  viverPeriodo(estado, INICIO, fim);
  for (let data = somarDias(INICIO, 1); data <= fim; data = somarDias(data, 1)) {
    const ontem = estado.dias[somarDias(data, -1)].itens;
    for (const item of estado.dias[data].itens) {
      if (item.tipo !== 'rodizio' || item.atrasada) continue;
      const mesmaOntem = ontem.find(i => i.tarefaId === item.tarefaId);
      if (mesmaOntem) assert.notStrictEqual(item.pessoa, mesmaOntem.pessoa, `${data} ${item.tarefaId}`);
    }
  }
});
