import jsPDF from 'jspdf'
import 'jspdf-autotable'

/**
 * Utilitário global para gerar relatórios em PDF com a biblioteca jsPDF
 * @param {string} tituloRelatorio - O título que vai no topo do PDF
 * @param {Array<string>} headers - Os cabeçalhos da tabela
 * @param {Array<Array<any>>} dados - Os dados (matriz) a preencher
 * @param {string} nomeArquivo - Ex: 'casos_patronus.pdf'
 */
export const exportarParaPDF = (tituloRelatorio, headers, dados, nomeArquivo = 'relatorio.pdf') => {
  // Inicializa o jsPDF no formato Retrato (p), milímetros, A4
  const doc = new jsPDF('p', 'mm', 'a4')

  // Configura o cabeçalho
  doc.setFontSize(18)
  doc.setTextColor(41, 128, 185) // Cor azul primária Patronus
  doc.text('Patronus - Gestão Jurídica', 14, 22)

  doc.setFontSize(12)
  doc.setTextColor(100)
  doc.text(tituloRelatorio, 14, 30)

  // Inserir data de emissão no lado direito superior
  const now = new Date()
  const dataFormatada = now.toLocaleString('pt-BR')
  doc.setFontSize(10)
  doc.setTextColor(150)
  doc.text(`Emitido em: ${dataFormatada}`, doc.internal.pageSize.width - 15, 22, { align: 'right' })

  // Desenha uma linha separadora azul clara
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  doc.line(14, 35, doc.internal.pageSize.width - 14, 35)

  // Gera a Tabela Automática
  doc.autoTable({
    head: [headers],
    body: dados,
    startY: 40,
    styles: {
      fontSize: 9,
      cellPadding: 4,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [41, 128, 185], // Azul
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250], // Zebrado light
    },
    margin: { top: 40, left: 14, right: 14 },
  })

  // Rodapé
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `Página ${i} de ${pageCount} - Gerado automaticamente por Patronus App`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    )
  }

  // Comanda o download do relatório direto no browser
  doc.save(nomeArquivo)
}
