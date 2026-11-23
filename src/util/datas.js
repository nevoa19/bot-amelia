// As datas circulam pelo bot como texto 'AAAA-MM-DD' (e meses como 'AAAA-MM').
// Assim dá para comparar com < e > e salvar no JSON sem conversão.
// Nas contas, uso meio-dia UTC para fugir de problema com fuso e horário de verão.
const { config } = require('../configuracao');

const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;
const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Data e hora de agora no fuso da casa, ex.: { data: '2026-11-23', hora: '20:05' }
function agoraNaCasa(momento = new Date()) {
  const formatador = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.fusoHorario,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const valor = {};
  for (const parte of formatador.formatToParts(momento)) {
    valor[parte.type] = parte.value;
  }
  let hora = valor.hour;
  if (hora === '24') hora = '00'; // alguns Node devolvem 24 à meia-noite
  return { data: `${valor.year}-${valor.month}-${valor.day}`, hora: `${hora}:${valor.minute}` };
}

function emMs(data) {
  return Date.parse(data + 'T12:00:00Z');
}

function somarDias(data, dias) {
  return new Date(emMs(data) + dias * UM_DIA_EM_MS).toISOString().slice(0, 10);
}

function diasEntre(dataInicial, dataFinal) {
  return Math.round((emMs(dataFinal) - emMs(dataInicial)) / UM_DIA_EM_MS);
}

// 0 = domingo, 1 = segunda ... 6 = sábado
function diaDaSemana(data) {
  return new Date(emMs(data)).getUTCDay();
}

function nomeDoDiaDaSemana(data) {
  return DIAS_DA_SEMANA[diaDaSemana(data)];
}

// '2026-11-09' -> '09/11'
function diaEMes(data) {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

function mesDe(data) {
  return data.slice(0, 7);
}

function ultimoDiaDoMes(mes) {
  const [ano, numeroDoMes] = mes.split('-').map(Number);
  // dia 0 do mês seguinte = último dia deste mês
  return new Date(Date.UTC(ano, numeroDoMes, 0, 12)).toISOString().slice(0, 10);
}

function mesAnterior(mes) {
  return mesDe(somarDias(mes + '-01', -1));
}

function nomeDoMes(mes) {
  return MESES[Number(mes.slice(5)) - 1];
}

function ultimoDomingoAte(data) {
  return somarDias(data, -diaDaSemana(data));
}

// Lê '14/11' ou '14/11/2026'. Sem ano: se a data já passou (ou é antes de `naoAntesDe`),
// entende que é do ano que vem, para '20/12 a 15/01' funcionar.
function lerData(texto, hoje, naoAntesDe) {
  const partes = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(texto || '');
  if (!partes) return null;

  const dia = partes[1].padStart(2, '0');
  const mes = partes[2].padStart(2, '0');
  let ano;
  if (partes[3]) {
    ano = partes[3].length === 2 ? Number('20' + partes[3]) : Number(partes[3]);
  } else {
    ano = Number(hoje.slice(0, 4));
  }

  let data = `${ano}-${mes}-${dia}`;
  if (!partes[3] && data < (naoAntesDe || hoje)) {
    data = `${ano + 1}-${mes}-${dia}`;
  }
  // descarta coisas como 31/02
  if (isNaN(emMs(data)) || new Date(emMs(data)).toISOString().slice(0, 10) !== data) return null;
  return data;
}

module.exports = {
  agoraNaCasa, somarDias, diasEntre, diaDaSemana, nomeDoDiaDaSemana, diaEMes,
  mesDe, ultimoDiaDoMes, mesAnterior, nomeDoMes, ultimoDomingoAte, lerData,
};
