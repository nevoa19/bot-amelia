const { nomesDasPessoas } = require('../configuracao');
const { semAcento } = require('../util/texto');

// 'bia', 'Bia' ou 'BIA' -> 'Bia' (nome como está no config)
function acharPessoa(texto) {
  if (!texto) return null;
  for (const nome of nomesDasPessoas()) {
    if (semAcento(nome) === semAcento(texto)) return nome;
  }
  return null;
}

const QUINZE_MINUTOS = 15 * 60 * 1000;

function aindaValido(registro) {
  return registro && Date.now() - registro.quando < QUINZE_MINUTOS;
}

module.exports = { acharPessoa, aindaValido };
