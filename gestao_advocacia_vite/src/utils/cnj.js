// Utilitário para parsing e formatação do Número Único CNJ
// Formato: NNNNNNN-DD.AAAA.J.TT.OOOO

const CNJ_REGEX = /^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/;

const SEGMENTOS = {
  '1': { nome: 'STF',                      area: 'Constitucional', instancia: '3ª Instância (STF)' },
  '2': { nome: 'CNJ',                      area: 'Administrativo', instancia: 'Administrativa'      },
  '3': { nome: 'STJ',                      area: 'Federal',        instancia: '3ª Instância (STJ)' },
  '4': { nome: 'Justiça Federal (TRF)',    area: 'Cível',          instancia: '1ª Instância'        },
  '5': { nome: 'Justiça do Trabalho (TRT)',area: 'Trabalhista',    instancia: '1ª Instância'        },
  '6': { nome: 'Justiça Eleitoral (TRE)', area: 'Eleitoral',      instancia: '1ª Instância'        },
  '7': { nome: 'Justiça Militar Estadual',area: 'Militar',        instancia: '1ª Instância'        },
  '8': { nome: 'TJDFT',                   area: 'Cível',          instancia: '1ª Instância'        },
  '9': { nome: 'Justiça Estadual (TJ)',   area: 'Cível',          instancia: '1ª Instância'        },
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

  return {
    valido: true,
    numero: limpo,
    ano: aaaa,
    segmentoId: j,
    tribunal: tt,
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
