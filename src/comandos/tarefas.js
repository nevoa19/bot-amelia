const { marcarFeita, contestar, proporTroca, aceitarTroca, recusarTroca } = require('../casa/tarefas');
const { reais } = require('../util/texto');
const { baixarFotoDeContestacao } = require('../whatsapp/midia');
const textos = require('../mensagens');
const { acharPessoa } = require('./ajudantes');

async function feito(contexto, pedido) {
  const numeros = [];
  for (const arg of pedido.args) {
    const numero = Number(arg);
    if (numero) numeros.push(numero);
  }
  if (numeros.length === 0) return pedido.responder('Me diga o número da tarefa, ex.: *feito 2*');

  const respostas = [];
  for (const numero of numeros) {
    respostas.push(marcarFeita(contexto.estado, pedido.hoje, pedido.nome, numero, pedido.hora).msg);
  }
  contexto.salvar();
  return pedido.responder(respostas.join('\n'));
}

async function tarefas(contexto, pedido) {
  return pedido.responder(`📋 *${pedido.nome}, hoje:*\n\n${textos.textoDoDia(contexto.estado, pedido.hoje, pedido.nome)}`);
}

async function hoje(contexto, pedido) {
  return pedido.responder(textos.textoGeral(contexto.estado, pedido.hoje));
}

async function trocar(contexto, pedido) {
  const numero = Number(pedido.args[0]);
  const para = acharPessoa(pedido.args[1]);
  const resultado = proporTroca(contexto.estado, pedido.hoje, pedido.nome, numero, para);
  contexto.salvar();
  if (resultado.ok) {
    await contexto.mensageiro.enviarPara(para, `🔁 ${pedido.nome} pediu para você fazer hoje: *${resultado.item.nome}*.\nResponda *aceito* ou *recuso*.`);
  }
  return pedido.responder(resultado.msg);
}

async function aceito(contexto, pedido) {
  const resultado = aceitarTroca(contexto.estado, pedido.hoje, pedido.nome);
  contexto.salvar();
  if (resultado.ok) await contexto.mensageiro.enviarPara(resultado.de, `${pedido.nome} aceitou a troca! ${resultado.msg}`);
  return pedido.responder(resultado.msg);
}

async function recuso(contexto, pedido) {
  const resultado = recusarTroca(contexto.estado, pedido.hoje, pedido.nome);
  if (!resultado.ok) return pedido.responder(resultado.msg);
  contexto.salvar();
  await contexto.mensageiro.enviarPara(resultado.troca.de, `${pedido.nome} não pôde aceitar a troca. A tarefa ${resultado.troca.numero} continua com você.`);
  return pedido.responder('Ok, troca recusada.');
}

// Contestação é anônima: só funciona no privado do bot, e o grupo não fica sabendo quem contestou.
async function contestarTarefa(contexto, pedido) {
  if (pedido.doGrupo) {
    return pedido.responder('🤫 A contestação é anônima: mande no *privado do bot* a foto com a legenda *contestar Nome número*.');
  }
  const alvo = acharPessoa(pedido.args[0]);
  const numero = Number(pedido.args[1]);
  if (!alvo || !numero) return pedido.responder('Use assim, junto com uma foto: *contestar Bia 2*');
  if (!pedido.msg.hasMedia) {
    return pedido.responder(`📸 Para contestar, mande uma *foto* mostrando o que não foi feito, com a legenda *contestar ${alvo} ${numero}*.`);
  }

  const foto = await baixarFotoDeContestacao(pedido.msg, pedido.nome, pedido.agora);
  if (!foto.ok) return pedido.responder(foto.msg);

  const resultado = contestar(contexto.estado, pedido.hoje, pedido.nome, alvo, numero);
  if (!resultado.ok) return pedido.responder(resultado.msg);
  contexto.salvar();

  const aviso = `❗ A tarefa *${numero}. ${resultado.item.nome}* da *${alvo}* foi contestada.\n` +
    `Ela voltou para a lista da ${alvo}. Se não for refeita até 23:59, vira multa (${reais(resultado.item.multa)}). ` +
    `Quando refizer, é só marcar *feito ${numero}* de novo.`;
  await contexto.mensageiro.enviarGrupo(foto.media, { caption: aviso });
  await contexto.mensageiro.enviarPara(alvo, textos.textoListaAtualizada(contexto.estado, pedido.hoje, alvo, numero));
  return pedido.responder(`🤫 Contestação registrada, sem o seu nome. O grupo foi avisado e a tarefa voltou para a lista da ${alvo}.`);
}

module.exports = {
  feito, fiz: feito, feita: feito,
  tarefas, minhas: tarefas,
  hoje,
  trocar, aceito, recuso,
  contestar: contestarTarefa,
};
