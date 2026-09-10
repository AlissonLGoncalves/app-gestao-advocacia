/**
 * JanelaIntimacoes — reproducao ESTATICA da tela de Intimacoes (DjenPage).
 *
 * Regra de conteudo desta landing: nenhum dado inventado. Por isso a peca
 * mostra apenas o que e' verdade estrutural do produto — os rotulos reais da
 * interface (abas de DjenPage.jsx, pills de components/djen/
 * CategoriasPublicacoes.jsx e os campos "Partes / Assunto / Prazo" do card de
 * publicacao) — e representa o conteudo de cada escritorio como faixas
 * neutras. Nao ha numero de processo, nome de parte, contador nem metrica:
 * nada aqui simula dado real de ninguem.
 *
 * E' decorativa (aria-hidden na moldura); a explicacao acessivel fica na
 * <figcaption> renderizada pela LandingPage.
 */

import React from 'react'

// Rotulos identicos aos do app (DjenPage.jsx / CategoriasPublicacoes.jsx).
const ABAS = ['Caixa de entrada', 'OABs monitoradas', 'Triagem IA']
const PILLS = ['Não tratadas', 'Sem processo', 'Tratadas']

function Publicacao({ tag, tagClasse }) {
  return (
    <li className="lp-tela__item">
      <div className="lp-tela__linha">
        <span className="lp-faixa" style={{ width: '46%' }} />
        <span className={`lp-tag ${tagClasse}`}>{tag}</span>
      </div>
      <div className="lp-tela__campo">Partes</div>
      <span className="lp-faixa" style={{ width: '78%' }} />
      <div className="lp-tela__campo" style={{ marginTop: 12 }}>
        Assunto
      </div>
      <span className="lp-faixa" style={{ width: '62%' }} />
    </li>
  )
}

export default function JanelaIntimacoes() {
  return (
    <div className="lp-janela" aria-hidden="true">
      <div className="lp-janela__barra">
        <span className="lp-janela__ponto" />
        <span className="lp-janela__ponto" />
        <span className="lp-janela__ponto" />
        <span className="lp-janela__titulo">Patronus — Intimações</span>
      </div>

      <div className="lp-janela__corpo">
        <p className="lp-tela__titulo">Intimações</p>

        <div className="lp-tela__abas">
          {ABAS.map((aba, i) => (
            <span key={aba} className={`lp-tela__aba${i === 0 ? ' is-active' : ''}`}>
              {aba}
            </span>
          ))}
        </div>

        <div className="lp-tela__pills">
          {PILLS.map((pill, i) => (
            <span key={pill} className={`lp-tela__pill${i === 0 ? ' is-active' : ''}`}>
              {pill}
            </span>
          ))}
        </div>

        <ul className="lp-tela__lista list-unstyled mb-0">
          <Publicacao tag="Prazo sugerido" tagClasse="lp-tag--prazo" />
          <Publicacao tag="Sem processo" tagClasse="lp-tag--info" />
          <Publicacao tag="Tratada" tagClasse="lp-tag--ok" />
        </ul>
      </div>
    </div>
  )
}
