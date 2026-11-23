const { registrarPagamento, comprovanteJaUsado } = require('../casa/caixinha');
const { reais } = require('../util/texto');
const { baixarComprovante } = require('../whatsapp/midia');
const textos = require('../mensagens');
const { aindaValido } = require('./ajudantes');

async function multas(contexto, pedido) {
  return pedido.responder(textos.textoCaixinha(contexto.estado, pedido.hoje));
}

// O comprovante pode vir:
//  1. na própria mensagem (foto com a legenda "paguei 8")
//  2. no privado, numa foto mandada até 15 min antes (o bot já perguntou o valor)
//  3. no grupo, numa foto sem legenda mandada até 15 min antes (o bot ficou quieto e guardou)
async function acharComprovante(contexto, pedido) {
  const { memoria } = contexto;
  if (pedido.msg.hasMedia) return baixarComprovante(pedido.msg, pedido.nome, pedido.agora);

  const doPrivado = memoria.comprovantePendente[pedido.nome];
  if (aindaValido(doPrivado)) return doPrivado;

  const doGrupo = memoria.fotoNoGrupo[pedido.nome];
  if (pedido.doGrupo && aindaValido(doGrupo)) return baixarComprovante(doGrupo.msg, pedido.nome, pedido.agora);

  return null;
}

async function paguei(contexto, pedido) {
  const valor = Number((pedido.args[0] || '').replace(',', '.'));
  if (!valor) return pedido.responder('Me diga o valor, ex.: *paguei 8*');

  const comprovante = await acharComprovante(contexto, pedido);
  if (!comprovante) return pedido.responder('🧾 ' + textos.COMO_PAGAR);
  if (!comprovante.ok) return pedido.responder(comprovante.msg);
  if (comprovanteJaUsado(contexto.estado, comprovante.hash)) {
    return pedido.responder('⚠️ Esse comprovante já foi usado em outro pagamento. Mande o comprovante deste Pix.');
  }

  const resultado = registrarPagamento(contexto.estado, pedido.nome, valor,
    { arquivo: comprovante.arquivo, hash: comprovante.hash }, pedido.hoje);
  if (!resultado.ok) return pedido.responder(resultado.msg);

  delete contexto.memoria.comprovantePendente[pedido.nome];
  delete contexto.memoria.fotoNoGrupo[pedido.nome];
  contexto.salvar();

  let situacao = 'Você *quitou todas as multas*! 🎉 Está zerada.';
  if (resultado.resta > 0) situacao = `Agora você deve *${reais(resultado.resta)}*.`;

  // pagou no grupo: o comprovante já está lá, então o bot só responde em cima da mensagem dela
  if (pedido.doGrupo) return pedido.responder(`✅ Pagamento de ${reais(valor)} registrado, ${pedido.nome}! ${situacao}`);

  // pagou no privado: o comprovante vai para o grupo, para todas verem
  let legenda = `💸 *${pedido.nome}* pagou ${reais(valor)} na caixinha. Segue o comprovante. `;
  if (resultado.resta > 0) legenda += `Ainda deve ${reais(resultado.resta)}.`;
  else legenda += 'Quitou todas as multas! ✅';
  await contexto.mensageiro.enviarGrupo(comprovante.media, { caption: legenda });
  return pedido.responder(`✅ Pagamento de ${reais(valor)} registrado com comprovante. ${situacao}`);
}

module.exports = { multas, caixinha: multas, saldo: multas, paguei };
