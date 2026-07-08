// Extrai a comarca do nome do órgão. O to_dict não tem um campo `comarca`
// próprio, mas o `nome_orgao` costuma trazê-la (ex.: "1ª Vara Cível da Comarca
// de Blumenau" → "Blumenau"). Só extrai quando o padrão "Comarca de X" existe;
// senão retorna vazio (melhor em branco do que chutar errado).
export function extrairComarcaDoOrgao(nomeOrgao) {
  if (!nomeOrgao) return ''
  const m = /comarca\s+de\s+(.+)$/i.exec(nomeOrgao)
  return m ? m[1].trim() : ''
}

// Normaliza uma publicação "crua" (a que vem da lista de Intimações) no formato
// que o ModalCriarClienteCaso espera — o mesmo da aba Triagem:
// { publicacao, analise, sugestoes_vinculo }.
//
// Sem isso, quando o modal era aberto pelo botão "Tratar", ele recebia a pub
// crua: `publicacao.publicacao` ficava undefined (perdendo o pub.id → título
// "Caso DJEN #" sem número) e `analise` vinha vazio → nenhum campo
// auto-preenchia. Aproveita tudo que o to_dict já expõe (e que o painel de
// Detalhe da Publicação mostra): número, órgão/vara, classe (nome_classe),
// comarca (extraída do órgão) e partes (polo_ativo/polo_passivo). Só o valor
// da causa fica de fora (não vem no to_dict, só na análise completa da Triagem).
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
      comarca: extrairComarcaDoOrgao(pub?.nome_orgao),
      classe_processual: pub?.nome_classe || '',
      valor_causa: null,
      partes_autoras: splitPartes(pub?.polo_ativo),
      partes_reus: splitPartes(pub?.polo_passivo),
    },
    sugestoes_vinculo: {},
  }
}
