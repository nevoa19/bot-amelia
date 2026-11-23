// Para onde as mensagens vão: privado de cada pessoa ou grupo da casa.
// Os ids do WhatsApp só existem depois que o cliente conecta, por isso o preparar().
const { config } = require('../configuracao');
const { log } = require('../util/log');

function criarMensageiro(client) {
  const mensageiro = {
    idPorNome: {},
    grupoId: null,
  };

  async function enviar(destino, conteudo, opcoes) {
    try {
      await client.sendMessage(destino, conteudo, opcoes);
    } catch (erro) {
      log('Erro ao enviar para', destino, erro.message);
    }
  }

  mensageiro.preparar = async function () {
    for (const pessoa of config.pessoas) {
      const id = await client.getNumberId(pessoa.telefone).catch(() => null);
      if (id) mensageiro.idPorNome[pessoa.nome] = id._serialized;
      else log(`⚠️  Não achei WhatsApp para ${pessoa.nome} (${pessoa.telefone}). Confira o número no config.js.`);
    }

    if (config.grupoNome) {
      const conversas = await client.getChats();
      for (const conversa of conversas) {
        if (conversa.isGroup && conversa.name === config.grupoNome) mensageiro.grupoId = conversa.id._serialized;
      }
      if (!mensageiro.grupoId) log(`⚠️  Grupo "${config.grupoNome}" não encontrado.`);
    }
    if (!mensageiro.grupoId) {
      log('⚠️  Sem grupo configurado: a lista do dia, o "feito", as contestações e o fechamento acontecem no grupo. Preencha grupoNome no config.js.');
    }
  };

  mensageiro.enviarPara = async function (nome, conteudo, opcoes) {
    const id = mensageiro.idPorNome[nome];
    if (id) await enviar(id, conteudo, opcoes);
  };

  mensageiro.enviarGrupo = async function (conteudo, opcoes) {
    if (mensageiro.grupoId) await enviar(mensageiro.grupoId, conteudo, opcoes);
  };

  // Sem grupo configurado, o aviso vai no privado de cada uma.
  mensageiro.avisarTodas = async function (texto, exceto) {
    if (mensageiro.grupoId) {
      await mensageiro.enviarGrupo(texto);
      return;
    }
    for (const pessoa of config.pessoas) {
      if (pessoa.nome !== exceto) await mensageiro.enviarPara(pessoa.nome, texto);
    }
  };

  mensageiro.ehOGrupo = function (chatId) {
    return chatId === mensageiro.grupoId;
  };

  return mensageiro;
}

module.exports = { criarMensageiro };
