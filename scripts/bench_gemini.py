"""Benchmark gemini-2.5-pro vs gemini-2.5-flash no detector de prazos.

Roda 5 textos representativos contra cada modelo, mede latencia e checa
acerto do tipo + vencimento. Saida em tabela.

Rode dentro do container Fly (tem GEMINI_API_KEY) ou local com .env carregado:
    flyctl ssh console -a app-gestao-advocacia -C "python scripts/bench_gemini.py"
"""

import os
import statistics
import time
from datetime import date

CASOS = [
    {
        "id": "contestacao_15u",
        "texto": (
            "Intimada a parte requerida para apresentar contestacao no prazo de 15 (quinze) dias uteis, "
            "sob pena de revelia, nos termos do art. 335 do CPC. Juntada certidao de intimacao publicada "
            "em 02/05/2026."
        ),
        "esperado_tipo": "contestacao",
    },
    {
        "id": "replica_15u",
        "texto": (
            "Intimada a parte autora para apresentar replica a contestacao no prazo de 15 dias, "
            "manifestando-se sobre as preliminares e documentos juntados. Decisao publicada em 02/05/2026."
        ),
        "esperado_tipo": "replica",
    },
    {
        "id": "embargos_5u",
        "texto": (
            "Embargos de declaracao opostos. Vista a parte embargada para manifestar-se no prazo de 5 dias "
            "uteis, art. 1.023 par. 2o do CPC. Publicado em 30/04/2026."
        ),
        "esperado_tipo": "embargos",
    },
    {
        "id": "log_sem_prazo",
        "texto": (
            "Conclusos para despacho. Juntada de peticao. Movimentacao registrada em 02/05/2026 sem "
            "abertura de prazo para qualquer das partes."
        ),
        "esperado_tipo": None,
    },
    {
        "id": "alegacoes_15u",
        "texto": (
            "Encerrada a instrucao processual, intimem-se as partes para apresentacao de alegacoes finais "
            "por memoriais escritos, no prazo sucessivo de 15 dias uteis, comecando pela parte autora, "
            "art. 364 par. 2o do CPC. Publicado em 01/05/2026."
        ),
        "esperado_tipo": "alegacoes_finais",
    },
]

MODELOS = ["gemini-2.5-flash", "gemini-2.5-pro"]


def run():
    os.environ.setdefault("FLASK_APP", "app.py")
    from app import app
    from gemini_service import get_gemini_client, is_enabled
    import json

    ctx = app.app_context()
    ctx.push()
    try:
        if not is_enabled():
            print("GEMINI desabilitado dentro do contexto. Abortando.")
            return
        client = get_gemini_client()
        resultados = {m: [] for m in MODELOS}
        _bench(client, resultados)
        _resumo(resultados)
    finally:
        ctx.pop()


def _resumo(resultados):
    print("\n=== RESUMO ===")
    for modelo in MODELOS:
        rs = resultados[modelo]
        latencias = [r["ms"] for r in rs]
        acertos = sum(1 for r in rs if r["ok_tipo"])
        p50 = statistics.median(latencias)
        p95 = sorted(latencias)[int(len(latencias) * 0.95) - 1] if len(latencias) > 1 else latencias[0]
        media = statistics.mean(latencias)
        print(
            f"  {modelo:18s}  acerto={acertos}/{len(rs)}  "
            f"p50={p50:.0f}ms  p95={p95:.0f}ms  media={media:.0f}ms"
        )


def _bench(client, resultados):
    import json
    for caso in CASOS:
        prompt = f"""Voce eh um analista juridico brasileiro. Analise o texto de uma movimentacao
processual e determine se ha um PRAZO PROCESSUAL para uma parte cumprir.

Retorne APENAS JSON valido, sem markdown:
{{
  "tem_prazo": true/false,
  "tipo": "contestacao|replica|impugnacao|recurso|embargos|alegacoes_finais|cumprimento|manifestacao|defesa|parecer|outro",
  "dias": numero_inteiro_ou_null,
  "uteis": true_se_dias_uteis_false_se_corridos,
  "vencimento_iso": "YYYY-MM-DD",
  "confianca": "alta|media|baixa"
}}

REGRAS:
1. Se eh log (Conclusos, Juntada), retorne tem_prazo=false.
2. CPC art. 219: prazos sao em dias UTEIS por padrao.

DATA DE REFERENCIA: {date.today().isoformat()}

TEXTO:
{caso['texto']}
"""
        for modelo in MODELOS:
            t0 = time.perf_counter()
            try:
                resp = client.models.generate_content(
                    model=modelo,
                    contents=prompt,
                    config={"response_mime_type": "application/json"},
                )
                dt_ms = (time.perf_counter() - t0) * 1000
                raw = (getattr(resp, "text", None) or "").strip()
                try:
                    parsed = json.loads(raw)
                except Exception:
                    parsed = {"_parse_error": raw[:80]}
                ok_tipo = (
                    parsed.get("tipo") == caso["esperado_tipo"]
                    if caso["esperado_tipo"]
                    else not parsed.get("tem_prazo")
                )
                resultados[modelo].append(
                    {"caso": caso["id"], "ms": dt_ms, "ok_tipo": ok_tipo, "out": parsed}
                )
                print(
                    f"  [{modelo:18s}] {caso['id']:18s} {dt_ms:7.0f}ms ok={ok_tipo}  "
                    f"tipo={parsed.get('tipo')} dias={parsed.get('dias')}"
                )
            except Exception as e:
                dt_ms = (time.perf_counter() - t0) * 1000
                resultados[modelo].append(
                    {"caso": caso["id"], "ms": dt_ms, "ok_tipo": False, "err": str(e)[:120]}
                )
                print(f"  [{modelo:18s}] {caso['id']:18s} {dt_ms:7.0f}ms ERRO: {e}")


if __name__ == "__main__":
    run()
