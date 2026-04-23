from datetime import datetime

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import get_tenant_id
from models import Caso, Cliente, Despesa, Recebimento


def _hoje():
    return datetime.utcnow().date()


def _caso_titulo(caso_id):
    if not caso_id:
        return None
    caso = db.session.get(Caso, caso_id)
    return caso.titulo if caso else None


def _cliente_nome(caso_id):
    if not caso_id:
        return None
    caso = db.session.get(Caso, caso_id)
    if not caso or not caso.cliente_id:
        return None
    cliente = db.session.get(Cliente, caso.cliente_id)
    return cliente.nome_razao_social if cliente else None


def register_relatorios_routes(relatorios_ns, finance_access_required):

    @relatorios_ns.route("/contas-a-receber")
    class ContasAReceberAPI(Resource):
        @jwt_required()
        @finance_access_required
        @relatorios_ns.doc(
            security="jsonWebToken",
            description="Lista recebimentos pendentes e vencidos com totais.",
        )
        def get(self):
            user_id = get_jwt_identity()
            get_tenant_id()

            hoje = _hoje()
            recebimentos = (
                Recebimento.query.filter_by(user_id=user_id)
                .order_by(Recebimento.data_recebimento.asc())
                .all()
            )

            items = []
            total_pendente = 0.0
            for r in recebimentos:
                valor = float(r.valor)
                vencimento = r.data_recebimento
                if r.recebido:
                    status = "Pago"
                elif vencimento and vencimento < hoje:
                    status = "Vencido"
                else:
                    status = "Pendente"

                if not r.recebido:
                    total_pendente += valor

                items.append(
                    {
                        "id": r.id,
                        "descricao": r.descricao,
                        "cliente_nome": _cliente_nome(r.caso_id),
                        "caso_titulo": _caso_titulo(r.caso_id),
                        "valor": str(r.valor),
                        "data_vencimento": vencimento.isoformat() if vencimento else None,
                        "status": status,
                        "recebido": r.recebido,
                    }
                )

            pendentes = [i for i in items if i["status"] in ("Pendente", "Vencido")]
            return {
                "items": items,
                "total_geral": round(total_pendente, 2),
                "quantidade_items": len(pendentes),
            }, 200

    @relatorios_ns.route("/contas-a-pagar")
    class ContasAPagarAPI(Resource):
        @jwt_required()
        @finance_access_required
        @relatorios_ns.doc(
            security="jsonWebToken",
            description="Lista despesas pendentes e vencidas com totais.",
        )
        def get(self):
            user_id = get_jwt_identity()
            get_tenant_id()

            hoje = _hoje()
            despesas = (
                Despesa.query.filter_by(user_id=user_id).order_by(Despesa.data_despesa.asc()).all()
            )

            items = []
            total_pendente = 0.0
            for d in despesas:
                valor = float(d.valor)
                vencimento = d.data_despesa
                if d.pago:
                    status = "Paga"
                elif vencimento and vencimento < hoje:
                    status = "Vencida"
                else:
                    status = "A Pagar"

                if not d.pago:
                    total_pendente += valor

                items.append(
                    {
                        "id": d.id,
                        "descricao": d.descricao,
                        "caso_titulo": _caso_titulo(d.caso_id),
                        "valor": str(d.valor),
                        "data_vencimento": vencimento.isoformat() if vencimento else None,
                        "status": status,
                        "pago": d.pago,
                    }
                )

            pendentes = [i for i in items if i["status"] in ("A Pagar", "Vencida")]
            return {
                "items": items,
                "total_geral": round(total_pendente, 2),
                "quantidade_items": len(pendentes),
            }, 200

    @relatorios_ns.route("/fluxo-caixa")
    class FluxoCaixaAPI(Resource):
        @jwt_required()
        @finance_access_required
        @relatorios_ns.doc(
            security="jsonWebToken",
            description="Fluxo de caixa mensal: receitas vs despesas. Param: ano (default: ano atual).",
            params={"ano": "Ano (ex: 2025)"},
        )
        def get(self):
            user_id = get_jwt_identity()
            get_tenant_id()

            try:
                ano = int(request.args.get("ano", datetime.utcnow().year))
                if ano < 2000 or ano > 2100:
                    ano = datetime.utcnow().year
            except (ValueError, TypeError):
                ano = datetime.utcnow().year

            receitas_mes = {m: 0.0 for m in range(1, 13)}
            despesas_mes = {m: 0.0 for m in range(1, 13)}

            recebimentos = Recebimento.query.filter(
                Recebimento.user_id == user_id,
                db.extract("year", Recebimento.data_recebimento) == ano,
            ).all()
            for r in recebimentos:
                if r.data_recebimento:
                    receitas_mes[r.data_recebimento.month] += float(r.valor)

            despesas = Despesa.query.filter(
                Despesa.user_id == user_id,
                db.extract("year", Despesa.data_despesa) == ano,
            ).all()
            for d in despesas:
                if d.data_despesa:
                    despesas_mes[d.data_despesa.month] += float(d.valor)

            MESES_PT = [
                "Jan",
                "Fev",
                "Mar",
                "Abr",
                "Mai",
                "Jun",
                "Jul",
                "Ago",
                "Set",
                "Out",
                "Nov",
                "Dez",
            ]
            meses = []
            saldo_acumulado = 0.0
            for m in range(1, 13):
                receita = round(receitas_mes[m], 2)
                despesa = round(despesas_mes[m], 2)
                saldo = round(receita - despesa, 2)
                saldo_acumulado = round(saldo_acumulado + saldo, 2)
                meses.append(
                    {
                        "mes": m,
                        "mes_nome": MESES_PT[m - 1],
                        "receitas": receita,
                        "despesas": despesa,
                        "saldo": saldo,
                        "saldo_acumulado": saldo_acumulado,
                    }
                )

            total_receitas = round(sum(receitas_mes.values()), 2)
            total_despesas = round(sum(despesas_mes.values()), 2)

            return {
                "ano": ano,
                "meses": meses,
                "totais": {
                    "receitas": total_receitas,
                    "despesas": total_despesas,
                    "saldo": round(total_receitas - total_despesas, 2),
                },
            }, 200

    @relatorios_ns.route("/casos-status")
    class CasosStatusAPI(Resource):
        @jwt_required()
        @relatorios_ns.doc(
            security="jsonWebToken",
            description="Contagem de casos agrupados por status.",
        )
        def get(self):
            user_id = get_jwt_identity()
            get_tenant_id()

            casos = Caso.query.filter_by(user_id=user_id).all()
            agrupado: dict[str, int] = {}
            for c in casos:
                s = c.status or "Sem status"
                agrupado[s] = agrupado.get(s, 0) + 1

            total = len(casos)
            grupos = [
                {
                    "status": s,
                    "count": cnt,
                    "percentual": round(cnt / total * 100, 1) if total else 0,
                }
                for s, cnt in sorted(agrupado.items(), key=lambda x: -x[1])
            ]

            return {"total": total, "status_groups": grupos}, 200
