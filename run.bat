@echo off
echo ========================================
echo   STEL Shop Manager - Iniciando...
echo ========================================
echo.

REM Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no está instalado o no está en el PATH
    pause
    exit /b 1
)

REM Activar entorno virtual si existe
if exist "venv\Scripts\activate.bat" (
    echo Activando entorno virtual...
    call venv\Scripts\activate.bat
)

REM Verificar instalación
if not exist "config\database_config.json" (
    echo Primera ejecución detectada. Ejecutando instalador...
    python setup.py
    echo.
    echo Por favor, configura la base de datos y vuelve a ejecutar.
    pause
    exit /b 0
)

REM Ejecutar aplicación
echo Iniciando servidor...
python main.py

pause
