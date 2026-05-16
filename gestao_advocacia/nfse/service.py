"""Service de NFS-e: orquestra emissao a partir de um Recebimento.

Fluxo padrao:
  1. recebimento = busca Recebimento (tenant-scoped, status="Pago")
  2. config = busca ConfigNFSe do tenant
  3. payload = monta EmissaoPayload (recebimento + config + tomador)
  4. emissao = cria registro EmissaoNFSe (status="Pendente", tentativas+1)
  5. gateway = get_gateway(config.gateway_tipo)
  6. resultado = gateway.emitir(payload)
  7. atualiza emissao com o resultado e commita

Erros do gateway nao quebram o request — a emissao fica salva com
status="Rejeitada" e mensagem_erro pra UI mostrar.
"""

from __future__ import annotations

from extensions import db
from models import Caso, Cliente, ConfigNFSe, EmissaoNFSe, Recebimento

from .gateway import EmissaoPayload, get_gateway


def _to_float(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def montar_payload(recebimento: Recebimento, config: ConfigNFSe | None) -> EmissaoPayload:
    """Compoe o payload normalizado. Tomador deduzido do cliente
    vinculado ao recebimento (se houver)."""
    tomador_nome = None
    tomador_doc = None
    if recebimento.cliente_id:
        cliente = Cliente.query.filter_by(id=recebimento.cliente_id).first()
        if cliente:
            tomador_nome = cliente.nome_razao_social
            tomador_doc = cliente.cpf_cnpj

    # Descricao do servico: usa a descricao do recebimento + referencia do
    # caso se houver. Nao expoe detalhes sensiveis — texto livre que o
    # advogado revisa no modal antes de confirmar.
    descricao = recebimento.descricao or "Servico advocaticio"
    if recebimento.caso_id:
        caso = Caso.query.filter_by(id=recebimento.caso_id).first()
        if caso and caso.titulo:
            descricao = f"{descricao} — ref. {caso.titulo}"

    if config is None:
        return EmissaoPayload(
            recebimento_id=recebimento.id,
            descricao_servico=descricao,
            valor=_to_float(recebimento.valor),
            cnpj_emissor=None,
            inscricao_municipal=None,
            razao_social=None,
            municipio=None,
            uf=None,
            codigo_servico=None,
            regime_tributario=None,
            aliquota_iss=None,
            ambiente="sandbox",
            tomador_nome=tomador_nome,
            tomador_documento=tomador_doc,
        )

    aliquota = float(config.aliquota_iss) if config.aliquota_iss is not None else None
    return EmissaoPayload(
        recebimento_id=recebimento.id,
        descricao_servico=descricao,
        valor=_to_float(recebimento.valor),
        cnpj_emissor=config.cnpj_emissor,
        inscricao_municipal=config.inscricao_municipal,
        razao_social=config.razao_social,
        municipio=config.municipio,
        uf=config.uf,
        codigo_servico=config.codigo_servico,
        regime_tributario=config.regime_tributario,
        aliquota_iss=aliquota,
        ambiente=config.ambiente or "sandbox",
        tomador_nome=tomador_nome,
        tomador_documento=tomador_doc,
    )


def emitir(recebimento: Recebimento, config: ConfigNFSe | None, user_id: int) -> EmissaoNFSe:
    """Cria EmissaoNFSe, chama o gateway e atualiza o registro.

    Sempre retorna a EmissaoNFSe persistida — em sucesso (status=
    Autorizada/EmProcessamento) ou falha (status=Rejeitada).
    """
    payload = montar_payload(recebimento, config)
    gateway_tipo = config.gateway_tipo if config else "mock"

    emissao = EmissaoNFSe(
        tenant_id=recebimento.tenant_id,
        user_id=user_id,
        recebimento_id=recebimento.id,
        status="Pendente",
        gateway_tipo=gateway_tipo,
        tentativas=1,
    )
    db.session.add(emissao)
    db.session.flush()  # garante id

    gateway = get_gateway(gateway_tipo)
    try:
        resultado = gateway.emitir(payload)
    except Exception as exc:  # pragma: no cover — defensivo contra adapter mal escrito
        emissao.status = "Rejeitada"
        emissao.mensagem_erro = f"Excecao no gateway: {exc!s}"
        db.session.commit()
        return emissao

    emissao.status = resultado.status
    emissao.gateway_id = resultado.gateway_id
    emissao.numero_nfse = resultado.numero_nfse
    emissao.serie = resultado.serie
    emissao.codigo_verificacao = resultado.codigo_verificacao
    emissao.xml_url = resultado.xml_url
    emissao.pdf_url = resultado.pdf_url
    emissao.mensagem_erro = resultado.mensagem_erro
    db.session.commit()
    return emissao
