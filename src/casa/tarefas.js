// O que acontece com as tarefas ao longo do dia: marcar como feita, contestar, trocar e fechar o dia.
const { config, nomesDasPessoas } = require('../configuracao');
const { gerarDia } = require('./distribuicao');
const { estaAusente } = require('./ausencias');
const { plural } = require('../util/texto');

function acharItem(dia, numero) {
  for (const item of dia.itens) {
    if (item.n === numero) return item;
  }
  return null;
}

function textoDoQueFalta(dia, pessoa) {
  const faltam = [];
  for (const item of dia.itens) {
    if (item.pessoa === pessoa && !item.feita) faltam.push(item.n);
  }
  if (faltam.length === 0) return '🎉 Você terminou tudo de hoje!';
  return `${plural(faltam.length, 'Falta', 'Faltam')} ${faltam.length}: ${faltam.join(', ')}.`;
}

function marcarFeita(estado, data, pessoa, numero, hora) {
  const dia = gerarDia(estado, data);
  const item = acharItem(dia, numero);
  if (!item) return { ok: false, msg: `Não achei a tarefa ${numero} de hoje.` };
  if (item.pessoa !== pessoa) return { ok: false, msg: `A tarefa ${numero} é da ${item.pessoa}, não sua. 😉` };
  if (item.feita) return { ok: false, msg: `A tarefa ${numero} já está marcada como feita.` };
  // a louça só vale depois da janta, senão dava para lavar a do café e deixar a da noite
  if (item.liberarApos && hora < item.liberarApos) {
    return { ok: false, msg: `🍽️ A louça só pode ser marcada depois das ${item.liberarApos} (para valer a do dia inteiro, inclusive a janta).` };
  }
  item.feita = true;
  item.feitaEm = hora;
  return { ok: true, msg: `✅ ${item.nome}: feito! ${textoDoQueFalta(dia, pessoa)}` };
}

// Alguém marcou "feito" sem fazer. A tarefa volta para pendente e, se não for refeita até 23:59, vira multa.
// Quem contestou fica guardado só no estado: nas mensagens a contestação é anônima.
function contestar(estado, data, quem, alvo, numero) {
  const dia = gerarDia(estado, data);
  const item = acharItem(dia, numero);
  if (!alvo || alvo === quem) return { ok: false, msg: 'Diga de quem é a tarefa, ex.: *contestar Bia 2*.' };
  if (!item || item.pessoa !== alvo) return { ok: false, msg: `A tarefa ${numero} de hoje não é da ${alvo}. Confira com *hoje*.` };
  if (!item.feita) return { ok: false, msg: `A tarefa ${numero} ainda nem foi marcada como feita.` };
  item.feita = false;
  item.feitaEm = undefined;
  item.contestadaPor = quem;
  return { ok: true, item };
}

// Tudo o que não foi feito vira multa. Se a tarefa já vinha atrasada, a multa dobra
// (só dobra uma vez, para não virar uma dívida que ninguém paga).
function fecharDia(estado, data) {
  const dia = gerarDia(estado, data);
  if (dia.fechado) return [];

  const multasNovas = [];
  for (const item of dia.itens) {
    if (item.feita) continue;
    let valor = item.multa;
    if (item.nivel) valor = item.multa * config.multiplicadorReincidencia;

    let motivo = item.nome;
    if (item.atrasada) motivo += ' (atrasada de novo)';
    if (item.contestadaPor) motivo += ' (contestada)';

    const multa = { pessoa: item.pessoa, valor, motivo, data };
    estado.multas.push(multa);
    multasNovas.push(multa);
  }
  dia.fechado = true;
  return multasNovas;
}

function proporTroca(estado, data, de, numero, para) {
  const item = acharItem(gerarDia(estado, data), numero);
  if (!item || item.pessoa !== de) return { ok: false, msg: `A tarefa ${numero} não é sua hoje.` };
  if (item.tipo === 'individual') return { ok: false, msg: 'A louça é individual, não dá para trocar. 😅' };
  if (item.atrasada) return { ok: false, msg: 'Tarefa atrasada não pode ser trocada: ela é sua até ser feita. 😉' };
  if (!nomesDasPessoas().includes(para) || para === de) return { ok: false, msg: 'Não entendi com quem você quer trocar.' };
  if (estaAusente(estado, para, data)) return { ok: false, msg: `A ${para} está viajando hoje.` };

  estado.trocas = estado.trocas.filter(t => !(t.data === data && t.numero === numero));
  estado.trocas.push({ data, numero, de, para });
  return { ok: true, msg: `Pedido enviado para ${para}.`, item };
}

function acharTrocaPara(estado, data, quem) {
  for (const troca of estado.trocas) {
    if (troca.data === data && troca.para === quem) return troca;
  }
  return null;
}

function aceitarTroca(estado, data, quem) {
  const troca = acharTrocaPara(estado, data, quem);
  if (!troca) return { ok: false, msg: 'Você não tem nenhum pedido de troca pendente hoje.' };

  const item = acharItem(gerarDia(estado, data), troca.numero);
  item.pessoa = quem;
  // os pontos acompanham quem realmente fez
  estado.carga[troca.de] -= item.pontos;
  estado.carga[quem] += item.pontos;
  estado.trocas = estado.trocas.filter(t => t !== troca);
  return { ok: true, msg: `🔁 Combinado! "${item.nome}" agora é da ${quem}.`, de: troca.de };
}

function recusarTroca(estado, data, quem) {
  const troca = acharTrocaPara(estado, data, quem);
  if (!troca) return { ok: false, msg: 'Você não tem pedido de troca pendente.' };
  estado.trocas = estado.trocas.filter(t => t !== troca);
  return { ok: true, troca };
}

module.exports = { acharItem, marcarFeita, contestar, fecharDia, proporTroca, aceitarTroca, recusarTroca };
