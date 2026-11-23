// Bot da Casa: liga o WhatsApp, agenda as rotinas e passa as mensagens para os comandos.
//   npm start        liga o bot (na primeira vez mostra o QR Code)
//   npm run testar   liga e já manda a mensagem do dia
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const { config } = require('./configuracao');
const { carregarEstado, salvarEstado } = require('./estado');
const { agoraNaCasa } = require('./util/datas');
const { log } = require('./util/log');
const { criarCliente } = require('./whatsapp/cliente');
const { criarMensageiro } = require('./whatsapp/mensageiro');
const { criarRotinas } = require('./rotinas');
const { criarTratador } = require('./comandos');

const estado = carregarEstado();
const client = criarCliente();
const contexto = {
  estado,
  mensageiro: criarMensageiro(client),
  agora: () => agoraNaCasa(),
  salvar: () => salvarEstado(estado),
};
const rotinas = criarRotinas(contexto);
const tratarMensagem = criarTratador(contexto);

function agendar() {
  const fuso = { timezone: config.fusoHorario };
  cron.schedule(config.horarios.manha, rotinas.mensagemDaManha, fuso);
  for (const horario of config.horarios.lembretes) {
    cron.schedule(horario, rotinas.lembrete, fuso);
  }
  cron.schedule(config.horarios.fechamento, rotinas.fechamento, fuso);
  cron.schedule(config.horarios.resumoSemanal, rotinas.resumoSemanal, fuso);
}

client.on('qr', qr => {
  console.log('\nEscaneie com o WhatsApp do BOT (Configurações > Dispositivos conectados):\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => log('Autenticado.'));

// O pm2 religa o bot depois que ele sai; o WhatsApp costuma reconectar sozinho na segunda tentativa.
client.on('disconnected', motivo => {
  log('Desconectado:', motivo, '(reiniciando em 30 s)');
  setTimeout(() => process.exit(1), 30000);
});

client.on('ready', async () => {
  log('Bot conectado!');
  await contexto.mensageiro.preparar();
  rotinas.recuperarDiasAbertos();
  await rotinas.rotinasDoMes(contexto.agora().data); // caso estivesse desligado na virada do mês
  agendar();
  log('Agendamentos ativos. Pessoas encontradas:', Object.keys(contexto.mensageiro.idPorNome).join(', ') || 'nenhuma');

  if (process.argv.includes('--enviar-agora')) await rotinas.mensagemDaManha();
});

client.on('message', msg => {
  tratarMensagem(msg).catch(erro => log('Erro no comando:', erro));
});

// Sem internet ou com o servidor reiniciando, o WhatsApp Web não abre. Em vez de ficar travado,
// o bot sai e o pm2 tenta de novo em 30 s.
client.initialize().catch(erro => {
  log('Não consegui iniciar o WhatsApp:', erro.message, '(tentando de novo em instantes)');
  process.exit(1);
});
