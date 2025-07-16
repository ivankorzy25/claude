// main.js - Lógica principal de la aplicación

// Estado global
let appState = {
    currentTab: 'products',
    isProcessing: false,
    statusCheckInterval: null
};

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    // Iniciar verificación de estado
    checkSystemStatus();
    appState.statusCheckInterval = setInterval(checkSystemStatus, 5000);
    
    // Configurar comunicación entre módulos
    setupModuleCommunication();
    
    // Manejar atajos de teclado
    setupKeyboardShortcuts();

    // Enviar mensaje al módulo de productos para que se conecte a la DB
    const productsIframe = document.getElementById('products-tab').querySelector('iframe');
    if (productsIframe) {
        let connectInterval = setInterval(function() {
            if (productsIframe.contentWindow && productsIframe.contentWindow.connectDatabase) {
                productsIframe.contentWindow.connectDatabase();
                clearInterval(connectInterval); // Detener el intervalo una vez que la función esté disponible
            }
        }, 1000); // Intentar cada segundo
    }
});

// Gestión de pestañas
function openTab(tabName) {
    // Ocultar todas las pestañas
    const panels = document.querySelectorAll('.tab-panel');
    panels.forEach(panel => panel.classList.remove('active'));
    
    // Desactivar todos los botones
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(button => button.classList.remove('active'));
    
    // Mostrar pestaña seleccionada
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Activar botón correspondiente
    const activeButton = Array.from(buttons).find(btn => 
        btn.textContent.toLowerCase().includes(tabName.replace('-', ' '))
    );
    if (activeButton) activeButton.classList.add('active');
    
    appState.currentTab = tabName;
}

function connectProductsDB() {
    const productsIframe = document.getElementById('products-tab').querySelector('iframe');
    if (productsIframe && productsIframe.contentWindow) {
        productsIframe.contentWindow.postMessage({ type: 'connect_db' }, window.location.origin);
    }
}

// Verificar estado del sistema
async function checkSystemStatus() {
    try {
        const response = await fetch('/health');
        const health = await response.json();
        
        if (health.status === 'ok') {
            // Actualizar estados
            updateStatus('db', health.modules.products);
            updateStatus('browser', health.modules.navigation);
            updateStatus('ai', health.modules.ai_generator);
        }
    } catch (error) {
        console.error('Error verificando estado:', error);
    }
}

function updateStatus(module, isConnected) {
    const statusText = document.getElementById(`${module}-status-text`);
    if (statusText) {
        if (module === 'db') {
            statusText.textContent = isConnected ? 'Conectado' : 'Desconectado';
            statusText.className = isConnected ? 'connected' : '';
        } else if (module === 'browser') {
            statusText.textContent = isConnected ? 'Activo' : 'No iniciado';
            statusText.className = isConnected ? 'connected' : '';
        } else if (module === 'ai') {
            statusText.textContent = isConnected ? 'Configurado' : 'No configurado';
            statusText.className = isConnected ? 'connected' : '';
        }
    }
}

// Comunicación entre módulos
function setupModuleCommunication() {
    // Escuchar mensajes de los iframes
    window.addEventListener('message', function(event) {
        // Verificar origen por seguridad
        if (event.origin !== window.location.origin) return;
        
        handleModuleMessage(event.data);
    });
}

function handleModuleMessage(data) {
    console.log('Mensaje recibido:', data);
    
    switch(data.type) {
        case 'products:selected':
            // Productos seleccionados, notificar a otros módulos
            broadcastToModules({
                type: 'products:selection-update',
                count: data.count
            });
            break;
            
        case 'navigation:ready':
            // Navegador listo
            broadcastToModules({
                type: 'navigation:status-update',
                ready: true
            });
            break;
            
        case 'ai:configured':
            // IA configurada
            broadcastToModules({
                type: 'ai:status-update',
                configured: true
            });
            break;
            
        case 'process:start':
            // Iniciar procesamiento
            appState.isProcessing = true;
            showProcessingOverlay();
            break;
            
        case 'process:complete':
            // Procesamiento completado
            appState.isProcessing = false;
            hideProcessingOverlay();
            showNotification('Procesamiento completado', 'success');
            break;
            
        case 'error':
            // Error en algún módulo
            showNotification(data.message, 'error');
            break;
    }
}

function broadcastToModules(message) {
    // Enviar mensaje a todos los iframes
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        iframe.contentWindow.postMessage(message, window.location.origin);
    });
}

// Notificaciones
function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    // Agregar al body
    document.body.appendChild(notification);
    
    // Remover después de 5 segundos
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Overlay de procesamiento
function showProcessingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'processing-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p>Procesando productos...</p>
        </div>
    `;
    document.body.appendChild(overlay);
}

function hideProcessingOverlay() {
    const overlay = document.getElementById('processing-overlay');
    if (overlay) overlay.remove();
}

// Agregar función para forzar recarga
async function forceRefresh() {
    try {
        const response = await fetch('/api/force-refresh', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
            // Limpiar todo el cache del navegador
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => {
                        caches.delete(name);
                    });
                });
            }
            
            // Recargar con parámetro único
            window.location.href = window.location.href.split('?')[0] + '?v=' + result.build + '&t=' + Date.now();
        }
    } catch (error) {
        console.error('Error forzando actualización:', error);
        // Forzar recarga de todas formas
        window.location.reload(true);
    }
}

// Atajos de teclado
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(event) {
        // Ctrl+Shift+R - Recarga forzada
        if (event.ctrlKey && event.shiftKey && event.key === 'R') {
            event.preventDefault();
            forceRefresh();
        }
        
        // Ctrl+S - Guardar
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            broadcastToModules({ type: 'shortcut:save' });
        }
        
        // Ctrl+F - Buscar
        if (event.ctrlKey && event.key === 'f') {
            event.preventDefault();
            broadcastToModules({ type: 'shortcut:search' });
        }
        
        // Space - Pausar/Reanudar (solo si está procesando)
        if (event.key === ' ' && appState.isProcessing) {
            event.preventDefault();
            broadcastToModules({ type: 'shortcut:toggle-pause' });
        }
        
        // Alt+1,2,3 - Cambiar pestañas
        if (event.altKey) {
            switch(event.key) {
                case '1':
                    openTab('products');
                    break;
                case '2':
                    openTab('ai-generator');
                    break;
                case '3':
                    openTab('navigation');
                    break;
            }
        }
    });
}

// Funciones de ayuda
function showHelp() {
    document.getElementById('help-modal').style.display = 'block';
}

function showAbout() {
    showNotification(`
        STEL Shop Manager v1.0.0
        Desarrollado para optimizar la gestión de productos en Stelorder.
        © 2024 - Todos los derechos reservados.
    `, 'info');
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    if (event.target.className === 'modal') {
        event.target.style.display = 'none';
    }
}

// Limpiar al salir
window.addEventListener('beforeunload', function() {
    if (appState.statusCheckInterval) {
        clearInterval(appState.statusCheckInterval);
    }
    
    // Advertir si hay proceso activo
    if (appState.isProcessing) {
        return '¿Estás seguro? Hay un proceso en curso.';
    }
});

// Estilos adicionales para notificaciones
const style = document.createElement('style');
style.textContent = `
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 5px;
    color: white;
    font-weight: bold;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideIn 0.3s ease;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.notification.success { background: var(--success-color); }
.notification.error { background: var(--danger-color); }
.notification.info { background: var(--info-color); }
.notification.warning { background: var(--warning-color); }

.notification button {
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    margin-left: 10px;
}

.loading-content {
    background: white;
    padding: 30px;
    border-radius: 10px;
    text-align: center;
}

.loading-content p {
    margin-top: 20px;
    font-size: 18px;
    color: var(--dark-color);
}
`;
document.head.appendChild(style);
