const { viverPeriodo } = require('./ajuda');
const test = require('node:test');
const assert = require('node:assert');
const { estadoVazio } = require('../src/estado');
const { somarDias } = require('../src/util/datas');
const { gerarDia } = require('../src/casa/distribuicao');
const { proporAusencia, confirmarProposta, cancelarViagem } = require('../src/casa/ausencias');
const { statusDaSemana, sequenciaDeSemanasLimpas } = require('../src/casa/caixinha');

const HOJE = '2026-11-09';
const meioDia = data => ({ data, hora: '12:00' });

test('viagem avisada com antecedência vale na hora', () => {
  const estado = estadoVazio();
  const resultado = proporAusencia(estado, 'viagem', 'Bia', '12/11', '14/11', meioDia(HOJE));
  assert.strictEqual(resultado.ativa, true);
  assert.deepStrictEqual(estado.ausencias, [{ pessoa: 'Bia', inicio: '2026-11-12', fim: '2026-11-14' }]);
});

test('viagem em cima da hora precisa da confirmação de quem fica', () => {
  const estado = estadoVazio();
  const resultado = proporAusencia(estado, 'viagem', 'Bia', '10/11', '11/11', { data: HOJE, hora: '22:00' });
  assert.strictEqual(resultado.ativa, false);
  assert.deepStrictEqual(resultado.prop.precisam, ['Ana', 'Carol']);

  assert.strictEqual(confirmarProposta(estado, 'Ana', HOJE).ativa, false);
  assert.strictEqual(confirmarProposta(estado, 'Carol', HOJE).ativa, true);
  assert.strictEqual(estado.ausencias.length, 1);
});

test('viagem não pode começar hoje', () => {
  const estado = estadoVazio();
  assert.strictEqual(proporAusencia(estado, 'viagem', 'Bia', '09/11', '10/11', meioDia(HOJE)).ok, false);
});

test('quem viaja não recebe tarefas e não volta com tarefas a mais', () => {
  function pontosDaBia(estado, inicio, fim) {
    let pontos = 0;
    for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
      for (const item of estado.dias[data].itens) {
        if (item.pessoa === 'Bia' && item.tipo === 'rodizio') pontos += item.pontos;
      }
    }
    return pontos;
  }

  const semViagem = estadoVazio();
  viverPeriodo(semViagem, HOJE, '2026-12-20');

  const comViagem = estadoVazio();
  proporAusencia(comViagem, 'viagem', 'Bia', '17/11', '21/11', meioDia(HOJE));
  viverPeriodo(comViagem, HOJE, '2026-12-20');

  for (let data = '2026-11-17'; data <= '2026-11-21'; data = somarDias(data, 1)) {
    assert.ok(!comViagem.dias[data].itens.some(item => item.pessoa === 'Bia'), `Bia com tarefa em ${data}`);
  }
  // no mês seguinte à volta ela recebe praticamente o mesmo que receberia sem viajar
  const diferenca = pontosDaBia(comViagem, '2026-11-22', '2026-12-20') - pontosDaBia(semViagem, '2026-11-22', '2026-12-20');
  assert.ok(Math.abs(diferenca) <= 4, `diferença de ${diferenca} pontos depois da volta`);
});

test('voltar antes devolve a pessoa ao rodízio a partir de amanhã', () => {
  const estado = estadoVazio();
  proporAusencia(estado, 'viagem', 'Bia', '12/11', '20/11', meioDia(HOJE));
  cancelarViagem(estado, 'Bia', '2026-11-14');
  assert.strictEqual(estado.ausencias[0].fim, '2026-11-14');
});

test('férias: as três confirmam, faxina na véspera e na volta, nenhuma tarefa no meio', () => {
  const estado = estadoVazio();
  assert.strictEqual(proporAusencia(estado, 'ferias', 'Ana', '10/11', '12/11', meioDia(HOJE)).ok, false, 'precisa de 2 dias de antecedência');

  proporAusencia(estado, 'ferias', 'Ana', '20/11', '25/11', meioDia(HOJE));
  confirmarProposta(estado, 'Bia', HOJE);
  assert.strictEqual(estado.ferias.length, 0, 'falta a Carol');
  confirmarProposta(estado, 'Carol', HOJE);
  assert.deepStrictEqual(estado.ferias, [{ inicio: '2026-11-20', fim: '2026-11-25' }]);

  viverPeriodo(estado, HOJE, '2026-11-30');
  const idsDe = data => estado.dias[data].itens.map(item => item.tarefaId);
  assert.ok(idsDe('2026-11-19').includes('saida_lixo'));
  assert.ok(idsDe('2026-11-26').includes('chegada_po'));
  assert.strictEqual(estado.dias['2026-11-22'].itens.length, 0);
});

test('nas férias as semanas ficam congeladas: não contam nem quebram a sequência', () => {
  const estado = estadoVazio();
  proporAusencia(estado, 'ferias', 'Ana', '23/11', '29/11', meioDia(HOJE));
  confirmarProposta(estado, 'Bia', HOJE);
  confirmarProposta(estado, 'Carol', HOJE);
  viverPeriodo(estado, HOJE, '2026-12-06');

  assert.strictEqual(statusDaSemana(estado, 'Ana', '2026-11-29'), 'neutra');
  // semanas limpas: 09-15/11, 16-22/11 e 30/11-06/12 (a das férias é pulada)
  assert.strictEqual(sequenciaDeSemanasLimpas(estado, 'Ana', '2026-12-06'), 3);
});

test('semana com menos de 4 dias em casa não conta para o desconto', () => {
  const estado = estadoVazio();
  proporAusencia(estado, 'viagem', 'Bia', '17/11', '20/11', meioDia(HOJE));
  viverPeriodo(estado, HOJE, '2026-11-22');
  assert.strictEqual(statusDaSemana(estado, 'Bia', '2026-11-22'), 'neutra');
  assert.strictEqual(statusDaSemana(estado, 'Ana', '2026-11-22'), 'limpa');
  assert.ok(gerarDia(estado, '2026-11-21').itens.some(item => item.pessoa === 'Bia'));
});
