"""
STEL Shop Manager - Aplicación Principal
Sistema modular para gestión de productos y descripciones
"""

import sys
import os
import webbrowser
import threading
import time
from pathlib import Path

# Agregar módulos al path
sys.path.append(str(Path(__file__).parent))

from flask import Flask, render_template, jsonify, request, send_file
from flask_cors import CORS
import logging

# Importar módulos
from products.product_manager import ProductManager
from products.database_handler import DatabaseHandler
from products.product_filters import FilterCriteria
from navigation.selenium_handler import SeleniumHandler
from ai_generator.ai_handler import AIHandler
from ai_generator.prompt_manager import PromptManager

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/stel_shop.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Crear aplicación Flask
app = Flask(__name__, 
    static_folder='static',
    template_folder='templates'
)
CORS(app)

# Instancias globales de los módulos
product_manager = ProductManager()
selenium_handler = SeleniumHandler()
ai_handler = AIHandler()
prompt_manager = PromptManager()

# Estado global de la aplicación
app_state = {
    'db_connected': False,
    'browser_running': False,
    'ai_configured': False,
    'processing': False
}

# ============================================================================
# RUTAS PRINCIPALES
# ============================================================================

@app.route('/')
def index():
    """Página principal con las tres pestañas"""
    return render_template('index.html')

@app.route('/health')
def health():
    """Estado de salud de la aplicación"""
    return jsonify({
        'status': 'ok',
        'modules': {
            'products': app_state['db_connected'],
            'navigation': app_state['browser_running'],
            'ai_generator': app_state['ai_configured']
        }
    })

# ============================================================================
# API DE PRODUCTOS
# ============================================================================

@app.route('/api/products/connect', methods=['POST'])
def connect_database():
    """Conectar a la base de datos MySQL"""
    try:
        success = product_manager.connect_database()
        if success:
            app_state['db_connected'] = True
            db_config = product_manager.db_handler.config
            instance_name = db_config.get("instance_connection_name", "Cloud SQL")
            return jsonify({
                'success': True,
                'info': f"{db_config.get('database')}.{db_config.get('table')} @ {instance_name}"
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No se pudo conectar a la base de datos. Revisa las credenciales y la configuración del conector.'
            })
    except Exception as e:
        logger.error(f"Error conectando DB: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/products/products', methods=['POST'])
def get_products():
    """Obtener productos con filtros"""
    try:
        filters = request.json.get('filters', {})
        sort = request.json.get('sort', {})
        
        # Aplicar filtros si existen
        if filters:
            criteria = FilterCriteria(**filters)
            df = product_manager.apply_filter(criteria)
        else:
            df = product_manager.refresh_products()
        
        # Convertir a lista de diccionarios
        products = df.to_dict('records')
        
        return jsonify({
            'success': True,
            'products': products
        })
    except Exception as e:
        logger.error(f"Error obteniendo productos: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/products/filter-options')
def get_filter_options():
    """Obtener opciones para filtros"""
    try:
        options = product_manager.get_filter_options()
        return jsonify(options)
    except Exception as e:
        return jsonify({
            'familias': [],
            'marcas': [],
            'saved_filters': [],
            'preset_filters': []
        })

@app.route('/api/products/search', methods=['POST'])
def search_products():
    """Búsqueda rápida de productos"""
    try:
        query = request.json.get('query', '')
        df = product_manager.search_products(query)
        
        return jsonify({
            'success': True,
            'products': df.to_dict('records')
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/products/statistics')
def get_statistics():
    """Obtener estadísticas"""
    try:
        stats = product_manager.get_statistics()
        return jsonify(stats)
    except Exception as e:
        return jsonify({})

@app.route('/api/products/export-selection', methods=['POST'])
def export_selection():
    """Exportar productos seleccionados"""
    try:
        format_type = request.json.get('format', 'excel')
        filepath = product_manager.export_selected_products(format_type)
        
        if filepath:
            filename = os.path.basename(filepath)
            return jsonify({
                'success': True,
                'filename': filename
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No se pudo exportar'
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/products/download-export/<filename>')
def download_export(filename):
    """Descargar archivo exportado"""
    filepath = Path('exports') / filename
    if filepath.exists():
        return send_file(filepath, as_attachment=True)
    else:
        return "Archivo no encontrado", 404

# ============================================================================
# API DE NAVEGACIÓN
# ============================================================================

@app.route('/api/navigation/start-browser', methods=['POST'])
def start_browser():
    """Iniciar navegador Chrome"""
    try:
        # Configurar callbacks
        selenium_handler.set_callback('on_log', lambda log: logger.info(log['message']))
        selenium_handler.set_callback('on_product_complete', handle_product_complete)
        selenium_handler.set_callback('on_error', handle_navigation_error)
        
        result = selenium_handler.initialize_browser()
        
        if result['success']:
            app_state['browser_running'] = True
            
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/navigation/check-login')
def check_login():
    """Verificar estado de login"""
    try:
        logged_in = selenium_handler.check_login_status()
        return jsonify({'logged_in': logged_in})
    except Exception as e:
        return jsonify({'logged_in': False, 'error': str(e)})

@app.route('/api/navigation/close-browser', methods=['POST'])
def close_browser():
    """Cerrar navegador"""
    try:
        selenium_handler.close_browser()
        app_state['browser_running'] = False
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/navigation/process-products', methods=['POST'])
def process_products():
    """Procesar lista de productos"""
    try:
        products = request.json.get('products', [])
        settings = request.json.get('settings', {})
        
        if not products:
            return jsonify({'success': False, 'error': 'No hay productos'})
        
        # Callback para generar descripciones
        def generate_descriptions(product):
            if settings.get('use_ai') and app_state['ai_configured']:
                # Usar IA
                prompt = prompt_manager.get_current_prompt()['prompt']
                descripcion_detallada = ai_handler.generate_description(
                    product['row_data'], 
                    prompt,
                    get_contact_config()
                )
                
                # Generar descripción corta sin HTML
                descripcion = generate_short_description(product['row_data'])
                
                return {
                    'descripcion': descripcion,
                    'descripcion_detallada': descripcion_detallada,
                    'seo_titulo': f"{product['nombre']} - Generador Eléctrico",
                    'seo_descripcion': descripcion[:160]
                }
            else:
                # Sin IA, usar generación básica
                from ai_generator.ai_handler import AIHandler
                temp_handler = AIHandler()
                descripcion_detallada = temp_handler._generate_fallback_description(
                    product['row_data'], 
                    get_contact_config()
                )
                
                descripcion = generate_short_description(product['row_data'])
                
                return {
                    'descripcion': descripcion,
                    'descripcion_detallada': descripcion_detallada,
                    'seo_titulo': f"{product['nombre']} - Equipo Industrial",
                    'seo_descripcion': descripcion[:160]
                }
        
        # Iniciar procesamiento en thread
        selenium_handler.process_products(products, generate_descriptions)
        app_state['processing'] = True
        
        return jsonify({'success': True})
        
    except Exception as e:
        logger.error(f"Error procesando productos: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/navigation/status')
def get_navigation_status():
    """Obtener estado del navegador"""
    try:
        status = selenium_handler.get_status()
        return jsonify(status)
    except Exception as e:
        return jsonify({
            'browser_status': None,
            'is_processing': False,
            'stats': {}
        })

@app.route('/api/navigation/pause', methods=['POST'])
def pause_navigation():
    """Pausar procesamiento"""
    selenium_handler.pause_processing()
    return jsonify({'success': True})

@app.route('/api/navigation/resume', methods=['POST'])
def resume_navigation():
    """Reanudar procesamiento"""
    selenium_handler.resume_processing()
    return jsonify({'success': True})

@app.route('/api/navigation/stop', methods=['POST'])
def stop_navigation():
    """Detener procesamiento"""
    selenium_handler.stop_processing()
    app_state['processing'] = False
    return jsonify({'success': True})

# ============================================================================
# API DE GENERADOR IA
# ============================================================================

@app.route('/api/ai-generator/validate-api-key', methods=['POST'])
def validate_api_key():
    """Validar API key de Google Gemini"""
    try:
        api_key = request.json.get('api_key', '')
        
        if ai_handler.initialize_model(api_key):
            app_state['ai_configured'] = True
            return jsonify({'success': True})
        else:
            return jsonify({
                'success': False,
                'error': 'API key inválida'
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/ai-generator/prompt-versions')
def get_prompt_versions():
    """Obtener todas las versiones de prompts"""
    try:
        versions = prompt_manager.get_all_versions()
        return jsonify(versions)
    except Exception as e:
        return jsonify([])

@app.route('/api/ai-generator/prompt-version/<version_id>')
def get_prompt_version(version_id):
    """Obtener una versión específica"""
    try:
        if version_id == 'base':
            version = prompt_manager.get_base_prompt()
        else:
            version = prompt_manager.get_version(version_id)
        
        return jsonify(version)
    except Exception as e:
        return jsonify({})

@app.route('/api/ai-generator/save-prompt-version', methods=['POST'])
def save_prompt_version():
    """Guardar nueva versión de prompt"""
    try:
        data = request.json
        version = prompt_manager.save_new_version(
            data['prompt'],
            data['name'],
            data['description']
        )
        return jsonify({'success': True, 'version': version})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/ai-generator/generate-preview', methods=['POST'])
def generate_preview():
    """Generar preview con producto de ejemplo"""
    try:
        data = request.json
        api_key = data.get('api_key')
        prompt = data.get('prompt')
        product_type = data.get('product_type', 'generador')
        
        # Asegurar que el modelo esté inicializado
        if api_key and not app_state['ai_configured']:
            ai_handler.initialize_model(api_key)
        
        # Generar preview
        html = ai_handler.preview_with_example(prompt)
        
        return jsonify({
            'success': True,
            'html': html
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/ai-generator/product-types')
def get_product_types():
    """Obtener tipos de productos configurados"""
    try:
        return jsonify(ai_handler.product_types)
    except Exception as e:
        return jsonify({})

# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

def handle_product_complete(result):
    """Callback cuando se completa un producto"""
    logger.info(f"Producto {result['sku']} procesado: {result['success']}")

def handle_navigation_error(error_data):
    """Callback para errores de navegación"""
    logger.error(f"Error en navegación: {error_data}")

def get_contact_config():
    """Obtener configuración de contacto"""
    return {
        'whatsapp': '541139563099',
        'email': 'info@generadores.ar',
        'telefono_display': '+54 11 3956-3099',
        'website': 'www.generadores.ar'
    }

def generate_short_description(product_data):
    """Generar descripción corta sin HTML"""
    info = {
        'nombre': str(product_data.get('Descripción', 'Producto')),
        'marca': str(product_data.get('Marca', '')),
        'modelo': str(product_data.get('Modelo', '')),
        'potencia': str(product_data.get('Potencia', '')),
        'familia': str(product_data.get('Familia', ''))
    }
    
    # Calcular autonomía si es posible
    autonomia = "Variable según carga"
    consumo = product_data.get('Consumo_Combustible_L_H')
    tanque = product_data.get('Capacidad_Tanque_L')
    
    if consumo and tanque:
        try:
            horas = float(tanque) / float(consumo)
            autonomia = f"~ {horas:.1f} horas"
        except:
            pass
    
    descripcion = f"""========================================
{info['marca'].upper()} {info['modelo']}
========================================

[ INFORMACIÓN GENERAL ]
- Producto: {info['nombre']}
- Familia: {info['familia']}
- Potencia: {info['potencia']}

[ CARACTERÍSTICAS PRINCIPALES ]
- Motor de alta calidad
- Construcción robusta
- Mantenimiento simplificado
- Garantía oficial

[ AUTONOMÍA ]
- Autonomía estimada: {autonomia}

========================================"""
    
    return descripcion

# ============================================================================
# INICIALIZACIÓN
# ============================================================================

def create_directories():
    """Crear directorios necesarios"""
    directories = [
        'logs',
        'exports',
        'screenshots',
        'selections',
        'config',
        'browser_profiles',
        'modules/ai_generator/versions',
        'modules/ai_generator/templates'
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)

def open_browser():
    """Abrir navegador automáticamente"""
    time.sleep(2)
    webbrowser.open('http://localhost:5001')

if __name__ == '__main__':
    # Crear directorios
    create_directories()
    
    # Mensaje de inicio
    print("""
    ╔══════════════════════════════════════════════╗
    ║       STEL SHOP MANAGER - v1.0.0             ║
    ║   Sistema Modular de Gestión de Productos    ║
    ╚══════════════════════════════════════════════╝
    
    Iniciando servidor...
    """)
    
    # Abrir navegador en thread separado
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Iniciar aplicación
    app.run(debug=False, host='0.0.0.0', port=5001)
