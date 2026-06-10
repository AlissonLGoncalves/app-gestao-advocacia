"""Helpers compartilhados entre módulos de modelo."""


def _iniciais_de_nome(nome):
    """Retorna ate 2 iniciais maiusculas do nome completo.

    Used to render avatar pills in UI (e.g. "Alisson Luiz" -> "AL").
    Returns None for empty/None input so callers can fall back.
    """
    if not nome:
        return None
    partes = [p for p in str(nome).strip().split() if p]
    if not partes:
        return None
    if len(partes) == 1:
        return partes[0][:2].upper()
    return (partes[0][0] + partes[-1][0]).upper()
