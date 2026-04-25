"""enriquecimento-cnj: utilitario unificado para Numero Unico CNJ.

Espelha a logica do frontend (gestao_advocacia_vite/src/utils/cnj.js) para
parse/regex e adiciona validacao do digito verificador (Resolucao CNJ 65/2008,
modulo 97 base 10).

Formato CNJ canonico: NNNNNNN-DD.AAAA.J.TR.OOOO
  N (7 digitos): numero sequencial
  D (2 digitos): digito verificador
  A (4 digitos): ano
  J (1 digito) : segmento de justica
  T (2 digitos): tribunal
  O (4 digitos): orgao/unidade

Algoritmo do DV:
  1. Concatena NNNNNNN + AAAA + J + TR + OOOO + "00" (sem o DD).
  2. resto = int(concat) % 97
  3. dv_esperado = 98 - resto
  4. valido se dv_esperado == int(DD)
"""

import re

# Regex para extrair CNJ de texto livre (com lookarounds anti-digito).
CNJ_REGEX_TEXTO = re.compile(r"(?<!\d)(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})(?!\d)")

# Regex ancorado para validar string completa (string ja deve conter so o numero).
CNJ_REGEX_STRICT = re.compile(r"^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$")

# Defesa contra payload abusivo: regex e validacoes operam no maximo neste tamanho.
_TEXTO_MAX_CHARS = 100_000

# Janela (chars antes do match) para detectar prefixos como "autos n", "processo:"
_PREFIX_WINDOW = 30
_PREFIX_PRIORITY = re.compile(
    r"(?:autos\s+n[ºo°]?|autos\s+numero|processo\s*[:\-]|processo\s+n[ºo°]?|proc\.?\s*n[ºo°]?)\s*$",
    re.IGNORECASE,
)


def somente_digitos_cnj(numero):
    """Remove pontuacao do numero CNJ, retorna so digitos. None-safe."""
    if not numero:
        return ""
    return re.sub(r"\D", "", str(numero))


def validar_dv_cnj(numero):
    """Valida o DV do numero CNJ (Resolucao 65/2008, mod 97 base 10).

    Aceita string formatada ('NNNNNNN-DD.AAAA.J.TR.OOOO') ou apenas digitos
    (20 caracteres). None/invalido -> False (sem raise).
    """
    if not numero:
        return False
    digitos = somente_digitos_cnj(numero)
    if len(digitos) != 20:
        return False

    seq = digitos[0:7]
    dv = digitos[7:9]
    aaaa = digitos[9:13]
    j = digitos[13:14]
    tr = digitos[14:16]
    oooo = digitos[16:20]

    try:
        # Concatena tudo SEM o DD, e adiciona "00" no final para o calculo.
        base = seq + aaaa + j + tr + oooo + "00"
        resto = int(base) % 97
        dv_esperado = 98 - resto
        return dv_esperado == int(dv)
    except (ValueError, TypeError):
        return False


def extrair_numeros_cnj(texto):
    """Lista de numeros CNJ (formato canonico) encontrados em `texto`, dedup.

    None/'' -> []. Slice em 100_000 chars para defesa em profundidade.
    """
    if not texto:
        return []
    s = str(texto)
    if len(s) > _TEXTO_MAX_CHARS:
        s = s[:_TEXTO_MAX_CHARS]

    encontrados = []
    seen = set()
    for match in CNJ_REGEX_TEXTO.finditer(s):
        nnnnnnn, dd, aaaa, j, tt, oooo = match.groups()
        canonico = f"{nnnnnnn}-{dd}.{aaaa}.{j}.{tt}.{oooo}"
        if canonico in seen:
            continue
        seen.add(canonico)
        encontrados.append(canonico)
    return encontrados


def extrair_primeiro_cnj_valido(texto):
    """Primeiro numero CNJ no texto que passa em validar_dv_cnj.

    Preferencia: se houver match precedido (janela de 30 chars) por 'autos n',
    'processo:' etc, esse e priorizado. Retorna None se nenhum valido.
    """
    if not texto:
        return None
    s = str(texto)
    if len(s) > _TEXTO_MAX_CHARS:
        s = s[:_TEXTO_MAX_CHARS]

    candidato_priorizado = None
    candidato_simples = None

    for match in CNJ_REGEX_TEXTO.finditer(s):
        nnnnnnn, dd, aaaa, j, tt, oooo = match.groups()
        canonico = f"{nnnnnnn}-{dd}.{aaaa}.{j}.{tt}.{oooo}"
        if not validar_dv_cnj(canonico):
            continue

        if candidato_simples is None:
            candidato_simples = canonico

        # Olha janela antes do match para identificar prefixo de prioridade
        inicio = max(0, match.start() - _PREFIX_WINDOW)
        antes = s[inicio:match.start()]
        if _PREFIX_PRIORITY.search(antes):
            candidato_priorizado = canonico
            break

    return candidato_priorizado or candidato_simples
