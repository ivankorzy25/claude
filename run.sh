#!/bin/bash

echo "========================================"
echo "  STEL Shop Manager - Iniciando..."
echo "========================================"
echo

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 no está instalado"
    exit 1
fi

# Activar entorno virtual si existe
if [ -f ".venv/bin/activate" ]; then
    echo "Activando entorno virtual .venv..."
    source .venv/bin/activate
fi

# Verificar instalación
if [ ! -f "config/database_config.json" ]; then
    echo "Primera ejecución detectada. Ejecutando instalador..."
    python3 setup.py
    echo
    echo "Por favor, configura la base de datos y vuelve a ejecutar."
    exit 0
fi

# Ejecutar aplicación
echo "Iniciando servidor..."
"./.venv/bin/python" main.py
