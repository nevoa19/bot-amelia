// Tudo o que o bot precisa lembrar fica num único JSON (dados/estado.json):
// as tarefas de cada dia, multas, pagamentos, créditos, viagens, férias etc.
// Para uma casa com três pessoas isso é mais do que suficiente e dispensa banco de dados.
const fs = require('fs');
const path = require('path');
const { nomesDasPessoas, PASTA_RAIZ } = require('./configuracao');

const PASTA_DADOS = process.env.BOT_DADOS || path.join(PASTA_RAIZ, 'dados');
const ARQUIVO_ESTADO = path.join(PASTA_DADOS, 'estado.json');

function estadoVazio() {
  const carga = {};
  for (const nome of nomesDasPessoas()) {
    carga[nome] = 0;
  }
  return {
    carga,          // pontos de esforço acumulados por pessoa (equilíbrio do rodízio)
    contagem: {},   // quantas vezes cada pessoa fez cada tarefa restrita (ex.: banheiro)
    dias: {},       // '2026-11-09': { itens: [...], fechado }
    multas: [],
    pagamentos: [],
    creditos: [],
    trocas: [],
    ausencias: [],  // viagens individuais
    ferias: [],
    propostas: [],  // férias/viagens esperando confirmação
    meses: {},      // controle do fechamento mensal (fechado, lembrado, cobrado...)
  };
}

function carregarEstado() {
  if (!fs.existsSync(ARQUIVO_ESTADO)) return estadoVazio();
  const salvo = JSON.parse(fs.readFileSync(ARQUIVO_ESTADO, 'utf8'));
  // junta com o vazio para estados antigos ganharem os campos novos
  return { ...estadoVazio(), ...salvo };
}

// Grava num arquivo temporário e renomeia: se o servidor cair no meio, o estado antigo continua inteiro.
function salvarEstado(estado) {
  fs.mkdirSync(PASTA_DADOS, { recursive: true });
  const temporario = ARQUIVO_ESTADO + '.tmp';
  fs.writeFileSync(temporario, JSON.stringify(estado, null, 2));
  fs.renameSync(temporario, ARQUIVO_ESTADO);
}

module.exports = { PASTA_DADOS, estadoVazio, carregarEstado, salvarEstado };
