@echo OFF
echo Iniciando Servidor Backend Flask...

set VENV_PATH=..\..\venv
set ACTIVATE_SCRIPT=%VENV_PATH%\Scripts\activate.bat
set FLASK_APP_FILE=app.py

cd /D %~dp0\..\..\gestao_advocacia
call %ACTIVATE_SCRIPT%

if "%VIRTUAL_ENV%"=="" (
    echo ERRO: Nao foi possivel ativar o ambiente virtual em %VENV_PATH%
    pause
    exit /b
)

echo Ambiente virtual ativado.
echo Executando Flask app: %FLASK_APP_FILE%
python %FLASK_APP_FILE%

echo Servidor Flask encerrado.
pause
