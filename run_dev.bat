.\run_dev.ba@echo off
echo ========================================
echo   STEL Shop Manager - Vista Unificada
echo ========================================
echo.

REM Limpiar cache
for /d /r . %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d"
python clear_cache.py

REM Activar entorno virtual
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)

REM Mensaje de instrucciones
echo.
echo La aplicacion se abrira en una sola pagina con scroll
echo Sigue los pasos en orden:
echo   1. Navegacion - Inicia Chrome y haz login
echo   2. IA - Configura tu API key
echo   3. Productos - Selecciona que procesar
echo   4. Procesar - Inicia el proceso
echo.

REM Ejecutar
python main.py

pause
