param(
    [switch]$Execute
)

# Limpa artefatos locais de runtime/teste que nao devem entrar no git.
# Modo padrao: dry-run (somente informa o que seria removido).
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $repoRoot

$targets = @(
    "gestao_advocacia/uploads_documentos",
    "gestao_advocacia_vite/coverage"
)

if (-not $Execute) {
    Write-Host "DRY-RUN ativo. Nenhum arquivo sera removido. Use -Execute para aplicar."
}

foreach ($relativePath in $targets) {
    $fullPath = Join-Path $repoRoot $relativePath
    if (Test-Path $fullPath) {
        if ($Execute) {
            Remove-Item -Recurse -Force $fullPath
            Write-Host "Removido: $relativePath"
        } else {
            Write-Host "Seria removido: $relativePath"
        }
    } else {
        Write-Host "Nao encontrado: $relativePath"
    }
}
