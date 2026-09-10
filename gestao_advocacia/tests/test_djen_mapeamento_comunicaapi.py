"""Mapeamento dos campos da ComunicaAPI (regressao de 10/09/2026).

O payload abaixo e' uma copia reduzida de uma resposta real de
comunicaapi.pje.jus.br (OAB/PR, TRT9, set/2026) — as CHAVES sao exatamente as
que a API devolve. Ate esta data o codigo procurava "numeroProcesso" e uma
lista "partes", que nao existem na resposta: toda publicacao entrava sem
numero de processo e sem partes, quebrando o auto-vinculo ao caso.
"""

from djen_tasks import _extrair_polos_do_item, _item_get

# Formato real: snake_case no numero, "destinatarios" com polo de uma letra.
ITEM_REAL = {
    "hash": "abc123",
    "id": 719541221,
    "numero_processo": "01025003719995090089",
    "numeroprocessocommascara": "0102500-37.1999.5.09.0089",
    "siglaTribunal": "TRT9",
    "nomeClasse": "AGRAVO DE PETICAO",
    "nomeOrgao": "Secao Especializada",
    "tipoComunicacao": "Intimacao",
    "data_disponibilizacao": "2026-09-09",
    "texto": "PODER JUDICIARIO ... AGRAVANTE: JOAO DOMINGOS PINTO",
    "destinatarios": [
        {"nome": "JOAO DOMINGOS PINTO", "comunicacao_id": 719541221, "polo": "A"},
        {"nome": "LUCIANO CANOVA", "comunicacao_id": 719541221, "polo": "P"},
        {"nome": "CARLOS ALBERTO CORREA", "comunicacao_id": 719541221, "polo": "P"},
    ],
}


def test_numero_processo_snake_case_e_lido():
    """A chave real e' numero_processo — sem isso a caixa fica sem numero."""
    achado = _item_get(ITEM_REAL, "numero_processo", "numeroProcesso", "numeroprocesso")
    assert achado == "01025003719995090089"


def test_numero_com_mascara_e_lido():
    achado = _item_get(
        ITEM_REAL,
        "numeroprocessocommascara",
        "numeroProcessoComMascara",
        "numeroProcessoMascara",
    )
    assert achado == "0102500-37.1999.5.09.0089"


def test_polos_vem_de_destinatarios_com_letra():
    ativo, passivo = _extrair_polos_do_item(ITEM_REAL)
    assert ativo == "JOAO DOMINGOS PINTO"
    assert passivo == "LUCIANO CANOVA | CARLOS ALBERTO CORREA"


def test_polos_aceita_formato_antigo_partes_tipoparte():
    """Compatibilidade: se algum tribunal ainda mandar o formato antigo."""
    item = {
        "partes": [
            {"nome": "AUTOR LTDA", "tipoParte": "POLO ATIVO"},
            {"nome": "REU SA", "tipoParte": "POLO PASSIVO"},
        ]
    }
    ativo, passivo = _extrair_polos_do_item(item)
    assert ativo == "AUTOR LTDA"
    assert passivo == "REU SA"


def test_polos_sem_partes_retorna_none():
    ativo, passivo = _extrair_polos_do_item({"texto": "sem partes"})
    assert ativo is None
    assert passivo is None


def test_polos_ignora_entrada_sem_nome_e_nao_quebra_com_lixo():
    item = {"destinatarios": [{"polo": "A"}, "texto solto", {"nome": "", "polo": "P"}]}
    assert _extrair_polos_do_item(item) == (None, None)
    assert _extrair_polos_do_item({"destinatarios": "nao e lista"}) == (None, None)


def test_polo_desconhecido_cai_no_ativo():
    """Sem polo declarado a parte aparece — melhor no ativo do que sumir."""
    item = {"destinatarios": [{"nome": "FULANO", "polo": ""}]}
    ativo, passivo = _extrair_polos_do_item(item)
    assert ativo == "FULANO"
    assert passivo is None
