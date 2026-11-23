// Fotos e PDFs que chegam pelo WhatsApp (comprovantes de pagamento e fotos de contestação).
// Cada arquivo é salvo em dados/<pasta> e ganha um hash, que impede usar o mesmo comprovante duas vezes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PASTA_DADOS } = require('../estado');

const TIPOS_COMPROVANTE = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

function extensaoDo(tipo) {
  if (tipo === 'application/pdf') return 'pdf';
  if (tipo === 'image/jpeg') return 'jpg';
  return tipo.split('/')[1];
}

async function baixarMidia(msg, nome, pasta, tiposAceitos, mensagemDeErro, agora) {
  let media = null;
  try {
    media = await msg.downloadMedia();
  } catch (erro) {
    media = null;
  }
  if (!media || !media.data) return { ok: false, msg: 'Não consegui abrir o arquivo. Tenta mandar de novo?' };
  if (!tiposAceitos.includes(media.mimetype)) return { ok: false, msg: mensagemDeErro };

  const hash = crypto.createHash('sha256').update(media.data).digest('hex');
  const nomeDoArquivo = `${agora.data}_${agora.hora.replace(':', 'h')}_${nome}_${hash.slice(0, 6)}.${extensaoDo(media.mimetype)}`;
  fs.mkdirSync(path.join(PASTA_DADOS, pasta), { recursive: true });
  fs.writeFileSync(path.join(PASTA_DADOS, pasta, nomeDoArquivo), Buffer.from(media.data, 'base64'));

  return { ok: true, arquivo: path.join('dados', pasta, nomeDoArquivo), hash, media };
}

function baixarComprovante(msg, nome, agora) {
  return baixarMidia(msg, nome, 'comprovantes', TIPOS_COMPROVANTE, '🧾 O comprovante precisa ser uma foto/print ou um PDF.', agora);
}

function baixarFotoDeContestacao(msg, nome, agora) {
  return baixarMidia(msg, nome, 'contestacoes', TIPOS_FOTO, '📸 A contestação precisa de uma foto.', agora);
}

module.exports = { baixarComprovante, baixarFotoDeContestacao };
