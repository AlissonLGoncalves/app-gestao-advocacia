import React from 'react'

// Barra fina (3px) que sinaliza urgencia visual baseada em data_vencimento.
// Cores discretas — paleta consistente com PrioridadeBadge:
//   vencido / hoje      -> vermelho (danger)
//   1-3 dias            -> laranja  (warning)
//   4-7 dias            -> amarelo  (caution)
//   8-15 dias           -> verde    (success suave)
//   >15 dias ou null    -> nao renderiza
// Concluido tambem nao renderiza — barra so faz sentido pra prazos abertos.

const PALETTE = {
  vencido: '#dc3545', // danger forte
  hoje: '#ef4444', // danger
  proximo: '#f59e0b', // warning
  atencao: '#fbbf24', // caution amarelo
  ok: '#34c759', // success
}

const ymd = (raw) => {
  if (!raw) return null
  const s = String(raw).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

const hojeYmd = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const diasEntre = (a, b) => {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.floor((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000)
}

// Mapeia dias-ate-vencimento -> cor da paleta. Exportado para teste.
export function corPorDias(diff) {
  if (diff === null || diff === undefined) return null
  if (diff < 0) return PALETTE.vencido
  if (diff === 0) return PALETTE.hoje
  if (diff <= 3) return PALETTE.proximo
  if (diff <= 7) return PALETTE.atencao
  if (diff <= 15) return PALETTE.ok
  return null
}

// Props:
//   dataVencimento: string ISO ou YYYY-MM-DD
//   concluido: boolean (qualquer status "Concluído/Concluido") — esconde
//   posicao: 'top' | 'bottom' (default 'top')
//   altura: numero em px (default 3)
export default function SlaBar({ dataVencimento, concluido = false, posicao = 'top', altura = 3 }) {
  if (concluido) return null
  const d = ymd(dataVencimento)
  if (!d) return null
  const diff = diasEntre(hojeYmd(), d)
  const cor = corPorDias(diff)
  if (!cor) return null
  const style = {
    height: altura,
    background: cor,
    width: '100%',
    [posicao === 'top' ? 'borderTopLeftRadius' : 'borderBottomLeftRadius']: 'inherit',
    [posicao === 'top' ? 'borderTopRightRadius' : 'borderBottomRightRadius']: 'inherit',
  }
  return (
    <div
      aria-label={
        diff < 0
          ? `Vencido ha ${Math.abs(diff)} dia(s)`
          : diff === 0
            ? 'Vence hoje'
            : `Vence em ${diff} dia(s)`
      }
      style={style}
    />
  )
}
