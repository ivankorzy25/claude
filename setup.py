"""
Script de instalación para STEL Shop Manager
Instala todas las dependencias y configura el entorno
"""

import subprocess
import sys
import os
from pathlib import Path

def install_requirements():
    """Instala todos los paquetes necesarios"""
    
    print("📦 Instalando dependencias...")
    
    requirements = [
        'flask',
        'flask-cors',
        'selenium',
        'pandas',
        'openpyxl',
        'pymysql',
        'google-generativeai',
        'requests',
        'PyPDF2',
        'PyMuPDF',
        'webdriver-manager'
    ]
    
    for package in requirements:
        print(f"  Instalando {package}...")
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])
    
    print("✅ Dependencias instaladas")

def create_directory_structure():
    """Crea la estructura de directorios necesaria"""
    
    print("\n📁 Creando estructura de directorios...")
    
    directories = [
        'logs',
        'exports',
        'screenshots',
        'selections',
        'config',
        'browser_profiles',
        'static/css',
        'static/js',
        'static/modules/products',
        'static/modules/navigation',
        'static/modules/ai_generator',
        'templates',
        'modules/products',
        'modules/navigation',
        'modules/ai_generator/templates',
        'modules/ai_generator/versions'
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        print(f"  ✓ {directory}")
    
    print("✅ Estructura creada")

def create_config_files():
    """Crea archivos de configuración por defecto"""
    
    print("\n⚙️ Creando archivos de configuración...")
    
    # Configuración de base de datos
    db_config = {
        "host": "localhost",
        "user": "root",
        "password": "tu_password_aqui",
        "database": "lista_precios_kor",
        "table": "shop_master_gaucho_completo"
    }
    
    with open('config/database_config.json', 'w') as f:
        import json
        json.dump(db_config, f, indent=2)
    
    print("  ✓ config/database_config.json")
    
    # Configuración del navegador
    browser_config = {
        "timeout": 60,
        "implicit_wait": 10,
        "page_load_timeout": 30,
        "window_size": "1280,720",
        "disable_images": False
    }
    
    with open('config/browser_config.json', 'w') as f:
        json.dump(browser_config, f, indent=2)
    
    print("  ✓ config/browser_config.json")
    print("✅ Configuración creada")

def copy_module_files():
    """Copia los archivos de los módulos a las ubicaciones correctas"""
    
    print("\n📄 Preparando archivos de módulos...")
    
    # Aquí deberías copiar los archivos HTML, CSS y JS de cada módulo
    # a las carpetas static/modules correspondientes
    
    print("⚠️ Por favor, copia manualmente los archivos de cada módulo:")
    print("  - products.html, products.css, products.js → static/modules/products/")
    print("  - navigation.html, navigation.css, navigation.js → static/modules/navigation/")
    print("  - generator.html, generator.css, generator.js → static/modules/ai_generator/")

def main():
    """Función principal de instalación"""
    
    print("""
    +----------------------------------------------+
    |     INSTALADOR - STEL SHOP MANAGER v1.0.0    |
    +----------------------------------------------+
    """)
    
    try:
        # 1. Instalar dependencias
        install_requirements()
        
        # 2. Crear estructura
        create_directory_structure()
        
        # 3. Crear configuración
        create_config_files()
        
        # 4. Instrucciones finales
        print("\n" + "="*50)
        print("✅ INSTALACIÓN COMPLETADA")
        print("="*50)
        
        print("\n📋 SIGUIENTES PASOS:")
        print("1. Edita config/database_config.json con tus credenciales MySQL")
        print("2. Copia los archivos de módulos a static/modules/")
        print("3. Ejecuta: python main.py")
        print("4. Abre tu navegador en: http://localhost:5000")
        
        print("\n💡 TIPS:")
        print("- Obtén tu API key de Google en: https://makersuite.google.com/app/apikey")
        print("- Asegúrate de tener Chrome instalado")
        print("- El perfil de Chrome se guardará en browser_profiles/")
        
    except Exception as e:
        print(f"\n❌ Error durante la instalación: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
