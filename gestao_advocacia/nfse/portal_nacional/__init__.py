"""Adapter do Portal Nacional NFS-e (gov.br).

Estrutura desta sub-etapa (5.6.1):
- dps_builder.py — monta DPS em XML conforme leiaute oficial
- gateway.py — PortalNacionalGateway (esqueleto, sem XMLDSIG nem HTTP real)

Sub-etapas futuras:
- 5.6.2 — XMLDSIG + storage de certificado A1
- 5.6.3 — Chamada HTTP mTLS real
- 5.6.4 — Webhook + distribuicao por NSU
"""
