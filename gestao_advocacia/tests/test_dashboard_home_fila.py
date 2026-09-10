"""Campos novos do /dashboard/home para a tela "Seu dia" (redesign Stitch).

Cobre: campos presentes com banco vazio (zeros), fila de intimacoes agrupada
por tribunal, progresso do dia, sequencia de dias e resumo da semana.
"""

from datetime import datetime, time, timedelta, timezone

from models import Caso, Cliente, ItemAgenda, PublicacaoDJEN, User
from utils.datas import TZ_BRASIL, hoje_brasil

CAMPOS_NOVOS = {
    "eventos_hoje",
    "fila_intimacoes_por_tribunal",
    "progresso_hoje",
    "resolvidas_hoje",
    "sequencia_dias",
    "semana",
    "captura_hoje",
}


def _meio_dia_utc(dia):
    """Timestamp naive UTC equivalente ao meio-dia (Brasil) do dia informado.

    Mesmo formato gravado por `datetime.utcnow()` em tratado_em/tratada_em.
    """
    local = datetime.combine(dia, time(12, 0), tzinfo=TZ_BRASIL)
    return local.astimezone(timezone.utc).replace(tzinfo=None)


def _usuario(auth_client, db):
    return db.session.get(User, int(auth_client.user["id"]))


def _caso(db, usuario, numero_processo=None):
    cliente = Cliente(
        nome_razao_social="Cliente Fila",
        cpf_cnpj=f"FILA-{numero_processo or 'sem'}",
        tipo_pessoa="PF",
        user_id=usuario.id,
        tenant_id=usuario.tenant_id,
    )
    db.session.add(cliente)
    db.session.flush()
    caso = Caso(
        titulo="Caso da Fila",
        numero_processo=numero_processo,
        cliente_id=cliente.id,
        user_id=usuario.id,
        tenant_id=usuario.tenant_id,
    )
    db.session.add(caso)
    db.session.flush()
    return caso


def _publicacao(usuario, **kwargs):
    base = {
        "tenant_id": usuario.tenant_id,
        "user_id": usuario.id,
        "ativo": True,
        "triagem_ignorada": False,
        "texto": "Intimacao para manifestacao",
    }
    base.update(kwargs)
    return PublicacaoDJEN(**base)


def test_campos_novos_presentes_com_banco_vazio(auth_client):
    response = auth_client.get("/api/v1/dashboard/home")

    assert response.status_code == 200
    payload = response.get_json()
    assert CAMPOS_NOVOS <= set(payload)
    assert payload["eventos_hoje"] == []
    assert payload["fila_intimacoes_por_tribunal"] == []
    assert payload["progresso_hoje"] == {"resolvidas": 0, "total": 0}
    assert payload["resolvidas_hoje"] == []
    assert payload["sequencia_dias"] == 0
    assert payload["semana"] == {"intimacoes_tratadas": 0, "prazos_perdidos": 0}
    assert payload["captura_hoje"] == {"publicacoes": 0, "tribunais": [], "vinculadas": 0}


def test_fila_de_intimacoes_agrupada_por_tribunal(auth_client, db):
    usuario = _usuario(auth_client, db)
    caso = _caso(db, usuario)
    hoje = hoje_brasil()
    db.session.add_all(
        [
            _publicacao(usuario, sigla_tribunal="TJPR", data_disponibilizacao=hoje),
            _publicacao(usuario, sigla_tribunal="TJPR", data_disponibilizacao=hoje),
            _publicacao(usuario, sigla_tribunal="TJPR", data_disponibilizacao=hoje),
            _publicacao(usuario, sigla_tribunal="TRT9", data_disponibilizacao=hoje),
            # Vinculada a caso mas ainda sem tratamento: continua na fila
            # (mesmo criterio do inbox "Nao tratadas") e conta como vinculada.
            _publicacao(
                usuario, sigla_tribunal="TRT9", data_disponibilizacao=hoje, caso_id=caso.id
            ),
            # Ja tratada: sai da fila.
            _publicacao(
                usuario,
                sigla_tribunal="TRT9",
                data_disponibilizacao=hoje,
                tratada_em=_meio_dia_utc(hoje),
            ),
            # Ignorada na triagem: fora da fila.
            _publicacao(usuario, sigla_tribunal="TST", triagem_ignorada=True),
        ]
    )
    db.session.commit()

    payload = auth_client.get("/api/v1/dashboard/home").get_json()

    assert payload["fila_intimacoes_por_tribunal"] == [
        {"tribunal": "TJPR", "quantidade": 3},
        {"tribunal": "TRT9", "quantidade": 2},
    ]
    assert payload["resumo"]["intimacoes_pendentes"] == 5
    assert payload["captura_hoje"] == {
        "publicacoes": 6,
        "tribunais": ["TJPR", "TRT9"],
        "vinculadas": 1,
    }


def test_progresso_do_dia_soma_resolvidas_e_pendentes(auth_client, db):
    usuario = _usuario(auth_client, db)
    caso = _caso(db, usuario, numero_processo="0001234-56.2026.8.16.0001")
    hoje = hoje_brasil()
    agora = _meio_dia_utc(hoje)
    db.session.add_all(
        [
            ItemAgenda(
                tipo="tarefa",
                titulo="Contestacao protocolada",
                status="Concluido",
                tratado_em=agora,
                caso_id=caso.id,
                user_id=usuario.id,
                tenant_id=usuario.tenant_id,
            ),
            ItemAgenda(
                tipo="tarefa",
                titulo="Prazo de ontem",
                status="Pendente",
                data_vencimento=datetime.combine(hoje - timedelta(days=1), time(12, 0)),
                caso_id=caso.id,
                user_id=usuario.id,
                tenant_id=usuario.tenant_id,
            ),
            ItemAgenda(
                tipo="evento",
                titulo="Audiencia una",
                status="Pendente",
                data_inicio=datetime.combine(hoje, time(14, 0)),
                caso_id=caso.id,
                user_id=usuario.id,
                tenant_id=usuario.tenant_id,
            ),
            _publicacao(usuario, sigla_tribunal="TJPR", tratada_em=agora, lida=True),
            _publicacao(usuario, sigla_tribunal="TJPR"),
        ]
    )
    db.session.commit()

    payload = auth_client.get("/api/v1/dashboard/home").get_json()

    # 2 resolvidas (1 tarefa tratada + 1 publicacao tratada); pendentes:
    # prazo vencido + evento de hoje + publicacao sem tratar = 3.
    assert payload["progresso_hoje"] == {"resolvidas": 2, "total": 5}
    titulos = {item["titulo"] for item in payload["resolvidas_hoje"]}
    assert "Contestacao protocolada" in titulos
    assert {item["tipo"] for item in payload["resolvidas_hoje"]} == {"tarefa", "publicacao"}

    evento = payload["eventos_hoje"][0]
    assert evento["titulo"] == "Audiencia una"
    assert evento["numero_processo"] == "0001234-56.2026.8.16.0001"
    assert evento["tribunal"] == "TJPR"

    tarefa = payload["tarefas_prioritarias"][0]
    assert tarefa["titulo"] == "Prazo de ontem"
    assert tarefa["urgencia"] == "vencido"
    assert tarefa["numero_processo"] == "0001234-56.2026.8.16.0001"
    assert tarefa["tribunal"] == "TJPR"


def test_sequencia_conta_dois_dias_seguidos(auth_client, db):
    usuario = _usuario(auth_client, db)
    hoje = hoje_brasil()
    ontem = hoje - timedelta(days=1)
    anteontem = hoje - timedelta(days=2)
    db.session.add_all(
        [
            ItemAgenda(
                tipo="tarefa",
                titulo="Tratado ontem",
                status="Concluido",
                tratado_em=_meio_dia_utc(ontem),
                user_id=usuario.id,
                tenant_id=usuario.tenant_id,
            ),
            _publicacao(usuario, sigla_tribunal="TJPR", tratada_em=_meio_dia_utc(anteontem)),
            # Buraco em hoje-3; hoje-4 nao deve contar.
            _publicacao(
                usuario,
                sigla_tribunal="TJPR",
                tratada_em=_meio_dia_utc(hoje - timedelta(days=4)),
            ),
        ]
    )
    db.session.commit()

    payload = auth_client.get("/api/v1/dashboard/home").get_json()

    # Hoje ainda sem atividade: a contagem comeca em ontem.
    assert payload["sequencia_dias"] == 2


def test_sequencia_inclui_hoje_quando_ja_houve_tratamento(auth_client, db):
    usuario = _usuario(auth_client, db)
    hoje = hoje_brasil()
    db.session.add_all(
        [
            _publicacao(usuario, sigla_tribunal="TJPR", tratada_em=_meio_dia_utc(hoje)),
            _publicacao(
                usuario,
                sigla_tribunal="TJPR",
                tratada_em=_meio_dia_utc(hoje - timedelta(days=1)),
            ),
        ]
    )
    db.session.commit()

    payload = auth_client.get("/api/v1/dashboard/home").get_json()

    assert payload["sequencia_dias"] == 2


def test_semana_conta_intimacoes_tratadas_e_prazos_perdidos(auth_client, db):
    usuario = _usuario(auth_client, db)
    hoje = hoje_brasil()
    db.session.add_all(
        [
            _publicacao(usuario, sigla_tribunal="TJPR", tratada_em=_meio_dia_utc(hoje)),
            _publicacao(
                usuario,
                sigla_tribunal="TJPR",
                tratada_em=_meio_dia_utc(hoje - timedelta(days=6)),
            ),
            # Fora da janela de 7 dias.
            _publicacao(
                usuario,
                sigla_tribunal="TJPR",
                tratada_em=_meio_dia_utc(hoje - timedelta(days=9)),
            ),
            ItemAgenda(
                tipo="tarefa",
                titulo="Prazo perdido",
                status="Pendente",
                data_vencimento=datetime.combine(hoje - timedelta(days=2), time(12, 0)),
                user_id=usuario.id,
                tenant_id=usuario.tenant_id,
            ),
            # Concluido: nao e prazo perdido.
            ItemAgenda(
                tipo="tarefa",
                titulo="Prazo cumprido",
                status="Concluido",
                data_vencimento=datetime.combine(hoje - timedelta(days=3), time(12, 0)),
                user_id=usuario.id,
                tenant_id=usuario.tenant_id,
            ),
            # Vencido ha mais de 7 dias: fora do resumo da semana.
            ItemAgenda(
                tipo="tarefa",
                titulo="Prazo antigo",
                status="Pendente",
                data_vencimento=datetime.combine(hoje - timedelta(days=10), time(12, 0)),
                user_id=usuario.id,
                tenant_id=usuario.tenant_id,
            ),
        ]
    )
    db.session.commit()

    payload = auth_client.get("/api/v1/dashboard/home").get_json()

    assert payload["semana"] == {"intimacoes_tratadas": 2, "prazos_perdidos": 1}
