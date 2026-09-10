// Redesign Stitch (TELA 3) — "Dados do processo" compacto (coluna direita).
// Só renderiza as linhas que existem no caso; sem inventar campo.

import React from 'react'
import AvatarSigla from '../ui/AvatarSigla.jsx'
import { formatDataBR } from './proximoPasso.js'

function fmtBRL(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function Dado({ label, children, testid }) {
  return (
    <div className="cd-dado" data-testid={testid}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export default function DadosProcessoCard({ caso, sigla, totalDocumentos, onVerDocumentos }) {
  if (!caso) return null
  const cliente = (caso.cliente_nome || caso.cliente?.nome_razao_social || '').trim()
  const contraria = (caso.parte_contraria || '').trim()
  const vara = (caso.vara_juizo || '').trim()
  const comarca = (caso.comarca || '').trim()
  const assunto = [caso.tipo_acao, caso.area_direito].filter(Boolean).join(' · ')
  const valor = fmtBRL(caso.valor_causa)
  const distribuicao = formatDataBR(caso.data_distribuicao)
  const descricao = (caso.descricao || '').trim()

  return (
    <section className="cd-card" aria-labelledby="cd-dados-titulo" data-testid="dados-processo">
      <div className="cd-card-head">
        <h3 className="cd-card-title" id="cd-dados-titulo">
          Dados do processo
        </h3>
        {caso.status && <span className="cd-chip">{caso.status}</span>}
      </div>
      <dl className="cd-dados">
        {(cliente || contraria) && (
          <Dado label="Partes" testid="dado-partes">
            {cliente && (
              <div>
                <span className="cd-papel">Cliente:</span> {cliente}
              </div>
            )}
            {contraria ? (
              <div>
                <span className="cd-papel">Parte contrária:</span> {contraria}
                {caso.adv_parte_contraria && (
                  <div className="cd-sub">Adv.: {caso.adv_parte_contraria}</div>
                )}
              </div>
            ) : (
              <div className="cd-sub">Parte contrária não informada</div>
            )}
          </Dado>
        )}
        {(vara || comarca || sigla) && (
          <Dado label="Vara e tribunal" testid="dado-vara">
            {[vara, comarca && !vara.toLowerCase().includes(comarca.toLowerCase()) ? comarca : null]
              .filter(Boolean)
              .join(' — ') || 'Vara não informada'}
            {sigla && (
              <span className="cd-chip ms-2" style={{ verticalAlign: '1px' }}>
                {sigla}
              </span>
            )}
          </Dado>
        )}
        {assunto && <Dado label="Assunto">{assunto}</Dado>}
        {caso.instancia && <Dado label="Instância">{caso.instancia}</Dado>}
        {valor && (
          <Dado label="Valor da causa" testid="dado-valor">
            <span className="cd-num">{valor}</span>
          </Dado>
        )}
        {distribuicao && (
          <Dado label="Distribuição">
            <span className="cd-num">{distribuicao}</span>
          </Dado>
        )}
        {caso.responsavel_nome && (
          <Dado label="Advogado responsável">
            <span className="cd-dado-resp">
              <AvatarSigla nome={caso.responsavel_nome} iniciais={caso.responsavel_iniciais} />
              {caso.responsavel_nome}
            </span>
          </Dado>
        )}
        {descricao && (
          <div className="cd-dado">
            <details className="cd-dados-resumo">
              <summary>Resumo do caso</summary>
              <p>{descricao}</p>
            </details>
          </div>
        )}
      </dl>
      {typeof totalDocumentos === 'number' && (
        <button
          type="button"
          className="cd-docs-link w-100 mt-3"
          onClick={onVerDocumentos}
          data-testid="link-documentos"
        >
          <span>Documentos vinculados ({totalDocumentos})</span>
          <span aria-hidden="true">→</span>
        </button>
      )}
    </section>
  )
}
