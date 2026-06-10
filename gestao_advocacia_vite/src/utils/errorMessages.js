// Issue #299 — tradutor central de erros HTTP → mensagem amigável PT-BR.
//
// Por que aqui: ~99 call-sites fazem `toast.error(err.message)`. Em vez de
// tocar cada um, o api/client.js usa este mapa pra montar a MENSAGEM do
// Error lançado — todo toast existente fica amigável de graça. O texto
// técnico original continua disponível em `err.technical` e `err.payload`
// pra depuração (console).

// Mensagens vindas do backend em PT-BR (validações de formulário etc.)
// devem ser preservadas — são úteis ("Título do caso é obrigatório").
// Heurística: se contém termo tipicamente técnico/inglês, descarta.
const PADROES_TECNICOS = [
  /traceback/i,
  /exception/i,
  /not found\b/i,
  /internal server error/i,
  /unauthorized/i,
  /forbidden/i,
  /bad request/i,
  /service unavailable/i,
  /gateway/i,
  /^http \d{3}$/i,
  /sqlalchemy|psycopg|integrityerror/i,
  /tenant/i,
  /jwt|token expired|signature/i,
  /undefined|null is not|cannot read/i,
]

export function pareceTecnica(msg) {
  if (!msg || typeof msg !== 'string') return true
  if (msg.length > 300) return true
  return PADROES_TECNICOS.some((re) => re.test(msg))
}

const POR_STATUS = {
  400: 'Dados inválidos — confira os campos e tente de novo.',
  401: 'Sessão expirada. Entre novamente.',
  403: 'Você não tem permissão para esta ação.',
  404: 'Registro não encontrado — pode ter sido removido.',
  409: 'Conflito: este registro já existe ou foi alterado por outra pessoa.',
  413: 'Arquivo grande demais para o servidor.',
  422: 'Dados inválidos — confira os campos e tente de novo.',
  429: 'Muitas tentativas seguidas. Aguarde um instante e tente de novo.',
  500: 'Erro interno no servidor. Tente novamente em instantes.',
  502: 'Servidor indisponível no momento. Tente novamente em instantes.',
  503: 'Servidor indisponível no momento. Tente novamente em instantes.',
  504: 'O servidor demorou demais para responder. Tente novamente.',
}

export const ERRO_REDE = 'Sem conexão com o servidor. Verifique sua internet e tente de novo.'

/**
 * Monta a mensagem amigável pra um erro HTTP.
 * @param {number} status  código HTTP
 * @param {string} msgBackend  message/erro vindos do payload do backend
 */
export function mensagemAmigavel(status, msgBackend) {
  // 4xx de validação: o backend costuma mandar PT-BR útil — preserva,
  // a menos que pareça técnica (inglês/stack/jargão).
  if (status >= 400 && status < 500 && msgBackend && !pareceTecnica(msgBackend)) {
    return msgBackend
  }
  return POR_STATUS[status] || 'Algo deu errado. Tente novamente em instantes.'
}
