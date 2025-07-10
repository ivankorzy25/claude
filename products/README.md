# Módulo Products v1.0.0

## 📝 Descripción
Este módulo gestiona la conexión con MySQL y proporciona una interfaz completa para seleccionar, filtrar y preparar productos para procesamiento. Incluye filtros avanzados, selección flexible y exportación de datos.

## 🚀 Características Principales
- **Conexión MySQL**: Gestión segura de base de datos
- **Filtros Avanzados**: Por familia, marca, stock, precio, características
- **Búsqueda Inteligente**: Soporta operadores avanzados
- **Selección Flexible**: Individual, masiva, por criterios
- **Estadísticas en Tiempo Real**: Totales, valores, stocks
- **Exportación**: Excel y JSON
- **Guardado de Selecciones**: Reutilizar configuraciones

## 📋 Requisitos
- Python 3.8+
- MySQL 5.7+
- PyMySQL
- Pandas
- openpyxl (para exportar Excel)

## 🔧 Configuración

### Base de Datos (config/database_config.json)
```json
{
    "host": "localhost",
    "user": "root",
    "password": "tu_password",
    "database": "lista_precios_kor",
    "table": "shop_master_gaucho_completo"
}
```

### Estructura de Tabla MySQL Esperada
```sql
CREATE TABLE shop_master_gaucho_completo (
    SKU VARCHAR(50) PRIMARY KEY,
    Descripción TEXT,
    Marca VARCHAR(100),
    Modelo VARCHAR(100),
    Familia VARCHAR(100),
    Precio_USD_con_IVA DECIMAL(10,2),
    Stock INT,
    URL_PDF VARCHAR(255),
    Potencia VARCHAR(50),
    Tensión VARCHAR(50),
    Motor VARCHAR(100),
    Combustible VARCHAR(50),
    Cabina VARCHAR(10),
    TTA_Incluido VARCHAR(10),
    -- ... otros campos
);
```

## 📚 API Interna

### Clase ProductManager
```python
# Inicializar
manager = ProductManager()

# Conectar a base de datos
manager.connect_database()

# Refrescar productos
df = manager.refresh_products(use_filter=True)

# Aplicar filtros
criteria = FilterCriteria(
    familia="Grupos Electrógenos",
    stock_min=1,
    precio_max=10000
)
filtered_df = manager.apply_filter(criteria)

# Búsqueda avanzada
results = manager.search_products("familia:generadores stock:>10")

# Selección
manager.select_product(sku="GE-001", selected=True)
manager.select_all(True)
manager.select_by_criteria({"min_stock": 10})

# Obtener seleccionados
selected_df = manager.get_selected_products()

# Preparar para procesamiento
products_list = manager.prepare_for_processing()

# Guardar/cargar selección
manager.save_selection("mi_seleccion")
manager.load_selection("mi_seleccion")

# Exportar
filepath = manager.export_selected_products(format='excel')
```

### Clase DatabaseHandler
```python
# Consultas directas
db = DatabaseHandler(config)
db.connect()

# Obtener todos los productos
df = db.get_all_products()

# Consulta filtrada
filters = {
    'familia': 'Generadores',
    'stock_min': 1,
    'precio_max': 5000
}
df = db.get_products_filtered(filters)

# Valores únicos para filtros
familias = db.get_distinct_values('Familia')
marcas = db.get_distinct_values('Marca')

# Estadísticas
stats = db.get_statistics()

# Actualizar campo
db.update_product_field('SKU001', 'Stock', 10)
```

### Búsqueda Avanzada - Operadores
```
Sintaxis: campo:operador valor

Ejemplos:
- familia:generadores
- marca:honda
- stock:>10
- stock:<=0
- precio:>=1000
- precio:<5000
- potencia:>100
- cabina:si
- tta:no
- "texto libre de búsqueda"

Combinaciones:
"generadores diesel stock:>0 precio:<10000"
```

## 🔄 Comunicación con Otros Módulos

### Eventos que Emite:
- `products:process-request`: Solicita procesamiento de productos seleccionados
- `products:selection-changed`: Notifica cambios en la selección
- `products:data-refreshed`: Datos actualizados desde BD

### Eventos que Escucha:
- `navigation:product-processed`: Producto procesado exitosamente
- `ai:description-needed`: Solicitud de descripción para producto

### Ejemplo de Integración:
```javascript
// Escuchar solicitud de procesamiento
window.addEventListener('products:process-request', (event) => {
    const { products, settings } = event.detail;
    // products = array de productos seleccionados
    // settings = configuración de procesamiento
    
    console.log(`Procesando ${products.length} productos`);
});

// Notificar producto procesado
window.dispatchEvent(new CustomEvent('navigation:product-processed', {
    detail: {
        sku: 'GE-001',
        success: true,
        message: 'Actualizado correctamente'
    }
}));
```

## 🎯 Casos de Uso

### 1. Selección por Stock
```python
# Productos con stock disponible
criteria = FilterCriteria(stock_min=1)
manager.apply_filter(criteria)
```

### 2. Selección por Precio
```python
# Productos económicos
criteria = FilterCriteria(precio_max=5000)
manager.apply_filter(criteria)
```

### 3. Selección por Características
```python
# Generadores diesel con cabina
criteria = FilterCriteria(
    familia="Grupos Electrógenos",
    combustible="diesel",
    has_cabina=True
)
manager.apply_filter(criteria)
```

### 4. Procesamiento por Lotes
```python
# Seleccionar familia completa
manager.apply_filter(FilterCriteria(familia="Compresores"))
manager.select_all(True)
products = manager.prepare_for_processing()
# Enviar a otros módulos...
```

## 📊 Estadísticas Disponibles
- Total de productos en BD
- Productos filtrados
- Productos seleccionados
- Valor total de selección
- Stock total
- Distribución por familia/marca
- Productos con/sin stock

## 🔐 Seguridad
- Conexión MySQL segura
- Validación de entradas
- Escape de caracteres especiales
- Sin exposición de credenciales

## 💾 Persistencia
- Selecciones guardadas en JSON
- Filtros personalizados
- Historial de búsquedas
- Exportaciones en carpeta local

## 📝 Actualización del Módulo

Al actualizar este módulo:
1. **Respaldar selecciones** guardadas
2. **Verificar estructura** de tabla MySQL
3. **Actualizar mapeo** de columnas si cambia BD
4. **Probar filtros** complejos
5. **Documentar campos** nuevos

## 🤝 Contribución
Para contribuir:
1. Agregar nuevos tipos de filtro
2. Optimizar consultas SQL
3. Mejorar rendimiento con índices
4. Agregar validaciones
5. Documentar casos edge

## 📞 Soporte
Para problemas:
- Verificar conexión MySQL
- Revisar logs en `logs/products.log`
- Comprobar permisos de BD
- Validar estructura de tabla
