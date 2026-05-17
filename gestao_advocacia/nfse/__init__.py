"""Pacote NFS-e: emissao on-demand de Nota Fiscal de Servico eletronica.

Estrutura:
- gateway.py — interface abstrata + MockGateway (Etapa 5.2)
- service.py — orquestracao (compoe payload, chama gateway, atualiza DB)
- (futuro) portal_nacional.py — adapter real contra gov.br/nfse
"""
