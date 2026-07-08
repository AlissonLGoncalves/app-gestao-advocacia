// Normaliza uma publicação "crua" (a que vem da lista de Intimações) no formato
// que o ModalCriarClienteCaso espera — o mesmo da aba Triagem:
// { publicacao, analise, sugestoes_vinculo }.
//
// Sem isso, quando o modal era aberto pelo botão "Tratar", ele recebia a pub
// crua: `publicacao.publicacao` ficava undefined (perdendo o pub.id → título
// "Caso DJEN #" sem número) e `analise` vinha vazio → nenhum campo
// auto-preenchia. Os dados que já existem no to_dict da publicação (número do
// processo, órgão/vara e partes em polo_ativo/polo_passivo) passam a preencher.
export function wrapPubParaModalCriar(pub) {
  const splitPartes = (txt) =>
    (txt || '')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
  return {
    publicacao: pub || {},
    analise: {
      numero_processo: pub?.numero_processo || '',
      vara: pub?.nome_orgao || '',
      comarca: '',
      classe_processual: '',
      valor_causa: null,
      partes_autoras: splitPartes(pub?.polo_ativo),
      partes_reus: splitPartes(pub?.polo_passivo),
    },
    sugestoes_vinculo: {},
  }
}
