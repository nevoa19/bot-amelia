const { config } = require('../configuracao');

// Compara só os 8 últimos dígitos: assim tanto faz o +55, o DDD ou o 9 a mais no começo.
function finalDoNumero(numero) {
  return String(numero).replace(/\D/g, '').slice(-8);
}

// Contas novas do WhatsApp chegam com um id interno (@lid) em vez do telefone.
// Aqui eu tento descobrir o telefone de verdade por dois caminhos.
async function telefoneDoLid(msg, origem) {
  try {
    const [par] = await msg.client.getContactLidAndPhone(origem);
    if (par && par.pn) return par.pn.split('@')[0];
  } catch (erro) {
    // versão da biblioteca sem essa função, ou o WhatsApp não respondeu: tenta o outro jeito
  }
  try {
    const contato = await msg.getContact();
    if (contato.number) return contato.number;
  } catch (erro) {
    // sem jeito de descobrir
  }
  return null;
}

// Descobre qual moradora mandou a mensagem. Devolve null para quem não é da casa.
// No grupo quem mandou vem em msg.author; no privado, em msg.from.
async function quemMandou(msg) {
  const origem = msg.author || msg.from || '';
  let numero = origem.split('@')[0];

  if (!/^\d{10,15}$/.test(numero) || origem.endsWith('@lid')) {
    numero = await telefoneDoLid(msg, origem);
    if (!numero) return null;
  }

  for (const pessoa of config.pessoas) {
    if (finalDoNumero(pessoa.telefone) === finalDoNumero(numero)) return pessoa.nome;
  }
  return null;
}

module.exports = { quemMandou };
