// utils/gerarDocumentoLegal.js
import jsPDF from 'jspdf'

const PW = 210 // A4 largura mm
const PH = 297 // A4 altura mm
const ML = 25 // margem esquerda
const MR = 25 // margem direita
const CW = PW - ML - MR // largura do conteúdo
const LH = 6.5 // altura de linha padrão

// ─── helpers ─────────────────────────────────────────────────────────────────

function novaDoc() {
  return new jsPDF('p', 'mm', 'a4')
}

function cabecalho(doc, titulo) {
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(41, 128, 185)
  doc.text('Patronus — Gestão Jurídica', PW / 2, 16, { align: 'center' })

  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.4)
  doc.line(ML, 20, PW - MR, 20)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 20, 20)
  const linhasTitulo = doc.splitTextToSize(titulo.toUpperCase(), CW)
  linhasTitulo.forEach((linha, i) => {
    doc.text(linha, PW / 2, 29 + i * 7, { align: 'center' })
  })

  return 29 + linhasTitulo.length * 7 + 6
}

function rodape(doc) {
  const total = doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setTextColor(150)
    doc.text(`Página ${i} de ${total} — Gerado por Patronus App`, PW / 2, PH - 8, {
      align: 'center',
    })
  }
}

/**
 * Escreve um bloco de texto com quebra automática. Retorna o novo y.
 * Adiciona nova página se necessário.
 */
function bloco(
  doc,
  texto,
  y,
  { fontSize = 11, bold = false, center = false, indent = 0, extra = 3 } = {}
) {
  doc.setFontSize(fontSize)
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setTextColor(20, 20, 20)

  const linhas = doc.splitTextToSize(texto, CW - indent)
  const alturaBloco = linhas.length * LH

  if (y + alturaBloco > PH - 20) {
    doc.addPage()
    y = 22
  }

  if (center) {
    linhas.forEach((l, i) => doc.text(l, PW / 2, y + i * LH, { align: 'center' }))
  } else {
    doc.text(linhas, ML + indent, y)
  }

  return y + alturaBloco + extra
}

function espaco(y, mm = 5) {
  return y + mm
}

function secao(doc, texto, y) {
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(41, 128, 185)
  const linhas = doc.splitTextToSize(texto.toUpperCase(), CW)

  if (y + linhas.length * LH + 4 > PH - 20) {
    doc.addPage()
    y = 22
  }

  doc.text(linhas, ML, y)
  y += linhas.length * LH + 1

  doc.setDrawColor(200, 220, 240)
  doc.setLineWidth(0.3)
  doc.line(ML, y, PW - MR, y)

  return y + 5
}

function linhaAssinatura(doc, y, labels = []) {
  const espPorLabel = labels.length > 1 ? CW / labels.length : CW

  if (y + 22 > PH - 20) {
    doc.addPage()
    y = 22
  }

  labels.forEach((label, i) => {
    const x = ML + i * espPorLabel + espPorLabel * 0.1
    const largura = espPorLabel * 0.8
    doc.setDrawColor(50)
    doc.setLineWidth(0.3)
    doc.line(x, y + 14, x + largura, y + 14)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(70)
    doc.text(label, x + largura / 2, y + 19, { align: 'center' })
  })

  return y + 24
}

// ─── formatadores ────────────────────────────────────────────────────────────

function fmtEndereco(c) {
  const partes = [
    c.rua ? `${c.rua}${c.numero ? ', nº ' + c.numero : ''}` : null,
    c.bairro || null,
    c.cidade && c.estado ? `${c.cidade}/${c.estado}` : c.cidade || c.estado || null,
    c.cep ? `CEP ${c.cep}` : null,
  ].filter(Boolean)
  return partes.length ? partes.join(', ') : 'endereço não informado'
}

function qualificacaoPF(c) {
  const partes = [
    c.nome_razao_social,
    c.nacionalidade || 'brasileiro(a)',
    c.estado_civil ? c.estado_civil.toLowerCase() : null,
    c.profissao ? c.profissao.toLowerCase() : null,
    c.cpf_cnpj ? `portador(a) do CPF nº ${c.cpf_cnpj}` : null,
    c.rg ? `RG nº ${c.rg}${c.orgao_emissor ? '/' + c.orgao_emissor : ''}` : null,
    `residente e domiciliado(a) na ${fmtEndereco(c)}`,
  ].filter(Boolean)
  return partes.join(', ')
}

function fmtAdvogado(opcoes) {
  const nome = opcoes.nomeAdvogado || '__________________________________'
  const oab = opcoes.oab
    ? `OAB/${opcoes.estadoOAB || 'UF'} nº ${opcoes.oab}`
    : `inscrito(a) na OAB/${opcoes.estadoOAB || 'UF'} sob nº ___________`
  return `${nome}, advogado(a), ${oab}`
}

function fmtCidadeData(opcoes) {
  const cidade = opcoes.cidade || '_______________________________'
  const d = new Date()
  const mes = d.toLocaleDateString('pt-BR', { month: 'long' })
  const ano = d.getFullYear()
  return `${cidade}, ___ de ${mes} de ${ano}.`
}

// ─── modelos disponíveis ─────────────────────────────────────────────────────

export const MODELOS = {
  procuracao: {
    label: 'Procuração',
    icon: 'bi-file-earmark-person',
    templates: [
      { id: 'procuracao_civil', label: 'Procuração Geral (Cível)' },
      { id: 'procuracao_previdenciaria', label: 'Procuração Previdenciária' },
      { id: 'procuracao_consumidor', label: 'Procuração Direito do Consumidor' },
      { id: 'procuracao_trabalhista', label: 'Procuração Trabalhista' },
    ],
  },
  contrato: {
    label: 'Contrato de Honorários',
    icon: 'bi-file-earmark-text',
    templates: [
      { id: 'contrato_revisao', label: 'Contrato — Revisão Contratual/Bancária' },
      { id: 'contrato_aposentadoria', label: 'Contrato — Concessão de Aposentadoria' },
      { id: 'contrato_geral', label: 'Contrato — Geral (Êxito)' },
      { id: 'contrato_mensal', label: 'Contrato — Honorários Mensais' },
    ],
  },
  declaracao: {
    label: 'Declaração',
    icon: 'bi-file-earmark-check',
    templates: [
      { id: 'declaracao_hipossuficiencia', label: 'Declaração de Hipossuficiência' },
      { id: 'declaracao_residencia', label: 'Declaração de Residência' },
      { id: 'declaracao_dependente', label: 'Declaração de Dependência Econômica' },
    ],
  },
}

// ─── geradores por template ───────────────────────────────────────────────────

function gerarProcuracaoCivil(doc, cliente, opcoes) {
  let y = cabecalho(
    doc,
    'Instrumento Particular de Procuração\nAd Judicia et Extra — Foro em Geral'
  )

  y = secao(doc, 'Outorgante', y)
  y = bloco(
    doc,
    `${qualificacaoPF(cliente)}, pelo presente instrumento e na melhor forma de direito, nomeia e constitui seu bastante Procurador o(a):`,
    y,
    { fontSize: 10.5 }
  )

  y = espaco(y, 3)
  y = secao(doc, 'Outorgado', y)
  y = bloco(doc, fmtAdvogado(opcoes), y, { fontSize: 10.5, bold: true })

  y = espaco(y, 3)
  y = secao(doc, 'Poderes Conferidos', y)
  y = bloco(
    doc,
    'Ao qual confere amplos e gerais poderes para o foro em geral, com a cláusula "ad judicia et extra", para representar o(a) outorgante em todos os atos e termos de quaisquer processos judiciais ou extrajudiciais, podendo especialmente:',
    y,
    { fontSize: 10 }
  )

  const poderes = [
    'I — propor ações, contestar, recorrer em qualquer instância ou Tribunal, inclusive no Superior Tribunal de Justiça e Supremo Tribunal Federal;',
    'II — assinar petições iniciais, contestações, réplicas, recursos e demais peças processuais;',
    'III — requerer medidas cautelares e tutelas provisórias de urgência e de evidência;',
    'IV — transigir, firmar acordos, receber e dar quitação;',
    'V — receber intimações e citações, inclusive pessoalmente;',
    'VI — substabelecer no todo ou em parte, com ou sem reservas de iguais poderes;',
    'VII — praticar todos os demais atos necessários ao fiel cumprimento deste mandato.',
  ]

  poderes.forEach((p) => {
    y = bloco(doc, p, y, { fontSize: 10, indent: 5, extra: 2 })
  })

  y = espaco(y, 8)
  y = bloco(doc, fmtCidadeData(opcoes), y, { fontSize: 10, center: true, extra: 10 })

  y = linhaAssinatura(doc, y, [
    `${cliente.nome_razao_social}\nOutorgante`,
    `${opcoes.nomeAdvogado || 'Advogado(a) — Outorgado(a)'}`,
  ])

  rodape(doc)
}

function gerarProcuracaoPrevidenciaria(doc, cliente, opcoes) {
  let y = cabecalho(doc, 'Instrumento Particular de Procuração\nEspecial — Matéria Previdenciária')

  y = secao(doc, 'Outorgante', y)
  y = bloco(
    doc,
    `${qualificacaoPF(cliente)}, pelos presentes termos, constitui seu bastante procurador(a) o(a):`,
    y,
    { fontSize: 10.5 }
  )

  y = espaco(y, 3)
  y = secao(doc, 'Outorgado', y)
  y = bloco(doc, fmtAdvogado(opcoes), y, { fontSize: 10.5, bold: true })

  y = espaco(y, 3)
  y = secao(doc, 'Poderes Conferidos', y)
  y = bloco(
    doc,
    'Para representar o(a) outorgante perante o Instituto Nacional do Seguro Social — INSS, Ministério da Previdência Social, Justiça Federal, Turmas Recursais dos Juizados Especiais Federais, Tribunais Regionais Federais e Superior Tribunal de Justiça, com poderes especiais para:',
    y,
    { fontSize: 10 }
  )

  const poderes = [
    'I — requerer, acompanhar e receber benefícios previdenciários de qualquer natureza, incluindo aposentadorias, auxílios, pensões e salário-maternidade;',
    'II — interpor recursos administrativos junto ao INSS, Conselho de Recursos da Previdência Social e demais órgãos competentes;',
    'III — propor ações judiciais perante a Justiça Federal e Juizados Especiais Federais relativamente a benefícios previdenciários negados ou cancelados;',
    'IV — firmar acordos, receber valores atrasados (atrasados/retroativos) e dar plena quitação;',
    'V — requerer revisão do benefício, atualização de rendimentos e correção de tempo de contribuição;',
    'VI — obter extratos, certidões e quaisquer documentos junto à Previdência Social;',
    'VII — substabelecer no todo ou em parte, com ou sem reservas;',
    'VIII — praticar todos os atos processuais e administrativos inerentes ao mandato.',
  ]

  poderes.forEach((p) => {
    y = bloco(doc, p, y, { fontSize: 10, indent: 5, extra: 2 })
  })

  y = espaco(y, 8)
  y = bloco(doc, fmtCidadeData(opcoes), y, { fontSize: 10, center: true, extra: 10 })
  y = linhaAssinatura(doc, y, [
    `${cliente.nome_razao_social}\nOutorgante`,
    `${opcoes.nomeAdvogado || 'Advogado(a) — Outorgado(a)'}`,
  ])

  rodape(doc)
}

function gerarProcuracaoConsumidor(doc, cliente, opcoes) {
  let y = cabecalho(doc, 'Instrumento Particular de Procuração\nEspecial — Direito do Consumidor')

  y = secao(doc, 'Outorgante', y)
  y = bloco(
    doc,
    `${qualificacaoPF(cliente)}, na qualidade de consumidor(a), nomeia e constitui como seu bastante procurador(a):`,
    y,
    { fontSize: 10.5 }
  )

  y = espaco(y, 3)
  y = secao(doc, 'Outorgado', y)
  y = bloco(doc, fmtAdvogado(opcoes), y, { fontSize: 10.5, bold: true })

  y = espaco(y, 3)
  y = secao(doc, 'Poderes Conferidos', y)
  y = bloco(
    doc,
    'Para representar o(a) outorgante nas esferas judicial e extrajudicial em matéria consumerista (Lei nº 8.078/1990 — Código de Defesa do Consumidor), com poderes para:',
    y,
    { fontSize: 10 }
  )

  const poderes = [
    'I — propor ações indenizatórias, revisão de contratos, repetição de indébito, dano moral e material decorrentes de relação de consumo;',
    'II — realizar notificações, reclamações e representações perante fornecedores, PROCON, BACEN, ANS, ANATEL e demais órgãos reguladores;',
    'III — representar o(a) outorgante em audiências de conciliação, mediação e instrução;',
    'IV — transigir, firmar acordos e dar quitação, desde que os termos sejam favoráveis ao outorgante;',
    'V — recorrer em qualquer instância, inclusive especial e extraordinária;',
    'VI — receber valores indenizatórios e dar quitação;',
    'VII — substabelecer, no todo ou em parte, com reservas;',
    'VIII — praticar todos os atos necessários à defesa dos interesses do(a) outorgante.',
  ]

  poderes.forEach((p) => {
    y = bloco(doc, p, y, { fontSize: 10, indent: 5, extra: 2 })
  })

  y = espaco(y, 8)
  y = bloco(doc, fmtCidadeData(opcoes), y, { fontSize: 10, center: true, extra: 10 })
  y = linhaAssinatura(doc, y, [
    `${cliente.nome_razao_social}\nOutorgante — Consumidor(a)`,
    `${opcoes.nomeAdvogado || 'Advogado(a) — Outorgado(a)'}`,
  ])

  rodape(doc)
}

function gerarProcuracaoTrabalhista(doc, cliente, opcoes) {
  let y = cabecalho(doc, 'Instrumento Particular de Procuração\nEspecial — Matéria Trabalhista')

  y = secao(doc, 'Outorgante', y)
  y = bloco(
    doc,
    `${qualificacaoPF(cliente)}, empregado(a), nomeia e constitui como seu procurador(a):`,
    y,
    { fontSize: 10.5 }
  )

  y = espaco(y, 3)
  y = secao(doc, 'Outorgado', y)
  y = bloco(doc, fmtAdvogado(opcoes), y, { fontSize: 10.5, bold: true })

  y = espaco(y, 3)
  y = secao(doc, 'Poderes Conferidos', y)
  y = bloco(
    doc,
    'Para representar o(a) outorgante perante a Justiça do Trabalho, Tribunal Regional do Trabalho, Tribunal Superior do Trabalho e órgãos do Ministério do Trabalho, com poderes para:',
    y,
    { fontSize: 10 }
  )

  const poderes = [
    'I — propor reclamação trabalhista, contestar, recorrer em qualquer grau de jurisdição;',
    'II — requerer verbas rescisórias, horas extras, adicional noturno, insalubridade, periculosidade, FGTS e demais direitos trabalhistas;',
    'III — comparecer a audiências, inclusive de conciliação, instrução e julgamento;',
    'IV — firmar acordos, receber e dar quitação;',
    'V — habilitar-se em processos de falência ou recuperação judicial para receber créditos trabalhistas;',
    'VI — substabelecer com ou sem reservas de iguais poderes;',
    'VII — praticar todos os atos necessários ao fiel cumprimento do presente mandato.',
  ]

  poderes.forEach((p) => {
    y = bloco(doc, p, y, { fontSize: 10, indent: 5, extra: 2 })
  })

  y = espaco(y, 8)
  y = bloco(doc, fmtCidadeData(opcoes), y, { fontSize: 10, center: true, extra: 10 })
  y = linhaAssinatura(doc, y, [
    `${cliente.nome_razao_social}\nOutorgante`,
    `${opcoes.nomeAdvogado || 'Advogado(a) — Outorgado(a)'}`,
  ])

  rodape(doc)
}

// ── CONTRATOS ─────────────────────────────────────────────────────────────────

/**
 * @param {object} honorarios
 * @param {string} honorarios.iniciais  — texto da cláusula de honorários iniciais
 * @param {string} honorarios.exito     — texto da cláusula de honorários de êxito
 */
function clausulasGeraisContrato(doc, y, honorarios) {
  y = secao(doc, 'Cláusula 1ª — Do Objeto', y)
  y = bloco(
    doc,
    'O(A) CONTRATADO(A) compromete-se a prestar serviços de advocacia ao(à) CONTRATANTE, consistindo no estudo, orientação jurídica, preparação e acompanhamento de todos os atos processuais e extrajudiciais decorrentes do objeto descrito neste instrumento.',
    y,
    { fontSize: 10 }
  )

  y = secao(doc, 'Cláusula 2ª — Dos Honorários Iniciais', y)
  y = bloco(doc, honorarios.iniciais, y, { fontSize: 10 })

  y = secao(doc, 'Cláusula 3ª — Dos Honorários de Êxito', y)
  y = bloco(doc, honorarios.exito, y, { fontSize: 10 })

  y = secao(doc, 'Cláusula 4ª — Das Despesas Processuais', y)
  y = bloco(
    doc,
    'As custas judiciais, emolumentos, honorários periciais, despesas com diligências e demais gastos processuais correrão por conta do(a) CONTRATANTE, devendo ser adiantadas quando solicitado pelo(a) CONTRATADO(A), independentemente do resultado final da demanda.',
    y,
    { fontSize: 10 }
  )

  y = secao(doc, 'Cláusula 5ª — Da Rescisão', y)
  y = bloco(
    doc,
    'Qualquer das partes poderá rescindir este contrato mediante notificação prévia de 15 (quinze) dias. Os honorários iniciais já pagos são devidos integralmente pelo trabalho realizado até a rescisão e não são restituíveis, salvo por culpa exclusiva do(a) CONTRATADO(A).',
    y,
    { fontSize: 10 }
  )

  y = secao(doc, 'Cláusula 6ª — Do Foro', y)
  y = bloco(
    doc,
    'As partes elegem o foro da comarca de domicílio do(a) CONTRATANTE para dirimir quaisquer controvérsias oriundas do presente instrumento.',
    y,
    { fontSize: 10 }
  )

  return y
}

function gerarContratoRevisao(doc, cliente, opcoes) {
  let y = cabecalho(
    doc,
    'Contrato Particular de Prestação de Serviços\nAdvocatícios — Revisão Contratual/Bancária'
  )

  y = secao(doc, 'Contratante', y)
  y = bloco(doc, qualificacaoPF(cliente), y, { fontSize: 10.5 })

  y = espaco(y, 3)
  y = secao(doc, 'Contratado(a)', y)
  y = bloco(doc, `${fmtAdvogado(opcoes)}, denominado(a) simplesmente CONTRATADO(A).`, y, {
    fontSize: 10.5,
    bold: true,
  })

  y = espaco(y, 3)
  y = secao(doc, 'Do Objeto Específico', y)
  y = bloco(
    doc,
    'O presente contrato tem por objeto a prestação de serviços advocatícios visando a revisão de contrato(s) bancário(s)/financeiro(s) firmado(s) pelo(a) CONTRATANTE, com fundamento no Código de Defesa do Consumidor e legislação aplicável, abrangendo: análise de contratos, identificação de cobranças indevidas (juros abusivos, capitalização ilegal, seguros não contratados), propositura de ação revisional e/ou de repetição de indébito, bem como todos os atos necessários até a conclusão do processo.',
    y,
    { fontSize: 10 }
  )

  y = espaco(y, 3)
  y = clausulasGeraisContrato(doc, y, {
    iniciais:
      'Ficam estabelecidos honorários iniciais no valor de R$ ____________ (___________________________), devidos no ato da assinatura deste contrato, a título de retribuição pelo trabalho de análise, elaboração de peças e abertura do processo. O pagamento deverá ser realizado por: ( ) PIX  ( ) Transferência bancária  ( ) Outro: _______________.',
    exito:
      'Além dos honorários iniciais, ficam fixados honorários de êxito no percentual de ____% (____________ por cento) sobre o valor total obtido ou economizado em favor do(a) CONTRATANTE (sentença, acordo judicial ou êxito administrativo), devidos no prazo de ___ dias após o recebimento efetivo dos valores pelo(a) CONTRATANTE. Em caso de acordo extrajudicial, o percentual incide sobre o valor acordado.',
  })

  y = espaco(y, 8)
  y = bloco(doc, fmtCidadeData(opcoes), y, { fontSize: 10, center: true, extra: 10 })
  y = linhaAssinatura(doc, y, [
    `${cliente.nome_razao_social}\nCONTRATANTE`,
    `${opcoes.nomeAdvogado || 'Advogado(a)'}\nCONTRATADO(A)`,
  ])
  y = espaco(y, 5)
  y = linhaAssinatura(doc, y, ['1ª Testemunha', '2ª Testemunha'])

  rodape(doc)
}

function gerarContratoAposentadoria(doc, cliente, opcoes) {
  let y = cabecalho(
    doc,
    'Contrato Particular de Prestação de Serviços\nAdvocatícios — Concessão/Revisão de Aposentadoria'
  )

  y = secao(doc, 'Contratante', y)
  y = bloco(doc, qualificacaoPF(cliente), y, { fontSize: 10.5 })

  y = espaco(y, 3)
  y = secao(doc, 'Contratado(a)', y)
  y = bloco(doc, `${fmtAdvogado(opcoes)}, denominado(a) CONTRATADO(A).`, y, {
    fontSize: 10.5,
    bold: true,
  })

  y = espaco(y, 3)
  y = secao(doc, 'Do Objeto Específico', y)
  y = bloco(
    doc,
    'O presente contrato tem por objeto a prestação de serviços advocatícios para fins de concessão e/ou revisão de benefício de aposentadoria (por tempo de contribuição, por idade, especial ou por invalidez) junto ao INSS e/ou Justiça Federal, abrangendo: levantamento e organização de documentos, elaboração de requerimento administrativo, acompanhamento do processo no INSS, e, se necessário, propositura de ação judicial perante os Juizados Especiais Federais ou Vara Federal.',
    y,
    { fontSize: 10 }
  )

  y = espaco(y, 3)
  y = secao(doc, 'Cláusula 1ª — Do Objeto', y)
  y = bloco(
    doc,
    'O(A) CONTRATADO(A) responsabiliza-se pelo acompanhamento de todos os atos administrativos e judiciais necessários à concessão ou revisão do benefício previdenciário, mantendo o(a) CONTRATANTE informado(a) sobre o andamento do processo.',
    y,
    { fontSize: 10 }
  )

  y = secao(doc, 'Cláusula 2ª — Dos Honorários Iniciais', y)
  y = bloco(
    doc,
    'Ficam estabelecidos honorários iniciais no valor de R$ ____________ (___________________________), devidos no ato da assinatura deste contrato, a título de remuneração pela análise da documentação, elaboração do requerimento administrativo e acompanhamento junto ao INSS. Forma de pagamento: ( ) PIX  ( ) Transferência bancária  ( ) Outro: _______________.',
    y,
    { fontSize: 10 }
  )

  y = secao(doc, 'Cláusula 3ª — Dos Honorários de Êxito', y)
  y = bloco(
    doc,
    'Em caso de êxito na concessão ou revisão do benefício, ficam fixados honorários de êxito no percentual de ____% (____________ por cento) sobre o valor do benefício mensal concedido multiplicado por 12 (doze) meses. Havendo pagamento de parcelas retroativas (atrasados/RMI), incidirá o percentual de ____% sobre o total dos valores retroativos, devidos no prazo de ___ dias após o recebimento efetivo pelo(a) CONTRATANTE.',
    y,
    { fontSize: 10 }
  )

  y = secao(doc, 'Cláusula 4ª — Das Despesas', y)
  y = bloco(
    doc,
    'As despesas com documentação, perícias médicas, emolumentos e outras despesas processuais serão adiantadas pelo(a) CONTRATANTE quando solicitado pelo(a) CONTRATADO(A), independentemente do resultado da demanda.',
    y,
    { fontSize: 10 }
  )

  y = secao(doc, 'Cláusula 5ª — Da Rescisão e Foro', y)
  y = bloco(
    doc,
    'A rescisão se dará por notificação com 15 dias de antecedência. Os honorários iniciais já pagos não são restituíveis pelo trabalho realizado. Fica eleito o foro da comarca de domicílio do(a) CONTRATANTE.',
    y,
    { fontSize: 10 }
  )

  y = espaco(y, 8)
  y = bloco(doc, fmtCidadeData(opcoes), y, { fontSize: 10, center: true, extra: 10 })
  y = linhaAssinatura(doc, y, [
    `${cliente.nome_razao_social}\nCONTRATANTE`,
    `${opcoes.nomeAdvogado || 'Advogado(a)'}\nCONTRATADO(A)`,
  ])
  y = espaco(y, 5)
  y = linhaAssinatura(doc, y, ['1ª Testemunha', '2ª Testemunha'])

  rodape(doc)
}

function gerarContratoGeral(doc, cliente, opcoes) {
  let y = cabecalho(doc, 'Contrato Particular de Prestação de Serviços\nAdvocatícios — Êxito')

  y = secao(doc, 'Contratante', y)
  y = bloco(doc, qualificacaoPF(cliente), y, { fontSize: 10.5 })

  y = espaco(y, 3)
  y = secao(doc, 'Contratado(a)', y)
  y = bloco(doc, `${fmtAdvogado(opcoes)}, denominado(a) CONTRATADO(A).`, y, {
    fontSize: 10.5,
    bold: true,
  })

  y = espaco(y, 3)
  y = secao(doc, 'Do Objeto Específico', y)
  y = bloco(
    doc,
    'O presente contrato tem por objeto a prestação de serviços advocatícios consistentes em: orientação jurídica, elaboração de peças processuais, acompanhamento de processo judicial/administrativo e representação em todas as instâncias, conforme demanda especificada pelo(a) CONTRATANTE:',
    y,
    { fontSize: 10 }
  )
  y = bloco(
    doc,
    'Objeto/Demanda: ____________________________________________________________\n___________________________________________________________________________',
    y,
    { fontSize: 10, indent: 5 }
  )

  y = espaco(y, 3)
  y = clausulasGeraisContrato(doc, y, {
    iniciais:
      'Ficam estabelecidos honorários iniciais no valor de R$ ____________ (___________________________), devidos no ato da assinatura deste contrato, correspondendo à remuneração pelos serviços de estudo do caso, orientação jurídica e elaboração das peças processuais iniciais. Forma de pagamento: ( ) PIX  ( ) Transferência bancária  ( ) Parcelado em ___ vezes de R$ ____________.',
    exito:
      'Ficam fixados honorários de êxito no percentual de ____% (____________ por cento) sobre o proveito econômico obtido em favor do(a) CONTRATANTE, devidos no prazo de ___ dias após o trânsito em julgado ou recebimento efetivo dos valores. Na hipótese de acordo, o percentual incide sobre o valor total acordado.',
  })

  y = espaco(y, 8)
  y = bloco(doc, fmtCidadeData(opcoes), y, { fontSize: 10, center: true, extra: 10 })
  y = linhaAssinatura(doc, y, [
    `${cliente.nome_razao_social}\nCONTRATANTE`,
    `${opcoes.nomeAdvogado || 'Advogado(a)'}\nCONTRATADO(A)`,
  ])
  y = espaco(y, 5)
  y = linhaAssinatura(doc, y, ['1ª Testemunha', '2ª Testemunha'])

  rodape(doc)
}

function gerarContratoMensal(doc, cliente, opcoes) {
  let y = cabecalho(
    doc,
    'Contrato Particular de Prestação de Serviços\nAdvocatícios — Honorários Mensais (Retainer)'
  )

  y = secao(doc, 'Contratante', y)
  y = bloco(doc, qualificacaoPF(cliente), y, { fontSize: 10.5 })

  y = espaco(y, 3)
  y = secao(doc, 'Contratado(a)', y)
  y = bloco(doc, `${fmtAdvogado(opcoes)}, denominado(a) CONTRATADO(A).`, y, {
    fontSize: 10.5,
    bold: true,
  })

  y = espaco(y, 3)
  y = secao(doc, 'Do Objeto', y)
  y = bloco(
    doc,
    'O presente contrato tem por objeto a prestação de serviços advocatícios de assessoria jurídica contínua, abrangendo consultas, elaboração de documentos, acompanhamento processual e representação judicial/extrajudicial, conforme demanda do(a) CONTRATANTE.',
    y,
    { fontSize: 10 }
  )

  y = secao(doc, 'Cláusula 1ª — Dos Honorários Iniciais', y)
  y = bloco(
    doc,
    'Ficam estabelecidos honorários iniciais no valor de R$ ____________ (___________________________), devidos no ato da assinatura deste contrato, correspondendo ao trabalho de diagnóstico jurídico, estruturação do atendimento e início dos serviços. Forma de pagamento: ( ) PIX  ( ) Transferência bancária  ( ) Outro: _______________.',
    y,
    { fontSize: 10 }
  )

  y = secao(doc, 'Cláusula 2ª — Dos Honorários Mensais', y)
  y = bloco(
    doc,
    'Os honorários mensais de manutenção são fixados em R$ ____________ (_______________________), devidos no dia ___ de cada mês, por transferência bancária ou outra forma acordada. O não pagamento por mais de 30 (trinta) dias consecutivos autoriza a rescisão unilateral pelo(a) CONTRATADO(A), sem prejuízo da cobrança dos valores em aberto.',
    y,
    { fontSize: 10 }
  )

  y = secao(doc, 'Cláusula 3ª — Dos Honorários de Êxito', y)
  y = bloco(
    doc,
    'Eventuais êxitos em demandas judiciais ou administrativas gerarão honorários de êxito adicionais no percentual de ____% (____________ por cento) sobre o proveito econômico obtido, a ser pago no prazo de ___ dias após o recebimento pelo(a) CONTRATANTE. Este percentual não substitui os honorários mensais já contratados.',
    y,
    { fontSize: 10 }
  )

  y = secao(doc, 'Cláusula 4ª — Da Vigência', y)
  y = bloco(
    doc,
    'O presente contrato terá vigência de ___ (_________) meses, com início em ___/___/_______, podendo ser renovado por iguais períodos mediante acordo expresso entre as partes.',
    y,
    { fontSize: 10 }
  )

  y = secao(doc, 'Cláusula 5ª — Da Rescisão e Foro', y)
  y = bloco(
    doc,
    'Rescisão mediante aviso prévio de 30 dias. Os honorários iniciais já pagos não são restituíveis. Fica eleito o foro da comarca de domicílio do(a) CONTRATANTE.',
    y,
    { fontSize: 10 }
  )

  y = espaco(y, 8)
  y = bloco(doc, fmtCidadeData(opcoes), y, { fontSize: 10, center: true, extra: 10 })
  y = linhaAssinatura(doc, y, [
    `${cliente.nome_razao_social}\nCONTRATANTE`,
    `${opcoes.nomeAdvogado || 'Advogado(a)'}\nCONTRATADO(A)`,
  ])
  y = espaco(y, 5)
  y = linhaAssinatura(doc, y, ['1ª Testemunha', '2ª Testemunha'])

  rodape(doc)
}

// ── DECLARAÇÕES ───────────────────────────────────────────────────────────────

function gerarDeclaracaoHipossuficiencia(doc, cliente, opcoes) {
  let y = cabecalho(doc, 'Declaração de Hipossuficiência Econômica')

  y = espaco(y, 5)
  y = bloco(doc, `Eu, ${qualificacaoPF(cliente)},`, y, { fontSize: 11 })

  y = espaco(y, 3)
  y = bloco(
    doc,
    'DECLARO, sob as penas da lei, para os fins de obtenção dos benefícios da JUSTIÇA GRATUITA, nos termos do art. 98 e seguintes do Código de Processo Civil (Lei nº 13.105/2015) e do art. 5º, LXXIV, da Constituição Federal, que:',
    y,
    { fontSize: 11 }
  )

  y = espaco(y, 3)
  y = bloco(
    doc,
    '1 — Sou pessoa hipossuficiente economicamente, não possuindo condições financeiras de arcar com as custas processuais e honorários advocatícios sem prejuízo do próprio sustento e de minha família;',
    y,
    { fontSize: 10.5, indent: 5 }
  )

  y = bloco(
    doc,
    `2 — Minha renda mensal é de aproximadamente R$ _____________________ (_______________________), proveniente de: ____________________________________________;`,
    y,
    { fontSize: 10.5, indent: 5 }
  )

  y = bloco(doc, '3 — Possuo ___ (___________) dependentes;', y, { fontSize: 10.5, indent: 5 })

  y = bloco(
    doc,
    '4 — Não possuo bens imóveis, veículos ou investimentos de valor significativo que possam ser utilizados para custear as despesas processuais.',
    y,
    { fontSize: 10.5, indent: 5 }
  )

  y = espaco(y, 5)
  y = bloco(
    doc,
    'Estou ciente de que a falsidade desta declaração constitui ato atentatório à dignidade da Justiça, sujeitando o(a) declarante às sanções do art. 100, parágrafo único, do CPC, sem prejuízo das responsabilidades civil e penal.',
    y,
    { fontSize: 10.5 }
  )

  y = espaco(y, 10)
  y = bloco(doc, fmtCidadeData(opcoes), y, { fontSize: 10.5, center: true, extra: 12 })
  y = linhaAssinatura(doc, y, [`${cliente.nome_razao_social}\nDeclarante`])

  rodape(doc)
}

function gerarDeclaracaoResidencia(doc, cliente, opcoes) {
  let y = cabecalho(doc, 'Declaração de Residência')

  y = espaco(y, 5)
  y = bloco(doc, `Eu, ${qualificacaoPF(cliente)},`, y, { fontSize: 11 })

  y = espaco(y, 3)
  y = bloco(
    doc,
    'DECLARO, para os devidos fins de direito e sob as penas da lei, que resido e tenho domicílio no seguinte endereço:',
    y,
    { fontSize: 11 }
  )

  y = espaco(y, 3)
  y = bloco(doc, `Endereço: ${fmtEndereco(cliente)}`, y, { fontSize: 11, bold: true, indent: 5 })

  y = espaco(y, 5)
  y = bloco(
    doc,
    'Declaro ainda que as informações acima são verdadeiras e que resido no referido endereço há ______ (___________________) meses/anos, com caráter permanente.',
    y,
    { fontSize: 10.5 }
  )

  y = espaco(y, 5)
  y = bloco(
    doc,
    'Estou ciente de que a prestação de informações falsas constitui crime tipificado no art. 299 do Código Penal.',
    y,
    { fontSize: 10.5 }
  )

  y = espaco(y, 10)
  y = bloco(doc, fmtCidadeData(opcoes), y, { fontSize: 10.5, center: true, extra: 12 })
  y = linhaAssinatura(doc, y, [`${cliente.nome_razao_social}\nDeclarante`])

  rodape(doc)
}

function gerarDeclaracaoDependente(doc, cliente, opcoes) {
  let y = cabecalho(doc, 'Declaração de Dependência Econômica')

  y = espaco(y, 5)
  y = bloco(doc, `Eu, ${qualificacaoPF(cliente)},`, y, { fontSize: 11 })

  y = espaco(y, 3)
  y = bloco(
    doc,
    'DECLARO, para os fins de direito e sob as penas da lei, que a(s) pessoa(s) abaixo identificada(s) é/são meu(s) dependente(s) econômico(s), vivendo sob meu sustento e responsabilidade financeira:',
    y,
    { fontSize: 11 }
  )

  y = espaco(y, 5)
  const linhasTabela = [
    'Nome completo                  | Parentesco      | Data de Nasc.',
    '________________________________|_________________|_______________',
    '________________________________|_________________|_______________',
    '________________________________|_________________|_______________',
    '________________________________|_________________|_______________',
  ]
  linhasTabela.forEach((l) => {
    y = bloco(doc, l, y, { fontSize: 9.5, indent: 5, extra: 1 })
  })

  y = espaco(y, 8)
  y = bloco(
    doc,
    'Declaro que as informações acima são verídicas e que sou o único(a) responsável pelo sustento dos referidos dependentes.',
    y,
    { fontSize: 10.5 }
  )

  y = espaco(y, 10)
  y = bloco(doc, fmtCidadeData(opcoes), y, { fontSize: 10.5, center: true, extra: 12 })
  y = linhaAssinatura(doc, y, [`${cliente.nome_razao_social}\nDeclarante`])

  rodape(doc)
}

// ─── mapa de funções ──────────────────────────────────────────────────────────

const GERADORES = {
  procuracao_civil: gerarProcuracaoCivil,
  procuracao_previdenciaria: gerarProcuracaoPrevidenciaria,
  procuracao_consumidor: gerarProcuracaoConsumidor,
  procuracao_trabalhista: gerarProcuracaoTrabalhista,
  contrato_revisao: gerarContratoRevisao,
  contrato_aposentadoria: gerarContratoAposentadoria,
  contrato_geral: gerarContratoGeral,
  contrato_mensal: gerarContratoMensal,
  declaracao_hipossuficiencia: gerarDeclaracaoHipossuficiencia,
  declaracao_residencia: gerarDeclaracaoResidencia,
  declaracao_dependente: gerarDeclaracaoDependente,
}

/**
 * Gera e faz download do documento jurídico.
 * @param {string} templateId  — id do template (ver MODELOS)
 * @param {object} cliente     — dados do cliente vindos da API
 * @param {object} opcoes      — { nomeAdvogado, oab, estadoOAB, cidade }
 */
export function gerarDocumento(templateId, cliente, opcoes = {}) {
  const gerador = GERADORES[templateId]
  if (!gerador) throw new Error(`Template "${templateId}" não encontrado.`)

  const doc = novaDoc()
  gerador(doc, cliente, opcoes)

  const nomeCliente = (cliente.nome_razao_social || 'cliente').replace(/\s+/g, '_').toLowerCase()
  const nomeArquivo = `${templateId}_${nomeCliente}.pdf`
  doc.save(nomeArquivo)
}
