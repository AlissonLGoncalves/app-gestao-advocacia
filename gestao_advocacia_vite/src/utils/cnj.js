// Utilitário para parsing e formatação do Número Único CNJ
// Resolução CNJ 65/2008 — Formato: NNNNNNN-DD.AAAA.J.TT.OOOO

const CNJ_REGEX = /^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/;

// J=4 Justiça Federal — TRFs
const TRF_CODES = {
  '01': 'TRF1 (AC, AM, AP, BA, GO, MA, MT, PA, PI, RO, RR, TO, DF)',
  '02': 'TRF2 (ES, RJ)',
  '03': 'TRF3 (MS, SP)',
  '04': 'TRF4 (PR, RS, SC)',
  '05': 'TRF5 (AL, CE, PB, PE, RN, SE)',
  '06': 'TRF6 (MG)',
};

// J=5 Justiça do Trabalho — TRTs
const TRT_CODES = {
  '01': 'TRT1 (RJ)', '02': 'TRT2 (SP - Capital)', '03': 'TRT3 (MG)',
  '04': 'TRT4 (RS)', '05': 'TRT5 (BA)', '06': 'TRT6 (PE)',
  '07': 'TRT7 (CE)', '08': 'TRT8 (PA/AP)', '09': 'TRT9 (PR)',
  '10': 'TRT10 (DF/TO)', '11': 'TRT11 (AM/RR)', '12': 'TRT12 (SC)',
  '13': 'TRT13 (PB)', '14': 'TRT14 (RO/AC)', '15': 'TRT15 (SP - Interior)',
  '16': 'TRT16 (MA)', '17': 'TRT17 (ES)', '18': 'TRT18 (GO)',
  '19': 'TRT19 (AL)', '20': 'TRT20 (SE)', '21': 'TRT21 (RN)',
  '22': 'TRT22 (PI)', '23': 'TRT23 (MT)', '24': 'TRT24 (MS)',
};

// J=8 Justiça Estadual — Tribunais de Justiça por estado
const TJ_CODES = {
  '01': 'TJAC', '02': 'TJAL', '03': 'TJAP', '04': 'TJAM',
  '05': 'TJBA', '06': 'TJCE', '07': 'TJES', '08': 'TJGO',
  '09': 'TJMA', '10': 'TJMT', '11': 'TJMS', '12': 'TJMG',
  '13': 'TJPA', '14': 'TJPB', '15': 'TJPE', '16': 'TJPR',
  '17': 'TJRN', '18': 'TJRS', '19': 'TJRO', '20': 'TJRR',
  '21': 'TJSC', '22': 'TJSP', '23': 'TJSE', '24': 'TJTO',
  '25': 'TJPI', '26': 'TJRJ', '27': 'TJRR',
};

// J=6 Justiça Eleitoral — TREs
const TRE_CODES = {
  '01': 'TRE-AC', '02': 'TRE-AL', '03': 'TRE-AP', '04': 'TRE-AM',
  '05': 'TRE-BA', '06': 'TRE-CE', '07': 'TRE-DF', '08': 'TRE-ES',
  '09': 'TRE-GO', '10': 'TRE-MA', '11': 'TRE-MT', '12': 'TRE-MS',
  '13': 'TRE-MG', '14': 'TRE-PA', '15': 'TRE-PB', '16': 'TRE-PR',
  '17': 'TRE-PE', '18': 'TRE-PI', '19': 'TRE-RJ', '20': 'TRE-RN',
  '21': 'TRE-RS', '22': 'TRE-RO', '23': 'TRE-RR', '24': 'TRE-SC',
  '25': 'TRE-SE', '26': 'TRE-SP', '27': 'TRE-TO',
};

function getTribunalNome(j, tt) {
  switch (j) {
    case '4': return TRF_CODES[tt] || `TRF${tt}`;
    case '5': return TRT_CODES[tt] || `TRT${tt}`;
    case '6': return TRE_CODES[tt] || `TRE-${tt}`;
    case '8': return TJ_CODES[tt]  || `TJ-${tt}`;
    default:  return null;
  }
}

// Segmentos de justiça (dígito J)
// Resolução CNJ 65/2008:
// 1=STF, 2=CNJ, 3=STJ, 4=Fed, 5=Trab, 6=Eleit, 7=MilUnião, 8=Estadual, 9=TJDFT
const SEGMENTOS = {
  '1': { nome: 'STF',                       area: 'Constitucional', instancia: '3ª Instância (STF)' },
  '2': { nome: 'CNJ',                        area: 'Administrativo', instancia: 'Administrativa'     },
  '3': { nome: 'STJ',                        area: 'Federal',        instancia: '3ª Instância (STJ)' },
  '4': { nome: 'Justiça Federal',            area: 'Federal',        instancia: '1ª Instância'       },
  '5': { nome: 'Justiça do Trabalho',        area: 'Trabalhista',    instancia: '1ª Instância'       },
  '6': { nome: 'Justiça Eleitoral',          area: 'Eleitoral',      instancia: '1ª Instância'       },
  '7': { nome: 'Justiça Militar da União',   area: 'Militar',        instancia: '1ª Instância'       },
  '8': { nome: 'Justiça Estadual',           area: 'Cível',          instancia: '1ª Instância'       },
  '9': { nome: 'TJDFT',                      area: 'Cível',          instancia: '1ª Instância'       },
};

/**
 * Faz o parse do número CNJ e retorna as informações extraídas.
 * Retorna null se o número não for válido.
 */
export function parseCNJ(numero) {
  if (!numero) return null;
  const limpo = numero.replace(/\s/g, '');
  const match = limpo.match(CNJ_REGEX);
  if (!match) return null;

  const [, , , aaaa, j, tt] = match;
  const seg = SEGMENTOS[j] || { nome: 'Desconhecido', area: '', instancia: '' };
  const tribunalNome = getTribunalNome(j, tt);

  return {
    valido: true,
    numero: limpo,
    ano: aaaa,
    segmentoId: j,
    tribunal: tt,
    tribunalNome: tribunalNome || seg.nome,
    segmentoNome: seg.nome,
    areaSugerida: seg.area,
    instanciaSugerida: seg.instancia,
  };
}

/**
 * Aplica a máscara CNJ enquanto o usuário digita.
 * NNNNNNN-DD.AAAA.J.TT.OOOO
 */
export function formatCNJ(valor) {
  const digits = valor.replace(/\D/g, '').slice(0, 20);
  if (!digits) return '';

  let result = '';
  for (let i = 0; i < digits.length; i++) {
    if (i === 7)  result += '-';
    if (i === 9)  result += '.';
    if (i === 13) result += '.';
    if (i === 14) result += '.';
    if (i === 16) result += '.';
    result += digits[i];
  }
  return result;
}
