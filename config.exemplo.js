// Configuração do Bot da Casa (EXEMPLO, com nomes e telefones fictícios).
//
// Para usar: copie este arquivo para config.js e troque pelos dados da casa.
// O config.js fica fora do Git (.gitignore), porque tem os telefones de verdade.
// Depois de mudar qualquer coisa, reinicie o bot.

module.exports = {
  fusoHorario: 'America/Sao_Paulo',

  // Data de referência para as frequências ("a cada 2 dias", "a cada 3 dias"...).
  // Não precisa mexer; mudar isso reorganiza em quais dias cada tarefa cai.
  dataInicio: '2026-11-09',

  // Nome EXATO do grupo da casa no WhatsApp (o número do bot precisa estar nele).
  // A lista do dia, o "feito" e os avisos acontecem no grupo.
  grupoNome: 'Apê 302',

  // Para onde vão as multas. Aparece nas mensagens de cobrança para facilitar o Pix.
  caixinha: { chavePix: 'caixinha@exemplo.com', titular: 'Ana' },

  // Horários (formato cron: minuto hora * * dia-da-semana)
  horarios: {
    manha: '0 8 * * *',                       // mensagem com as tarefas do dia
    lembretes: ['0 20 * * *', '0 22 * * *'],   // lembretes para quem tem pendência
    fechamento: '0 0 * * *',                   // 00:00 = fecha o dia (prazo 23:59)
    resumoSemanal: '0 21 * * 0',               // domingo 21h
  },

  // Descontos, créditos e prazos
  regras: {
    descontos: [20, 35, 50],   // % de desconto por 1, 2 e 3+ semanas limpas seguidas
    creditoMaximo: 15,         // ninguém fica com mais de R$ 15 de crédito
    diaVencimento: 8,          // multas de um mês vencem no dia 8 do mês seguinte (com desconto)
    diaCobranca: 10,           // dia 10: nova cobrança, já sem desconto para quem não pagou
    diasMinSemana: 4,          // semana só conta para o desconto se a pessoa ficou 4+ dias em casa
    diasMinMes: 15,            // mês só conta para a anistia se a pessoa ficou 15+ dias em casa
  },

  // Se uma tarefa atrasada ficar sem fazer DE NOVO, a multa é multiplicada por isto.
  multiplicadorReincidencia: 2,

  pessoas: [
    // telefone com DDI e DDD, só números
    { nome: 'Ana',   telefone: '5534900000001' },
    { nome: 'Bia',   telefone: '5534900000002' },
    { nome: 'Carol', telefone: '5534900000003' },
  ],

  // tipo:
  //   'rodizio'    -> o bot distribui entre as moradoras, equilibrando o esforço
  //   'fixa'       -> sempre da mesma pessoa (campo responsavel)
  //   'individual' -> todo mundo faz a sua (ex.: louça)
  // frequencia: a cada quantos dias (1 = todo dia, 7 = uma vez por semana)
  // deslocamento: em qual dia do ciclo cai. Nas semanais: 0=seg, 1=ter, 2=qua,
  //               3=qui, 4=sex, 5=sáb, 6=dom (a dataInicio é uma segunda)
  // pontos: esforço da tarefa (usado para equilibrar o rodízio)
  // multa: em reais
  // liberarApos: só pode ser marcada como feita depois deste horário
  // pessoas: (opcional) só essas entram no rodízio dessa tarefa
  // diferenteDe: (opcional) não pode cair para quem fez essa outra tarefa por último
  // foraDoEquilibrio: (opcional) não entra na conta de pontos; alterna só pelo número de vezes
  //                   (ex.: caixa de areia, que é só de quem tem pet)
  tarefas: [
    // --- diárias e a cada poucos dias ---
    { id: 'varrer',   nome: 'Varrer ou aspirar a casa',                                     tipo: 'rodizio', frequencia: 1, pontos: 2, multa: 3 },
    { id: 'cozinha',  nome: 'Limpar mesa, balcões da cozinha e do corredor, fogão e tirar o pó do rack da TV', tipo: 'rodizio', frequencia: 1, pontos: 3, multa: 4 },
    { id: 'pano',     nome: 'Passar pano no chão',                                          tipo: 'rodizio', frequencia: 2, deslocamento: 0, pontos: 3, multa: 3 },
    { id: 'lixo',     nome: 'Tirar o lixo (cozinha e recicláveis)',                         tipo: 'rodizio', frequencia: 2, deslocamento: 1, pontos: 1, multa: 5 },
    { id: 'area',     nome: 'Lavar a área',                                                 tipo: 'rodizio', frequencia: 3, deslocamento: 0, pontos: 3, multa: 4 },
    { id: 'banheiro', nome: 'Lavar o banheiro, tirar o lixo do banheiro e trocar o tapete', tipo: 'rodizio', frequencia: 3, deslocamento: 1, pontos: 4, multa: 6, pessoas: ['Ana', 'Carol'] },
    { id: 'gata',     nome: 'Limpar a caixa de areia dos gatos',                            tipo: 'rodizio', pessoas: ['Ana', 'Bia'], foraDoEquilibrio: true, frequencia: 1, pontos: 1, multa: 2 },
    { id: 'louca',    nome: 'Lavar, secar e guardar a sua louça',                             tipo: 'individual', frequencia: 1, pontos: 1, multa: 8, liberarApos: '20:00' },

    // --- semanais ---
    { id: 'geladeira',  nome: 'Limpar a geladeira e jogar fora o que venceu',                tipo: 'rodizio', frequencia: 7, deslocamento: 2, pontos: 3, multa: 4 },
    { id: 'microondas', nome: 'Limpar o micro-ondas',                                        tipo: 'rodizio', frequencia: 7, deslocamento: 3, pontos: 1, multa: 2 },
    { id: 'roupas',     nome: 'Colocar para lavar e estender os panos de prato, os tapetes e a roupa de cama da sala', tipo: 'rodizio', frequencia: 7, deslocamento: 5, pontos: 2, multa: 4 },
    { id: 'recolher',   nome: 'Recolher do varal, dobrar e guardar os panos de prato, os tapetes e a roupa de cama da sala', tipo: 'rodizio', frequencia: 7, deslocamento: 6, pontos: 2, multa: 4, diferenteDe: 'roupas' },
  ],

  // Véspera das férias: divididas pelo rodízio
  faxinaSaida: [
    { id: 'saida_lixo',      nome: '🧳 Faxina de saída: tirar TODO o lixo da casa (cozinha, recicláveis e banheiro)', pontos: 2, multa: 5 },
    { id: 'saida_geladeira', nome: '🧳 Faxina de saída: tirar da geladeira e da fruteira tudo que vai estragar',      pontos: 2, multa: 4 },
    { id: 'saida_cozinha',   nome: '🧳 Faxina de saída: cozinha limpa, ralo da pia sem resto de comida e panos lavados', pontos: 2, multa: 4 },
  ],
  // Dia da volta das férias
  faxinaChegada: [
    { id: 'chegada_po',   nome: '🏠 Faxina de chegada: tirar o pó da casa toda',     pontos: 3, multa: 3 },
    { id: 'chegada_pano', nome: '🏠 Faxina de chegada: passar pano na casa toda',    pontos: 3, multa: 3 },
  ],
};
