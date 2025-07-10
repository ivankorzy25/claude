"""
Módulo de Generación con IA para STEL Shop
Gestiona la creación de descripciones HTML usando Google Gemini
"""

import json
import re
from datetime import datetime
from typing import Dict, Any, Optional
import google.generativeai as genai
from pathlib import Path

class AIHandler:
    """Maneja la generación de descripciones con IA"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.model = None
        self.current_prompt_version = "base"
        self.module_path = Path(__file__).parent
        
        # Cargar configuración de productos
        self.product_types = self._load_product_types()
        
        if api_key:
            self.initialize_model(api_key)
    
    def initialize_model(self, api_key: str):
        """Inicializa el modelo de Google Gemini"""
        try:
            genai.configure(api_key=api_key)
            # Intentar con el modelo más reciente
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            return True
        except Exception as e:
            print(f"Error inicializando modelo: {e}")
            return False
    
    def _load_product_types(self) -> Dict:
        """Carga la configuración de tipos de productos"""
        template_path = self.module_path / "templates" / "product_templates.json"
        
        default_types = {
            "grupo_electrogeno": {
                "keywords": ["generador", "grupo electrógeno", "kva", "kw"],
                "focus": "potencia, autonomía, motor",
                "applications": "respaldo energético, obras, industria"
            },
            "compresor": {
                "keywords": ["compresor", "psi", "bar", "aire comprimido"],
                "focus": "presión, caudal, tanque",
                "applications": "talleres, pintura, herramientas neumáticas"
            },
            "motobomba": {
                "keywords": ["motobomba", "bomba", "caudal", "litros"],
                "focus": "caudal, altura máxima, succión",
                "applications": "riego, drenaje, construcción"
            },
            "motocultivador": {
                "keywords": ["motocultivador", "cultivador", "labranza"],
                "focus": "potencia, ancho de trabajo, profundidad",
                "applications": "agricultura, huertos, preparación de suelo"
            }
        }
        
        if template_path.exists():
            try:
                with open(template_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        
        return default_types
    
    def detect_product_type(self, product_info: Dict) -> str:
        """Detecta el tipo de producto basándose en la información"""
        # Combinar toda la información relevante
        search_text = f"{product_info.get('nombre', '')} {product_info.get('familia', '')} {product_info.get('modelo', '')}".lower()
        
        # Buscar coincidencias
        for product_type, config in self.product_types.items():
            for keyword in config['keywords']:
                if keyword.lower() in search_text:
                    return product_type
        
        return "generico"
    
    def generate_description(self, product_info: Dict, prompt_template: str = None, config: Dict = None) -> str:
        """Genera la descripción HTML del producto"""
        if not self.model:
            return self._generate_fallback_description(product_info, config)
        
        # Detectar tipo de producto
        product_type = self.detect_product_type(product_info)
        product_config = self.product_types.get(product_type, {})
        
        # Preparar el prompt
        if not prompt_template:
            prompt_template = self._get_base_prompt()
        
        # Reemplazar variables en el prompt
        prompt = self._prepare_prompt(prompt_template, product_info, product_type, product_config)
        
        try:
            # Generar con IA
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=2000,
                )
            )
            
            if response and response.text:
                # Procesar y formatear la respuesta
                html_content = self._format_ai_response(response.text, product_info, config)
                return html_content
            else:
                return self._generate_fallback_description(product_info, config)
                
        except Exception as e:
            print(f"Error generando con IA: {e}")
            return self._generate_fallback_description(product_info, config)
    
    def _get_base_prompt(self) -> str:
        """Obtiene el prompt base actual"""
        return """
        Genera una descripción HTML profesional para el siguiente producto:
        
        Tipo de producto: {product_type}
        Información del producto:
        - Nombre: {nombre}
        - Marca: {marca}
        - Modelo: {modelo}
        - Potencia: {potencia_kva} KVA
        - Motor: {motor}
        - Características técnicas: {tech_specs}
        
        La descripción debe:
        1. Ser profesional y persuasiva para venta
        2. Destacar los beneficios principales del producto
        3. Mencionar aplicaciones típicas ({applications})
        4. Enfocarse en: {focus_areas}
        5. Tener entre 150-200 palabras
        6. NO usar bullets, solo párrafos
        7. NO usar emojis ni caracteres especiales
        8. Usar un tono profesional pero cercano
        
        IMPORTANTE: 
        - Solo devuelve el contenido de los párrafos, sin etiquetas HTML
        - No uses listas con viñetas
        - Separa los párrafos con saltos de línea simples
        """
    
    def _prepare_prompt(self, template: str, product_info: Dict, product_type: str, product_config: Dict) -> str:
        """Prepara el prompt con la información del producto"""
        # Preparar especificaciones técnicas
        tech_specs = []
        if product_info.get('voltaje'):
            tech_specs.append(f"Voltaje: {product_info['voltaje']}V")
        if product_info.get('frecuencia'):
            tech_specs.append(f"Frecuencia: {product_info['frecuencia']}Hz")
        if product_info.get('consumo'):
            tech_specs.append(f"Consumo: {product_info['consumo']} L/h")
        
        # Reemplazar variables
        replacements = {
            '{product_type}': product_type.replace('_', ' ').title(),
            '{nombre}': product_info.get('nombre', 'Producto'),
            '{marca}': product_info.get('marca', ''),
            '{modelo}': product_info.get('modelo', ''),
            '{potencia_kva}': product_info.get('potencia_kva', ''),
            '{motor}': product_info.get('motor', ''),
            '{tech_specs}': ', '.join(tech_specs),
            '{applications}': product_config.get('applications', 'uso general'),
            '{focus_areas}': product_config.get('focus', 'calidad y rendimiento')
        }
        
        prompt = template
        for key, value in replacements.items():
            prompt = prompt.replace(key, str(value))
        
        return prompt
    
    def _format_ai_response(self, ai_text: str, product_info: Dict, config: Dict) -> str:
        """Formatea la respuesta de IA en el HTML final"""
        # Limpiar texto de caracteres no deseados
        cleaned_text = self._clean_text(ai_text)
        
        # Dividir en párrafos
        paragraphs = [p.strip() for p in cleaned_text.split('\n') if p.strip()]
        
        # Preparar datos de contacto
        whatsapp = config.get('whatsapp', '541139563099')
        email = config.get('email', 'info@generadores.ar')
        telefono_display = config.get('telefono_display', '+54 11 3956-3099')
        website = config.get('website', 'www.generadores.ar')
        
        # URL del PDF
        pdf_url = product_info.get('pdf_url', '')
        if pdf_url and not pdf_url.startswith('http'):
            pdf_url = f"https://storage.googleapis.com/fichas_tecnicas/{pdf_url}"
        
        # Preparar mensajes para enlaces
        nombre_producto = product_info.get('nombre', 'Producto')
        whatsapp_msg = f"Hola,%20vengo%20de%20ver%20el%20{nombre_producto.replace(' ', '%20')}%20en%20la%20tienda%20de%20Stelorder%20y%20quisiera%20más%20información%20sobre%20este%20producto"
        email_subject = f"Consulta%20desde%20Stelorder%20-%20{nombre_producto.replace(' ', '%20')}"
        email_body = f"Hola,%0A%0AVengo%20de%20ver%20el%20{nombre_producto.replace(' ', '%20')}%20en%20la%20tienda%20de%20Stelorder%20y%20quisiera%20más%20información%20sobre%20este%20producto.%0A%0AQuedo%20a%20la%20espera%20de%20su%20respuesta.%0A%0ASaludos"
        
        # Generar HTML basado en el formato de ejemplo
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
            
            <!-- Título del producto -->
            <h2 style="background: #ff6600; color: white; padding: 15px; text-align: center; border-radius: 10px; margin-bottom: 20px;">
                {nombre_producto.upper()}
            </h2>
            
            <!-- Descripción principal -->
            <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                {''.join([f'<p style="line-height: 1.6; color: #333; margin-bottom: 10px;">{p}</p>' for p in paragraphs])}
            </div>
            
            <!-- Especificaciones técnicas -->
            <div style="background: #ffcc00; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
                <h3 style="color: #333; margin-bottom: 15px;">📊 ESPECIFICACIONES TÉCNICAS COMPLETAS</h3>
                <table style="width: 100%; background: white; border-radius: 5px; overflow: hidden;">
                    <tr style="background: #333; color: white;">
                        <th style="padding: 10px; text-align: left;">CARACTERÍSTICA</th>
                        <th style="padding: 10px; text-align: left;">ESPECIFICACIÓN</th>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>⚡ POTENCIA</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">{product_info.get('potencia_kva', 'N/D')} KVA{f" / {product_info.get('potencia_kw', '')} KW" if product_info.get('potencia_kw') else ''}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>🔌 VOLTAJE</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">{product_info.get('voltaje', 'N/D')} V</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>📊 FRECUENCIA</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">{product_info.get('frecuencia', 'N/D')} Hz</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>🔧 MOTOR</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">{product_info.get('motor', 'N/D')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>⚙️ ALTERNADOR</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">{product_info.get('alternador', 'N/D')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>⛽ CONSUMO</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">{product_info.get('consumo', 'N/D')} L/h @ 75%</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>🛢️ TANQUE</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">{product_info.get('tanque', 'N/D')} Litros</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>📐 DIMENSIONES</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">{product_info.get('largo', 'N/D')} x {product_info.get('ancho', 'N/D')} x {product_info.get('alto', 'N/D')} mm</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px;"><strong>⚖️ PESO</strong></td>
                        <td style="padding: 10px;">{product_info.get('peso', 'N/D')} kg</td>
                    </tr>
                </table>
            </div>
            
            <!-- Características incluidas -->
            <div style="background: #52c41a; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <h3 style="margin-bottom: 10px;">INCLUYE CABINA INSONORIZADA</h3>
            </div>
            
            <!-- Beneficios -->
            <div style="margin-bottom: 30px;">
                <h3 style="color: #ff6600; margin-bottom: 15px;">✨ VENTAJAS DESTACADAS</h3>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #333;">⚡ POTENCIA Y RENDIMIENTO SUPERIOR</h4>
                    <p>Este equipo ofrece una potencia confiable y un rendimiento excepcional para garantizar continuidad en sus operaciones.</p>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #333;">💰 ECONOMÍA OPERATIVA GARANTIZADA</h4>
                    <p>Optimizado para máxima eficiencia y reducción de costos operativos a largo plazo.</p>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #333;">🛡️ CONFIABILIDAD COMPROBADA</h4>
                    <p>Construido con los más altos estándares de calidad para años de servicio confiable.</p>
                </div>
            </div>
            
            <!-- Por qué elegir -->
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #333; margin-bottom: 20px;">POR QUÉ ELEGIR ESTE GENERADOR</h2>
                
                <div style="display: flex; justify-content: space-around; flex-wrap: wrap;">
                    <div style="background: #f5f5f5; padding: 20px; margin: 10px; border-radius: 10px; flex: 1; min-width: 200px;">
                        <h4 style="color: #52c41a;">✅ GARANTÍA OFICIAL</h4>
                        <p>Respaldo total del fabricante con garantía extendida</p>
                    </div>
                    
                    <div style="background: #f5f5f5; padding: 20px; margin: 10px; border-radius: 10px; flex: 1; min-width: 200px;">
                        <h4 style="color: #ff6600;">✅ CALIDAD CERTIFICADA</h4>
                        <p>Cumple con todas las normas internacionales</p>
                    </div>
                    
                    <div style="background: #f5f5f5; padding: 20px; margin: 10px; border-radius: 10px; flex: 1; min-width: 200px;">
                        <h4 style="color: #ff4d4f;">✅ SERVICIO TÉCNICO</h4>
                        <p>Red nacional de servicio y repuestos originales</p>
                    </div>
                    
                    <div style="background: #f5f5f5; padding: 20px; margin: 10px; border-radius: 10px; flex: 1; min-width: 200px;">
                        <h4 style="color: #faad14;">💰 FINANCIACIÓN</h4>
                        <p>Múltiples opciones de pago y financiación</p>
                    </div>
                </div>
            </div>
            
            <!-- Call to Action -->
            <div style="background: #333; color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
                <h2 style="margin-bottom: 20px;">TOME ACCIÓN AHORA</h2>
                <p style="margin-bottom: 20px;">No pierda esta oportunidad. Consulte con nuestros especialistas hoy mismo.</p>
                
                <div style="margin: 20px 0;">
                    <a href="https://wa.me/{whatsapp}?text={whatsapp_msg}" target="_blank" style="display: inline-block; background: #25d366; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 5px; font-weight: bold;">
                        💬 CONSULTAR POR WHATSAPP
                    </a>
                    
                    <a href="{pdf_url}" target="_blank" style="display: inline-block; background: #faad14; color: #333; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 5px; font-weight: bold;">
                        📄 DESCARGAR FICHA TÉCNICA
                    </a>
                    
                    <a href="mailto:{email}?subject={email_subject}&body={email_body}" style="display: inline-block; background: #ff4d4f; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 5px; font-weight: bold;">
                        ✉️ SOLICITAR COTIZACIÓN
                    </a>
                </div>
            </div>
            
            <!-- Contacto directo -->
            <div style="text-align: center; margin-bottom: 20px;">
                <h3>CONTACTO DIRECTO</h3>
                <p>
                    <strong>📞 Teléfono / WhatsApp:</strong> <a href="https://wa.me/{whatsapp}?text={whatsapp_msg}" target="_blank">{telefono_display}</a><br>
                    <strong>✉️ Email:</strong> <a href="mailto:{email}?subject={email_subject}&body={email_body}">{email}</a><br>
                    <strong>🌐 Sitio Web:</strong> <a href="https://{website}" target="_blank">{website}</a>
                </p>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; padding: 20px; border-top: 2px solid #ddd; color: #666;">
                <p>✅ Garantía Oficial | ✅ Servicio Técnico | ✅ Repuestos Originales | ✅ Financiación</p>
                <p style="font-size: 12px; margin-top: 10px;">© 2024 - Todos los derechos reservados | Distribuidor Oficial de Grupos Electrógenos</p>
            </div>
            
        </div>
        """
        
        return html
    
    def _clean_text(self, text: str) -> str:
        """Limpia el texto de caracteres especiales y emojis"""
        # Remover emojis y caracteres especiales
        text = re.sub(r'[^\w\s\-.,;:()áéíóúñÁÉÍÓÚÑ]', '', text)
        # Normalizar espacios
        text = ' '.join(text.split())
        return text
    
    def _generate_fallback_description(self, product_info: Dict, config: Dict) -> str:
        """Genera una descripción sin IA cuando no está disponible"""
        nombre = product_info.get('nombre', 'Producto')
        marca = product_info.get('marca', '')
        modelo = product_info.get('modelo', '')
        potencia = product_info.get('potencia_kva', '')
        
        # Descripción genérica profesional
        descripcion_parrafos = [
            f"El {nombre} es una solución confiable y eficiente para sus necesidades de energía. "
            f"Este equipo de {marca} modelo {modelo} ha sido diseñado con los más altos estándares de calidad "
            f"para garantizar un rendimiento óptimo y durabilidad excepcional.",
            
            f"Con una potencia de {potencia} KVA, este generador proporciona la energía necesaria "
            f"para mantener sus operaciones funcionando sin interrupciones. Su diseño robusto y "
            f"tecnología avanzada lo convierten en la elección ideal para aplicaciones industriales, "
            f"comerciales y residenciales.",
            
            f"La confiabilidad es nuestra prioridad. Por eso, cada unidad cuenta con componentes "
            f"de primera calidad y ha sido rigurosamente probada para asegurar su funcionamiento "
            f"en las condiciones más exigentes. Respaldamos nuestros productos con garantía oficial "
            f"y una red de servicio técnico especializado."
        ]
        
        # Usar el mismo formato HTML que con IA
        return self._format_ai_response('\n\n'.join(descripcion_parrafos), product_info, config)

    def preview_with_example(self, prompt_template: str, example_product: Dict = None) -> str:
        """Genera una vista previa con un producto de ejemplo"""
        if not example_product:
            example_product = {
                'nombre': 'Grupo Electrógeno Cummins 100KVA',
                'marca': 'Cummins',
                'modelo': 'C100D5',
                'codigo': 'GE-CUM-100',
                'familia': 'Grupos Electrógenos',
                'potencia_kva': '100',
                'potencia_kw': '80',
                'voltaje': '380/220',
                'frecuencia': '50',
                'motor': 'Cummins 6BT5.9-G2',
                'alternador': 'Stamford UCI274C',
                'consumo': '22.3',
                'tanque': '220',
                'ruido': '75',
                'largo': '3200',
                'ancho': '1100',
                'alto': '1460',
                'peso': '1720',
                'pdf_url': 'cummins_c100d5.pdf'
            }
        
        config = {
            'whatsapp': '541139563099',
            'email': 'info@generadores.ar',
            'telefono_display': '+54 11 3956-3099',
            'website': 'www.generadores.ar'
        }
        
        return self.generate_description(example_product, prompt_template, config)
