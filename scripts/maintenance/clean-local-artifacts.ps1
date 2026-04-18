# Limpa artefatos locais de runtime/teste que nao devem entrar no git.
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $repoRoot

$targets = @(
    "gestao_advocacia/uploads_documentos",
    "gestao_advocacia_vite/coverage"
)

foreach ($relativePath in $targets) {
    $fullPath = Join-Path $repoRoot $relativePath
    if (Test-Path $fullPath) {
        Remove-Item -Recurse -Force $fullPath
        Write-Host "Removido: $relativePath"
    } else {
        Write-Host "Nao encontrado: $relativePath"
    }
}
