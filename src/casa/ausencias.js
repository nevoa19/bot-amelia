// Férias (casa fechada) e viagens individuais.
//  - Férias precisam da confirmação das três e de 2 dias de antecedência (para dar tempo da faxina de saída).
//  - Viagem avisada com 24h+ de antecedência vale na hora. Em cima da hora, quem fica em casa confirma.
//  - Nada disso vale para o dia de hoje, que já foi montado.
const { nomesDasPessoas } = require('../configuracao');
const { somarDias, diasEntre, lerData } = require('../util/datas');

function emFerias(estado, data) {
  for (const ferias of estado.ferias) {
    if (data >= ferias.inicio && data <= ferias.fim) return true;
  }
  return false;
}

function estaViajando(estado, pessoa, data) {
  for (const viagem of estado.ausencias) {
    if (viagem.pessoa === pessoa && data >= viagem.inicio && data <= viagem.fim) return true;
  }
  return false;
}

function estaAusente(estado, pessoa, data) {
  return emFerias(estado, data) || estaViajando(estado, pessoa, data);
}

function pessoasEmCasa(estado, data) {
  const emCasa = [];
  for (const nome of nomesDasPessoas()) {
    if (!estaAusente(estado, nome, data)) emCasa.push(nome);
  }
  return emCasa;
}

function periodosSeCruzam(inicioA, fimA, inicioB, fimB) {
  return !(fimA < inicioB || inicioA > fimB);
}

function proporAusencia(estado, tipo, autor, textoInicio, textoFim, agora) {
  const hoje = agora.data;
  const inicio = lerData(textoInicio, hoje);
  const fim = lerData(textoFim || textoInicio, hoje, inicio);
  const exemplo = tipo === 'ferias' ? '*ferias 20/12 a 15/01*' : '*viajo 14/11 a 17/11*';

  if (!inicio || !fim) return { ok: false, msg: `Não entendi as datas. Ex.: ${exemplo}` };
  if (fim < inicio) return { ok: false, msg: 'A data de volta é antes da de ida. 🤔' };

  if (tipo === 'ferias') {
    if (inicio < somarDias(hoje, 2)) {
      return { ok: false, msg: 'As férias precisam ser combinadas com pelo menos 2 dias de antecedência (para dar tempo da faxina de saída).' };
    }
    for (const ferias of estado.ferias) {
      if (periodosSeCruzam(inicio, fim, ferias.inicio, ferias.fim)) return { ok: false, msg: 'Já tem férias marcadas nesse período.' };
    }
  } else {
    if (inicio <= hoje) {
      return { ok: false, msg: 'A viagem tem que começar a partir de amanhã (o dia de hoje continua valendo).' };
    }
    for (const viagem of estado.ausencias) {
      if (viagem.pessoa === autor && periodosSeCruzam(inicio, fim, viagem.inicio, viagem.fim)) {
        return { ok: false, msg: 'Você já tem viagem marcada nesse período.' };
      }
    }
  }

  const proposta = { id: Date.now(), tipo, autor, inicio, fim, confirmacoes: [autor], criada: hoje };

  if (tipo === 'viagem') {
    // 24h de antecedência = começa depois de amanhã (ou amanhã, se o aviso veio à meia-noite)
    const faltamDias = diasEntre(hoje, inicio);
    const avisouComAntecedencia = faltamDias >= 2 || (faltamDias === 1 && agora.hora === '00:00');

    const precisamConfirmar = [];
    for (const nome of nomesDasPessoas()) {
      if (nome !== autor && !estaAusente(estado, nome, inicio)) precisamConfirmar.push(nome);
    }

    if (avisouComAntecedencia || precisamConfirmar.length === 0) {
      estado.ausencias.push({ pessoa: autor, inicio, fim });
      return { ok: true, ativa: true, prop: proposta };
    }
    proposta.precisam = precisamConfirmar;
  } else {
    proposta.precisam = nomesDasPessoas();
  }

  // uma proposta nova da mesma pessoa substitui a anterior
  estado.propostas = estado.propostas.filter(p => !(p.tipo === tipo && p.autor === autor));
  estado.propostas.push(proposta);
  return { ok: true, ativa: false, prop: proposta };
}

// A proposta mais recente que ainda espera a resposta dessa pessoa.
function propostaEsperandoPor(estado, pessoa) {
  for (let i = estado.propostas.length - 1; i >= 0; i--) {
    const proposta = estado.propostas[i];
    if (proposta.precisam.includes(pessoa) && !proposta.confirmacoes.includes(pessoa)) return proposta;
  }
  return null;
}

function confirmarProposta(estado, quem, hoje) {
  limparPropostasVencidas(estado, hoje);
  const proposta = propostaEsperandoPor(estado, quem);
  if (!proposta) return { ok: false, msg: 'Não tem nenhuma proposta esperando a sua confirmação.' };

  proposta.confirmacoes.push(quem);
  const falta = [];
  for (const nome of proposta.precisam) {
    if (!proposta.confirmacoes.includes(nome)) falta.push(nome);
  }
  if (falta.length > 0) return { ok: true, ativa: false, prop: proposta, falta };

  estado.propostas = estado.propostas.filter(p => p !== proposta);
  if (proposta.tipo === 'ferias') {
    estado.ferias.push({ inicio: proposta.inicio, fim: proposta.fim });
  } else if (proposta.tipo === 'cancelarferias') {
    aplicarCancelamentoDasFerias(estado, proposta, hoje);
  } else {
    estado.ausencias.push({ pessoa: proposta.autor, inicio: proposta.inicio, fim: proposta.fim });
  }
  return { ok: true, ativa: true, prop: proposta };
}

function rejeitarProposta(estado, quem) {
  const proposta = propostaEsperandoPor(estado, quem);
  if (!proposta) return { ok: false, msg: 'Não tem nenhuma proposta esperando a sua resposta.' };
  estado.propostas = estado.propostas.filter(p => p !== proposta);
  return { ok: true, prop: proposta };
}

// Proposta que não foi confirmada a tempo é descartada. Férias precisam estar confirmadas
// antes da véspera ser montada, senão a faxina de saída não entra no dia.
function limparPropostasVencidas(estado, hoje) {
  const aindaValem = [];
  for (const proposta of estado.propostas) {
    if (proposta.tipo === 'cancelarferias') {
      if (proposta.fim > hoje) aindaValem.push(proposta);
    } else if (proposta.tipo === 'ferias') {
      if (proposta.inicio > somarDias(hoje, 1)) aindaValem.push(proposta);
    } else if (proposta.inicio > hoje) {
      aindaValem.push(proposta);
    }
  }
  estado.propostas = aindaValem;
}

// Voltou antes ou desistiu. Os dias que já passaram continuam contando como viagem.
function cancelarViagem(estado, pessoa, hoje) {
  const viagem = estado.ausencias.find(v => v.pessoa === pessoa && v.fim >= hoje);
  if (!viagem) return { ok: false, msg: 'Você não tem viagem marcada.' };

  if (viagem.inicio > hoje) {
    estado.ausencias = estado.ausencias.filter(v => v !== viagem);
  } else {
    viagem.fim = hoje; // hoje já foi montado sem ela; a partir de amanhã volta ao rodízio
  }
  return { ok: true };
}

// Cancelar ou encerrar antes as férias também precisa das três.
function proporCancelarFerias(estado, autor, hoje) {
  const ferias = estado.ferias.find(f => f.fim >= hoje);
  if (!ferias) return { ok: false, msg: 'Não tem férias marcadas.' };
  if (ferias.inicio <= hoje && ferias.fim === hoje) return { ok: false, msg: 'As férias já acabam hoje. 🙂' };

  const proposta = {
    id: Date.now(), tipo: 'cancelarferias', autor, inicio: ferias.inicio, fim: ferias.fim,
    confirmacoes: [autor], precisam: nomesDasPessoas(), criada: hoje,
  };
  estado.propostas = estado.propostas.filter(p => p.tipo !== 'cancelarferias');
  estado.propostas.push(proposta);
  return { ok: true, prop: proposta, comecou: ferias.inicio <= hoje };
}

function aplicarCancelamentoDasFerias(estado, proposta, hoje) {
  const ferias = estado.ferias.find(f => f.inicio === proposta.inicio && f.fim === proposta.fim);
  if (!ferias) return;
  if (ferias.inicio > hoje) {
    estado.ferias = estado.ferias.filter(f => f !== ferias);
  } else {
    ferias.fim = hoje; // hoje continua de férias; amanhã já tem a faxina de chegada
  }
}

module.exports = {
  emFerias, estaViajando, estaAusente, pessoasEmCasa,
  proporAusencia, confirmarProposta, rejeitarProposta, limparPropostasVencidas,
  cancelarViagem, proporCancelarFerias,
};
