const { viverPeriodo } = require('./ajuda');
const test = require('node:test');
const assert = require('node:assert');
const { estadoVazio } = require('../src/estado');
const {
  saldo, pendenteAte, registrarPagamento, concederCredito, fecharMes, verificarVencimento,
} = require('../src/casa/caixinha');

const INICIO = '2026-11-09';

// A Ana deixa a louça (R$ 8) nos dias indicados. O resto da casa faz tudo.
function anaEsqueceALouca(...datas) {
  return (item, data) => item.pessoa === 'Ana' && item.tarefaId === 'louca' && datas.includes(data);
}

function relatorioDa(relatorios, pessoa) {
  return relatorios.find(r => r.pessoa === pessoa);
}

test('exemplo da apresentação: multa de R$ 8, R$ 4 de crédito e uma semana limpa', () => {
  const estado = estadoVazio();
  estado.creditos.push({ pessoa: 'Ana', valor: 4, motivo: 'crédito anterior', tipo: 'teste' });

  // multa na 3ª semana de dezembro, 4ª semana limpa
  viverPeriodo(estado, INICIO, '2026-12-31', anaEsqueceALouca('2026-12-16'));
  const ana = relatorioDa(fecharMes(estado, '2026-12'), 'Ana');
  assert.strictEqual(ana.pct, 20);
  assert.strictEqual(ana.aPagar, 2.4);
  assert.strictEqual(ana.semDesconto, 4);

  // não pagou até o dia 8: perde os 20% e volta a dever R$ 4
  viverPeriodo(estado, '2027-01-01', '2027-01-08');
  const perderam = verificarVencimento(estado, '2026-12');
  assert.deepStrictEqual(perderam, [{ pessoa: 'Ana', valor: 1.6 }]);
  assert.strictEqual(pendenteAte(estado, 'Ana', '2026-12-31'), 4);
});

test('quem pagou até o vencimento mantém o desconto', () => {
  const estado = estadoVazio();
  estado.creditos.push({ pessoa: 'Ana', valor: 4, motivo: 'crédito anterior', tipo: 'teste' });
  viverPeriodo(estado, INICIO, '2026-12-31', anaEsqueceALouca('2026-12-16'));
  fecharMes(estado, '2026-12');

  registrarPagamento(estado, 'Ana', 2.4, { hash: 'pix' }, '2027-01-08');
  viverPeriodo(estado, '2027-01-01', '2027-01-08');
  assert.deepStrictEqual(verificarVencimento(estado, '2026-12'), []);
  assert.strictEqual(saldo(estado).Ana, 0);
});

test('multa nova no começo do mês não faz perder o desconto do mês passado', () => {
  const estado = estadoVazio();
  viverPeriodo(estado, INICIO, '2026-12-31', anaEsqueceALouca('2026-12-02'));
  fecharMes(estado, '2026-12');
  registrarPagamento(estado, 'Ana', pendenteAte(estado, 'Ana', '2026-12-31'), { hash: 'pix' }, '2027-01-02');

  // pagou dezembro em dia, mas esqueceu a louça no dia 3 de janeiro
  viverPeriodo(estado, '2027-01-01', '2027-01-08', anaEsqueceALouca('2027-01-03'));
  assert.deepStrictEqual(verificarVencimento(estado, '2026-12'), []);
  assert.strictEqual(saldo(estado).Ana, 8, 'deve só a multa de janeiro');
});

test('crédito que cobre a multa inteira mantém o desconto sem pagar nada', () => {
  const estado = estadoVazio();
  estado.creditos.push({ pessoa: 'Ana', valor: 10, motivo: 'crédito anterior', tipo: 'teste' });
  viverPeriodo(estado, INICIO, '2026-12-31', anaEsqueceALouca('2026-12-16'));
  fecharMes(estado, '2026-12');
  viverPeriodo(estado, '2027-01-01', '2027-01-08');

  assert.deepStrictEqual(verificarVencimento(estado, '2026-12'), []);
  assert.strictEqual(saldo(estado).Ana, -3.6); // 10 - 8 + 1,60 de desconto
});

test('desconto pela sequência de semanas limpas no fim do mês', () => {
  // multa na 1ª semana de dezembro e 3 semanas limpas depois: 50%
  const estado = estadoVazio();
  viverPeriodo(estado, INICIO, '2026-12-31', anaEsqueceALouca('2026-12-02'));
  const ana = relatorioDa(fecharMes(estado, '2026-12'), 'Ana');
  assert.strictEqual(ana.semanas, 3);
  assert.strictEqual(ana.pct, 50);
  assert.strictEqual(ana.desconto, 4);
});

test('multa na última semana do mês não tem desconto', () => {
  const estado = estadoVazio();
  viverPeriodo(estado, INICIO, '2026-12-31', anaEsqueceALouca('2026-12-23'));
  const ana = relatorioDa(fecharMes(estado, '2026-12'), 'Ana');
  assert.strictEqual(ana.pct, 0);
  assert.strictEqual(ana.aPagar, 8);
});

test('ninguém passa de R$ 15 de crédito', () => {
  const estado = estadoVazio();
  const primeiro = concederCredito(estado, 'Bia', 12, 'teste');
  const segundo = concederCredito(estado, 'Bia', 10, 'teste');
  assert.strictEqual(primeiro.dado, 12);
  assert.strictEqual(segundo.dado, 3);
  assert.strictEqual(segundo.cortado, 7);
  assert.strictEqual(saldo(estado).Bia, -15);
});

test('não aceita pagar mais do que deve', () => {
  const estado = estadoVazio();
  estado.multas.push({ pessoa: 'Carol', valor: 5, motivo: 'lixo', data: INICIO });
  assert.strictEqual(registrarPagamento(estado, 'Carol', 8, { hash: 'x' }, INICIO).ok, false);
  assert.strictEqual(registrarPagamento(estado, 'Carol', 5, { hash: 'x' }, INICIO).resta, 0);
  assert.strictEqual(registrarPagamento(estado, 'Carol', 1, { hash: 'y' }, INICIO).ok, false);
});

// dezembro com multa, janeiro e fevereiro limpos
function cenarioDaAnistia(pagaDezembro) {
  const estado = estadoVazio();
  viverPeriodo(estado, INICIO, '2026-12-31', anaEsqueceALouca('2026-12-16'));
  fecharMes(estado, '2026-12');
  if (pagaDezembro) registrarPagamento(estado, 'Ana', pendenteAte(estado, 'Ana', '2026-12-31'), { hash: 'pix' }, '2027-01-05');
  viverPeriodo(estado, '2027-01-01', '2027-01-31');
  verificarVencimento(estado, '2026-12');
  const janeiro = fecharMes(estado, '2027-01');
  viverPeriodo(estado, '2027-02-01', '2027-02-28');
  const fevereiro = fecharMes(estado, '2027-02');
  return { estado, janeiro: relatorioDa(janeiro, 'Ana'), fevereiro: relatorioDa(fevereiro, 'Ana') };
}

test('anistia devolve só o que foi pago de verdade, depois de 2 meses limpos', () => {
  const { janeiro, fevereiro, estado } = cenarioDaAnistia(true);
  assert.strictEqual(janeiro.anistia, undefined, 'um mês limpo ainda não dá anistia');
  // multa de 8 com 20% de desconto: ela pagou 6,40, é isso que volta
  assert.strictEqual(fevereiro.anistia, 6.4);
  assert.strictEqual(saldo(estado).Ana, -6.4);
});

test('sem pagar as multas, não tem anistia', () => {
  const { fevereiro, estado } = cenarioDaAnistia(false);
  assert.strictEqual(fevereiro.anistiaPerdida, true);
  assert.strictEqual(fevereiro.anistia, undefined);
  assert.strictEqual(saldo(estado).Ana, 8, 'perdeu o desconto e continua devendo tudo');
});
