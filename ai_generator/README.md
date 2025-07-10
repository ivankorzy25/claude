# Módulo AI Generator v1.0.0

## 📝 Descripción
Este módulo gestiona la generación de descripciones HTML para productos usando Google Gemini AI. Permite crear, versionar y personalizar prompts para diferentes tipos de productos.

## 🚀 Características Principales
- **Editor de Prompts**: Editor con resaltado de sintaxis y variables
- **Versionado Completo**: Historial de cambios con descripciones
- **Previsualización en Vivo**: Vista previa con productos de ejemplo
- **Detección Automática**: Identifica el tipo de producto automáticamente
- **Plantillas HTML**: Genera HTML según el formato especificado
- **Sin Emojis**: Limpia automáticamente caracteres especiales

## 📋 Requisitos
- Python 3.8+
- Google Gemini API Key
- Módulos: `google-generativeai`, `pathlib`

## 🔧 Configuración

### 1. API Key
Obtén tu API key gratuita en: https://makersuite.google.com/app/apikey

### 2. Estructura de Archivos
```
ai_generator/
├── templates/
│   ├── default_prompt.json    # Prompt base
│   └── product_templates.json  # Tipos de productos
└── versions/                   # Historial de versiones
```

## 📚 API Interna

### Clase AIHandler
```python
# Inicializar
handler = AIHandler(api_key='TU_API_KEY')

# Generar descripción
html = handler.generate_description(
    product_info=dict,      # Datos del producto
    prompt_template=str,    # Prompt personalizado (opcional)
    config=dict            # Configuración de contacto
)

# Detectar tipo de producto
product_type = handler.detect_product_type(product_info)

# Preview con ejemplo
preview_html = handler.preview_with_example(prompt_template)
```

### Clase PromptManager
```python
# Inicializar
manager = PromptManager()

# Obtener prompt actual
current = manager.get_current_prompt()

# Guardar nueva versión
version = manager.save_new_version(
    prompt_text="...",
    name="Mi versión mejorada",
    description="Agregué más detalles técnicos"
)

# Actualizar prompt base
manager.update_base_prompt(prompt_text, description)

# Obtener historial
versions = manager.get_all_versions()
```

## 🔄 Comunicación con Otros Módulos

### Eventos que Escucha:
- `product_selected`: Cuando se selecciona un producto para generar descripción
- `bulk_generation_requested`: Para generar múltiples descripciones

### Eventos que Emite:
- `description_generated`: Cuando se completa una descripción
- `preview_ready`: Cuando está lista la previsualización

### Ejemplo de Integración:
```python
# Desde el módulo de productos
from modules.ai_generator import AIHandler

handler = AIHandler(api_key)
for product in selected_products:
    description = handler.generate_description(product)
    # Enviar al módulo de navegación...
```

## 🎨 Personalización de Prompts

### Variables Disponibles:
- `{nombre}`: Nombre del producto
- `{marca}`: Marca
- `{modelo}`: Modelo
- `{potencia_kva}`: Potencia en KVA
- `{motor}`: Información del motor
- `{product_type}`: Tipo detectado
- `{tech_specs}`: Especificaciones técnicas
- `{applications}`: Aplicaciones típicas
- `{focus_areas}`: Áreas de enfoque

### Estructura del Prompt Base:
1. Contexto del producto
2. Instrucciones específicas
3. Restricciones de formato
4. Ejemplos (opcional)

## 📈 Versionado

### Estructura de una Versión:
```json
{
    "version": "v1_20240115_143022",
    "name": "Versión con más detalles técnicos",
    "description": "Agregué sección de beneficios expandida",
    "created_at": "2024-01-15T14:30:22",
    "prompt": "...",
    "is_base": false,
    "changes_from_previous": {
        "lines_added": 5,
        "lines_removed": 2,
        "summary": "Agregadas 5 líneas"
    }
}
```

## 🚨 Manejo de Errores
- Si la API falla, genera descripción estándar
- Valida estructura de productos antes de procesar
- Registra errores en log para debugging

## 🔐 Seguridad
- API keys se almacenan localmente
- No se envían datos sensibles a la API
- Limpieza automática de contenido generado

## 📝 Actualización del Módulo

Al actualizar este módulo:
1. **Mantén compatibilidad** con versiones anteriores de prompts
2. **Documenta cambios** en CHANGELOG.md
3. **Actualiza este README** con nuevas funciones
4. **Prueba** con productos de ejemplo antes de deploy
5. **Respalda** versiones de prompts importantes

## 🤝 Contribución
Para contribuir:
1. Crea una rama feature/tu-mejora
2. Documenta cambios en el código
3. Actualiza tests si es necesario
4. Crea PR con descripción detallada

## 📞 Soporte
Para problemas o consultas sobre este módulo:
- Revisa los logs en `versions/debug.log`
- Consulta la documentación de Google Gemini
- Abre un issue en el repositorio
