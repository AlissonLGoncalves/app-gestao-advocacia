# Stitch prompt — Patronus (v2.14.0) — versão "simples + estímulo + extração DJEN"

Como usar: cole o bloco BASE primeiro. Depois, na mesma sessão do Stitch, gere uma tela por vez com os blocos TELA 1, 2, 3 e 4. Se quiser partir do visual atual, anexe um print do app junto com o BASE.

---

## BASE (princípios + design system + shell)

Design a radically simple, habit-forming SaaS web app called **Patronus — Sistema Jurídico**, for solo lawyers and small Brazilian law firms. All UI copy in Brazilian Portuguese with correct accents. Desktop-first, 1440px wide, light theme only.

Why this product exists: the lawyer today prefers opening each court system (PJe, eproc, Projudi) directly, because the app felt cluttered and they "did not know where to start". Patronus is NOT where court files are read — the courts are the source of truth. Patronus is the layer above the courts: every morning at 7h it reads the DJEN (Diário de Justiça Eletrônico, the official gazette where courts publish notices to lawyers), and for each publication it automatically extracts the **parties**, the **case number (CNJ)**, the **subject** and the **deadline to comply** (e.g. "Contestação — 15 dias úteis → vence 26/09/2026"). The lawyer then decides in 30 seconds, gets the document assembled, and is sent to the court. The only success metric is: "did I open Patronus before opening PJe this morning?".

Three non-negotiable design goals:

1. **Radical simplicity.** Every screen has one job, one obvious primary action, and almost nothing else. If an element does not help the lawyer finish today's work, it does not exist on the screen. No KPI walls, no charts on the home, no more than 2 columns, no more than 3 visible actions per row. Prefer a single vertical list over a dashboard grid. Secondary information lives one click away.

2. **Built-in motivation (sober, not gamified).** The lawyer must feel progress every time they open the app and feel the "zero" state as a reward. Use: a visible daily progress line ("4 de 7 tratadas hoje"), a calm "Tudo em dia" state with a checkmark when the queue is empty, a quiet streak counter ("7 dias seguidos em dia"), a small weekly recap ("Esta semana você tratou 23 intimações e não perdeu nenhum prazo"), and immediate feedback after each action (row slides out, counter decrements). Tone: a respectful assistant, never a game — no confetti, no badges, no points.

3. **Show the work the app did for you.** The automatic DJEN extraction is the reason to open Patronus, so it must be visible and trustworthy: every publication shows the extracted fields (Partes, Nº do processo, Assunto, Prazo) already filled in, labeled "Extraído automaticamente", with a small confidence indicator (green dot = confirmado pelo nº CNJ, amber dot = revisar). The lawyer confirms with one click or edits inline; they never type what the app already read. A short line on the home tells what was captured this morning ("Hoje às 7h: 12 publicações lidas em TJPR, TRT9 e STJ · 9 já vinculadas a casos").

Visual language: "quiet premium" — Linear meets Apple Settings, with legal-grade seriousness. Generous white space, few borders, one accent color. No stock illustrations, no gradients on content, no purple, no emoji.

Design tokens:
- Canvas: vertical gradient #F7F8FA → #ECEFF4 with a very faint blue glow at the top-left corner.
- Surfaces: white cards at 90% opacity, 1px border rgba(17,24,39,0.09), radius 18px for cards, 12px for inputs and buttons, 26px for the outer app frame, shadow 0 10px 30px rgba(15,23,42,0.06).
- Sidebar: 286px wide, gradient #13171F → #1A202B, its own rounded frame. The whole app floats as a rounded frame with 16px page padding.
- Text: #101828 primary, #475467 secondary, #667085 tertiary.
- Primary blue #0A84FF (hover #006FE3). Success #079455. Danger #D92D20. Warning amber #B54708. Color is used only for meaning (urgency, status, confidence, the one primary action), never decoratively.
- Typography: Plus Jakarta Sans for titles (weight 700–800, letter-spacing -0.03em); Manrope for body (400–600). Body 15px, lists 14px, page title 28px, section titles 15px semibold. Dates, case numbers and money use tabular figures.
- Icons: outline Heroicons style, 18–20px, 1.5px stroke.
- Motion: subtle, 320ms ease-out.

App shell, persistent across all screens:
- Left sidebar: brand block with a hexagonal "P" mark in blue gradient (#56A6FF → #1F78FF → #0A45C4), the word "Patronus" and a small uppercase "Sistema Jurídico" tagline. Only 7 items in three tiny labeled groups: **Diário** (Início, Intimações with a red count badge, Casos, Agenda with a count badge), **Semanal** (Clientes, Financeiro, Documentos), **Sistema** (Configurações). Active item is a soft blue gradient pill with a 1px inner light border. Footer: "Sair" in muted red and "v2.14.0" in small gray text.
- Top bar inside the content frame: page title and one-line subtitle on the left; on the right a single "+ Novo" quick-add button, a notification bell, and a search field with the placeholder "Buscar ou executar ação…  Ctrl K". Nothing else.

Global constraints: realistic Brazilian data (names, CNJ case numbers like 0001234-56.2026.8.16.0001, courts TJPR / TRT9 / STJ / TST, subjects like "Ação de cobrança", "Reclamação trabalhista", "Execução de título extrajudicial"), never lorem ipsum; empty states are one sentence plus one button; exactly one primary blue button per screen; WCAG AA contrast; 8px spacing grid; max content width 1040px centered so the screen never feels like a wall.

---

## TELA 1 — Início ("Seu dia")

Using the Patronus shell, design the **Início** screen. Sidebar item "Início" active. This is the screen the lawyer opens every morning before PJe, so it must be the simplest screen of the product.

Top: greeting "Bom dia, Alisson." and one line "Você tem 7 coisas para resolver hoje. Comece pela primeira." Right under it, a thin progress line with the label "4 de 7 resolvidas" and, to the right, a quiet streak chip "7 dias seguidos em dia".

Directly below, one muted line with a small DJEN icon: "Hoje às 7h: 12 publicações lidas em TJPR, TRT9 e STJ · partes, nº do processo e prazos extraídos · 9 já vinculadas a casos." with a text link "Ver intimações".

Main content is ONE vertical list titled "Sua fila de hoje", ordered by urgency, max 7 rows, no columns beside it. Each row: a 3px tone bar (red = vencido, amber = hoje, blue = esta semana), a bold one-line title written as an instruction and built from the extracted data ("Contestar — Maria Silva × Banco Alfa S.A. · vence 26/09", "Tratar 3 publicações novas do TJPR", "Confirmar audiência de amanhã — Reclamação trabalhista"), one muted detail line (case number in tabular figures, court, subject), and on the right ONE button per row ("Tratar", "Abrir no tribunal ↗", "Concluir"). The first row is the only one that uses the primary blue button; the others use a quiet outline button. Completed rows stay at the bottom, struck through in gray, so progress is visible.

Below the list, a single small card "Esta semana" with one sentence: "Você tratou 23 intimações e não perdeu nenhum prazo." and a text link "Ver resumo".

Also design the empty state of this screen: a large green checkmark, the title "Tudo em dia." and one sentence "Nenhum prazo, nenhuma publicação pendente. Amanhã às 7h o DJEN será lido de novo.", with one outline button "Ver casos". Keep the streak chip visible.

---

## TELA 2 — Intimações (inbox zero com extração)

Using the Patronus shell, design the **Intimações** screen as an inbox-zero list. Sidebar item "Intimações" active with badge "12".

Title "Intimações", subtitle "12 publicações lidas hoje no DJEN aguardam sua decisão". Under the title a thin progress line "0 de 12 tratadas hoje".

Toolbar with only three things: pill filters "Não tratadas (12) · Sem processo (3) · Tratadas", a tribunal dropdown ("Todos os tribunais"), and a search field. No date pickers or sort menus visible (they live inside a small "Filtros" popover).

One vertical list of publications. Each row is a compact card with two zones:
- Left zone: tribunal chip ("TJPR") and publication date, then the raw excerpt of the publication in 2 lines of secondary text (the official gazette text).
- Right zone, titled with a tiny label "Extraído automaticamente": four short fields in a 2×2 grid — **Partes** "Maria Silva × Banco Alfa S.A.", **Nº do processo** "0001234-56.2026.8.16.0001" (tabular figures, with a green dot "vinculado ao caso"), **Assunto** "Ação de cobrança", **Prazo** "Contestação · 15 dias úteis · vence 26/09/2026" with an amber dot meaning "revisar" on rows where confidence is lower. Fields look editable on hover (pencil icon).
- Far right: ONE primary button "Tratar". Rows without a matched case show a subtle "Sem processo" chip next to the case number and a text link "Criar caso". Row hover reveals two quiet icon actions: "Abrir no tribunal ↗" and "Descartar".

Design the modal "Tratar intimação" opened by "Tratar": a compact card with the four extracted fields on top (already filled, each with its confidence dot, editable), a highlighted suggestion block "Sugestão do Patronus: registrar prazo de Contestação — 15 dias úteis → vence 26/09/2026 (contado a partir de 05/09/2026)", a segmented choice Prazo / Audiência / Tarefa / Descartar (Prazo preselected), a linked-case selector already showing the matched case, and one primary button "Confirmar e próxima" (advances to the next publication automatically) plus a text link "Cancelar". Small footer text: "Você confirmou 0 de 12. Tempo médio: 20 s por publicação."

Also design the empty state: a green checkmark, "Caixa zerada." and "Todas as 12 publicações de hoje foram tratadas. Próxima leitura do DJEN amanhã às 7h.", plus the streak chip "7 dias seguidos em dia".

---

## TELA 3 — Caso (hub com próximo passo)

Using the Patronus shell, design the **Caso detail** screen. Sidebar item "Casos" active.

Breadcrumb "Casos / 0001234-56.2026.8.16.0001". Header: title "Maria Silva × Banco Alfa S.A.", below it the case number, "TJPR · 3ª Vara Cível de Curitiba · Ação de cobrança", a phase chip "Conhecimento" and a priority badge. On the right the primary button "Abrir no tribunal ↗" and a secondary "+ Novo no caso".

Tabs: Resumo · Atividades · Histórico · Financeiro (Resumo active).

Resumo is two columns, and the LEFT column is the star:
- Left (60%): a single tall card "Próximo passo" with a large sentence "Apresentar contestação até 26/09/2026" and a due-date chip "em 12 dias"; a small source line under it: "Prazo extraído da publicação do DJEN de 05/09/2026 · ver publicação". Then a 3-item checklist "O que falta" (Procuração assinada ✓, Documentos do cliente ✓, Minuta revisada ☐); then a block "Peça cabível: Contestação" with a big secondary button "Gerar .docx" and a small text "Endereçamento, qualificação das partes e nº do processo preenchidos com os dados extraídos".
- Right (40%): a compact card "Dados do processo" (partes, vara, assunto, valor da causa R$ 48.500,00, advogado responsável), and a compact "Linha do tempo" with the last 5 events (publicação DJEN, movimentação CNJ, documento, prazo), each with a small icon and date, and a text link "Ver histórico completo".

Nothing else on the screen.

---

## TELA 4 — Login

Design the Patronus **Login** page (no app shell). Split layout.

Left panel (45%): dark navy gradient #13171F → #1A202B with the Patronus hexagonal "P" mark and wordmark, the tagline "Abra o Patronus antes do PJe." and three short lines with small outline icons: "Lemos o DJEN todo dia às 7h por você", "Partes, nº do processo, assunto e prazo já extraídos", "Peça pronta em Word, direto para o protocolo".

Right panel: centered minimal form on the off-white canvas: title "Entrar", fields "E-mail" and "Senha", primary button "Entrar", links "Esqueci a senha" and "Solicitar acesso". Footer "Patronus v2.14.0 · Sistema Jurídico".
