# Rotação do `FLY_API_TOKEN`

O token Fly usado pelo workflow `deploy-fly.yml` (secret
`FLY_API_TOKEN`) **não expira automaticamente**. Para reduzir a janela
de exposição em caso de vazamento, rotacionar a cada **6 meses**.

## Quando rotacionar

- Calendário fixo: **a cada 6 meses** (próxima rotação anotada abaixo).
- Imediatamente se houver suspeita de vazamento (commit acidental,
  ex-colaborador com acesso ao repo, log público com o token, etc.).

## Procedimento

1. **Gerar novo token** com escopo limitado ao app:

   ```
   flyctl tokens create deploy --app app-gestao-advocacia
   ```

   Copiar o token (só aparece uma vez).

2. **Atualizar secret no GitHub**:
   - Repo → Settings → Secrets and variables → Actions
   - Editar `FLY_API_TOKEN`, colar o novo valor

3. **Disparar deploy manual** para validar que o token novo funciona:
   - Actions → "Deploy backend to Fly" → Run workflow → branch `main`
   - Se passou (job verde + health check OK), seguir.

4. **Revogar o token antigo**:

   ```
   flyctl tokens list
   flyctl tokens revoke <id-do-token-antigo>
   ```

5. **Atualizar o registro abaixo** com a nova data.

6. **Criar issue de lembrete** para a próxima rotação. Sem isso este
   `docs/ops/` vira papel de parede e o token nunca rotaciona.

   ```
   gh issue create \
     --title "Rotacionar FLY_API_TOKEN" \
     --label ops,recurring \
     --body "Próxima rotação esperada conforme docs/ops/fly-token-rotation.md. \
   Procedimento completo no doc. Devida em <DATA = rotacao_atual + 6 meses>."
   ```

   Após criar, anotar o número da issue na tabela de histórico abaixo.
   Ao concluir a próxima rotação, fechar a issue e abrir a próxima.

## Histórico

| Data         | Quem rotacionou | Issue de lembrete |
|--------------|-----------------|-------------------|
| 2026-04-26   | (criação inicial — sem rotação efetiva) | (a criar) |

**Próxima rotação esperada: 2026-10-26**
