// Cliente do WhatsApp Web (biblioteca não oficial whatsapp-web.js).
// Ele abre um Chromium escondido e entra no WhatsApp Web com o número do bot.
// A sessão fica salva em dados/sessao, então só precisa escanear o QR Code uma vez.
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { config } = require('../configuracao');
const { PASTA_DADOS } = require('../estado');

function criarCliente() {
  return new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(PASTA_DADOS, 'sessao') }),
    puppeteer: {
      headless: true,
      // No servidor ARM o puppeteer não tem Chrome próprio, então uso o Chromium do sistema.
      // Vazio = Chrome que o puppeteer baixa sozinho (Windows e servidores x86).
      executablePath: process.env.CHROME_PATH || config.chromePath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote'],
    },
  });
}

module.exports = { criarCliente };
