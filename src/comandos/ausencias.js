const {
  proporAusencia, confirmarProposta, rejeitarProposta, cancelarViagem, proporCancelarFerias,
} = require('../casa/ausencias');
const { plural, juntarNomes } = require('../util/texto');
const { periodo } = require('../mensagens');

async function viajo(contexto, pedido) {
  const resultado = proporAusencia(contexto.estado, 'viagem', pedido.nome, pedido.datas[0], pedido.datas[1], pedido.agora);
  if (!resultado.ok) return pedido.responder(resultado.msg);
  contexto.salvar();

  const proposta = resultado.prop;
  const quando = periodo(proposta.inicio, proposta.fim);
  if (resultado.ativa) {
    await contexto.mensageiro.avisarTodas(`✈️ *${pedido.nome}* vai viajar ${quando}. Ela fica fora do rodízio nesses dias (sem compensação na volta).`, pedido.nome);
    return pedido.responder(`✈️ Boa viagem! Você fica fora do rodízio ${quando}. Se voltar antes, mande *voltei*.`);
  }

  // avisou em cima da hora: quem fica em casa precisa concordar
  for (const nome of proposta.precisam) {
    await contexto.mensageiro.enviarPara(nome, `✈️ ${pedido.nome} quer viajar ${quando}, mas avisou com menos de 24h. Você concorda? Responda *confirmo* ou *rejeito*.`);
  }
  const quantas = proposta.precisam.length;
  return pedido.responder(`Como faltam menos de 24h, ${juntarNomes(proposta.precisam)} ${plural(quantas, 'precisa', 'precisam')} confirmar. Já pedi para ${plural(quantas, 'ela', 'elas')}.`);
}

async function voltei(contexto, pedido) {
  const resultado = cancelarViagem(contexto.estado, pedido.nome, pedido.hoje);
  if (!resultado.ok) return pedido.responder(resultado.msg);
  contexto.salvar();
  await contexto.mensageiro.avisarTodas(`🏠 ${pedido.nome} voltou e entra no rodízio a partir de amanhã.`, pedido.nome);
  return pedido.responder('Bem-vinda de volta! Você entra no rodízio a partir de amanhã.');
}

async function ferias(contexto, pedido) {
  const resultado = proporAusencia(contexto.estado, 'ferias', pedido.nome, pedido.datas[0], pedido.datas[1], pedido.agora);
  if (!resultado.ok) return pedido.responder(resultado.msg);
  contexto.salvar();

  const quando = periodo(resultado.prop.inicio, resultado.prop.fim);
  for (const nome of resultado.prop.precisam) {
    if (nome === pedido.nome) continue;
    await contexto.mensageiro.enviarPara(nome, `🏖️ ${pedido.nome} propôs *férias* (casa fechada) ${quando}. Nesse período o bot não manda tarefas nem multas, e as semanas ficam congeladas. Responda *confirmo* ou *rejeito*.`);
  }
  return pedido.responder(`🏖️ Proposta de férias ${quando} enviada. Precisa da confirmação das outras.`);
}

async function cancelar(contexto, pedido) {
  const oQue = pedido.args[0] || '';
  if (oQue.startsWith('viag')) {
    const resultado = cancelarViagem(contexto.estado, pedido.nome, pedido.hoje);
    contexto.salvar();
    return pedido.responder(resultado.ok ? 'Viagem cancelada.' : resultado.msg);
  }
  if (!oQue.startsWith('feria')) return pedido.responder('Use *cancelar ferias* ou *voltei* (para viagem).');

  const resultado = proporCancelarFerias(contexto.estado, pedido.nome, pedido.hoje);
  if (!resultado.ok) return pedido.responder(resultado.msg);
  contexto.salvar();

  let proposta = `cancelar as férias ${periodo(resultado.prop.inicio, resultado.prop.fim)}`;
  if (resultado.comecou) proposta = 'encerrar as férias hoje (amanhã o bot volta, com a faxina de chegada)';
  for (const nome of resultado.prop.precisam) {
    if (nome !== pedido.nome) await contexto.mensageiro.enviarPara(nome, `🏖️ ${pedido.nome} propôs ${proposta}. Responda *confirmo* ou *rejeito*.`);
  }
  return pedido.responder('Proposta enviada. Precisa da confirmação das outras.');
}

async function confirmo(contexto, pedido) {
  const resultado = confirmarProposta(contexto.estado, pedido.nome, pedido.hoje);
  if (!resultado.ok) return pedido.responder(resultado.msg);
  contexto.salvar();
  if (!resultado.ativa) return pedido.responder(`👍 Confirmado. Falta: ${juntarNomes(resultado.falta)}.`);

  const proposta = resultado.prop;
  const quando = periodo(proposta.inicio, proposta.fim);
  let aviso;
  if (proposta.tipo === 'ferias') {
    aviso = `🏖️ *Férias confirmadas* ${quando}! Na véspera tem a faxina de saída e, na volta, a de chegada.`;
  } else if (proposta.tipo === 'cancelarferias') {
    aviso = '🏠 *Férias canceladas/encerradas.* O bot volta a mandar as tarefas.';
  } else {
    aviso = `✈️ *${proposta.autor}* vai viajar ${quando} (confirmado). Ela fica fora do rodízio nesses dias.`;
  }
  await contexto.mensageiro.avisarTodas(aviso);
  if (!contexto.mensageiro.grupoId) return pedido.responder('👍 Confirmado!');
  return null;
}

async function rejeito(contexto, pedido) {
  const resultado = rejeitarProposta(contexto.estado, pedido.nome);
  if (!resultado.ok) return pedido.responder(resultado.msg);
  contexto.salvar();

  const descricao = {
    ferias: 'as férias',
    cancelarferias: 'o cancelamento das férias',
    viagem: 'a viagem em cima da hora',
  };
  const proposta = resultado.prop;
  await contexto.mensageiro.enviarPara(proposta.autor,
    `${pedido.nome} não concordou com ${descricao[proposta.tipo]} ${periodo(proposta.inicio, proposta.fim)}. Conversem e, se mudar, é só propor de novo.`);
  return pedido.responder('Ok, proposta rejeitada.');
}

module.exports = {
  viajo, viagem: viajo, voltei, ferias, cancelar,
  confirmo, confirmado: confirmo, rejeito,
};
