"""Importa contratos de honorarios a partir do CSV produzido por scan.py.

Para cada arquivo:
  1) calcula SHA256 (idempotencia: skip se ja importado nesse tenant)
  2) extrai dados via Gemini (contrato_service.extrair_dados_contrato)
  3) faz match de Cliente por CPF (ou nome se CPF ausente) — cria se nao existir
  4) insere ContratoHonorario (caso_id fica nulo — voce vincula depois)

Uso:
    # Dry-run (extrai e mostra, nao grava)
    python -m scripts.import_contratos.importar --csv out/contratos_scan.csv --user-id 1 --dry-run

    # Importacao real
    python -m scripts.import_contratos.importar --csv out/contratos_scan.csv --user-id 1 --apply

    # Apenas alta prioridade (forte = 3)
    python -m scripts.import_contratos.importar --csv out/contratos_scan.csv --user-id 1 --apply --min-prioridade 3

    # Limitar a N arquivos (testar primeiro)
    python -m scripts.import_contratos.importar --csv out/contratos_scan.csv --user-id 1 --apply --limit 5
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
import traceback
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

_BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..")
sys.path.insert(0, os.path.abspath(_BASE_DIR))


def _build_app():
    from app import create_app  # noqa: PLC0415

    return create_app()


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _to_decimal(v) -> Decimal | None:
    if v in (None, "", "null"):
        return None
    try:
        return Decimal(str(v))
    except (InvalidOperation, ValueError):
        return None


def _to_date(v) -> date | None:
    if not v:
        return None
    try:
        return datetime.strptime(str(v)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _digits(v) -> str:
    return re.sub(r"\D", "", v or "")


def _match_or_create_cliente(db, Cliente, dados_contratante: dict, user_id: int, tenant_id):
    cpf_raw = dados_contratante.get("cpf") or ""
    cpf_digits = _digits(cpf_raw)
    nome = (dados_contratante.get("nome_completo") or "").strip()

    cliente = None
    if cpf_digits and len(cpf_digits) == 11:
        # Tenta varios formatos pq o app pode armazenar com ou sem mascara
        candidatos_cpf = [cpf_raw.strip(), cpf_digits]
        for c in candidatos_cpf:
            cliente = (
                Cliente.query.filter_by(tenant_id=tenant_id, cpf_cnpj=c).first()
                if tenant_id is not None
                else Cliente.query.filter_by(cpf_cnpj=c).first()
            )
            if cliente:
                return cliente, "match_cpf"

    if not cliente and nome:
        # Match por nome aproximado (case-insensitive)
        q = Cliente.query.filter(Cliente.nome_razao_social.ilike(nome))
        if tenant_id is not None:
            q = q.filter(Cliente.tenant_id == tenant_id)
        cliente = q.first()
        if cliente:
            return cliente, "match_nome"

    # Cria novo
    endereco = dados_contratante.get("endereco") or {}
    novo = Cliente(
        tenant_id=tenant_id,
        nome_razao_social=nome or "(sem nome)",
        cpf_cnpj=cpf_digits or f"IMPORT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        tipo_pessoa="PF",
        rg=dados_contratante.get("rg") or None,
        estado_civil=dados_contratante.get("estado_civil") or None,
        profissao=dados_contratante.get("profissao") or None,
        nacionalidade=dados_contratante.get("nacionalidade") or "Brasileiro(a)",
        cep=endereco.get("cep") or None,
        rua=endereco.get("logradouro") or None,
        numero=endereco.get("numero") or None,
        bairro=endereco.get("bairro") or None,
        cidade=endereco.get("cidade") or None,
        estado=endereco.get("uf") or None,
        notas_gerais="Importado de contrato de honorarios via Gemini.",
        user_id=user_id,
    )
    db.session.add(novo)
    db.session.flush()
    return novo, "criado"


def _classificar_assinatura(dados: dict, arquivo_nome: str) -> tuple[str, str]:
    """Retorna (status, descricao) baseado nas assinaturas detectadas.

    status: "Ativo" | "Pendente Assinatura" | "Minuta"
    """
    ass = dados.get("assinaturas") or {}
    contratante = ass.get("contratante_assinou")
    contratado = ass.get("contratado_assinou")
    tipo = (ass.get("tipo_assinatura") or "").lower()
    evidencias = ass.get("evidencias") or ""

    # Sinal forte do nome de arquivo: "_assinado"
    nome_indica_assinado = "assinado" in arquivo_nome.lower()

    if contratante is True and contratado is True:
        status = "Ativo"
    elif contratante is True or (nome_indica_assinado and tipo != "nenhuma"):
        status = "Ativo"
    elif tipo == "nenhuma":
        status = "Minuta"
    elif contratante is False:
        status = "Pendente Assinatura"
    else:
        status = "Pendente Assinatura"

    desc_partes = []
    if tipo and tipo != "incerto":
        desc_partes.append(f"Assinatura: {tipo}")
    if evidencias:
        desc_partes.append(f"Evidencia: {evidencias}")
    return status, " | ".join(desc_partes)


def _construir_contrato(ContratoHonorario, dados: dict, cliente_id: int, user_id: int, tenant_id,
                       arquivo_hash: str, arquivo_nome: str):
    parcelas = dados.get("parcelas") or []
    parcelas_json = json.dumps(parcelas, ensure_ascii=False) if parcelas else None

    status, ass_desc = _classificar_assinatura(dados, arquivo_nome)

    obs_partes = []
    if ass_desc:
        obs_partes.append(ass_desc)
    if dados.get("forma_pagamento"):
        obs_partes.append(f"Forma de pagamento: {dados['forma_pagamento']}")
    if dados.get("foro"):
        obs_partes.append(f"Foro: {dados['foro']}")
    sucumb = dados.get("sucumbencia_para_advogado")
    if sucumb is True:
        obs_partes.append("Sucumbencia pertence ao advogado.")
    elif sucumb is False:
        obs_partes.append("Sucumbencia pertence ao contratante.")
    despesas = dados.get("despesas_por_conta_de")
    if despesas:
        obs_partes.append(f"Despesas processuais por conta de: {despesas}")
    if dados.get("observacoes"):
        obs_partes.append(dados["observacoes"])
    notas = "\n".join(obs_partes) if obs_partes else None

    tipo_raw = (dados.get("tipo_honorario") or "fixo").lower()
    tipo_map = {
        "exito": "Êxito",
        "fixo": "Fixo",
        "misto": "Misto",
        "mensal": "Mensal",
        "horas": "Horas",
    }
    tipo = tipo_map.get(tipo_raw, "Fixo")

    return ContratoHonorario(
        tenant_id=tenant_id,
        tipo_honorario=tipo,
        valor_total=_to_decimal(dados.get("valor_total")),
        percentual_exito=_to_decimal(dados.get("percentual_exito")),
        percentual_recurso=_to_decimal(dados.get("percentual_recurso")),
        data_assinatura=_to_date(dados.get("data_assinatura")),
        status=status,
        notas_condicoes=notas,
        objeto=dados.get("objeto") or None,
        vigencia_condicao=dados.get("vigencia_condicao") or None,
        arquivo_hash=arquivo_hash,
        arquivo_nome=arquivo_nome,
        parcelas_json=parcelas_json,
        caso_id=None,
        cliente_id=cliente_id,
        user_id=user_id,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="CSV produzido por scan.py")
    ap.add_argument("--user-id", type=int, required=True, help="ID do usuario dono dos contratos")
    ap.add_argument("--apply", action="store_true", help="Sem isso e dry-run")
    ap.add_argument("--dry-run", action="store_true", help="Forca dry-run mesmo se houver --apply")
    ap.add_argument("--min-prioridade", type=int, default=1, help="Prioridade minima do scan (1-3)")
    ap.add_argument("--limit", type=int, default=0, help="Limita aos primeiros N arquivos")
    ap.add_argument("--out-jsons", default="out/contratos_extraidos", help="Pasta para salvar JSONs")
    ap.add_argument(
        "--incluir-minutas",
        action="store_true",
        help="Importa tambem contratos sem assinatura detectada (status=Minuta). Default: pula.",
    )
    args = ap.parse_args()

    apply_changes = args.apply and not args.dry_run

    out_dir = Path(args.out_jsons)
    out_dir.mkdir(parents=True, exist_ok=True)

    app = _build_app()
    with app.app_context():
        from contrato_service import extrair_dados_contrato, validar_extracao  # noqa: PLC0415
        from extensions import db  # noqa: PLC0415
        from models import Cliente, ContratoHonorario, User  # noqa: PLC0415

        user = User.query.get(args.user_id)
        if not user:
            raise SystemExit(f"Usuario {args.user_id} nao encontrado")
        tenant_id = user.tenant_id
        print(f"User: {user.username} (id={user.id}, tenant_id={tenant_id})")
        print(f"Modo: {'APPLY' if apply_changes else 'DRY-RUN'}")
        print()

        with open(args.csv, encoding="utf-8") as fp:
            rows = list(csv.DictReader(fp))

        rows = [r for r in rows if int(r["prioridade"]) >= args.min_prioridade]
        if args.limit:
            rows = rows[: args.limit]

        stats = {
            "ok": 0,
            "skip_duplicado": 0,
            "skip_arquivo_inexistente": 0,
            "skip_minuta": 0,
            "erro": 0,
        }

        for i, row in enumerate(rows, 1):
            arquivo = Path(row["arquivo"])
            print(f"[{i}/{len(rows)}] {row['pasta_cliente']} :: {arquivo.name}")

            if not arquivo.is_file():
                print("  -> arquivo nao encontrado, skip")
                stats["skip_arquivo_inexistente"] += 1
                continue

            try:
                arquivo_hash = _sha256(arquivo)
            except Exception as exc:
                print(f"  -> erro lendo arquivo: {exc}")
                stats["erro"] += 1
                continue

            existente = ContratoHonorario.query.filter_by(
                tenant_id=tenant_id, arquivo_hash=arquivo_hash
            ).first()
            if existente:
                print(f"  -> ja importado (contrato id={existente.id}), skip")
                stats["skip_duplicado"] += 1
                continue

            try:
                dados = extrair_dados_contrato(str(arquivo))
            except Exception as exc:
                print(f"  -> erro extraindo: {exc}")
                stats["erro"] += 1
                continue

            ok, avisos = validar_extracao(dados)
            if avisos:
                print(f"  -> avisos: {avisos}")

            # Salva JSON pra revisao
            json_out = out_dir / f"{arquivo.stem}_{arquivo_hash[:8]}.json"
            json_out.write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")

            contratante_nome = (dados.get("contratante") or {}).get("nome_completo") or "?"
            tipo = dados.get("tipo_honorario") or "?"
            valor = dados.get("valor_total")
            pct = dados.get("percentual_exito")
            status_ass, _ = _classificar_assinatura(dados, arquivo.name)
            print(
                f"  -> contratante: {contratante_nome} | tipo: {tipo} | valor: {valor} | "
                f"exito: {pct}% | status: {status_ass}"
            )

            if status_ass == "Minuta" and not args.incluir_minutas:
                print("  -> sem assinatura detectada, skip (use --incluir-minutas para forcar)")
                stats["skip_minuta"] += 1
                continue

            if not apply_changes:
                continue

            try:
                cliente, motivo = _match_or_create_cliente(
                    db, Cliente, dados.get("contratante") or {}, args.user_id, tenant_id
                )
                print(f"  -> cliente {motivo}: id={cliente.id} {cliente.nome_razao_social}")

                contrato = _construir_contrato(
                    ContratoHonorario,
                    dados,
                    cliente.id,
                    args.user_id,
                    tenant_id,
                    arquivo_hash,
                    arquivo.name,
                )
                db.session.add(contrato)
                db.session.commit()
                print(f"  -> contrato criado: id={contrato.id}")
                stats["ok"] += 1
            except Exception as exc:
                db.session.rollback()
                print(f"  -> erro gravando: {exc}")
                traceback.print_exc()
                stats["erro"] += 1

        print()
        print(f"FIM. {stats}")


if __name__ == "__main__":
    main()
