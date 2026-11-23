// Carrega o config.js da casa (que não vai para o GitHub, porque tem os telefones).
// Sem ele, usa o config.exemplo.js. A variável BOT_CONFIG força outro arquivo (usado nos testes).
const fs = require('fs');
const path = require('path');

const PASTA_RAIZ = path.join(__dirname, '..');

function caminhoDoConfig() {
  if (process.env.BOT_CONFIG) {
    return path.resolve(process.env.BOT_CONFIG);
  }
  const configDaCasa = path.join(PASTA_RAIZ, 'config.js');
  if (fs.existsSync(configDaCasa)) {
    return configDaCasa;
  }
  console.warn('⚠️  config.js não encontrado, usando o config.exemplo.js. Copie o exemplo para config.js e preencha com os dados da casa.');
  return path.join(PASTA_RAIZ, 'config.exemplo.js');
}

const config = require(caminhoDoConfig());

const REGRAS_PADRAO = {
  descontos: [20, 35, 50],
  creditoMaximo: 15,
  diaVencimento: 8,
  diaCobranca: 10,
  diasMinSemana: 4,
  diasMinMes: 15,
};
config.regras = { ...REGRAS_PADRAO, ...(config.regras || {}) };
if (!config.multiplicadorReincidencia) config.multiplicadorReincidencia = 2;
if (!config.faxinaSaida) config.faxinaSaida = [];
if (!config.faxinaChegada) config.faxinaChegada = [];
if (!config.caixinha) config.caixinha = {};

function nomesDasPessoas() {
  const nomes = [];
  for (const pessoa of config.pessoas) {
    nomes.push(pessoa.nome);
  }
  return nomes;
}

module.exports = { config, nomesDasPessoas, PASTA_RAIZ };
