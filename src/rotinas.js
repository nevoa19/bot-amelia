// O que o bot faz sozinho, nos horários do config:
//   8h       lista do dia (privado de cada uma + grupo) e rotinas do mês
//   20h/22h  lembrete no privado de quem ainda tem tarefa pendente
//   00:00    fecha o dia que acabou (prazo 23:59): multas e mensagem no grupo
//   domingo  resumo da semana no grupo e cobrança no privado de quem deve
//
// Calendário da caixinha:
//   logo depois do último dia do mês  fecha o mês e manda quanto cada uma deve, já com desconto
//   dia 8 (8h)                        lembrete: vence hoje, ainda com desconto
//   fim do dia 8                      quem não quitou perde o desconto
//   dia 10 (8h)                       nova cobrança, já sem desconto
const { config, nomesDasPessoas } = require('./configuracao');
const { somarDias, mesDe, mesAnterior, ultimoDiaDoMes } = require('./util/datas');
const { gerarDia } = require('./casa/distribuicao');
const { fecharDia } = require('./casa/tarefas');
const { emFerias, estaAusente, limparPropostasVencidas } = require('./casa/ausencias');
const { saldo, pendenteAte, fecharMes, verificarVencimento, descontoDoMes } = require('./casa/caixinha');
const textos = require('./mensagens');

function criarRotinas(contexto) {
  const { estado, mensageiro } = contexto;

  // Se o bot estava desligado na virada do dia, fecha o que ficou aberto.
  function recuperarDiasAbertos() {
    const hoje = contexto.agora().data;
    for (const data in estado.dias) {
      if (data < hoje && !estado.dias[data].fechado) fecharDia(estado, data);
    }
    gerarDia(estado, hoje);
    contexto.salvar();
  }

  async function mensagemDaManha() {
    const hoje = contexto.agora().data;
    limparPropostasVencidas(estado, hoje);
    gerarDia(estado, hoje);
    contexto.salvar();

    await rotinasDoMes(hoje);
    if (emFerias(estado, hoje)) return;

    for (const nome of nomesDasPessoas()) {
      if (estaAusente(estado, nome, hoje)) continue;
      await mensageiro.enviarPara(nome, textos.textoBomDia(estado, hoje, nome));
    }
    await mensageiro.enviarGrupo(textos.textoGeral(estado, hoje));
  }

  async function lembrete() {
    const hoje = contexto.agora().data;
    const dia = gerarDia(estado, hoje);
    for (const nome of nomesDasPessoas()) {
      const pendentes = dia.itens.filter(item => item.pessoa === nome && !item.feita);
      if (pendentes.length > 0) await mensageiro.enviarPara(nome, textos.textoLembrete(nome, pendentes));
    }
  }

  async function fechamento() {
    const hoje = contexto.agora().data;
    const ontem = somarDias(hoje, -1);
    const ontemEraFerias = emFerias(estado, ontem);

    const multasNovas = fecharDia(estado, ontem);
    gerarDia(estado, hoje);
    contexto.salvar();

    if (!ontemEraFerias) await mensageiro.enviarGrupo(textos.textoFechamentoDoDia(estado, multasNovas, ontem));

    // fecha o mês só depois do último dia, para entrarem as multas dele
    if (ontem === ultimoDiaDoMes(mesDe(ontem))) await fecharMesEAvisar(mesDe(ontem));

    // terminou o dia do vencimento: quem não pagou perde o desconto
    if (Number(ontem.slice(8)) === config.regras.diaVencimento) {
      const mes = mesAnterior(mesDe(ontem));
      if (estado.meses[mes] && estado.meses[mes].fechado) {
        verificarVencimento(estado, mes);
        contexto.salvar();
      }
    }
  }

  async function resumoSemanal() {
    const hoje = contexto.agora().data;
    if (emFerias(estado, hoje)) return;
    await mensageiro.enviarGrupo(textos.textoResumoSemanal(estado, hoje));

    // o bot cobra no privado, para nenhuma das meninas precisar cobrar
    const saldos = saldo(estado);
    for (const nome of nomesDasPessoas()) {
      if (saldos[nome] > 0) await mensageiro.enviarPara(nome, textos.textoCobrancaSemanal(nome, saldos[nome]));
    }
  }

  async function fecharMesEAvisar(mes) {
    const relatorios = fecharMes(estado, mes);
    contexto.salvar();
    if (!relatorios) return;

    await mensageiro.avisarTodas(textos.textoFechamentoDoMes(relatorios, mes));
    for (const relatorio of relatorios) {
      if (relatorio.aPagar > 0) await mensageiro.enviarPara(relatorio.pessoa, textos.textoDividaDoMes(relatorio, mes));
    }
  }

  async function lembreteDeVencimento(mes) {
    const fim = ultimoDiaDoMes(mes);
    for (const nome of nomesDasPessoas()) {
      const aPagar = pendenteAte(estado, nome, fim);
      if (aPagar <= 0) continue;
      const semDesconto = pendenteAte(estado, nome, fim, mes);
      await mensageiro.enviarPara(nome, textos.textoVenceHoje(nome, mes, aPagar, semDesconto));
    }
  }

  async function cobrancaSemDesconto(mes) {
    const fim = ultimoDiaDoMes(mes);
    for (const nome of nomesDasPessoas()) {
      const aPagar = pendenteAte(estado, nome, fim);
      if (aPagar <= 0) continue;
      const desconto = descontoDoMes(estado, nome, mes);
      const valorPerdido = desconto && desconto.revogado ? desconto.valor : 0;
      await mensageiro.enviarPara(nome, textos.textoCobrancaSemDesconto(nome, mes, aPagar, valorPerdido));
    }
  }

  async function rotinasDoMes(hoje) {
    const mes = mesAnterior(mesDe(hoje));
    const dia = Number(hoje.slice(8));

    let botRodouNoMes = false;
    for (const data in estado.dias) {
      if (data.startsWith(mes)) botRodouNoMes = true;
    }
    if (!botRodouNoMes) return;

    if (!estado.meses[mes]) estado.meses[mes] = {};
    const controle = estado.meses[mes];
    const { diaVencimento, diaCobranca } = config.regras;

    if (!controle.fechado) await fecharMesEAvisar(mes);

    if (dia > diaVencimento && !controle.prazoChecado) {
      verificarVencimento(estado, mes);
      contexto.salvar();
    }
    if (dia === diaVencimento && !controle.lembrado) {
      controle.lembrado = true;
      contexto.salvar();
      await lembreteDeVencimento(mes);
    }
    if (dia >= diaCobranca && !controle.cobrado) {
      controle.cobrado = true;
      contexto.salvar();
      await cobrancaSemDesconto(mes);
    }
  }

  return { recuperarDiasAbertos, mensagemDaManha, lembrete, fechamento, resumoSemanal, rotinasDoMes };
}

module.exports = { criarRotinas };
