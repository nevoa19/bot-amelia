const { config } = require('../configuracao');

function log(...partes) {
  const quando = new Date().toLocaleString('pt-BR', { timeZone: config.fusoHorario });
  console.log(`[${quando}]`, ...partes);
}

module.exports = { log };
