// Recebe cada mensagem do WhatsApp, descobre quem mandou e chama o comando certo.
// O texto é comparado sem acento e em minúsculas, então "Férias" e "ferias" funcionam igual.
const { semAcento } = require('../util/texto');
const { quemMandou } = require('../whatsapp/remetente');
const { baixarComprovante } = require('../whatsapp/midia');
const { textoAjuda } = require('../mensagens');

const COMANDOS = {
  ...require('./tarefas'),
  ...require('./caixinha'),
  ...require('./ausencias'),
};

function criarTratador(contexto) {
  // memória curta (não vai para o estado.json): fotos que podem virar comprovante
  contexto.memoria = { comprovantePendente: {}, fotoNoGrupo: {} };

  async function guardarPossivelComprovante(msg, nome, doGrupo, agora) {
    if (doGrupo) {
      contexto.memoria.fotoNoGrupo[nome] = { msg, quando: Date.now() };
      return;
    }
    const comprovante = await baixarComprovante(msg, nome, agora);
    if (!comprovante.ok) return msg.reply(comprovante.msg);
    contexto.memoria.comprovantePendente[nome] = { ...comprovante, quando: Date.now() };
    return msg.reply('🧾 Recebi o comprovante! Quanto você pagou? Responda, por exemplo, *paguei 8*.\n\n_(Se era para contestar uma tarefa, mande a foto de novo com a legenda *contestar Nome número*.)_');
  }

  return async function tratarMensagem(msg) {
    if (msg.fromMe) return;
    if (!msg.body && !msg.hasMedia) return;

    const nome = await quemMandou(msg);
    if (!nome) return; // não é da casa

    const doGrupo = msg.from.endsWith('@g.us');
    if (doGrupo && !contexto.mensageiro.ehOGrupo(msg.from)) return; // outro grupo

    const agora = contexto.agora();
    const texto = semAcento(msg.body || '');
    const [comando, ...args] = texto.split(/\s+/);

    if (msg.hasMedia && comando !== 'paguei' && comando !== 'contestar') {
      return guardarPossivelComprovante(msg, nome, doGrupo, agora);
    }

    const pedido = {
      msg, nome, doGrupo, args,
      datas: args.filter(arg => /\d/.test(arg)),
      agora, hoje: agora.data, hora: agora.hora,
      responder: resposta => msg.reply(resposta),
    };

    if (COMANDOS[comando]) return COMANDOS[comando](contexto, pedido);
    if (comando === 'ajuda' || comando === 'menu') return pedido.responder(textoAjuda());
    // no privado, qualquer outra coisa mostra a ajuda; no grupo o bot fica quieto
    if (!doGrupo) return pedido.responder(textoAjuda());
  };
}

module.exports = { criarTratador };
