# [C3] Integração com modal DJEN (F2) — upload de procuração

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md` e `ROADMAP-2026-Q2.md`.**
> 🚫 **NÃO use `Co-Authored-By`** em commits.

**Prioridade:** 🟡 Média (enhancement de feature existente)
**Track:** C — Automação de procuração
**Depende de:** C2
**Estimativa:** 3-4 horas

## Objetivo

Permitir que o `ModalCriarClienteCaso.jsx` (F2, já em produção) também aceite upload de procuração para complementar dados do cliente que o DJEN não traz (qualificação completa, endereço, RG, etc.).

## Tarefas

1. `gestao_advocacia_vite/src/components/djen/ModalCriarClienteCaso.jsx`:
   - Adicionar botão "Extrair mais dados da procuração" na aba/seção "Cliente"
   - Reutilizar service `procuracaoService.extrairProcuracao()` de C2
   - **Merge de dados** (regra clara):
     - Para campos **vazios** no form (vindos do DJEN) → procuração preenche
     - Para campos **já preenchidos** pelo DJEN → procuração NÃO sobrescreve, mas valida
     - Se procuração diverge do DJEN (ex: nome do autor DJEN ≠ outorgante procuração) → banner amarelo: *"Procuração diz 'X', DJEN diz 'Y'. Qual está correto?"* com 2 botões.

2. Atualizar `ModalCriarClienteCaso.test.jsx`:
   - Upload complementa endereço sem sobrescrever nome do DJEN
   - Divergência de nome mostra aviso + ambos os valores

## Critérios de aceite

- [ ] Upload dentro do modal F2 funciona
- [ ] Merge respeita prioridade DJEN > procuração em campos preenchidos
- [ ] Banner de divergência aparece quando apropriado
- [ ] 2 testes novos passando + 4 testes existentes continuam verdes

## Branch e PR

- Branch: `feat/c3-procuracao-modal-djen`
- Título PR: `[C3] Modal DJEN (F2) aceita procuração para complementar cliente`
