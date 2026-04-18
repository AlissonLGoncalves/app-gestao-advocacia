@echo OFF
echo Iniciando Servidor Frontend Vite/React...

cd /D %~dp0\..\..\gestao_advocacia_vite

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERRO: npm nao encontrado. Verifique se o Node.js esta instalado e no PATH.
    pause
    exit /b
)

echo Iniciando servidor de desenvolvimento Vite...
npm run dev

echo Servidor Vite encerrado.
pause
