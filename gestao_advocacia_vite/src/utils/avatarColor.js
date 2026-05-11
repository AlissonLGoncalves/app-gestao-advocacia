// Cores derivadas das variaveis de index.css. Hash deterministico para
// que o mesmo nome sempre receba a mesma cor (avatar estavel entre sessoes).
const PALETTE = [
  { bg: '#007aff', fg: '#ffffff' }, // primary
  { bg: '#5856d6', fg: '#ffffff' }, // indigo
  { bg: '#34c759', fg: '#ffffff' }, // success
  { bg: '#ff9500', fg: '#ffffff' }, // warning
  { bg: '#ff3b30', fg: '#ffffff' }, // danger
  { bg: '#5ac8fa', fg: '#0b3a59' }, // teal
  { bg: '#ff2d55', fg: '#ffffff' }, // pink
  { bg: '#0051d5', fg: '#ffffff' }, // primary-strong
]

const hashString = (s) => {
  let h = 0
  const str = String(s || '')
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function corPorNome(nome) {
  if (!nome) return { bg: '#9ca7bb', fg: '#ffffff' } // muted fallback
  return PALETTE[hashString(nome) % PALETTE.length]
}

export function iniciaisDoNome(nome) {
  if (!nome) return null
  const partes = String(nome).trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return null
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}
