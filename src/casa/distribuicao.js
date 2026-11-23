// Monta a lista de tarefas de um dia e decide quem faz o quê.
//
// Cada tarefa tem "pontos" de esforço (lixo = 1, banheiro = 4...). A distribuição é gulosa:
// as tarefas mais pesadas são distribuídas primeiro, e cada uma vai para quem tem menos pontos
// acumulados até agora (histórico + o que já recebeu hoje). Com o tempo os pontos se equilibram,
// mesmo com tarefas de frequências diferentes.
const { config, nomesDasPessoas } = require('../configuracao');
const { somarDias, diasEntre } = require('../util/datas');
const { emFerias, pessoasEmCasa } = require('./ausencias');

// Uma tarefa com frequencia 3 e deslocamento 1 cai nos dias 1, 4, 7... contados a partir da dataInicio.
function tarefasDoCalendario(data) {
  const diasDesdeOInicio = diasEntre(config.dataInicio, data);
  const doDia = [];
  for (const tarefa of config.tarefas) {
    const frequencia = tarefa.frequencia || 1;
    const deslocamento = tarefa.deslocamento || 0;
    const posicaoNoCiclo = ((diasDesdeOInicio - deslocamento) % frequencia + frequencia) % frequencia;
    if (posicaoNoCiclo === 0) doDia.push({ ...tarefa });
  }
  return doDia;
}

function novoItem(numero, tarefa, pessoa, tipo) {
  return {
    n: numero,
    tarefaId: tarefa.id,
    nome: tarefa.nome,
    pessoa,
    multa: tarefa.multa,
    pontos: tarefa.pontos || 1,
    liberarApos: tarefa.liberarApos || null,
    feita: false,
    tipo,
  };
}

// Quem fez essa tarefa por último (hoje ou nos 7 dias anteriores). Usado no "quem estende não recolhe".
function ultimaResponsavel(estado, itensDeHoje, data, tarefaId) {
  for (const item of itensDeHoje) {
    if (item.tarefaId === tarefaId) return item.pessoa;
  }
  for (let diasAtras = 1; diasAtras <= 7; diasAtras++) {
    const dia = estado.dias[somarDias(data, -diasAtras)];
    if (!dia) continue;
    for (let i = dia.itens.length - 1; i >= 0; i--) {
      if (dia.itens[i].tarefaId === tarefaId) return dia.itens[i].pessoa;
    }
  }
  return null;
}

function escolherResponsavel(estado, tarefa, candidatas, cargaDeHoje, data) {
  const todas = nomesDasPessoas();
  const contagem = estado.contagem[tarefa.id] || {};
  // desempate que gira a cada dia, para a mesma pessoa não ganhar sempre os empates
  const giro = diasEntre(config.dataInicio, data);

  const ordenadas = [...candidatas];
  ordenadas.sort((a, b) => {
    // tarefa restrita (ex.: banheiro só entre duas): alterna por número de vezes
    if (tarefa.pessoas) {
      const vezesA = contagem[a] || 0;
      const vezesB = contagem[b] || 0;
      if (vezesA !== vezesB) return vezesA - vezesB;
    }
    const pontosA = (estado.carga[a] || 0) + cargaDeHoje[a];
    const pontosB = (estado.carga[b] || 0) + cargaDeHoje[b];
    if (pontosA !== pontosB) return pontosA - pontosB;
    return ((todas.indexOf(a) + giro) % todas.length) - ((todas.indexOf(b) + giro) % todas.length);
  });
  return ordenadas[0];
}

function gerarDia(estado, data) {
  if (estado.dias[data]) return estado.dias[data];
  if (emFerias(estado, data)) {
    estado.dias[data] = { itens: [], fechado: false, ferias: true };
    return estado.dias[data];
  }

  const todas = nomesDasPessoas();
  const emCasa = pessoasEmCasa(estado, data);
  const viajando = todas.filter(nome => !emCasa.includes(nome));

  const tarefasDeHoje = tarefasDoCalendario(data);
  if (emFerias(estado, somarDias(data, 1))) {
    for (const tarefa of config.faxinaSaida) tarefasDeHoje.push({ tipo: 'rodizio', ...tarefa });
  }
  if (emFerias(estado, somarDias(data, -1))) {
    for (const tarefa of config.faxinaChegada) tarefasDeHoje.push({ tipo: 'rodizio', ...tarefa });
  }

  const itens = [];
  let numero = 1;
  const cargaDeHoje = {};
  for (const nome of todas) cargaDeHoje[nome] = 0;

  // 1) O que ficou de ontem continua com a MESMA pessoa, por cima das tarefas normais dela.
  //    Os pontos já foram contados no dia em que a tarefa foi distribuída, então não entram
  //    na carga de hoje: quem atrasou não é "compensada" com menos tarefas novas.
  //    Se ela viajou, a atrasada é descartada (a multa já foi aplicada).
  const idsAtrasados = [];
  const ontem = estado.dias[somarDias(data, -1)];
  if (ontem) {
    for (const item of ontem.itens) {
      if (item.feita || item.tipo === 'individual' || !emCasa.includes(item.pessoa)) continue;

      let nome = item.nome;
      const tambemCaiHoje = tarefasDeHoje.some(t => t.id === item.tarefaId);
      if (tambemCaiHoje && !item.atrasada) nome = `${item.nome} (a de ontem + a de hoje)`;

      itens.push({
        ...item, n: numero, nome, feita: false, atrasada: true, nivel: (item.nivel || 0) + 1,
        feitaEm: undefined, contestadaPor: undefined,
      });
      numero++;
      idsAtrasados.push(item.tarefaId);
    }
  }
  // Se a tarefa atrasada também cai hoje (ex.: varrer), a de hoje fica junto com a de ontem
  // e não é distribuída de novo.
  const tarefasNovas = tarefasDeHoje.filter(t => !idsAtrasados.includes(t.id));

  // 2) Tarefas fixas: sempre da mesma pessoa e fora do equilíbrio (a gata é de uma das moradoras)
  for (const tarefa of tarefasNovas) {
    if (tarefa.tipo === 'fixa' && emCasa.includes(tarefa.responsavel)) {
      itens.push(novoItem(numero, tarefa, tarefa.responsavel, 'fixa'));
      numero++;
    }
  }

  // 3) Rodízio, da mais pesada para a mais leve
  const rodizio = tarefasNovas.filter(t => t.tipo === 'rodizio');
  rodizio.sort((a, b) => (b.pontos || 1) - (a.pontos || 1));
  let pontosDistribuidos = 0;

  for (const tarefa of rodizio) {
    let candidatas = [];
    for (const nome of emCasa) {
      if (!tarefa.pessoas || tarefa.pessoas.includes(nome)) candidatas.push(nome);
    }
    if (candidatas.length === 0) continue; // ex.: as duas do banheiro viajando

    if (tarefa.diferenteDe) {
      const quemFezAOutra = ultimaResponsavel(estado, itens, data, tarefa.diferenteDe);
      if (quemFezAOutra && candidatas.length > 1) {
        candidatas = candidatas.filter(nome => nome !== quemFezAOutra);
      }
    }

    const escolhida = escolherResponsavel(estado, tarefa, candidatas, cargaDeHoje, data);
    itens.push(novoItem(numero, tarefa, escolhida, 'rodizio'));
    numero++;

    const pontos = tarefa.pontos || 1;
    cargaDeHoje[escolhida] += pontos;
    pontosDistribuidos += pontos;

    if (tarefa.pessoas) {
      if (!estado.contagem[tarefa.id]) estado.contagem[tarefa.id] = {};
      const contagem = estado.contagem[tarefa.id];
      contagem[escolhida] = (contagem[escolhida] || 0) + 1;
      // viagem sem compensação: quem está fora conta como se tivesse feito a vez dela
      for (const nome of viajando) {
        if (tarefa.pessoas.includes(nome)) contagem[nome] = (contagem[nome] || 0) + 1;
      }
    }
  }

  // 4) Individuais (louça): uma para cada pessoa em casa
  for (const tarefa of tarefasNovas) {
    if (tarefa.tipo !== 'individual') continue;
    for (const nome of emCasa) {
      itens.push(novoItem(numero, tarefa, nome, 'individual'));
      numero++;
    }
  }

  // Atualiza o placar de esforço. Quem está viajando ganha a média do dia,
  // para não voltar com uma pilha de tarefas (viagem sem compensação).
  for (const item of itens) {
    if (!item.atrasada && item.tipo === 'rodizio') {
      estado.carga[item.pessoa] = (estado.carga[item.pessoa] || 0) + item.pontos;
    }
  }
  if (emCasa.length > 0) {
    for (const nome of viajando) {
      estado.carga[nome] = (estado.carga[nome] || 0) + pontosDistribuidos / emCasa.length;
    }
  }

  estado.dias[data] = { itens, fechado: false };
  return estado.dias[data];
}

module.exports = { tarefasDoCalendario, gerarDia };
