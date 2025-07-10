# Módulo Navigation v1.0.0

## 📝 Descripción
Este módulo gestiona toda la interacción con el navegador Chrome y la automatización de procesos en la plataforma Stelorder. Proporciona una interfaz completa para controlar el navegador, verificar login, navegar por la plataforma y actualizar productos.

## 🚀 Características Principales
- **Gestión de Chrome**: Control completo del navegador con perfil persistente
- **Navegación Automática**: Navegación inteligente por Stelorder
- **Procesamiento por Lotes**: Actualización masiva de productos
- **Control de Pausa/Reanudación**: Pausar y reanudar procesos
- **Registro Detallado**: Log completo de todas las operaciones
- **Manejo de Errores**: Captura de screenshots en errores
- **Estadísticas en Tiempo Real**: Monitoreo del progreso

## 📋 Requisitos
- Python 3.8+
- Chrome instalado
- ChromeDriver (se descarga automáticamente)
- Selenium 4.0+

## 🔧 Configuración

### Estructura de Archivos
```
navigation/
├── browser_profiles/       # Perfiles de Chrome persistentes
├── screenshots/           # Capturas de pantalla
├── logs/                 # Archivos de log
└── config/              # Configuración del navegador
```

### Configuración del Navegador (config/browser_config.json)
```json
{
    "timeout": 60,
    "implicit_wait": 10,
    "page_load_timeout": 30,
    "window_size": "1280,720",
    "disable_images": false,
    "user_agent": null
}
```

## 📚 API Interna

### Clase SeleniumHandler
```python
# Inicializar
handler = SeleniumHandler()

# Configurar callbacks
handler.set_callback('on_product_complete', callback_func)
handler.set_callback('on_progress', progress_func)
handler.set_callback('on_error', error_func)
handler.set_callback('on_log', log_func)

# Iniciar navegador
result = handler.initialize_browser()

# Verificar login
is_logged = handler.check_login_status()

# Procesar productos
handler.process_products(products_list, generation_callback)

# Control de procesamiento
handler.pause_processing()
handler.resume_processing()
handler.stop_processing()

# Cerrar navegador
handler.close_browser()

# Obtener estado
status = handler.get_status()
```

### Clase BrowserManager
```python
# Gestión del navegador
browser = BrowserManager(profile_name="mi_perfil")
browser.initialize_browser()
browser.navigate_to(url)
browser.refresh_page()
browser.take_screenshot()
browser.execute_script(script, args)
browser.close_browser()
```

### Clase StelNavigator
```python
# Navegación específica de Stelorder
navigator = StelNavigator(browser_manager)
navigator.navigate_to_catalog()
navigator.search_product(sku)
navigator.select_product_from_results(sku)
navigator.navigate_to_shop_tab()
navigator.click_edit_shop()
navigator.update_shop_fields(fields_dict)
navigator.save_shop_changes()
```

## 🔄 Comunicación con Otros Módulos

### Eventos que Escucha:
- `products:process-request`: Solicitud de procesamiento desde módulo Products
- `ai:descriptions-generated`: Descripciones generadas desde módulo AI

### Eventos que Emite:
- `navigation:login-confirmed`: Login verificado
- `navigation:product-processed`: Producto procesado
- `navigation:process-complete`: Proceso completo
- `navigation:error`: Error durante procesamiento

### Ejemplo de Integración:
```javascript
// Desde el módulo de productos
window.dispatchEvent(new CustomEvent('products:process-request', {
    detail: {
        products: selectedProducts,
        settings: {
            use_ai: true,
            update_seo: true
        }
    }
}));

// Escuchar respuesta
window.addEventListener('navigation:product-processed', (event) => {
    console.log('Producto procesado:', event.detail);
});
```

## 🛠️ Flujo de Procesamiento

1. **Inicialización**
   - Crear perfil de Chrome persistente
   - Iniciar navegador
   - Navegar a Stelorder

2. **Autenticación**
   - Usuario hace login manual
   - Verificar estado de login
   - Confirmar acceso

3. **Procesamiento**
   - Navegar al catálogo
   - Para cada producto:
     - Buscar por SKU
     - Seleccionar de resultados
     - Ir a pestaña Shop
     - Abrir editor
     - Actualizar campos
     - Guardar cambios
   - Registrar estadísticas

4. **Finalización**
   - Exportar estadísticas
   - Cerrar navegador
   - Limpiar recursos

## 🚨 Manejo de Errores

### Errores Comunes:
1. **Perfil en uso**: Cerrar Chrome y reintentar
2. **Elemento no encontrado**: Verificar selectores
3. **Timeout**: Ajustar tiempos de espera
4. **Login expirado**: Re-autenticar

### Recuperación de Errores:
- Screenshots automáticos en errores
- Reintentos configurables
- Log detallado para debugging
- Continuación desde último producto

## 📊 Estadísticas y Reportes

El módulo genera estadísticas detalladas:
- Productos procesados exitosamente
- Productos con errores
- Tiempo total de procesamiento
- Errores por tipo
- Screenshots de errores

## 🔐 Seguridad
- Perfil de Chrome aislado
- No almacena credenciales
- Logs sin información sensible
- Screenshots solo en errores

## 📝 Actualización del Módulo

Al actualizar este módulo:
1. **Respaldar perfiles** de Chrome existentes
2. **Actualizar selectores** si cambia Stelorder
3. **Probar con pocos productos** primero
4. **Documentar cambios** en CHANGELOG.md
5. **Actualizar tests** de integración

## 🤝 Contribución
Para contribuir:
1. Verificar selectores actuales
2. Probar en diferentes resoluciones
3. Manejar nuevos casos de error
4. Optimizar tiempos de espera
5. Documentar cambios

## 📞 Soporte
Para problemas:
- Revisar logs en `logs/navigation.log`
- Verificar screenshots en `screenshots/`
- Comprobar versión de Chrome/ChromeDriver
- Revisar selectores de elementos
