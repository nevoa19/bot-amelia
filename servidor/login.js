// Conecta o WhatsApp do bot pela primeira vez (ou de novo, se ele for desconectado).
//
// Por que não usar o QR da própria biblioteca: desde 23/11/2026 o WhatsApp Web manda quem não
// está logado para a página /login/, onde o whatsapp-web.js não encontra o QR e fica esperando
// para sempre (https://github.com/wwebjs/whatsapp-web.js/issues/201988). Já com a sessão salva
// ele funciona normal. Então aqui eu abro o Chrome direto na pasta de sessão do bot, pego o QR
// da página, espero o celular conectar e fecho o Chrome com calma, para a sessão ficar gravada.
const path = require('path');
const puppeteer = require('puppeteer');
const qrcode = require('qrcode-terminal');
const { PASTA_DADOS } = require('../src/estado');

const PASTA_SESSAO = path.join(PASTA_DADOS, 'sessao', 'session'); // a mesma que o LocalAuth usa
const SEGUNDOS_SINCRONIZANDO = 60;

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const navegador = await puppeteer.launch({
    headless: true,
    protocolTimeout: 300000,
    userDataDir: PASTA_SESSAO,
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote'],
  });
  const pagina = (await navegador.pages())[0];
  // o mesmo navegador que o whatsapp-web.js finge ser
  await pagina.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36');
  await pagina.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded', timeout: 180000 });
  console.log('WhatsApp Web aberto, esperando o QR (ou a sessão salva)...');

  let ultimoQR = '';
  let conectadoDesde = 0;
  // até 15 minutos para escanear
  for (let volta = 0; volta < 300; volta++) {
    await esperar(3000);
    let info;
    try {
      info = await pagina.evaluate(() => {
        const comQR = document.querySelector('[data-ref]');
        let estado = null;
        try {
          estado = window.require('WAWebSocketModel').Socket.state;
        } catch (erro) {
          // na página de login esse módulo não existe
        }
        return {
          qr: comQR ? comQR.getAttribute('data-ref') : null,
          estado,
          conversas: !!document.querySelector('#pane-side'),
        };
      });
    } catch (erro) {
      continue; // a página está trocando (acontece logo depois do scan)
    }

    if (info.qr && info.qr !== ultimoQR) {
      ultimoQR = info.qr;
      console.log('\nNo celular do bot: WhatsApp Business > Configurações > Dispositivos conectados > Conectar dispositivo');
      console.log('Escaneie AGORA (o QR muda a cada ~20 s):\n');
      qrcode.generate(info.qr, { small: true });
    }

    if (info.estado === 'CONNECTED' || info.conversas) {
      if (!conectadoDesde) {
        conectadoDesde = Date.now();
        console.log(`✅ Conectado! Sincronizando as conversas, espere ${SEGUNDOS_SINCRONIZANDO} s...`);
      }
      if (Date.now() - conectadoDesde > SEGUNDOS_SINCRONIZANDO * 1000) break;
    }
  }

  await navegador.close();
  if (!conectadoDesde) {
    console.log('❌ Não conectou a tempo. Rode de novo.');
    process.exit(1);
  }
  console.log('Sessão salva.');
}

main().catch(erro => {
  console.log('❌ Erro no login:', erro.message);
  process.exit(1);
});
