// Converte "R$ 15.000,00" / "15000.00" / 15000 em Number (ou null).
// Compartilhado entre a busca CNJ unitária e a criação em lote (#320).
export function parseValorCausa(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'number') return valor
  const txt = String(valor).replace('R$', '').trim()
  if (!txt) return null
  const normalizado = txt.includes(',') ? txt.replace(/\./g, '').replace(',', '.') : txt
  const num = Number(normalizado)
  return Number.isFinite(num) ? num : null
}
