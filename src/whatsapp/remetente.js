const { config } = require('../configuracao');

// Compara só os 8 últimos dígitos: assim tanto faz o +55, o DDD ou o 9 a mais no começo.
function finalDoNumero(numero) {
  return String(numero).replace(/\D/g, '').slice(-8);
}

// Descobre qual moradora mandou a mensagem. Devolve null para quem não é da casa.
// No grupo quem mandou vem em msg.author; no privado, em msg.from.
async function quemMandou(msg) {
  const origem = msg.author || msg.from || '';
  let numero = origem.split('@')[0];

  // contas novas às vezes chegam com um id interno (@lid) em vez do telefone
  if (!/^\d{10,15}$/.test(numero) || origem.endsWith('@lid')) {
    try {
      const contato = await msg.getContact();
      numero = contato.number;
    } catch (erro) {
      return null;
    }
  }

  for (const pessoa of config.pessoas) {
    if (finalDoNumero(pessoa.telefone) === finalDoNumero(numero)) return pessoa.nome;
  }
  return null;
}

module.exports = { quemMandou };
