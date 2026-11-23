// Dinheiro: multas, pagamentos, créditos, descontos e anistia.
//
// Saldo de cada pessoa = multas - pagamentos - créditos.
// Positivo: ela deve. Negativo: tem crédito, que abate as próximas multas.
const { config, nomesDasPessoas } = require('../configuracao');
const { somarDias, ultimoDiaDoMes, mesAnterior, nomeDoMes, ultimoDomingoAte } = require('../util/datas');
const { arredondar, reais, plural } = require('../util/texto');
const { estaAusente } = require('./ausencias');

function saldo(estado) {
  const saldos = {};
  for (const nome of nomesDasPessoas()) saldos[nome] = 0;

  for (const multa of estado.multas) saldos[multa.pessoa] += multa.valor;
  for (const pagamento of estado.pagamentos) saldos[pagamento.pessoa] -= pagamento.valor;
  for (const credito of estado.creditos) {
    if (!credito.revogado) saldos[credito.pessoa] -= credito.valor;
  }

  for (const nome in saldos) saldos[nome] = arredondar(saldos[nome]);
  return saldos;
}

// Quanto ainda falta pagar das multas geradas até `fim`.
// Pagamentos e créditos abatem primeiro as multas mais antigas.
// Com `semDescontoDe`, faz a conta como se o desconto daquele mês não existisse.
function pendenteAte(estado, pessoa, fim, semDescontoDe) {
  let devido = 0;
  for (const multa of estado.multas) {
    if (multa.pessoa === pessoa && multa.data <= fim) devido += multa.valor;
  }
  let abatido = 0;
  for (const pagamento of estado.pagamentos) {
    if (pagamento.pessoa === pessoa) abatido += pagamento.valor;
  }
  for (const credito of estado.creditos) {
    if (credito.pessoa !== pessoa || credito.revogado) continue;
    if (semDescontoDe && credito.tipo === 'desconto' && credito.mes === semDescontoDe) continue;
    abatido += credito.valor;
  }
  return Math.max(0, arredondar(devido - abatido));
}

function comprovanteJaUsado(estado, hash) {
  for (const pagamento of estado.pagamentos) {
    if (pagamento.comprovante && pagamento.comprovante.hash === hash) return true;
  }
  return false;
}

// Só é chamado com comprovante: quem garante isso é o comando "paguei".
function registrarPagamento(estado, pessoa, valor, comprovante, data) {
  const devido = saldo(estado)[pessoa];
  if (devido <= 0) return { ok: false, msg: 'Você não tem nenhuma multa em aberto. 🎉' };
  if (valor > devido + 0.001) return { ok: false, msg: `Você deve ${reais(devido)}. Confira o valor e mande de novo.` };
  estado.pagamentos.push({ pessoa, valor, comprovante, data });
  return { ok: true, resta: saldo(estado)[pessoa] };
}

// Dá crédito sem deixar ninguém passar do teto (R$ 15). O que sobra fica na caixinha.
function concederCredito(estado, pessoa, valor, motivo, extra = {}) {
  const saldoAtual = saldo(estado)[pessoa];
  const cabe = Math.max(0, saldoAtual + config.regras.creditoMaximo);
  const dado = arredondar(Math.min(valor, cabe));
  if (dado > 0) estado.creditos.push({ pessoa, valor: dado, motivo, ...extra });
  return { dado, cortado: arredondar(valor - dado) };
}

function multasNoPeriodo(estado, pessoa, inicio, fim) {
  let total = 0;
  for (const multa of estado.multas) {
    if (multa.pessoa === pessoa && multa.data >= inicio && multa.data <= fim) total += multa.valor;
  }
  return arredondar(total);
}

// Um período (semana ou mês) é:
//   'suja'      se a pessoa levou alguma multa nele
//   'neutra'    se ela ficou pouco tempo em casa (viagem/férias): não conta nem quebra sequência
//   'limpa'     caso contrário
//   'sem-dados' se o bot ainda não rodava nessa época
function statusDoPeriodo(estado, pessoa, inicio, fim, minimoDeDiasEmCasa) {
  let temDados = false;
  let diasEmCasa = 0;
  for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
    if (!estado.dias[data]) continue;
    temDados = true;
    if (!estaAusente(estado, pessoa, data)) diasEmCasa++;
  }
  if (!temDados) return 'sem-dados';
  if (multasNoPeriodo(estado, pessoa, inicio, fim) > 0) return 'suja';
  if (diasEmCasa >= minimoDeDiasEmCasa) return 'limpa';
  return 'neutra';
}

// semana de segunda a domingo
function statusDaSemana(estado, pessoa, domingo) {
  return statusDoPeriodo(estado, pessoa, somarDias(domingo, -6), domingo, config.regras.diasMinSemana);
}

function statusDoMes(estado, pessoa, mes) {
  return statusDoPeriodo(estado, pessoa, mes + '-01', ultimoDiaDoMes(mes), config.regras.diasMinMes);
}

// Semanas limpas seguidas, de trás para frente a partir da última semana completa até `data`.
function sequenciaDeSemanasLimpas(estado, pessoa, data) {
  let sequencia = 0;
  let domingo = ultimoDomingoAte(data);
  for (let i = 0; i < 104; i++) {
    const status = statusDaSemana(estado, pessoa, domingo);
    if (status === 'limpa') sequencia++;
    else if (status !== 'neutra') break;
    domingo = somarDias(domingo, -7);
  }
  return sequencia;
}

// 1 semana = 20%, 2 = 35%, 3 ou mais = 50%
function percentualDeDesconto(semanas) {
  const descontos = config.regras.descontos;
  if (semanas <= 0) return 0;
  return descontos[Math.min(semanas, descontos.length) - 1];
}

function descontoDoMes(estado, pessoa, mes) {
  for (const credito of estado.creditos) {
    if (credito.pessoa === pessoa && credito.tipo === 'desconto' && credito.mes === mes) return credito;
  }
  return null;
}

// Anistia: quem fecha o 2º mês limpo seguido recebe de volta, em crédito, o que PAGOU
// de multas no mês anterior à sequência. Só vale se aquelas multas foram quitadas,
// e o desconto que ela já ganhou naquele mês sai da devolução.
function calcularAnistia(estado, pessoa, mes, relatorio) {
  if (statusDoMes(estado, pessoa, mes) !== 'limpa') return;

  let mesesLimpos = 0;
  let mesQueQuebrou = null;
  let mesVerificado = mes;
  for (let i = 0; i < 36; i++) {
    const status = statusDoMes(estado, pessoa, mesVerificado);
    if (status === 'limpa') {
      mesesLimpos++;
    } else if (status !== 'neutra') {
      if (status === 'suja') mesQueQuebrou = mesVerificado;
      break;
    }
    mesVerificado = mesAnterior(mesVerificado);
  }
  if (mesesLimpos !== 2 || !mesQueQuebrou) return;

  relatorio.anistiaMes = mesQueQuebrou;
  const fimDoMesSujo = ultimoDiaDoMes(mesQueQuebrou);
  if (pendenteAte(estado, pessoa, fimDoMesSujo) > 0) {
    relatorio.anistiaPerdida = true;
    return;
  }

  let descontoRecebido = 0;
  const desconto = descontoDoMes(estado, pessoa, mesQueQuebrou);
  if (desconto && !desconto.revogado) descontoRecebido = desconto.valor;

  const pagoDeVerdade = arredondar(multasNoPeriodo(estado, pessoa, mesQueQuebrou + '-01', fimDoMesSujo) - descontoRecebido);
  const resultado = concederCredito(estado, pessoa, pagoDeVerdade,
    `Anistia: 2 meses limpos seguidos, devolução do que foi pago de multas em ${nomeDoMes(mesQueQuebrou)}`,
    { tipo: 'anistia', mes });
  relatorio.anistia = resultado.dado;
  relatorio.anistiaCortada = resultado.cortado;
}

// Roda logo depois do último dia do mês: aplica descontos e anistias e calcula quanto cada uma vai pagar.
function fecharMes(estado, mes) {
  if (!estado.meses[mes]) estado.meses[mes] = {};
  const controle = estado.meses[mes];
  if (controle.fechado) return null;

  const fim = ultimoDiaDoMes(mes);
  const relatorios = [];
  for (const pessoa of nomesDasPessoas()) {
    const relatorio = { pessoa, multasMes: multasNoPeriodo(estado, pessoa, mes + '-01', fim) };
    relatorio.semanas = sequenciaDeSemanasLimpas(estado, pessoa, fim);
    relatorio.pct = relatorio.multasMes > 0 ? percentualDeDesconto(relatorio.semanas) : 0;

    if (relatorio.pct > 0) {
      const semanas = relatorio.semanas;
      const resultado = concederCredito(estado, pessoa, arredondar(relatorio.multasMes * relatorio.pct / 100),
        `Desconto de ${relatorio.pct}% nas multas de ${nomeDoMes(mes)} (${semanas} ${plural(semanas, 'semana limpa', 'semanas limpas')})`,
        { tipo: 'desconto', mes });
      relatorio.desconto = resultado.dado;
      relatorio.descontoCortado = resultado.cortado;
    }

    calcularAnistia(estado, pessoa, mes, relatorio);

    relatorio.saldo = saldo(estado)[pessoa];
    relatorio.aPagar = pendenteAte(estado, pessoa, fim);
    relatorio.semDesconto = pendenteAte(estado, pessoa, fim, mes);
    relatorios.push(relatorio);
  }
  controle.fechado = true;
  return relatorios;
}

// Depois do vencimento: quem não quitou as multas do mês perde o desconto daquele mês.
// Quem tinha crédito suficiente para abater tudo já está quitada e mantém o desconto.
function verificarVencimento(estado, mes) {
  if (!estado.meses[mes]) estado.meses[mes] = {};
  const controle = estado.meses[mes];
  if (controle.prazoChecado) return null;

  const perderam = [];
  for (const pessoa of nomesDasPessoas()) {
    const desconto = descontoDoMes(estado, pessoa, mes);
    if (!desconto || desconto.revogado) continue;
    if (pendenteAte(estado, pessoa, ultimoDiaDoMes(mes)) > 0) {
      desconto.revogado = true;
      perderam.push({ pessoa, valor: desconto.valor });
    }
  }
  controle.prazoChecado = true;
  return perderam;
}

module.exports = {
  saldo, pendenteAte, comprovanteJaUsado, registrarPagamento, concederCredito,
  statusDaSemana, statusDoMes, sequenciaDeSemanasLimpas, percentualDeDesconto,
  descontoDoMes, fecharMes, verificarVencimento,
};
