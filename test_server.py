#!/usr/bin/env python3

import sys
import os
from pathlib import Path

# Agregar módulos al path
sys.path.append(str(Path(__file__).parent))

try:
    print("Probando importaciones...")
    
    from flask import Flask
    print("✓ Flask importado")
    
    from products.product_manager import ProductManager
    print("✓ ProductManager importado")
    
    from navigation.selenium_handler import SeleniumHandler
    print("✓ SeleniumHandler importado")
    
    from ai_generator.ai_handler import AIHandler
    print("✓ AIHandler importado")
    
    print("Todas las importaciones exitosas!")
    
    # Crear app simple
    app = Flask(__name__)
    
    @app.route('/')
    def hello():
        return "¡Servidor funcionando!"
    
    @app.route('/health')
    def health():
        return {"status": "ok"}
    
    print("Iniciando servidor en puerto 5001...")
    app.run(debug=True, host='0.0.0.0', port=5001)
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
