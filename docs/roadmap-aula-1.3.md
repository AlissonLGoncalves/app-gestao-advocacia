# Roadmap — Aula 1.3 (PipeFlow CRM × Patronus)

> Documento gerado a partir do estudo da aula 1.3 do curso PipeFlow CRM, adaptando as 10 features de referência para o contexto do **Patronus / gestão-advocacia** (gestão de escritório jurídico, NÃO CRM de vendas).
>
> Etapa 1.3-A (mapa da realidade atual) está documentada na conversa de origem. Este arquivo cobre as etapas **1.3-B (avaliação)** e **1.3-C (roadmap)**.

---

## Etapa 1.3-B — Avaliação das 10 features do PipeFlow

Tabela ordenada por status (🟢 Adotar → 🟡 Adaptar → 🔴 Descartar) e dentro de cada bloco por esforço crescente.

| # | Feature PipeFlow | Status | Justificativa (jurídico) | Equivalente jurídico no Patronus | Esforço | Dependências |
|---|---|---|---|---|---|---|
| 7 | Autenticação (login/signup/middleware) | 🔴 Descartar | Já existe em estado superior ao curso: JWT + roles (admin/advogado/assistente/cliente/superadmin) + invite + reset + LoginAudit. | `routes/auth.py` já cobre todos os fluxos | — | — |
| 4 | Multi-tenant (workspaces) | 🔴 Descartar | Multi-tenant via `tenant_id` + `query_for_tenant` + claim no JWT já está implementado e auditado. RLS aparece separado em #8. | Tabela `Tenant` + helper `query_for_tenant` | — | — |
| 9 | Onboarding Flow | 🟢 Adotar | Hoje só temos convite + cadastro por procuração; falta wizard pós-signup (escritório → OAB → primeiro cliente/caso → ativar DJEN). Reduz "tela vazia". | Wizard 4 passos: dados do escritório → OAB do advogado → 1º cliente → 1º caso (com autofill CNJ) | S | Nenhuma lib nova; reaproveita endpoints existentes |
| 1 | Pipeline Kanban (drag & drop) | 🟢 Adotar | A `PrazosPage` já tem vista "Kanban" baseada em select; falta drag-drop real, que é UX padrão para prazos. | Kanban de **Prazos/Tarefas** entre status A Fazer / Fazendo / Concluído (e/ou por prioridade) | S | `@dnd-kit/core` + endpoint PATCH de status já existente |
| 6 | Sistema de Atividades (timeline) | 🟢 Adotar | `AuditLog` é interno; falta timeline visível por **Caso** unificando movimentações CNJ, publicações DJEN, eventos da agenda, documentos anexados e tarefas. Diferencial forte para advogado. | Aba "Linha do tempo" no `CasoDetalhePage` agregando 5 fontes existentes | M | Nenhuma lib nova; endpoint agregador novo em `routes/casos.py` |
| 3 | Dashboard & Métricas (Recharts, funil) | 🟢 Adotar | Dashboard hoje é só listagem; falta visualização. "Funil" do CRM vira **distribuição de casos por fase processual** + receita realizada × projetada. | Gráficos: casos por status/área, prazos vencendo (heatmap), receita mensal, publicações DJEN/dia | M | `recharts` no frontend; endpoints de agregação em `routes/dashboard.py` |
| 10 | Landing Page (conversão pública) | 🟢 Adotar | Hoje o app só renderiza após login; sem aquisição orgânica. Vale página pública focada em diferenciais (DJEN automático + IA Gemini para procurações). | `/` público com hero + features + pricing-placeholder + CTA "Teste grátis 14 dias" | M | Decidir se vai no Vercel atual (rotas públicas no React) ou subdomínio. Atenção ao **Fly cold start ~7s** se houver chamada ao backend |
| 2 | Gestão de Leads (CRUD + filtros + timeline) | 🟡 Adaptar | "Lead" não existe em escritório jurídico. O equivalente útil é **busca/filtros avançados em Clientes e Casos** (por OAB, fase, vara, valor da causa, status financeiro). Timeline já coberto em #6. | Filtros server-side + salvar "buscas" + exportação | M | Endpoints já existem; falta UI e parâmetros de query |
| 8 | Row Level Security (Postgres policies) | 🟡 Adaptar | Hoje o isolamento é 100% app-level (`query_for_tenant`). RLS seria **defesa em profundidade** contra bug de query esquecida — bom em SaaS jurídico (LGPD/sigilo). Exige refactor da sessão SQLAlchemy para setar `app.current_tenant`. | Policies por `tenant_id` em todas as tabelas + `SET LOCAL` no `before_request` | L | Postgres em prod (já temos), Alembic migration de policies, suite de testes para regressão |
| 5 | Planos & Billing (Stripe) | 🟡 Adaptar | Faz sentido para B2B SaaS, mas planos genéricos ("Free/Pro/Team") não cabem em jurídico — melhor por **número de advogados/OAB** ou volume DJEN. Não-bloqueante para MVP. | Planos: Solo (1 OAB) / Escritório (até 5) / Corporate (ilimitado) + portal Stripe | XL | Stripe + webhooks + conta Stripe BR. **Atenção: Kaspersky MITM bloqueia Stripe** em dev local |

---

## Etapa 1.3-C — Roadmap em 3 ondas

### Onda 1 — Quick wins (próximos PRs, esforço XS/S)

#### 1.1 `feat/onboarding-wizard`
- **Arquivos**: `gestao_advocacia_vite/src/pages/OnboardingPage.jsx` (novo), `App.jsx` (rota guard "onboarding pendente"), `routes/tenant.py` (campo `onboarding_completed_at` no `Tenant`), Alembic migration nova.
- **Riscos**: Vercel Hobby — **commit sem `Co-Authored-By`**; CI frontend exige `npx prettier --write` antes do push; rota guard precisa não quebrar quem já está logado (testar com `sub=2` em prod).
- **Pronto quando**: novo signup vê wizard de 4 passos; ao concluir, `tenant.onboarding_completed_at` é preenchido e o usuário cai no Dashboard.

#### 1.2 `feat/prazos-kanban-dnd`
- **Arquivos**: `gestao_advocacia_vite/src/pages/PrazosPage.jsx` (refactor), `package.json` (adiciona `@dnd-kit/core` + `@dnd-kit/sortable`), `gestao_advocacia/routes/tarefas.py` (PATCH de status já existe — só validar contrato).
- **Riscos**: rebuild do bundle Vite pode impactar Vercel build time; otimizar update otimista (rollback em erro 5xx — Fly pode estar cold).
- **Pronto quando**: arrastar card entre colunas dispara PATCH `/api/v1/tarefas/{id}` e persiste após reload; teste vitest cobre o reorder.

### Onda 2 — Médio prazo (1-2 sprints, esforço M)

#### 2.1 `feat/caso-timeline`
- **Arquivos**: `gestao_advocacia/routes/casos.py` (novo `GET /casos/{id}/timeline` agregando `MovimentacaoCNJ` + `PublicacaoDJEN` + `EventoAgenda` + `Documento` + `TarefaPrazo`), `gestao_advocacia_vite/src/pages/CasoDetalhePage.jsx` (nova aba "Linha do Tempo").
- **Riscos**: query agregadora precisa respeitar `query_for_tenant` em **todas** as 5 fontes — risco de leak cross-tenant; CI backend-style com ruff 0.8.2 / black 24.10.0.
- **Pronto quando**: aba mostra eventos das 5 fontes ordenados desc por data, com ícone por tipo; teste pytest valida isolamento multi-tenant.

#### 2.2 `feat/dashboard-recharts`
- **Arquivos**: `gestao_advocacia_vite/package.json` (+ `recharts`), `gestao_advocacia_vite/src/pages/DashboardPage.jsx`, `gestao_advocacia/routes/dashboard.py` (endpoints agregadores: casos por status, receita mensal, publicações DJEN/dia).
- **Riscos**: agregações em SQLite (dev) vs Postgres (prod) podem divergir em `date_trunc`; bundle do Recharts é grande — verificar Vercel Hobby build size.
- **Pronto quando**: 4 cards com gráficos carregam < 2s em prod; teste vitest mocka endpoints.

#### 2.3 `feat/clientes-casos-filtros-avancados`
- **Arquivos**: `routes/clientes.py` e `routes/casos.py` (parâmetros de query: OAB, vara, fase, status financeiro, faixa de valor, range de data); `pages/ClientesPage.jsx` e `pages/CasosPage.jsx` (UI de filtros + chips); opcional: tabela `BuscaSalva` para favoritar.
- **Riscos**: paginação combinada com filtros pode impactar performance — adicionar índices via Alembic; CI: `ruff check . --fix && black .` antes do push.
- **Pronto quando**: combinar 3+ filtros retorna resultado paginado consistente; export CSV/PDF respeita filtros ativos.

#### 2.4 `feat/landing-page`
- **Arquivos**: `gestao_advocacia_vite/src/pages/LandingPage.jsx` + `MarketingLayout.jsx` (rota `/` pública, `/app/*` para autenticado), assets em `public/marketing/`.
- **Riscos**: SEO no Vercel sem SSR é limitado (React puro); evitar chamada ao backend Fly no carregamento (cold start ~7s mata conversão); commits sem `Co-Authored-By`.
- **Pronto quando**: `/` carrega < 1.5s sem hit no backend; CTA "Teste grátis" leva ao registro.

### Onda 3 — Estratégico (decisões grandes, esforço L/XL)

#### 3.1 `feat/rls-postgres-hardening`
- **Arquivos**: nova migration Alembic com `CREATE POLICY ... USING (tenant_id = current_setting('app.current_tenant')::int)` em ~15 tabelas; `gestao_advocacia/extensions.py` ou `app_runtime.py` (hook `before_request` faz `SET LOCAL app.current_tenant`); suite de testes nova `tests/test_rls_isolation.py`.
- **Riscos**: SQLite em dev não tem RLS — precisa fallback (skip policies) ou migrar dev pra Postgres via Docker; risco de quebrar jobs APScheduler que rodam fora de request context (CNJ 12h, DJEN diário) — eles precisam setar `app.current_tenant` manualmente; impacto em performance (testar com benchmark).
- **Pronto quando**: bug intencional removendo `query_for_tenant` de uma rota **não vaza dados** entre tenants (teste regressivo passa).

#### 3.2 `feat/stripe-billing`
- **Arquivos**: `models/__init__.py` (`Plano`, `Subscription`, `Invoice`), `routes/billing.py` (novo blueprint), webhook handler, `pages/BillingPage.jsx`, env vars Stripe.
- **Riscos**: **Kaspersky faz MITM e bloqueia Stripe** em dev local — desabilitar web protection ao testar; webhooks precisam URL pública (Fly OK, mas cold start pode causar timeout no retry do Stripe — manter `min_machines_running=1` durante rollout); planos por OAB exigem validação contra `User.role='advogado'` count; commits sem `Co-Authored-By` (deploy Vercel).
- **Pronto quando**: assinatura no portal Stripe ativa o tenant, webhook atualiza `subscription_status`, downgrade bloqueia features além do plano.

---

## Resumo das ondas

| Onda | Features | PRs | Esforço total |
|---|---|---|---|
| 1 — Quick wins | Onboarding wizard, Kanban drag-drop | 2 | S + S |
| 2 — Médio prazo | Timeline de Caso, Dashboard Recharts, Filtros avançados, Landing | 4 | 4×M |
| 3 — Estratégico | RLS Postgres, Stripe Billing | 2 | L + XL |

## Gotchas recorrentes (consultar antes de cada PR)

1. **Vercel Hobby (repo privado)**: nunca usar `Co-Authored-By:` no commit — quebra deploy.
2. **Kaspersky**: faz MITM e bloqueia Stripe/CSP — desabilitar web protection ao mexer em billing.
3. **Fly auto-stop**: cold start ~7s; landing pública não deve depender do backend no first paint.
4. **CI backend-style**: rodar `ruff check . --fix && black .` de dentro de `gestao_advocacia/` antes do push (versões pinadas: ruff 0.8.2 / black 24.10.0).
5. **CI frontend**: `npx prettier --write` além de `npm run lint`.
6. **Worktrees**: ao trabalhar em `.claude/worktrees/<branch>/`, escrever no path do worktree, não no main.
