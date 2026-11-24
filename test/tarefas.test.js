require('./ajuda');
const test = require('node:test');
const assert = require('node:assert');
const { estadoVazio } = require('../src/estado');
const { gerarDia } = require('../src/casa/distribuicao');
const { marcarFeita, contestar, fecharDia, proporTroca, aceitarTroca } = require('../src/casa/tarefas');

const DIA = '2026-11-09';

function item(estado, pessoa, tarefaId) {
  return gerarDia(estado, DIA).itens.find(i => i.pessoa === pessoa && (!tarefaId || i.tarefaId === tarefaId) && i.tipo !== 'fixa' && !i.foraDoEquilibrio);
}

test('louça só pode ser marcada depois das 20h', () => {
  const estado = estadoVazio();
  const louca = item(estado, 'Bia', 'louca');
  assert.strictEqual(marcarFeita(estado, DIA, 'Bia', louca.n, '14:00').ok, false);
  assert.strictEqual(marcarFeita(estado, DIA, 'Bia', louca.n, '20:00').ok, true);
});

test('não dá para marcar a tarefa de outra pessoa', () => {
  const estado = estadoVazio();
  const daBia = item(estado, 'Bia');
  const resultado = marcarFeita(estado, DIA, 'Carol', daBia.n, '21:00');
  assert.strictEqual(resultado.ok, false);
  assert.match(resultado.msg, /é da Bia/);
});

test('contestação devolve a tarefa e vira multa se não for refeita', () => {
  const estado = estadoVazio();
  const daBia = item(estado, 'Bia', 'louca');
  marcarFeita(estado, DIA, 'Bia', daBia.n, '21:00');

  assert.strictEqual(contestar(estado, DIA, 'Bia', 'Bia', daBia.n).ok, false, 'ninguém contesta a si mesma');
  assert.strictEqual(contestar(estado, DIA, 'Carol', 'Bia', daBia.n).ok, true);
  assert.strictEqual(daBia.feita, false);

  for (const outro of gerarDia(estado, DIA).itens) {
    if (outro !== daBia) outro.feita = true;
  }
  const multas = fecharDia(estado, DIA);
  assert.strictEqual(multas.length, 1);
  assert.strictEqual(multas[0].pessoa, 'Bia');
  assert.match(multas[0].motivo, /\(contestada\)$/);
  assert.doesNotMatch(multas[0].motivo, /Carol/, 'a multa não conta quem contestou');
});

test('não dá para contestar o que nem foi marcado', () => {
  const estado = estadoVazio();
  const daBia = item(estado, 'Bia');
  assert.strictEqual(contestar(estado, DIA, 'Carol', 'Bia', daBia.n).ok, false);
});

test('troca só vale com aceite e os pontos vão junto', () => {
  const estado = estadoVazio();
  const daAna = item(estado, 'Ana', 'cozinha') || item(estado, 'Ana');
  const pontosAntes = { ...estado.carga };

  assert.strictEqual(proporTroca(estado, DIA, 'Ana', daAna.n, 'Carol').ok, true);
  assert.strictEqual(daAna.pessoa, 'Ana', 'antes do aceite a tarefa continua com a Ana');

  assert.strictEqual(aceitarTroca(estado, DIA, 'Carol').ok, true);
  assert.strictEqual(daAna.pessoa, 'Carol');
  assert.strictEqual(estado.carga.Ana, pontosAntes.Ana - daAna.pontos);
  assert.strictEqual(estado.carga.Carol, pontosAntes.Carol + daAna.pontos);
});

test('troca da caixa de areia não mexe nos pontos', () => {
  const estado = estadoVazio();
  const areia = gerarDia(estado, DIA).itens.find(i => i.tarefaId === 'gata');
  const outra = areia.pessoa === 'Ana' ? 'Bia' : 'Ana';
  const pontosAntes = { ...estado.carga };
  proporTroca(estado, DIA, areia.pessoa, areia.n, outra);
  aceitarTroca(estado, DIA, outra);
  assert.strictEqual(areia.pessoa, outra);
  assert.deepStrictEqual(estado.carga, pontosAntes);
});

test('louça não troca', () => {
  const estado = estadoVazio();
  const louca = item(estado, 'Ana', 'louca');
  assert.strictEqual(proporTroca(estado, DIA, 'Ana', louca.n, 'Bia').ok, false);
});
