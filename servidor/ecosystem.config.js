// Configuração do pm2: como o servidor mantém o bot rodando.
const fs = require('fs');
const path = require('path');

let chromePath = '';
try { chromePath = fs.readFileSync(path.join(__dirname, 'chrome-path.txt'), 'utf8').trim(); } catch { /* sem arquivo = Chrome do puppeteer */ }

module.exports = {
  apps: [{
    name: 'casa',
    script: 'src/index.js',
    cwd: path.join(__dirname, '..'),
    env: { CHROME_PATH: chromePath, TZ: 'America/Sao_Paulo' },
    restart_delay: 30000,        // se cair, espera 30 s e liga de novo
    max_memory_restart: '800M',  // se o Chromium vazar memória, reinicia
    time: true,                  // logs com data e hora
  }],
};
