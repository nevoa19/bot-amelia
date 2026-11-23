function reais(valor) {
  return 'R$ ' + valor.toFixed(2).replace('.', ',');
}

// evita 2.4000000000000004 nas contas de dinheiro
function arredondar(valor) {
  const arredondado = Math.round(valor * 100) / 100;
  if (arredondado === 0) return 0; // não deixa sair -0
  return arredondado;
}

// 'Água ' -> 'agua', para comparar comandos e nomes sem depender de acento ou maiúscula
function semAcento(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function plural(quantidade, singular, pluralDaPalavra) {
  return quantidade === 1 ? singular : pluralDaPalavra;
}

// ['Ana'] -> 'Ana' | ['Ana', 'Bia'] -> 'Ana e Bia' | ['Ana', 'Bia', 'Carol'] -> 'Ana, Bia e Carol'
function juntarNomes(nomes) {
  if (nomes.length <= 1) return nomes.join('');
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
}

module.exports = { reais, arredondar, semAcento, plural, juntarNomes };
