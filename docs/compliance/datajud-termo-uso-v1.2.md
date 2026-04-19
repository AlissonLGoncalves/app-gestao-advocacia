---
fonte: https://www.cnj.jus.br/sistemas/datajud/api-publica/
versao: "1.2"
data_vigencia: "2023-11-27"
local_origem: "Brasília-DF"
orgao: "Conselho Nacional de Justiça — CNJ"
cnpj_orgao: "07.421.906/0001-29"
arquivado_em: "2026-04-18"
---

# Termo de Uso da API Pública do DATAJUD — v1.2

> Documento arquivado no projeto como artefato de compliance. O **Patronus consome a API pública do DATAJUD**, portanto estes termos vinculam o operador (nosso escritório/tenant) e precisam ser respeitados pelo código e pelo uso operacional.

## Implicações práticas para o Patronus

| Cláusula | O que isso obriga no nosso código/operação |
|----------|-------------------------------------------|
| 3.3 — Uso não comercial | Confirmar que revenda de dados DATAJUD **não** é feature. Uso interno do escritório apenas. |
| 3.13 — Máx 120 req/min | Rate limit obrigatório no `cnj_service.py`. Hoje temos `DJEN_SYNC_BACKLOG_LIMIT=50` e throttle; validar se respeita 120/min global. |
| 3.15 — Não sobrecarregar | Não paralelizar chamadas sem necessidade. Usar backoff em 429/503. |
| 3.17/3.18 — Sem engenharia reversa | Usar apenas endpoints documentados. |
| 3.19 — Notificar falhas de segurança | Se detectarmos vazamento ou CVE em uso do DATAJUD, comunicar CNJ. |
| 3.23 — Manter dados cadastrais atualizados | Quem detém a API key é responsável por manter cadastro CNJ atualizado. |
| 4.2 — Não coletar/processar dados pessoais além do permitido | DATAJUD traz metadados processuais; qualquer dado pessoal derivado (nomes, CPFs em publicações) deve ter base legal (art. 7º ou 11º LGPD). |
| 4.6 — Não compartilhar dados pessoais com terceiros | Restringir exportação/relatórios a usuários do mesmo tenant. Multi-tenant isolation já garante (ver `docs/tenant-isolation.md`). |

## Relação com os Termos do Patronus

Os Termos do Patronus (ver `gestao_advocacia_vite/src/pages/auth/RegisterPage.jsx` e, após A2, `src/legal/termos-v1.0.md`) classificam o escritório como **Controlador** e o Patronus como **Operador** (LGPD). O CNJ, por sua vez, é **Fornecedor** dos metadados processuais — e o Patronus é **usuário da API** perante o CNJ. Essa cadeia precisa estar documentada nos nossos termos na próxima revisão (A2).

## Texto original

---

### TERMO DE USO DA API PÚBLICA DO DATAJUD

**Versão 1.2**
**Brasília-DF, 27 de novembro de 2023**

O presente termo de Uso ("Termo") tem o objetivo de regular as regras e condições de acesso e uso dos serviços aplicáveis à utilização da API pública do Banco Nacional de Dados do Poder Judiciário – DATAJUD disponibilizado pelo Conselho Nacional de Justiça, sediado na SAF SUL Quadra 2 Lotes 5/6 – Brasília-DF, CNPJ nº 07.421.906/0001-29 (doravante denominado "CNJ").

#### 1. INFORMAÇÕES GERAIS

1.1. Ao aderir a este Termo, o usuário da API aceita, de forma tácita, irrevogável e sem ressalvas, todas as regras e condições previstas neste documento, bem como os demais termos e condições presentes no endereço eletrônico https://www.cnj.jus.br/sistemas/datajud/api-publica/, no momento da utilização do serviço.

1.2. O usuário manifestará tacitamente sua aceitação às condições deste termo ao utilizar a interface.

#### 2. DO USO DA APLICAÇÃO

2.1. A API pública disponibiliza aos usuários o acesso aos metadados processuais relativos aos processos públicos do Datajud.

2.2. As instruções de acesso, bem como consumo dessas informações estão disponíveis em https://www.cnj.jus.br/sistemas/datajud/api-publica/.

#### 3. RESPONSABILIDADES

3.1. O CNJ não se responsabiliza pelo mal uso do aplicativo ou eventuais danos morais ou patrimoniais provenientes da má interpretação dos seus dados ou dos resultados por ela apresentados.

3.2. O usuário da API pública se responsabiliza pelo uso da interface e das informações, pesquisas, documentos ou qualquer espécie de informação derivada de seu uso.

3.3. A API é fornecida exclusivamente para fins legais, não comerciais e autorizados, sendo seu uso indevido, abusivo, ilegal, malicioso ou imoral estritamente proibido.

3.4. O CNJ se reserva o direito de modificar ou interromper a API a qualquer momento ou de conceder ou revogar acesso sem aviso prévio.

3.5. O CNJ não assume qualquer responsabilidade por danos ou perdas resultantes do uso ou impossibilidade de uso da API.

3.6. O CNJ não garante a precisão, integridade ou atualidade dos dados fornecidos pela API.

3.7. O usuário é responsável por garantir que seus sistemas e aplicativos sejam compatíveis com a API e atendam aos requisitos técnicos estabelecidos.

3.8. O usuário concorda em não modificar, distribuir, vender ou explorar comercialmente a API ou qualquer informação derivada dela.

3.9. O usuário concorda em dar ciência ao CNJ de qualquer informação, notícia, estudo, relatório ou documento de qualquer natureza que seja disponibilizado ao público em geral.

3.10. O CNJ se reserva o direito de monitorar o uso da API e tomar medidas para proteger seus direitos e interesses legais.

3.11. O usuário concorda em não usar a API para coletar informações pessoais de terceiros.

3.12. O usuário concorda em usar a API de acordo com as limitações técnicas e operacionais especificadas pelo CNJ.

3.13. O usuário concorda em não realizar mais de 120 requisições por minuto, a menos que tenha autorização expressa por escrito do CNJ.

3.14. O CNJ se reserva o direito de limitar o número de requisições por usuário ou por chave de API a qualquer momento e sem aviso prévio.

3.15. O usuário concorda em não usar a API de forma a sobrecarregar, desabilitar ou prejudicar o funcionamento da API ou dos servidores do CNJ.

3.16. O CNJ se reserva o direito de monitorar o uso da API e tomar medidas para proteger seus direitos e interesses legais.

3.17. O usuário concorda em não tentar contornar as medidas de segurança ou autenticação implementadas pela API.

3.18. O usuário concorda em não fazer engenharia reversa da interface ou de qualquer parte da API.

3.19. O usuário concorda em informar imediatamente qualquer falha de segurança, de acesso ou erro na informação prestada.

3.20. O usuário concorda em não usar a API para violar a privacidade ou os direitos de propriedade intelectual de terceiros.

3.21. O usuário concorda em não usar a API para fins que possam ser considerados ofensivos, discriminatórios ou que violem as leis brasileiras ou internacionais.

3.22. O CNJ se reserva o direito de alterar estes termos e condições a qualquer momento, sem aviso prévio.

3.23. O usuário concorda em manter suas informações de contato atualizadas e em informar o CNJ imediatamente caso haja alguma mudança em seus dados cadastrais.

3.24. O usuário concorda em cooperar com o CNJ em caso de investigações ou disputas relacionadas ao uso da API.

#### 4. DISPOSIÇÕES SOBRE A LEI GERAL DE PROTEÇÃO DE DADOS – LGPD

4.1. O usuário concorda em usar a API em conformidade com a LGPD e outras leis e regulamentos aplicáveis.

4.2. O usuário concorda em não coletar, armazenar ou processar dados pessoais originários da API ou realizar cruzamentos de informação para esse fim, exceto conforme permitido pela LGPD e outras leis e regulamentos aplicáveis.

4.3. O CNJ se reserva o direito de limitar ou suspender o acesso do usuário à API em caso de suspeita de violação da LGPD ou outras leis e regulamentos aplicáveis.

4.4. O usuário concorda em manter os dados pessoais eventualmente coletados por meio da API seguros e confidenciais, em conformidade com a LGPD e outras leis e regulamentos aplicáveis.

4.5. O usuário concorda em notificar o CNJ imediatamente em caso de suspeita ou confirmação de violação de dados pessoais.

4.6. O usuário concorda em não compartilhar dados pessoais coletados por meio da API com terceiros.

#### 5. FORO

5.1. As Partes elegem o foro da Comarca de Brasília/DF para a resolução de quaisquer controvérsias oriundas deste termo, renunciando a todo e qualquer outro, por mais privilegiado que seja.

#### 6. ACEITAÇÃO DO TERMO E CONDIÇÕES DE USO

6.1. O Usuário declara ter lido, entendido e aceitado todas as regras, condições e obrigações estabelecidas no presente termo.
