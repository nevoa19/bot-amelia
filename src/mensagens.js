// Textos que o bot manda. Ficam todos aqui para ficar fácil mudar o jeito de falar sem mexer nas regras.
// (o WhatsApp entende *negrito* e _itálico_)
const { config, nomesDasPessoas } = require('./configuracao');
const { somarDias, diaEMes, nomeDoDiaDaSemana, nomeDoMes, ultimoDiaDoMes, mesDe, ultimoDomingoAte } = require('./util/datas');
const { reais, plural, juntarNomes } = require('./util/texto');
const { gerarDia } = require('./casa/distribuicao');
const { estaAusente } = require('./casa/ausencias');
const { saldo, statusDaSemana, sequenciaDeSemanasLimpas, percentualDeDesconto } = require('./casa/caixinha');

const COMO_PAGAR = 'Para dar baixa, mande a *foto/print ou PDF do comprovante* com a legenda *paguei 8* (com o valor que você pagou).';

function nomeDeExemplo() {
  const nomes = nomesDasPessoas();
  return nomes[1] || nomes[0];
}

function textoPix() {
  const { chavePix, titular } = config.caixinha;
  if (!chavePix) return '';
  let texto = `\n\n💳 Pix da caixinha: *${chavePix}*`;
  if (titular) texto += ` (${titular})`;
  return texto;
}

function textoSaldo(valor) {
  if (valor > 0) return `deve ${reais(valor)}`;
  if (valor < 0) return `tem ${reais(-valor)} de crédito`;
  return 'está em dia';
}

function periodo(inicio, fim) {
  if (inicio === fim) return `dia ${diaEMes(inicio)}`;
  return `de ${diaEMes(inicio)} a ${diaEMes(fim)}`;
}

// ---------- tarefas do dia ----------

function textoDoDia(estado, data, pessoa) {
  const dia = gerarDia(estado, data);
  if (dia.ferias) return '🏖️ _férias, casa fechada_';
  if (estaAusente(estado, pessoa, data)) return '✈️ _viajando_';

  const linhas = [];
  for (const item of dia.itens) {
    if (item.pessoa !== pessoa) continue;
    let linha = `${item.feita ? '✅' : '▫️'} *${item.n}.* ${item.nome}`;
    if (item.atrasada) linha += ' ⚠️ _atrasada: multa em dobro se ficar de novo_';
    if (item.contestadaPor) linha += ' ❗ _contestada: refaça até 23:59_';
    if (item.liberarApos) linha += ` _(marcar após ${item.liberarApos})_`;
    linhas.push(linha);
  }
  if (linhas.length === 0) return '_nada hoje_';
  return linhas.join('\n');
}

function textoGeral(estado, data) {
  let texto = `🏠 *Tarefas de ${nomeDoDiaDaSemana(data)}, ${diaEMes(data)}*\n`;
  for (const nome of nomesDasPessoas()) {
    texto += `\n*${nome}*\n${textoDoDia(estado, data, nome)}\n`;
  }
  texto += '\nPara marcar: mande *feito 3* aqui no grupo (ou *feito 1 4*). Prazo: 23:59. Digite *ajuda* para ver os comandos.';
  return texto;
}

function textoSequencia(estado, pessoa, data) {
  const semanas = sequenciaDeSemanasLimpas(estado, pessoa, data);
  if (semanas === 0) return '';
  const atual = percentualDeDesconto(semanas);
  const proximo = percentualDeDesconto(semanas + 1);
  let texto = `🔥 ${semanas} ${plural(semanas, 'semana limpa seguida', 'semanas limpas seguidas')} (desconto de ${atual}%`;
  if (proximo > atual) texto += `; mais uma e vai para ${proximo}%)`;
  else texto += ', o máximo!)';
  return texto;
}

function primeiroNumeroDaPessoa(estado, data, pessoa) {
  for (const item of gerarDia(estado, data).itens) {
    if (item.pessoa === pessoa) return item.n;
  }
  return 1;
}

function textoBomDia(estado, data, pessoa) {
  let texto = `☀️ Bom dia, ${pessoa}! Suas tarefas de hoje:\n\n${textoDoDia(estado, data, pessoa)}\n\n`;
  texto += `Quando terminar, marque *no grupo*: *feito ${primeiroNumeroDaPessoa(estado, data, pessoa)}*. Prazo: 23:59.`;
  const sequencia = textoSequencia(estado, pessoa, data);
  if (sequencia) texto += `\n\n${sequencia}`;
  return texto;
}

function textoLembrete(pessoa, pendentes) {
  let texto = `⏰ ${pessoa}, ainda ${plural(pendentes.length, 'falta', 'faltam')}:\n\n`;
  const linhas = [];
  for (const item of pendentes) {
    linhas.push(`▫️ *${item.n}.* ${item.nome} (multa ${reais(item.multa)})`);
  }
  texto += linhas.join('\n');
  texto += `\n\nO prazo é 23:59. Quando fizer, marque no grupo: *feito ${pendentes[0].n}*.`;
  return texto;
}

function textoListaAtualizada(estado, data, pessoa, numero) {
  return `📋 ${pessoa}, sua lista de hoje foi atualizada:\n\n${textoDoDia(estado, data, pessoa)}\n\nQuando terminar, marque no grupo: *feito ${numero}*.`;
}

function textoFechamentoDoDia(estado, multasNovas, data) {
  if (multasNovas.length === 0) return '🌙 Tudo foi feito hoje, parabéns! 👏 Boa noite, meninas 💛';

  let texto = '🌙 *Fechamento do dia: ficou para trás*\n';
  const fizeramTudo = [];
  for (const nome of nomesDasPessoas()) {
    const daPessoa = multasNovas.filter(m => m.pessoa === nome);
    if (daPessoa.length === 0) {
      if (!estaAusente(estado, nome, data)) fizeramTudo.push(nome);
      continue;
    }
    texto += `\n*${nome}*\n`;
    for (const multa of daPessoa) {
      texto += `• ${multa.motivo}: multa ${reais(multa.valor)}\n`;
    }
  }
  if (fizeramTudo.length > 0) {
    texto += `\n✅ ${juntarNomes(fizeramTudo)} ${plural(fizeramTudo.length, 'fez', 'fizeram')} tudo!`;
  }
  texto += '\n\nAs tarefas da casa que ficaram continuam com a mesma pessoa amanhã (se ficarem de novo, a multa dobra). Boa noite! 🌙';
  return texto;
}

function textoResumoSemanal(estado, data) {
  const saldos = saldo(estado);
  const inicioDaSemana = somarDias(data, -6);

  const cumprimento = {};
  for (const nome of nomesDasPessoas()) cumprimento[nome] = { feitas: 0, total: 0 };
  for (const dataDoDia in estado.dias) {
    if (dataDoDia < inicioDaSemana || dataDoDia > data) continue;
    for (const item of estado.dias[dataDoDia].itens) {
      cumprimento[item.pessoa].total++;
      if (item.feita) cumprimento[item.pessoa].feitas++;
    }
  }

  let texto = '📊 *Resumo da semana*\n';
  for (const nome of nomesDasPessoas()) {
    const { feitas, total } = cumprimento[nome];
    let linha = `\n*${nome}*: `;
    if (total > 0) linha += `${feitas}/${total} tarefas (${Math.round(100 * feitas / total)}%)`;
    else linha += 'viajou';
    linha += `, ${textoSaldo(saldos[nome])}`;
    if (statusDaSemana(estado, nome, ultimoDomingoAte(data)) === 'limpa') linha += ' ✨';
    texto += linha;

    const sequencia = textoSequencia(estado, nome, data);
    if (sequencia) texto += `\n   ${sequencia}`;
  }
  return texto;
}

function textoCaixinha(estado, data) {
  const saldos = saldo(estado);
  let texto = '💰 *Caixinha*\n';
  for (const nome of nomesDasPessoas()) {
    texto += `\n*${nome}*: ${textoSaldo(saldos[nome])}`;
    const sequencia = textoSequencia(estado, nome, data);
    if (sequencia) texto += `\n   ${sequencia}`;
  }
  const { creditoMaximo, descontos } = config.regras;
  texto += `\n\n_Crédito máximo: ${reais(creditoMaximo)}. Descontos: ${descontos.join('%, ')}% por 1, 2 e 3+ semanas limpas seguidas._`;
  return texto;
}

// ---------- caixinha: calendário do mês ----------

// '2026-11' -> '08/12'
function vencimentoDoMes(mes) {
  const mesSeguinte = mesDe(somarDias(ultimoDiaDoMes(mes), 1));
  return `${String(config.regras.diaVencimento).padStart(2, '0')}/${mesSeguinte.slice(5)}`;
}

function textoFechamentoDoMes(relatorios, mes) {
  let texto = `📅 *Fechamento de ${nomeDoMes(mes)}*\n`;
  for (const r of relatorios) {
    texto += `\n*${r.pessoa}*: ${r.multasMes ? `${reais(r.multasMes)} em multas` : 'nenhuma multa! 🌟'}`;
    if (r.desconto) {
      texto += `\n   🎁 desconto de ${r.pct}% (${r.semanas} ${plural(r.semanas, 'semana limpa', 'semanas limpas')}): -${reais(r.desconto)}`;
    }
    if (r.anistia) {
      texto += `\n   🏆 2 meses limpos! ${reais(r.anistia)} do que foi pago em multas de ${nomeDoMes(r.anistiaMes)} voltaram como crédito`;
    }
    if (r.anistiaPerdida) {
      texto += `\n   😕 2 meses limpos, mas as multas de ${nomeDoMes(r.anistiaMes)} não foram pagas, então não tem devolução`;
    }
    const cortado = (r.descontoCortado || 0) + (r.anistiaCortada || 0);
    if (cortado > 0) {
      texto += `\n   _(${reais(cortado)} ficaram na caixinha: o crédito máximo é ${reais(config.regras.creditoMaximo)})_`;
    }
    if (r.aPagar > 0) texto += `\n   👉 *a pagar: ${reais(r.aPagar)}*`;
    else texto += '\n   ✅ nada a pagar' + (r.saldo < 0 ? ` (${reais(-r.saldo)} de crédito)` : '');
  }
  texto += `\n\nVencimento: *${vencimentoDoMes(mes)}*. Quem não pagar até lá perde o desconto do mês.`;
  return texto;
}

function textoDividaDoMes(relatorio, mes) {
  let texto = `📅 ${relatorio.pessoa}, suas multas de ${nomeDoMes(mes)} ficaram em *${reais(relatorio.aPagar)}*`;
  if (relatorio.semDesconto > relatorio.aPagar) texto += ` (já com o desconto; sem ele seriam ${reais(relatorio.semDesconto)})`;
  texto += `. Vencimento: *${vencimentoDoMes(mes)}*.` + textoPix() + `\n\n${COMO_PAGAR}`;
  return texto;
}

function textoVenceHoje(pessoa, mes, aPagar, semDesconto) {
  let texto = `⏳ ${pessoa}, *vence hoje*: ${reais(aPagar)} das multas de ${nomeDoMes(mes)}.`;
  if (semDesconto > aPagar) texto += ` Se não pagar até 23:59, você perde o desconto e passa a dever ${reais(semDesconto)}.`;
  return texto + textoPix() + `\n\n${COMO_PAGAR}`;
}

function textoCobrancaSemDesconto(pessoa, mes, aPagar, descontoPerdido) {
  let texto = `💰 ${pessoa}, as multas de ${nomeDoMes(mes)} não foram pagas até o dia ${config.regras.diaVencimento}`;
  if (descontoPerdido) texto += `, então o desconto de ${reais(descontoPerdido)} foi cancelado`;
  return texto + `. Valor atualizado: *${reais(aPagar)}*.` + textoPix() + `\n\n${COMO_PAGAR}`;
}

function textoCobrancaSemanal(pessoa, valor) {
  return `💰 ${pessoa}, você tem ${reais(valor)} de multas em aberto na caixinha.` + textoPix() + `\n\n${COMO_PAGAR}`;
}

// ---------- ajuda ----------

function textoAjuda() {
  const exemplo = nomeDeExemplo();
  return `🤖 *Comandos do bot da casa*

*Tarefas* (no grupo)
*feito 2*: marca a tarefa 2 como feita (pode várias: *feito 1 3*)
*tarefas*: suas tarefas de hoje
*hoje*: tarefas de todo mundo
*trocar 2 ${exemplo}*: pede para a ${exemplo} fazer sua tarefa 2 hoje
*aceito* / *recuso*: responde a um pedido de troca

*Contestação* (no privado do bot, anônima)
*contestar ${exemplo} 2* com uma *foto*: quando alguém marcou feito sem fazer

*Caixinha*
*multas*: saldo, créditos e sequência de cada uma
*paguei 8* com a foto/PDF do comprovante: dá baixa de R$ 8

*Viagens e férias*
*viajo 14/11 a 17/11*: avisa que vai viajar (com 24h de antecedência vale na hora)
*voltei*: voltou antes ou desistiu da viagem
*ferias 20/12 a 15/01*: propõe férias (casa fechada; todas confirmam)
*cancelar ferias*: propõe cancelar ou encerrar as férias
*confirmo* / *rejeito*: responde a uma proposta

*ajuda*: esta mensagem`;
}

module.exports = {
  COMO_PAGAR, textoPix, textoSaldo, periodo,
  textoDoDia, textoGeral, textoSequencia, textoBomDia, textoLembrete, textoListaAtualizada,
  textoFechamentoDoDia, textoResumoSemanal, textoCaixinha,
  vencimentoDoMes, textoFechamentoDoMes, textoDividaDoMes, textoVenceHoje, textoCobrancaSemDesconto, textoCobrancaSemanal,
  textoAjuda,
};
