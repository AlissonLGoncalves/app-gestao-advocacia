# Guia de Versionamento do Projeto

Este documento define como atualizar versoes neste repositorio de forma padrao, previsivel e facil de interpretar (por pessoas e por IAs).

## 1) Objetivo

Garantir que toda atualizacao tenha versao correta e consistente.

Padrao adotado: **SemVer** (Semantic Versioning)

Formato:

`MAJOR.MINOR.PATCH`

Exemplo:

`1.0.0`

## 2) Onde a versao deve ser atualizada

Atualmente, este projeto usa versao em dois arquivos:

1. `package.json` (raiz)
2. `gestao_advocacia_vite/package.json`

Regra obrigatoria:

- Sempre manter os dois arquivos com a mesma versao.

## 3) Regras simples (quando usar cada numero)

### PATCH (x.y.Z)

Use PATCH quando:

- Corrigir bug
- Ajustar layout sem criar funcionalidade nova
- Melhorar texto, mensagens, estilos, pequenos refinos
- Refatorar sem alterar comportamento externo

Exemplo:

`1.0.0 -> 1.0.1`

### MINOR (x.Y.z)

Use MINOR quando:

- Adicionar funcionalidade nova
- Adicionar tela, filtro, endpoint novo sem quebrar o que ja existia
- Melhorias relevantes mantendo compatibilidade

Exemplo:

`1.0.1 -> 1.1.0`

### MAJOR (X.y.z)

Use MAJOR quando houver quebra de compatibilidade.

Caracteriza quebra de compatibilidade:

- API antiga deixa de funcionar do mesmo jeito
- Campos obrigatorios mudam e integracoes antigas quebram
- Contratos de requisicao/resposta mudam sem manter formato anterior
- Fluxo principal muda exigindo adaptacao de clientes/integracoes

Exemplo:

`1.9.4 -> 2.0.0`

## 4) Regra de decisao rapida

Se houver duvida, use esta ordem:

1. Quebrou compatibilidade? -> MAJOR
2. Nao quebrou, mas adicionou funcionalidade? -> MINOR
3. Nao adicionou funcionalidade e so corrigiu/ajustou? -> PATCH

## 5) Fluxo de release (passo a passo)

1. Definir tipo da mudanca: PATCH, MINOR ou MAJOR
2. Atualizar a versao nos dois arquivos:
   - `package.json`
   - `gestao_advocacia_vite/package.json`
3. Commitar com mensagem de release
4. Fazer push para `main`
5. (Opcional recomendado) Criar tag git da versao

## 6) Mensagens de commit recomendadas

- `chore(release): bump version to 1.0.1`
- `chore(release): bump version to 1.1.0`
- `chore(release): bump version to 2.0.0`

## 7) Comandos praticos (manual)

### Atualizar versao manualmente

Edite os dois `package.json` e depois rode:

```bash
git add package.json gestao_advocacia_vite/package.json
git commit -m "chore(release): bump version to X.Y.Z"
git push origin main
```

### Criar tag (opcional recomendado)

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

## 8) Como a IA deve interpretar

Quando uma IA for atualizar a versao deste projeto, ela deve:

1. Ler este arquivo (`GUIA_VERSIONAMENTO.md`)
2. Classificar mudanca em PATCH, MINOR ou MAJOR
3. Atualizar os dois `package.json` para o mesmo numero
4. Explicar em 1 frase por que escolheu esse tipo de versao
5. Commitar com padrao `chore(release): bump version to X.Y.Z`

## 9) Exemplos reais para este projeto

- Ajuste visual (cores, espacos, tipografia): PATCH
- Nova tela de relatorio sem quebrar rotas antigas: MINOR
- Mudanca de contrato da API de login que quebra frontend antigo: MAJOR

## 10) Politica atual

Versao base inicial: `1.0.0`

A partir daqui:

- Correcoes e refinamentos: `1.0.1`, `1.0.2`, ...
- Novas features compativeis: `1.1.0`, `1.2.0`, ...
- Quebra de compatibilidade: `2.0.0`, `3.0.0`, ...
