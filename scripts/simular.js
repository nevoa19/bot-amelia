// Simula a divisão de tarefas sem conectar no WhatsApp, para conferir se está justa.
//   npm run simular          4 semanas, todo mundo cumprindo tudo
//   npm run simular -- 8     8 semanas
const { config, nomesDasPessoas } = require('../src/configuracao');
const { estadoVazio } = require('../src/estado');
const { somarDias, diaEMes, nomeDoDiaDaSemana } = require('../src/util/datas');
const { gerarDia } = require('../src/casa/distribuicao');
const { fecharDia } = require('../src/casa/tarefas');

const semanas = Number(process.argv[2]) || 4;
const estado = estadoVazio();
const pontosRodizio = {};
for (const nome of nomesDasPessoas()) pontosRodizio[nome] = 0;

let data = config.dataInicio;
for (let i = 0; i < semanas * 7; i++) {
  const dia = gerarDia(estado, data);

  if (i < 7) {
    console.log(`\n${nomeDoDiaDaSemana(data)} ${diaEMes(data)}`);
    for (const nome of nomesDasPessoas()) {
      const tarefas = [];
      for (const item of dia.itens) {
        if (item.pessoa === nome) tarefas.push(item.nome.split(/[,(]/)[0].trim());
      }
      console.log(`  ${nome.padEnd(8)} ${tarefas.join(' | ')}`);
    }
  }

  for (const item of dia.itens) {
    item.feita = true;
    if (item.tipo === 'rodizio' && !item.foraDoEquilibrio) pontosRodizio[item.pessoa] += item.pontos;
  }
  fecharDia(estado, data);
  data = somarDias(data, 1);
}

console.log(`\nPontos de esforço do rodízio em ${semanas} semanas (fora a louça e as tarefas fora do equilíbrio):`);
for (const nome of nomesDasPessoas()) {
  console.log(`  ${nome.padEnd(8)} ${pontosRodizio[nome]}`);
}
