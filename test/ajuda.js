// Preparação comum dos testes: usa o config de exemplo (Ana, Bia e Carol) e uma pasta de dados temporária,
// e troca o WhatsApp por um cliente falso que só anota as mensagens.
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.BOT_CONFIG = path.join(__dirname, '..', 'config.exemplo.js');
process.env.BOT_DADOS = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-casa-teste-'));

const { estadoVazio } = require('../src/estado');
const { somarDias } = require('../src/util/datas');
const { gerarDia } = require('../src/casa/distribuicao');
const { fecharDia, marcarFeita } = require('../src/casa/tarefas');
const { criarMensageiro } = require('../src/whatsapp/mensageiro');
const { criarRotinas } = require('../src/rotinas');
const { criarTratador } = require('../src/comandos');

const TELEFONES = { Ana: '5534900000001', Bia: '5534900000002', Carol: '5534900000003' };
const GRUPO = 'grupo@g.us';

// Bot inteiro, sem WhatsApp de verdade. `enviadas` guarda tudo que ele mandou.
function criarBotDeTeste({ estado = estadoVazio(), agora = { data: '2026-11-09', hora: '12:00' } } = {}) {
  const enviadas = [];
  const clienteFalso = {
    async sendMessage(destino, conteudo, opcoes) {
      let para = 'grupo';
      for (const nome in TELEFONES) {
        if (destino === TELEFONES[nome] + '@c.us') para = nome;
      }
      const texto = typeof conteudo === 'string' ? conteudo : `[foto] ${opcoes.caption}`;
      enviadas.push({ para, texto });
    },
  };

  const mensageiro = criarMensageiro(clienteFalso);
  for (const nome in TELEFONES) mensageiro.idPorNome[nome] = TELEFONES[nome] + '@c.us';
  mensageiro.grupoId = GRUPO;

  const contexto = { estado, mensageiro, agora: () => bot.agora, salvar: () => {} };
  const bot = {
    estado, enviadas, agora,
    rotinas: criarRotinas(contexto),
    tratar: criarTratador(contexto),
    contexto,
    mensagensPara(quem) {
      return enviadas.filter(m => m.para === quem).map(m => m.texto);
    },
    limpar() {
      enviadas.length = 0;
    },
  };
  return bot;
}

let contadorDeFotos = 0;

function foto(conteudo) {
  contadorDeFotos++;
  return { mimetype: 'image/jpeg', data: Buffer.from(conteudo || 'foto ' + contadorDeFotos).toString('base64') };
}

// Mensagem falsa do WhatsApp. `respostas` guarda o que o bot respondeu em cima dela.
function mensagem(de, texto, { noGrupo = false, midia = null } = {}) {
  const msg = {
    from: noGrupo ? GRUPO : TELEFONES[de] + '@c.us',
    author: noGrupo ? TELEFONES[de] + '@c.us' : undefined,
    body: texto,
    fromMe: false,
    hasMedia: Boolean(midia),
    respostas: [],
    async downloadMedia() {
      return midia;
    },
    async reply(resposta) {
      msg.respostas.push(resposta);
    },
  };
  return msg;
}

// Faz tudo de um dia (menos o que estiver em `exceto`) e fecha o dia.
function viverDia(estado, data, exceto = () => false) {
  const dia = gerarDia(estado, data);
  for (const item of dia.itens) {
    if (!exceto(item)) marcarFeita(estado, data, item.pessoa, item.n, '21:00');
  }
  return fecharDia(estado, data);
}

function viverPeriodo(estado, inicio, fim, exceto) {
  for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
    viverDia(estado, data, item => exceto && exceto(item, data));
  }
}

module.exports = { criarBotDeTeste, mensagem, foto, viverDia, viverPeriodo, TELEFONES };
