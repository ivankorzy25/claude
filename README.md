# STEL Shop Manager v1.0.0

Sistema modular para gestión automatizada de productos y descripciones en Stelorder.

## 🚀 Características

- **Gestión de Productos**: Conexión directa a MySQL con filtros avanzados
- **Generador IA**: Creación de descripciones con Google Gemini AI
- **Automatización**: Control de Chrome para actualización masiva
- **Interfaz Modular**: Tres módulos independientes pero integrados

## 📋 Requisitos

- Python 3.8+
- MySQL 5.7+
- Google Chrome
- API Key de Google Gemini (gratuita)

## 🔧 Instalación

### 1. Clonar o descargar el proyecto

```bash
git clone [url-del-repositorio]
cd stel-shop-manager
```

### 2. Ejecutar el instalador

**Windows:**
```batch
python setup.py
```

**Linux/Mac:**
```bash
python3 setup.py
```

### 3. Configurar base de datos

Editar `config/database_config.json`:
```json
{
    "host": "localhost",
    "user": "tu_usuario",
    "password": "tu_contraseña",
    "database": "lista_precios_kor",
    "table": "shop_master_gaucho_completo"
}
```

### 4. Copiar archivos de módulos

Copiar los archivos HTML, CSS y JS de cada módulo a:
- `static/modules/products/`
- `static/modules/navigation/`
- `static/modules/ai_generator/`

## 🚀 Uso

### Iniciar la aplicación

**Windows:**
```batch
run.bat
```

**Linux/Mac:**
```bash
chmod +x run.sh
./run.sh
```

### Flujo de trabajo

1. **Conectar MySQL** en la pestaña Productos
2. **Configurar API de IA** en la pestaña Generador IA
3. **Iniciar Chrome** en la pestaña Navegación
4. **Hacer login manual** en Stelorder
5. **Seleccionar productos** a procesar
6. **Procesar** - el sistema generará descripciones y actualizará

## 📁 Estructura

```
stel-shop-manager/
├── main.py                 # Aplicación principal
├── setup.py               # Instalador
├── requirements.txt       # Dependencias
├── run.bat / run.sh      # Scripts de ejecución
├── config/               # Configuraciones
├── modules/              # Módulos del sistema
│   ├── products/        # Gestión de productos
│   ├── navigation/      # Control del navegador
│   └── ai_generator/    # Generación con IA
├── static/              # Archivos estáticos
├── templates/           # Plantillas HTML
└── logs/               # Archivos de log
```

## 🔐 Seguridad

- Las credenciales se almacenan localmente
- El perfil de Chrome es persistente pero aislado
- Las API keys no se transmiten a terceros

## 🛠️ Solución de problemas

### Error de conexión MySQL
- Verificar credenciales en `config/database_config.json`
- Asegurar que MySQL esté ejecutándose
- Comprobar permisos del usuario

### Chrome no inicia
- Verificar que Chrome esté instalado
- Cerrar otras instancias del perfil
- Eliminar `browser_profiles/` y reintentar

### Error de API de Google
- Verificar API key válida
- Comprobar límites de cuota
- Revisar conexión a internet

## 📝 Logs

Los logs se guardan en:
- `logs/stel_shop.log` - Log principal
- `logs/navigation.log` - Log de navegación
- `logs/products.log` - Log de productos

## 🤝 Soporte

Para soporte o consultas:
1. Revisar logs en la carpeta `logs/`
2. Consultar la ayuda integrada (botón ❓)
3. Verificar la documentación de cada módulo

## 📄 Licencia

© 2024 STEL Shop Manager - Desarrollado para Stelorder
