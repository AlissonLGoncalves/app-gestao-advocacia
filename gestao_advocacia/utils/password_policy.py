"""Política de força de senha da aplicação.

Regras obrigatórias:
- Mínimo 10 caracteres
- Pelo menos 1 letra maiúscula
- Pelo menos 1 letra minúscula
- Pelo menos 1 dígito
- Pelo menos 1 caractere especial
"""

import re

# Conjunto de caracteres especiais aceitos (visíveis no teclado BR/US, sem
# ambiguidades). Inclui pontuação comum e símbolos de teclado padrão.
SPECIAL_CHARS_PATTERN = r"[!@#$%^&*()\-_=+\[\]{};:'\",.<>/?\\|`~]"


def validar_forca_senha(password: str) -> tuple[bool, str | None]:
    """Valida a força da senha conforme a política da aplicação.

    Retorna (True, None) se válida ou (False, mensagem_de_erro) se inválida.
    """
    if len(password) < 10:
        return False, "A senha deve ter no mínimo 10 caracteres."
    if not re.search(r"[A-Z]", password):
        return False, "A senha deve conter pelo menos uma letra maiúscula."
    if not re.search(r"[a-z]", password):
        return False, "A senha deve conter pelo menos uma letra minúscula."
    if not re.search(r"\d", password):
        return False, "A senha deve conter pelo menos um número."
    if not re.search(SPECIAL_CHARS_PATTERN, password):
        return False, "A senha deve conter pelo menos um caractere especial (!@#$%&*…)."
    return True, None
