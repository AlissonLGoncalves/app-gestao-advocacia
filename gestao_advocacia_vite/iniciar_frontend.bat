:: Arquivo: iniciar_frontend.bat
:: Coloque este arquivo na RAIZ da sua pasta do projeto frontend (ex: gestao_advocacia_vite)

@echo OFF
echo Iniciando Servidor Frontend Vite/React...

:: Navega para a pasta do projeto frontend (IMPORTANTE se o script não estiver lá)
:: Se você colocar este .bat DENTRO da pasta gestao_advocacia_vite, esta linha não é estritamente necessária.
:: cd /D C:\Caminho\Completo\Para\gestao_advocacia_vite 
:: Exemplo: cd /D "C:\Users\aliss\OneDrive\Área de Trabalho\DEV - Alisson\PROJETOS\gestao_advocacia_vite"

:: Verifica se o Node.js/npm está no PATH (geralmente está)
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