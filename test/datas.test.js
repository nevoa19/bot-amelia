require('./ajuda');
const test = require('node:test');
const assert = require('node:assert');
const { lerData, ultimoDiaDoMes, mesAnterior, ultimoDomingoAte, diaEMes, somarDias, agoraNaCasa } = require('../src/util/datas');

test('lê datas no formato dia/mês', () => {
  assert.strictEqual(lerData('14/11', '2026-11-09'), '2026-11-14');
  assert.strictEqual(lerData('5/1/2027', '2026-11-09'), '2027-01-05');
  assert.strictEqual(lerData('5/1/27', '2026-11-09'), '2027-01-05');
});

test('data sem ano que já passou é do ano que vem', () => {
  assert.strictEqual(lerData('05/01', '2026-12-20'), '2027-01-05');
  // "20/12 a 15/01": a volta é depois da ida
  assert.strictEqual(lerData('15/01', '2026-12-01', '2026-12-20'), '2027-01-15');
});

test('datas inválidas viram null', () => {
  assert.strictEqual(lerData('31/02', '2026-11-09'), null);
  assert.strictEqual(lerData('amanhã', '2026-11-09'), null);
  assert.strictEqual(lerData(undefined, '2026-11-09'), null);
});

test('contas com meses e semanas', () => {
  assert.strictEqual(ultimoDiaDoMes('2027-02'), '2027-02-28');
  assert.strictEqual(ultimoDiaDoMes('2028-02'), '2028-02-29');
  assert.strictEqual(mesAnterior('2027-01'), '2026-12');
  assert.strictEqual(ultimoDomingoAte('2026-11-12'), '2026-11-08');
  assert.strictEqual(ultimoDomingoAte('2026-11-15'), '2026-11-15');
  assert.strictEqual(somarDias('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(diaEMes('2026-11-09'), '09/11');
});

test('a hora de agora usa o fuso da casa', () => {
  // 02:30 UTC = 23:30 do dia anterior em São Paulo
  assert.deepStrictEqual(agoraNaCasa(new Date('2026-11-10T02:30:00Z')), { data: '2026-11-09', hora: '23:30' });
});
