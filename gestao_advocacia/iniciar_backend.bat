:: Arquivo: iniciar_backend.bat
:: Coloque este arquivo na RAIZ da sua pasta do projeto backend (ex: gestao_advocacia)

@echo OFF
echo Iniciando Servidor Backend Flask...

:: Caminho para a pasta do seu ambiente virtual (venv)
set VENV_PATH=.\venv 

:: Caminho para o script de ativação do venv
set ACTIVATE_SCRIPT=%VENV_PATH%\Scripts\activate.bat

:: Caminho para o seu arquivo app.py
set FLASK_APP_FILE=app.py

:: Ativa o ambiente virtual
call %ACTIVATE_SCRIPT%

:: Verifica se a ativação foi bem-sucedida (opcional)
if "%VIRTUAL_ENV%"=="" (
    echo ERRO: Nao foi possivel ativar o ambiente virtual em %VENV_PATH%
    pause
    exit /b
)

echo Ambiente virtual ativado.
echo Executando Flask app: %FLASK_APP_FILE%

:: Inicia o servidor Flask
:: O Flask usará as configurações do seu config.py, incluindo a DATABASE_URL
:: O modo debug pode ser mantido para desenvolvimento local fácil.
python %FLASK_APP_FILE%

echo Servidor Flask encerrado.
pause