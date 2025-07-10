// products.js - Lógica del módulo de productos

// Estado global del módulo
let moduleState = {
    isConnected: false,
    products: [],
    selectedProducts: new Set(),
    filters: {},
    stats: {}
};

// URL del backend (ajustar según tu configuración)
const API_BASE_URL = 'https://southamerica-east1-lista-precios-2025.cloudfunctions.net/actualizar-precios-v2';

// Instancia de DataTables
let productsDataTable;

// Variables globales para los ajustes temporales del modal (copiado de LISTA PRECIOS KOR V2.html)
let margenAdicionalTemporal = 0;
let descuentoClienteTemporal = 0;

// Sistema de Cotización con Bluelytics (copiado de LISTA PRECIOS KOR V2.html)
let cotizacionUSD = 1200; // Valor por defecto
let fechaCotizacionActual = new Date().toISOString().split('T')[0];
let evolucionDataOficial = [];

// Configuración de almacenamiento (copiado de LISTA PRECIOS KOR V2.html)
const STORAGE_KEYS = {
    products: 'catalogoKorProducts',
    mapping: 'catalogoKorColumnMapping',
    security: 'catalogoKorSecurity'
};

// Sistema de conversión de unidades de potencia (copiado de LISTA PRECIOS KOR V2.html)
const CONVERSIONES_POTENCIA = {
    W: 1,
    KW: 1000,
    KVA: 1000 * 0.8,
    HP: 745.7,
    CV: 735.5,
    CC: 0.746
};

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeDataTable(); // Inicializar DataTables al cargar el DOM
    loadFilterOptions();
    updateUI();
    
    // Cargar datos de evolución del dólar y LUEGO cargar productos desde la API (copiado de LISTA PRECIOS KOR V2.html)
    cargarDatosEvolucion().then(() => {
        cargarProductosDesdeAPI();
    });
});

// Funciones de Base de Datos
async function connectDatabase() {
    updateButton('connect-db', true, 'Conectando...');
    
    try {
        // En este caso, la "conexión" es simplemente cargar los datos de la Cloud Function
        await cargarProductosDesdeAPI();
        
        moduleState.isConnected = true;
        document.getElementById('db-status-indicator').classList.add('connected');
        document.getElementById('db-status-text').textContent = 'Conectado';
        document.getElementById('db-info').textContent = "Cloud Function"; // Mostrar que es una Cloud Function
        
        // Habilitar botones
        document.querySelectorAll('button[disabled]').forEach(btn => {
            if (btn.id !== 'connect-db') {
                btn.disabled = false;
            }
        });
        
        // Cargar estadísticas
        await loadStatistics();
        
    } catch (error) {
        alert('Error de conexión: ' + error.message);
    } finally {
        updateButton('connect-db', false, '🔌 Conectar');
    }
}

// Reemplazar refreshProducts con cargarProductosDesdeAPI de LISTA PRECIOS KOR V2.html
async function refreshProducts() {
    await cargarProductosDesdeAPI();
}

// Funciones de Filtros
async function loadFilterOptions() {
    try {
        // Las opciones de filtro ahora se cargarán dinámicamente desde los productos cargados
        // No hay un endpoint /filter-options en la Cloud Function
        // Las opciones se cargarán después de cargar los productos
    } catch (error) {
        console.error('Error cargando opciones de filtro:', error);
    }
}

function applyFilters() {
    // Recopilar valores de filtros
    moduleState.filters = {
        familia: document.getElementById('filter-familia').value,
        marca: document.getElementById('filter-marca').value,
        stock: document.getElementById('filter-stock').value,
        precio_min: parseFloat(document.getElementById('filter-precio-min').value) || null,
        precio_max: parseFloat(document.getElementById('filter-precio-max').value) || null,
        potencia_min: parseFloat(document.getElementById('filter-potencia-min').value) || null,
        potencia_max: parseFloat(document.getElementById('filter-potencia-max').value) || null,
        has_cabina: document.getElementById('filter-cabina').checked || null,
        has_tta: document.getElementById('filter-tta').checked || null,
        combustible: document.getElementById('filter-combustible').value
    };
    
    // Limpiar valores nulos
    Object.keys(moduleState.filters).forEach(key => {
        if (!moduleState.filters[key]) delete moduleState.filters[key];
    });
    
    // Actualizar resumen de filtros
    updateFilterSummary();
    
    // Aplicar filtros a DataTables
    productsDataTable.draw(); // Redibujar la tabla para aplicar los filtros
    updateStatistics(); // Actualizar estadísticas después de filtrar
}

function clearFilters() {
    // Limpiar todos los campos de filtro
    document.getElementById('filter-familia').value = '';
    document.getElementById('filter-marca').value = '';
    document.getElementById('filter-stock').value = '';
    document.getElementById('filter-precio-min').value = '';
    document.getElementById('filter-precio-max').value = '';
    document.getElementById('filter-potencia-min').value = '';
    document.getElementById('filter-potencia-max').value = '';
    document.getElementById('filter-cabina').checked = false;
    document.getElementById('filter-tta').checked = false;
    document.getElementById('filter-combustible').value = '';
    document.getElementById('quick-search').value = '';
    
    moduleState.filters = {};
    updateFilterSummary();
    productsDataTable.search('').columns().search('').draw(); // Limpiar búsqueda y filtros de columna
    updateStatistics();
}

async function quickSearch() {
    const query = document.getElementById('quick-search').value.trim();
    
    // DataTables tiene su propia función de búsqueda global
    productsDataTable.search(query).draw();
    updateStatistics();
}

function toggleAdvancedFilters() {
    const advancedDiv = document.getElementById('advanced-filters');
    advancedDiv.style.display = advancedDiv.style.display === 'none' ? 'block' : 'none';
}

function updateFilterSummary() {
    const summary = document.getElementById('filter-summary');
    const summaryText = document.getElementById('filter-summary-text');
    
    const parts = [];
    
    if (moduleState.filters.familia) parts.push(`Familia: ${moduleState.filters.familia}`);
    if (moduleState.filters.marca) parts.push(`Marca: ${moduleState.filters.marca}`);
    if (moduleState.filters.stock) parts.push(`Stock: ${moduleState.filters.stock}`);
    if (moduleState.filters.precio_min || moduleState.filters.precio_max) {
        let precio = 'Precio: ';
        if (moduleState.filters.precio_min && moduleState.filters.precio_max) {
            precio += `$${moduleState.filters.precio_min}-$${moduleState.filters.precio_max}`;
        } else if (moduleState.filters.precio_min) {
            precio += `≥$${moduleState.filters.precio_min}`;
        } else {
            precio += `≤$${moduleState.filters.precio_max}`;
        }
        parts.push(precio);
    }
    
    if (parts.length > 0) {
        summaryText.textContent = 'Filtros activos: ' + parts.join(' | ');
        summary.style.display = 'block';
    } else {
        summary.style.display = 'none';
    }
}

// Funciones de Tabla (Refactorizadas para DataTables)
function initializeDataTable() {
    productsDataTable = $('#products-table').DataTable({
        data: [], // Inicialmente vacío
        columns: [
            { 
                data: 'SKU', // Usar SKU para el checkbox
                render: function(data, type, row) {
                    if (type === 'display') {
                        const isSelected = moduleState.selectedProducts.has(data);
                        return `<input type="checkbox" ${isSelected ? 'checked' : ''} 
                               onchange="toggleProductSelection('${data}', this.checked)">`;
                    }
                    return data;
                },
                orderable: false,
                searchable: false,
                className: 'checkbox-column'
            },
            { data: 'SKU', title: 'SKU', render: data => highlightSearch(data || '') },
            { data: 'Descripción', title: 'Descripción', render: data => highlightSearch(data || '') },
            { data: 'Marca', title: 'Marca', defaultContent: '' },
            { data: 'Familia', title: 'Familia', defaultContent: '' },
            { data: 'Stock', title: 'Stock', defaultContent: 0, className: 'numeric' },
            { data: 'Precio_USD_con_IVA', title: 'Precio USD', render: formatPrice, className: 'numeric' },
            { 
                data: null, 
                title: 'Acciones', 
                orderable: false, 
                searchable: false,
                render: function(data, type, row) {
                    return `
                        <div class="product-actions">
                            <button onclick="viewProductDetails('${row.SKU}')" class="btn btn-small">
                                👁️ Ver
                            </button>
                        </div>`;
                }
            }
        ],
        language: { url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
        pageLength: 25,
        responsive: true,
        destroy: true, // Permite reinicializar la tabla
        dom: 'Bfrltip', // Para botones, filtros, etc.
        buttons: [] // Puedes añadir botones aquí si es necesario
    });

    // Evento para actualizar el checkbox "seleccionar todos" al cambiar de página o filtrar
    productsDataTable.on('draw.dt', function() {
        updateSelectAllCheckbox();
    });
}

function highlightSearch(text) {
    const searchTerm = document.getElementById('quick-search').value.trim();
    if (!searchTerm || searchTerm.length < 3) return text;
    
    const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

function formatPrice(price) {
    if (price === null || price === undefined || isNaN(price)) return 'N/A';
    return `$${parseFloat(price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}

// Funciones de Selección
function toggleProductSelection(sku, selected) {
    if (selected) {
        moduleState.selectedProducts.add(sku);
    } else {
        moduleState.selectedProducts.delete(sku);
    }
    
    updateStatistics();
    updateSelectAllCheckbox();
    
    // Habilitar/deshabilitar botón de procesar
    document.getElementById('process-button').disabled = 
        moduleState.selectedProducts.size === 0;
}

function toggleSelectAll() {
    const checkbox = document.getElementById('select-all-checkbox');
    selectAll(checkbox.checked);
}

function selectAll(select) {
    // Seleccionar solo los productos actualmente visibles en la tabla
    productsDataTable.rows({ search: 'applied', page: 'current' }).every(function() {
        const rowData = this.data();
        const sku = rowData.SKU;
        const checkbox = $(this.node()).find('input[type="checkbox"]')[0];

        if (select) {
            moduleState.selectedProducts.add(sku);
            if (checkbox) checkbox.checked = true;
            $(this.node()).addClass('selected');
        } else {
            moduleState.selectedProducts.delete(sku);
            if (checkbox) checkbox.checked = false;
            $(this.node()).removeClass('selected');
        }
    });
    
    updateStatistics();
    document.getElementById('process-button').disabled = 
        moduleState.selectedProducts.size === 0;
}

function invertSelection() {
    productsDataTable.rows({ search: 'applied', page: 'current' }).every(function() {
        const rowData = this.data();
        const sku = rowData.SKU;
        const checkbox = $(this.node()).find('input[type="checkbox"]')[0];

        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            if (checkbox.checked) {
                moduleState.selectedProducts.add(sku);
                $(this.node()).addClass('selected');
            } else {
                moduleState.selectedProducts.delete(sku);
                $(this.node()).removeClass('selected');
            }
        }
    });
    
    updateStatistics();
    updateSelectAllCheckbox();
}

async function selectByFilter() {
    const criteria = prompt('Ingrese criterio de selección:\nEjemplos:\n- stock:>10\n- precio:<1000\n- familia:generadores');
    
    if (!criteria) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/select-by-criteria`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ criteria })
        });
        
        const result = await response.json();
        
        if (result.success) {
            result.selected_skus.forEach(sku => {
                moduleState.selectedProducts.add(sku);
            });
            
            // Redibujar la tabla para reflejar la selección
            productsDataTable.rows().invalidate('data').draw();
            updateStatistics();
            
            alert(`${result.selected_skus.length} productos seleccionados`);
        }
    } catch (error) {
        console.error('Error en selección por criterio:', error);
    }
}

function updateSelectAllCheckbox() {
    const checkbox = document.getElementById('select-all-checkbox');
    const visibleRows = productsDataTable.rows({ page: 'current', search: 'applied' }).data();
    const totalVisible = visibleRows.length;
    let checkedVisible = 0;

    visibleRows.each(function(rowData) {
        if (moduleState.selectedProducts.has(rowData.SKU)) {
            checkedVisible++;
        }
    });
    
    if (totalVisible === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
    } else if (checkedVisible === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
    } else if (checkedVisible === totalVisible) {
        checkbox.checked = true;
        checkbox.indeterminate = false;
    } else {
        checkbox.checked = false;
        checkbox.indeterminate = true;
    }
}

// Funciones de Paginación (DataTables las maneja automáticamente)
function updatePagination() {
    // DataTables maneja esto internamente
}

function previousPage() {
    productsDataTable.page('previous').draw('page');
}

function nextPage() {
    productsDataTable.page('next').draw('page');
}

function changePageSize() {
    const select = document.getElementById('items-per-page');
    productsDataTable.page.len(select.value).draw();
}

// Funciones de Estadísticas
async function loadStatistics() {
    try {
        // Las estadísticas ahora se calcularán desde los productos cargados en el frontend
        // No hay un endpoint /statistics en la Cloud Function
        updateStatistics();
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

function updateStatistics() {
    // Total productos
    document.getElementById('total-products').textContent = 
        moduleState.products.length || 0; // Usar moduleState.products
    
    // Productos filtrados (DataTables lo maneja)
    document.getElementById('filtered-products').textContent = 
        productsDataTable ? productsDataTable.rows({ search: 'applied' }).count() : 0;
    
    // Productos seleccionados
    document.getElementById('selected-products').textContent = 
        moduleState.selectedProducts.size;
    
    // Calcular valor total de seleccionados
    let totalValue = 0;
    moduleState.selectedProducts.forEach(sku => {
        const product = moduleState.products.find(p => p.SKU === sku);
        if (product && product.Precio_USD_con_IVA) {
            totalValue += parseFloat(product.Precio_USD_con_IVA);
        }
    });
    
    document.getElementById('total-value').textContent = formatPrice(totalValue);
}

// Funciones de Detalles del Producto
async function viewProductDetails(sku) {
    // Obtener el producto directamente del cache de moduleState
    const product = moduleState.products.find(p => p.SKU === sku);
    
    if (product) {
        showProductDetailsModal(product);
    } else {
        console.error('Producto no encontrado en caché:', sku);
    }
}

function showProductDetailsModal(product) {
    const content = document.getElementById('product-details-content');
    
    content.innerHTML = `
        <div class="detail-group">
            <h4>Información General</h4>
            <div class="detail-row">
                <span class="detail-label">SKU:</span>
                <span>${product.SKU}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Descripción:</span>
                <span>${product.Descripción || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Marca:</span>
                <span>${product.Marca || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Modelo:</span>
                <span>${product.Modelo || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Familia:</span>
                <span>${product.Familia || 'N/A'}</span>
            </div>
        </div>
        
        <div class="detail-group">
            <h4>Información Comercial</h4>
            <div class="detail-row">
                <span class="detail-label">Precio USD:</span>
                <span>${formatPrice(product.Precio_USD_con_IVA)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Stock:</span>
                <span>${product.Stock || 0}</span>
            </div>
        </div>
        
        <div class="detail-group">
            <h4>Especificaciones Técnicas</h4>
            <div class="detail-row">
                <span class="detail-label">Potencia:</span>
                <span>${product.Potencia || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Tensión:</span>
                <span>${product.Tensión || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Motor:</span>
                <span>${product.Motor || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Combustible:</span>
                <span>${product.Combustible || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Cabina:</span>
                <span>${product.Cabina || 'No'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">TTA:</span>
                <span>${product.TTA_Incluido || 'No'}</span>
            </div>
        </div>
        
        ${product.URL_PDF ? `
        <div class="detail-group">
            <h4>Documentación</h4>
            <a href="${product.URL_PDF}" target="_blank" class="btn btn-primary">
                📄 Ver Ficha Técnica
            </a>
        </div>
        ` : ''}
    `;
    
    document.getElementById('product-details-modal').style.display = 'block';
}

// Funciones de Procesamiento
async function processSelected() {
    if (moduleState.selectedProducts.size === 0) {
        alert('No hay productos seleccionados');
        return;
    }
    
    // Mostrar preview primero
    previewSelected();
}

async function previewSelected() {
    const selectedArray = Array.from(moduleState.selectedProducts);
    const selectedProducts = moduleState.products.filter(p => // Usar moduleState.products
        selectedArray.includes(p.SKU)
    );
    
    // Mostrar resumen
    const summary = document.getElementById('preview-summary');
    summary.innerHTML = `
        <h3>Resumen de Selección</h3>
        <p><strong>Total de productos:</strong> ${selectedProducts.length}</p>
        <p><strong>Familias:</strong> ${[...new Set(selectedProducts.map(p => p.Familia))].join(', ')}</p>
        <p><strong>Marcas:</strong> ${[...new Set(selectedProducts.map(p => p.Marca))].join(', ')}</p>
    `;
    
    // Mostrar lista
    const list = document.getElementById('preview-list');
    list.innerHTML = '<h4>Productos a procesar:</h4>';
    
    selectedProducts.forEach(product => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        item.innerHTML = `
            <span><strong>${product.SKU}</strong> - ${product.Descripción}</span>
            <span>${formatPrice(product.Precio_USD_con_IVA)}</span>
        `;
        list.appendChild(item);
    });
    
    document.getElementById('preview-modal').style.display = 'block';
}

async function confirmProcessing() {
    closeModal('preview-modal');
    
    // Preparar productos para procesamiento
    const selectedArray = Array.from(moduleState.selectedProducts);
    const productsToProcess = moduleState.products // Usar moduleState.products
        .filter(p => selectedArray.includes(p.SKU))
        .map(p => ({
            sku: p.SKU,
            nombre: p.Descripción,
            marca: p.Marca,
            modelo: p.Modelo,
            familia: p.Familia,
            precio: p.Precio_USD_con_IVA,
            stock: p.Stock,
            pdf_url: p.URL_PDF,
            row_data: p
        }));
    
    // Emitir evento para otros módulos
    window.dispatchEvent(new CustomEvent('products:process-request', {
        detail: {
            products: productsToProcess,
            settings: {
                use_ai: true,
                update_seo: true
            }
        }
    }));
    
    alert(`Enviando ${productsToProcess.length} productos para procesamiento`);
}

// Funciones de Guardado/Carga
async function saveSelection() {
    const name = prompt('Nombre para la selección:');
    if (!name) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/save-selection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                products: Array.from(moduleState.selectedProducts),
                filters: moduleState.filters
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Selección guardada correctamente');
        }
    } catch (error) {
        console.error('Error guardando selección:', error);
    }
}

async function loadSelection() {
    // TODO: Implementar UI para seleccionar archivo guardado
    const name = prompt('Nombre de la selección a cargar:');
    if (!name) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/load-selection/${name}`);
        const result = await response.json();
        
        if (result.success) {
            moduleState.selectedProducts = new Set(result.products);
            moduleState.filters = result.filters || {};
            
            // Actualizar UI de filtros
            updateFilterFields(moduleState.filters);
            
            // Recargar productos
            await refreshProducts();
            
            alert(`Cargados ${result.products.length} productos`);
        }
    } catch (error) {
        console.error('Error cargando selección:', error);
    }
}

async function exportSelection() {
    if (moduleState.selectedProducts.size === 0) {
        alert('No hay productos seleccionados para exportar');
        return;
    }
    
    const format = confirm('¿Exportar en formato Excel?\n(Cancelar para JSON)') ? 'excel' : 'json';
    
    try {
        const response = await fetch(`${API_BASE_URL}/export-selection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                products: Array.from(moduleState.selectedProducts),
                format: format
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Descargar archivo
            window.open(`${API_BASE_URL}/download-export/${result.filename}`, '_blank');
        }
    } catch (error) {
        console.error('Error exportando:', error);
    }
}

// Funciones de Filtros Guardados
async function saveCurrentFilter() {
    document.getElementById('save-filter-modal').style.display = 'block';
}

async function confirmSaveFilter() {
    const name = document.getElementById('filter-name').value.trim();
    if (!name) {
        alert('Por favor ingrese un nombre para el filtro');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/save-filter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                filter: moduleState.filters
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeModal('save-filter-modal');
            loadFilterOptions(); // Recargar lista
            alert('Filtro guardado correctamente');
        }
    } catch (error) {
        console.error('Error guardando filtro:', error);
    }
}

async function loadSavedFilter() {
    const select = document.getElementById('saved-filters');
    const value = select.value;
    
    if (!value) return;
    
    const [type, name] = value.split(':');
    
    try {
        const response = await fetch(`${API_BASE_URL}/load-filter/${name}?type=${type}`);
        const filter = await response.json();
        
        if (filter) {
            moduleState.filters = filter;
            updateFilterFields(filter);
            applyFilters();
        }
    } catch (error) {
        console.error('Error cargando filtro:', error);
    }
}

// Utilidades
function updateButton(buttonId, disabled, text) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = disabled;
        if (text) button.innerHTML = text;
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showLoading() {
    // productsDataTable.processing(true); // Mostrar indicador de carga de DataTables
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

function hideLoading() {
    // productsDataTable.processing(false); // Ocultar indicador de carga de DataTables
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function updateUI() {
    // Actualizar estado de botones según conexión
    const connected = moduleState.isConnected;
    
    document.getElementById('connect-db').disabled = connected;
    
    // Actualizar contador de selección
    updateStatistics();
}

function updateFilterFields(filters) {
    // Actualizar campos de filtro con valores
    if (filters.familia) document.getElementById('filter-familia').value = filters.familia;
    if (filters.marca) document.getElementById('filter-marca').value = filters.marca;
    if (filters.precio_min) document.getElementById('filter-precio-min').value = filters.precio_min;
    if (filters.precio_max) document.getElementById('filter-precio-max').value = filters.precio_max;
    // ... etc
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadSavedFiltersList(savedFilters) {
    const optgroup = document.getElementById('custom-filters-group');
    optgroup.innerHTML = '';
    
    savedFilters.forEach(filter => {
        const option = document.createElement('option');
        option.value = `custom:${filter}`;
        option.textContent = filter;
        optgroup.appendChild(option);
    });
}

// Funciones de LISTA PRECIOS KOR V2.html
// Función para cargar datos de evolución del dólar
async function cargarDatosEvolucion() {
    try {
        const response = await fetch('https://api.bluelytics.com.ar/v2/evolution.json');
        if (!response.ok) {
            throw new Error('No se pudo conectar a la API de Bluelytics.');
        }
        const data = await response.json();
        
        // Filtramos para quedarnos solo con el dólar oficial
        evolucionDataOficial = data
            .filter(d => d.source === 'Oficial')
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        if (evolucionDataOficial.length === 0) {
            throw new Error('La API no devolvió datos para el Dólar Oficial.');
        }

        // Configurar el selector de fecha
        const fechaInput = document.getElementById('fechaCotizacion');
        const hoy = new Date();
        fechaInput.max = toYYYYMMDD(hoy);
        if (evolucionDataOficial.length > 0) {
            fechaInput.min = evolucionDataOficial[0].date;
        }
        fechaInput.value = toYYYYMMDD(hoy);

        // Cargar cotización del día
        buscarCotizacionHistorica(toYYYYMMDD(hoy));

    } catch (error) {
        console.error('Error al cargar datos de cotización:', error);
        mostrarNotificacion('Error al cargar cotización del dólar. Usando valor por defecto.', 'warning');
        actualizarDisplayCotizacion(cotizacionUSD, new Date());
    }
}

// Modificar la función actualizarCotizacion para que actualice la tabla automáticamente
function actualizarCotizacion() {
    const fecha = document.getElementById('fechaCotizacion').value;
    if (fecha) {
        document.getElementById('cotizacionActual').innerHTML = '<div class="cotizacion-spinner"></div>';
        buscarCotizacionHistorica(fecha);
    }
}

// Modificar buscarCotizacionHistorica para forzar actualización
function buscarCotizacionHistorica(fechaStr) {
    const MAX_LOOKBEHIND_DAYS = 7;
    let resultado = null;
    let fechaDeBusqueda = new Date(fechaStr + 'T12:00:00');
    
    for (let i = 0; i <= MAX_LOOKBEHIND_DAYS; i++) {
        const fechaBusquedaStr = toYYYYMMDD(fechaDeBusqueda);
        resultado = evolucionDataOficial.find(d => d.date === fechaBusquedaStr);
        
        if (resultado) break;
        fechaDeBusqueda.setDate(fechaDeBusqueda.getDate() - 1);
    }
    
    if (resultado) {
        cotizacionUSD = resultado.value_sell;
        fechaCotizacionActual = resultado.date;
        actualizarDisplayCotizacion(cotizacionUSD, new Date(resultado.date + 'T12:00:00'));
        
        // Actualizar tabla si existe - FORZAR REDIBUJADO
        if (productsDataTable) {
            productsDataTable.rows().invalidate('data').draw(false);
        }
        
        // Actualizar modal si está abierto
        actualizarModalSiEstaAbierto();
        
        // Guardar en localStorage
        localStorage.setItem('korCotizacionUSD', cotizacionUSD);
        localStorage.setItem('korFechaCotizacion', fechaCotizacionActual);
    } else {
        mostrarNotificacion(`No se encontraron datos para la fecha seleccionada.`, 'warning');
    }
}

// Nueva función para actualizar el modal si está abierto
function actualizarModalSiEstaAbierto() {
    const modalElement = document.getElementById('product-details-modal'); // Cambiado a product-details-modal
    if (modalElement && modalElement.style.display === 'block') { // Verificar si está visible
        // Actualizar valores de cotización en el modal
        const cotizacionModalElem = document.getElementById('cotizacionModalValor');
        if (cotizacionModalElem) {
            cotizacionModalElem.textContent = `$${cotizacionUSD.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        
        // Actualizar todos los precios en ARS del modal
        document.querySelectorAll('.precio-ars').forEach(elem => {
            const precioUSD = parseFloat(elem.dataset.precioUsd);
            if (!isNaN(precioUSD)) {
                elem.textContent = `AR$ ${(precioUSD * cotizacionUSD).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
        });
        // Actualizar precios con ajustes si los controles están visibles
        if (document.getElementById('margenAdicionalInput')) {
            actualizarPreciosConAjustes();
        }
    }
}

// Función para actualizar cotización desde el modal
function actualizarCotizacionDesdeModal() {
    const fecha = document.getElementById('fechaCotizacionModal').value;
    if (fecha) {
        document.getElementById('cotizacionModalValor').innerHTML = '<div class="cotizacion-spinner" style="width: 16px; height: 16px;"></div>';
        buscarCotizacionHistorica(fecha);
        
        // Sincronizar con el selector principal
        document.getElementById('fechaCotizacion').value = fecha;
    }
}

// Función para actualizar el display de cotización
function actualizarDisplayCotizacion(valor, fecha) {
    const cotizacionElem = document.getElementById('cotizacionActual');
    const cotizacionPanel = document.getElementById('cotizacionPanel');
    
    if (cotizacionElem) {
        cotizacionElem.innerHTML = `$${valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    
    if (cotizacionPanel) {
        cotizacionPanel.style.display = 'flex';
    }
}

// Función auxiliar para formatear fecha
function toYYYYMMDD(date) {
    return date.toISOString().split('T')[0];
}

function formatDate(date) {
    const adjustedDate = new Date(date.toISOString().split('T')[0] + 'T12:00:00');
    return adjustedDate.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Función para actualizar precios con margen y descuento
function actualizarPreciosConAjustes() {
    const producto = moduleState.products.find(p => p.SKU === productoSeleccionadoParaExportar.SKU); // Obtener producto actualizado
    if (!producto) return;
    
    const pvpSinIVA = producto.Precio_USD_sin_IVA || 0; // Usar el nombre de columna del backend
    const ivaPct = producto.IVA_Porcentaje || 0; // Usar el nombre de columna del backend
    
    // Aplicar margen adicional primero
    const pvpConMargen = pvpSinIVA * (1 + margenAdicionalTemporal / 100);
    
    // Luego aplicar descuento
    const pvpFinalSinIVA = pvpConMargen * (1 - descuentoClienteTemporal / 100);
    const pvpFinalConIVA = pvpFinalSinIVA * (1 + ivaPct / 100);
    
    // Actualizar los valores mostrados
    document.querySelectorAll('.precio-venta-sin-iva').forEach(elem => {
        elem.textContent = `$${pvpFinalSinIVA.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    });
    
    document.querySelectorAll('.precio-venta-con-iva').forEach(elem => {
        elem.textContent = `$${pvpFinalConIVA.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    });
    
    // Actualizar precios en ARS
    document.querySelectorAll('.precio-venta-ars-sin-iva').forEach(elem => {
        elem.textContent = `AR$ ${(pvpFinalSinIVA * cotizacionUSD).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    });
    
    document.querySelectorAll('.precio-venta-ars-con-iva').forEach(elem => {
        elem.textContent = `AR$ ${(pvpFinalConIVA * cotizacionUSD).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    });
    
    // Recalcular márgenes de ganancia para vista interna
    const tipoVistaActual = document.getElementById('product-details-content').dataset.tipoVista; // Cambiado a product-details-content
    if (tipoVistaActual === 'interno') {
        actualizarMargenesGanancia(producto, pvpFinalSinIVA, pvpFinalConIVA);
    }
}

// Función para actualizar márgenes de ganancia
function actualizarMargenesGanancia(producto, pvpFinalSinIVA, pvpFinalConIVA) {
    const bonifGralPct = producto.Bonificación_Porcentaje || 0; // Usar nombre de columna del backend
    const descContadoPct = producto.Descuento_Contado_Porcentaje || 0; // Usar nombre de columna del backend
    const bonifFinancPct = producto.Bonificación_Financiación_Porcentaje || 0; // Usar nombre de columna del backend
    const ivaPct = producto.IVA_Porcentaje || 0; // Usar nombre de columna del backend
    
    // Costos del revendedor (estos no cambian)
    const pvpOriginalSinIVA = producto.Precio_USD_sin_IVA || 0; // Usar nombre de columna del backend
    const costoContadoSinIVA = pvpOriginalSinIVA * (1 - bonifGralPct/100) * (1 - descContadoPct/100);
    const costoFinancSinIVA = pvpOriginalSinIVA * (1 - bonifFinancPct/100);
    
    const costoContadoConIVA = costoContadoSinIVA * (1 + ivaPct/100);
    const costoFinancConIVA = costoFinancSinIVA * (1 + ivaPct/100);
    
    // Nuevos márgenes con el precio ajustado
    const margenContadoConIVA = pvpFinalConIVA - costoContadoConIVA;
    const porcentajeMargenContado = costoContadoConIVA !== 0 ? (margenContadoConIVA / costoContadoConIVA) * 100 : 0;
    
    const margenFinanciadoConIVA = pvpFinalConIVA - costoFinancConIVA;
    const porcentajeMargenFinanciado = costoFinancConIVA !== 0 ? (margenFinanciadoConIVA / costoFinancConIVA) * 100 : 0;
    
    // Actualizar display de márgenes
    const margenContadoElem = document.getElementById('margen-contado');
    const margenFinanciadoElem = document.getElementById('margen-financiado');
    
    if (margenContadoElem) {
        margenContadoElem.innerHTML = `${porcentajeMargenContado.toFixed(2)}% (Ganancia: $${margenContadoConIVA.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
    
    if (margenFinanciadoElem) {
        margenFinanciadoElem.innerHTML = `${porcentajeMargenFinanciado.toFixed(2)}% (Ganancia: $${margenFinanciadoConIVA.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
}

// Funciones para los controles
function incrementarMargen() {
    margenAdicionalTemporal = Math.min(margenAdicionalTemporal + 5, 200);
    document.getElementById('margenAdicionalInput').value = margenAdicionalTemporal;
    actualizarPreciosConAjustes();
}

function decrementarMargen() {
    margenAdicionalTemporal = Math.max(margenAdicionalTemporal - 5, 0);
    document.getElementById('margenAdicionalInput').value = margenAdicionalTemporal;
    actualizarPreciosConAjustes();
}

function incrementarDescuento() {
    descuentoClienteTemporal = Math.min(descuentoClienteTemporal + 5, 100);
    document.getElementById('descuentoClienteInput').value = descuentoClienteTemporal;
    actualizarPreciosConAjustes();
}

function decrementarDescuento() {
    descuentoClienteTemporal = Math.max(descuentoClienteTemporal - 5, 0);
    document.getElementById('descuentoClienteInput').value = descuentoClienteTemporal;
    actualizarPreciosConAjustes();
}

function cambiarMargenManual() {
    const valor = parseFloat(document.getElementById('margenAdicionalInput').value) || 0;
    margenAdicionalTemporal = Math.max(0, Math.min(200, valor));
    document.getElementById('margenAdicionalInput').value = margenAdicionalTemporal;
    actualizarPreciosConAjustes();
}

function cambiarDescuentoManual() {
    const valor = parseFloat(document.getElementById('descuentoClienteInput').value) || 0;
    descuentoClienteTemporal = Math.max(0, Math.min(100, valor));
    document.getElementById('descuentoClienteInput').value = descuentoClienteTemporal;
    actualizarPreciosConAjustes();
}

function resetearAjustes() {
    margenAdicionalTemporal = 0;
    descuentoClienteTemporal = 0;
    document.getElementById('margenAdicionalInput').value = 0;
    document.getElementById('descuentoClienteInput').value = 0;
    actualizarPreciosConAjustes();
}

// Función para obtener el logo KOR (copiado de LISTA PRECIOS KOR V2.html)
function getKorLogo(size = 'medium', showInnovacion = true) {
    const sizes = {
        small: { fontSize: '24px', spacing: '2px' },
        medium: { fontSize: '32px', spacing: '3px' },
        large: { fontSize: '48px', spacing: '4px' },
        xlarge: { fontSize: '64px', spacing: '5px' }
    };
    
    const config = sizes[size] || sizes.medium;
    
    return `
        <div style="display: inline-block; text-align: center;">
            <div style="font-size: ${config.fontSize}; font-weight: 900; letter-spacing: ${config.spacing}; line-height: 1;">
                <span style="color: #FF6B35;">K</span><span style="color: #000;">OR</span>
            </div>
            ${showInnovacion ? `<div style="font-size: ${parseInt(config.fontSize) * 0.3}px; letter-spacing: 3px; color: #666; margin-top: 5px; font-weight: 300;">INNOVACIÓN</div>` : ''}
        </div>
    `;
}

// Funciones de seguridad (copiado de LISTA PRECIOS KOR V2.html)
let isSecurityEnabled = false;
let securityPassword = null;

function loadSecurityConfig() {
    const security = localStorage.getItem(STORAGE_KEYS.security);
    if (security) {
        const config = JSON.parse(security);
        isSecurityEnabled = config.enabled;
        securityPassword = config.password;
        updateSecurityStatus();
        // $('#enableSecurity').prop('checked', isSecurityEnabled); // No hay jQuery aquí
        // if (isSecurityEnabled) { $('#securitySettings').show(); } // No hay jQuery aquí
    }
}

function toggleSecurity() {
    // const isChecked = $('#enableSecurity').is(':checked'); // No hay jQuery aquí
    // if (isChecked) {
    //     $('#securitySettings').slideDown();
    // } else {
    //     $('#securitySettings').slideUp();
    //     isSecurityEnabled = false;
    //     securityPassword = null;
    //     saveSecurityConfig();
    //     updateSecurityStatus();
    // }
}

function guardarConfiguracionSeguridad() {
    // const newPass = $('#newPassword').val(); // No hay jQuery aquí
    // const confirmPass = $('#confirmPassword').val(); // No hay jQuery aquí
    
    // if (!newPass || newPass.length < 6) {
    //     mostrarNotificacion('La contraseña debe tener al menos 6 caracteres', 'warning');
    //     return;
    // }
    
    // if (newPass !== confirmPass) {
    //     mostrarNotificacion('Las contraseñas no coinciden', 'danger');
    //     return;
    // }
    
    // isSecurityEnabled = true;
    // securityPassword = hashPassword(newPass);
    // saveSecurityConfig();
    // updateSecurityStatus();
    
    // $('#newPassword').val(''); // No hay jQuery aquí
    // $('#confirmPassword').val(''); // No hay jQuery aquí
    
    // mostrarNotificacion('Configuración de seguridad guardada correctamente', 'success');
}

function saveSecurityConfig() {
    const config = {
        enabled: isSecurityEnabled,
        password: securityPassword
    };
    localStorage.setItem(STORAGE_KEYS.security, JSON.stringify(config));
}

function updateSecurityStatus() {
    // const statusEl = $('#securityStatus'); // No hay jQuery aquí
    // if (isSecurityEnabled) {
    //     statusEl.removeClass('security-disabled').addClass('security-enabled');
    //     statusEl.html('<i class="fas fa-lock me-1"></i>Protegido');
    // } else {
    //     statusEl.removeClass('security-enabled').addClass('security-disabled');
    //     statusEl.html('<i class="fas fa-unlock me-1"></i>Sin Protección');
    // }
}

function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

// Función para mostrar el mapeo actual (copiado de LISTA PRECIOS KOR V2.html)
function mostrarMapeoActual() {
    // const mapping = JSON.parse(localStorage.getItem(STORAGE_KEYS.mapping) || '{}'); // No hay jQuery aquí
    // let mappingHtml = '<div class="alert alert-info"><h6>Mapeo de columnas actual:</h6><ul class="mb-0">';
    
    // for (const [campo, columna] of Object.entries(mapping)) {
    //     mappingHtml += `<li><strong>${campo}:</strong> ${columna}</li>`;
    // }
    
    // mappingHtml += '</ul></div>';
    
    // mostrarNotificacion(mappingHtml, 'info', 10000);
}

// Función para resetear el mapeo (copiado de LISTA PRECIOS KOR V2.html)
function resetearMapeo() {
    // if (confirm('¿Está seguro de restaurar el mapeo original? Esto sobrescribirá la configuración actual.')) {
    //     localStorage.setItem(STORAGE_KEYS.mapping, JSON.stringify(DEFAULT_MAPPING));
    //     mostrarNotificacion('Mapeo restaurado al original', 'success');
    // }
}

// Función para exportar HTML completo con datos embebidos (copiado de LISTA PRECIOS KOR V2.html)
function exportarHTMLCompleto() {
    // $('#exportacionCompletaModal').modal('hide'); // No hay jQuery aquí
    
    // setTimeout(() => {
    //     mostrarCargando();
        
    //     try {
    //         // Obtener el HTML actual
    //         let htmlContent = document.documentElement.outerHTML;
            
    //         // Preparar los datos para embeber
    //         const catalogoData = {
    //             productos: moduleState.products, // Usar moduleState.products
    //             mapping: JSON.parse(localStorage.getItem(STORAGE_KEYS.mapping) || '{}'),
    //             security: isSecurityEnabled ? {
    //                 enabled: true,
    //                 password: securityPassword
    //             } : { enabled: false },
    //             cotizacion: {
    //                 valor: cotizacionUSD,
    //                 fecha: fechaCotizacionActual
    //             },
    //             fechaGeneracion: new Date().toISOString(),
    //             version: "5.0"
    //         };
            
    //         // Script que se ejecutará en el archivo exportado
    //         const scriptEmbebido = `
    // <script id="datosEmbebidosCatalogo">
    // // ============================================
    // // DATOS EMBEBIDOS DEL CATÁLOGO KOR V5.0
    // // Generado: ${new Date().toLocaleString('es-AR')}
    // // Productos: ${moduleState.products.length}
    // // ============================================
    
    // // Datos completos del catálogo
    // window.CATALOGO_KOR_EMBEBIDO = ${JSON.stringify(catalogoData)};
    
    // // Función para inicializar el catálogo embebido
    // (function() {
    //     console.log('🚀 Iniciando carga de catálogo embebido V5.0...');
        
    //     function cargarDatosEmbebidos() {
    //         try {
    //             if (!window.CATALOGO_KOR_EMBEBIDO) {
    //                 console.error('❌ No se encontraron datos embebidos');
    //                 return;
    //             }
                
    //             const datos = window.CATALOGO_KOR_EMBEBIDO;
    //             console.log('📦 Datos encontrados:', {
    //                 productos: datos.productos ? datos.productos.length : 0,
    //                 mapping: datos.mapping ? 'Sí' : 'No',
    //                 security: datos.security ? (datos.security.enabled ? 'Activada' : 'Desactivada') : 'No configurada',
    //                 cotizacion: datos.cotizacion ? 'USD ' + datos.cotizacion.valor : 'No configurada'
    //             });
                
    //             // Verificar si es primera carga
    //             const productosActuales = localStorage.getItem('catalogoKorProducts');
    //             const primeraVez = !productosActuales || productosActuales === '[]';
                
    //             if (primeraVez) {
    //                 console.log('✨ Primera carga detectada - Instalando catálogo...');
                    
    //                 // 1. Cargar productos
    //                 if (datos.productos && datos.productos.length > 0) {
    //                     localStorage.setItem('catalogoKorProducts', JSON.stringify(datos.productos));
    //                     console.log('✅ Productos cargados:', datos.productos.length);
    //                 }
                    
    //                 // 2. Cargar mapeo
    //                 if (datos.mapping) {
    //                     localStorage.setItem('catalogoKorColumnMapping', JSON.stringify(datos.mapping));
    //                     console.log('✅ Mapeo de columnas cargado');
    //                 }
                    
    //                 // 3. Cargar configuración de seguridad
    //                 if (datos.security) {
    //                     localStorage.setItem('catalogoKorSecurity', JSON.stringify(datos.security));
    //                     console.log('✅ Configuración de seguridad cargada');
    //                 }
                    
    //                 // 4. Cargar cotización
    //                 if (datos.cotizacion) {
    //                     localStorage.setItem('korCotizacionUSD', datos.cotizacion.valor);
    //                     localStorage.setItem('korFechaCotizacion', datos.cotizacion.fecha);
    //                     console.log('✅ Cotización cargada: USD', datos.cotizacion.valor);
    //                 }
                    
    //                 console.log('🎉 Catálogo instalado exitosamente');
                    
    //                 // Si hay seguridad activada, recargar para solicitar contraseña
    //                 if (datos.security && datos.security.enabled) {
    //                     console.log('🔒 Seguridad activada - Recargando...');
    //                     setTimeout(() => location.reload(), 1000);
    //                 }
                    
    //             } else {
    //                 console.log('📋 Ya existen datos. Para reemplazarlos, use la función reinstalarCatalogo()');
    //             }
                
    //         } catch (error) {
    //             console.error('❌ Error al cargar datos:', error);
    //         }
    //     }
        
    //     // Ejecutar cuando el DOM esté listo
    //     if (document.readyState === 'loading') {
    //         document.addEventListener('DOMContentLoaded', cargarDatosEmbebidos);
    //     } else {
    //         cargarDatosEmbebidos();
    //     }
    // })();
    
    // // Función auxiliar para reinstalar
    // window.reinstalarCatalogo = function() {
    //     if (confirm('¿Desea reinstalar el catálogo? Esto borrará los datos actuales.')) {
    //         localStorage.removeItem('catalogoKorProducts');
    //         localStorage.removeItem('catalogoKorColumnMapping');
    //         localStorage.removeItem('catalogoKorSecurity');
    //         localStorage.removeItem('korCotizacionUSD');
    //         localStorage.removeItem('korFechaCotizacion');
    //         location.reload();
    //     }
    // };
    
    // console.log('💡 Tip: Si tiene problemas, ejecute reinstalarCatalogo() en la consola');
    // <\/script>`;
    
    //         // Limpiar el HTML
    //         htmlContent = htmlContent.replace(/<script[^>]*id="datosEmbebidos[^"]*"[^>]*>[\s\S]*?<\/script>/gi, '');
            
    //         // Insertar el nuevo script
    //         htmlContent = htmlContent.replace('</body>', scriptEmbebido + '\n</body>');
            
    //         // Agregar meta tags
    //         if (!htmlContent.includes('name="catalogo-kor-version"')) {
    //             htmlContent = htmlContent.replace('</head>', 
    //                 `<meta name="catalogo-kor-version" content="5.0">
    // <meta name="catalogo-fecha" content="${new Date().toISOString()}">
    // <meta name="catalogo-productos" content="${moduleState.products.length}">
    // <meta name="catalogo-cotizacion" content="${cotizacionUSD}">
    // </head>`);
    //         }
            
    //         // Crear el blob y descargar
    //         const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    //         const url = URL.createObjectURL(blob);
    //         const link = document.createElement('a');
    //         link.href = url;
            
    //         const fecha = new Date();
    //         const timestamp = fecha.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    //         link.download = `Catalogo_KOR_${timestamp}.html`;
            
    //         document.body.appendChild(link);
    //         link.click();
            
    //         setTimeout(() => {
    //             try {
    //                 if (document.body.contains(link)) {
    //                     document.body.removeChild(link);
    //                 }
    //                 URL.revokeObjectURL(url);
    //             } catch (cleanupError) {
    //                 console.warn("Error durante la limpieza post-descarga:", cleanupError);
    //             } finally {
    //                 ocultarCargando();
    //                 mostrarNotificacion(
    //                     'Catálogo exportado exitosamente. El archivo contiene todos los datos y puede abrirse sin necesidad del Excel original.', 
    //                     'success'
    //                 );
    //             }
    //         }, 300);
    
    //     } catch (error) {
    //         console.error('Error al preparar la exportación:', error);
    //         ocultarCargando(); 
    //         mostrarNotificacion('Error al preparar la exportación del catálogo: ' + error.message, 'danger');
    //     }
    // }, 500);
}

// También actualizar la función que muestra el modal de exportación (copiado de LISTA PRECIOS KOR V2.html)
function mostrarModalExportacionCompleta() {
    // $('#fechaGeneracion').text(new Date().toLocaleString('es-AR')); // No hay jQuery aquí
    // $('#cantidadProductos').text(moduleState.products.length); // No hay jQuery aquí
    // $('#exportacionCompletaModal').modal('show'); // No hay jQuery aquí
}

function populateStaticFilters() {
    const combustibles = ["Nafta", "Diesel", "Gas", "Nafta/Gas", "Eléctrico"];
    const cabinas = ["Abierto", "Silent", "Ultra Silent", "Sin Cabina", "Insonorizada"];
    const unidadesPotencia = ["W", "KW", "KVA", "HP", "CC"];

    const filtroCombustible = document.getElementById('filter-combustible');
    combustibles.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        filtroCombustible.appendChild(option);
    });

    const filtroCabina = document.getElementById('filter-cabina');
    cabinas.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        filtroCabina.appendChild(option);
    });
    
    const unidadPotenciaSelect = document.getElementById('unidadPotencia');
    unidadesPotencia.forEach(u => {
        const option = document.createElement('option');
        option.value = u;
        option.textContent = u;
        unidadPotenciaSelect.appendChild(option);
    });
}

function processPotenciaAvanzada(potenciaRaw) {
    if (!potenciaRaw || potenciaRaw.toString().trim() === '') {
        return { 
            valor: 0, 
            unidad: '', 
            valorNormalizado: 0,
            textoOriginal: '',
            textoFormateado: '-'
        };
    }
    
    const potenciaStr = String(potenciaRaw).trim();
    
    // Buscar números y unidades
    const match = potenciaStr.match(/^([\d.,]+)\s*([A-Za-z.]+)?/);
    
    if (match) {
        const valor = parseFloat(match[1].replace(',', '.'));
        const unidad = (match[2] || 'W').trim().toUpperCase();
        const valorNormalizado = normalizarPotencia(valor, unidad);
        
        return {
            valor: isNaN(valor) ? 0 : valor,
            unidad: unidad,
            valorNormalizado: valorNormalizado,
            textoOriginal: potenciaStr,
            textoFormateado: formatearPotenciaInteligente(valorNormalizado)
        };
    } else {
        // Casos especiales
        const numeroMatch = potenciaStr.match(/(\d+)/);
        if (numeroMatch) {
            const valor = parseFloat(numeroMatch[1]);
            return {
                valor: valor,
                unidad: potenciaStr.replace(numeroMatch[1], '').trim(),
                valorNormalizado: valor,
                textoOriginal: potenciaStr,
                textoFormateado: potenciaStr
            };
        }
        
        return {
            valor: 0,
            unidad: potenciaStr,
            valorNormalizado: 0,
            textoOriginal: potenciaStr,
            textoFormateado: potenciaStr
        };
    }
}

function normalizarPotencia(valor, unidad) {
    if (!valor || valor === 0) return 0;
    
    const unidadUpper = String(unidad).toUpperCase().trim();
    
    for (const [key, factor] of Object.entries(CONVERSIONES_POTENCIA)) {
        if (unidadUpper.includes(key)) {
            return valor * factor;
        }
    }
    
    return valor;
}

function formatearPotenciaInteligente(potenciaWatts) {
    if (!potenciaWatts || potenciaWatts === 0) return '-';
    
    if (potenciaWatts >= 1000) {
        const kw = potenciaWatts / 1000;
        if (kw % 1 === 0 || kw.toFixed(1) == kw.toFixed(0)) {
            return `${kw.toFixed(0)} KW`;
        } else {
            return `${kw.toFixed(1)} KW`;
        }
    }
    
    return `${Math.round(potenciaWatts)} W`;
}

function processImportedData(dataRows) {
    return dataRows.map(row => {
        const potenciaData = processPotenciaAvanzada(row.Potencia);
        
        const producto = {
            SKU: row.SKU, // Mantener el nombre de columna del backend
            Familia: row.Familia,
            Modelo: row.Modelo,
            Marca: row.Marca,
            Precio_USD_sin_IVA: parseFloat(row.Precio_USD_sin_IVA) || 0,
            IVA_Porcentaje: parseFloat(row['IVA_%']) || 10.5, // Usar el nombre de columna del backend
            Combustible: row.Combustible,
            Stock: row.Stock,
            Potencia: potenciaData.valor,
            Unidad_Potencia: potenciaData.unidad,
            Potencia_Completa: potenciaData.textoOriginal,
            Potencia_Normalizada: potenciaData.valorNormalizado,
            Potencia_Formateada: potenciaData.textoFormateado,
            Motor: row.Motor,
            Arranque: row.Arranque,
            Cabina: row.Cabina,
            TTA_Incluido: row.TTA_Incluido,
            Peso_kg: parseFloat(row['Peso_(kg)']) || 0,
            Dimensiones: row.Dimensiones,
            Descripción: row.Descripción,
            Características: row.Características,
            URL_PDF: row.URL_PDF,
            Bonificación_Porcentaje: parseFloat(row['Bonificación_%']) || 0,
            Descuento_Contado_Porcentaje: parseFloat(row['Descuento_Contado_%']) || 0,
            Bonificación_Financiación_Porcentaje: parseFloat(row['Bonif_Financiación_%']) || 0,
            Plan_Financiación: row.Plan_Financiación,
            Precio_Compra: parseFloat(row.Precio_Compra) || 0,
            // Asegurarse de que Precio_USD_con_IVA se calcule aquí para DataTables
            Precio_USD_con_IVA: (parseFloat(row.Precio_USD_sin_IVA) || 0) * (1 + (parseFloat(row['IVA_%']) || 10.5) / 100),
            
            Imagenes: [ // Cambiado a Imagenes para consistencia
                row.Instagram_Feed_URL_1, row.Instagram_Feed_URL_2, row.Instagram_Feed_URL_3, row.Instagram_Feed_URL_4, row.Instagram_Feed_URL_5, row.Instagram_Feed_URL_6, row.Instagram_Feed_URL_7, row.Instagram_Feed_URL_8, row.Instagram_Feed_URL_9, row.Instagram_Feed_URL_10, row.Instagram_Feed_URL_11,
                row.Instagram_Story_URL_1, row.Instagram_Story_URL_2, row.Instagram_Story_URL_3, row.Instagram_Story_URL_4, row.Instagram_Story_URL_5,
                row.MercadoLibre_URL_1, row.MercadoLibre_URL_2, row.MercadoLibre_URL_3, row.MercadoLibre_URL_4, row.MercadoLibre_URL_5,
                row.Web_Generica_URL_1, row.Web_Generica_URL_2, row.Web_Generica_URL_3, row.Web_Generica_URL_4, row.Web_Generica_URL_5
            ].filter(Boolean)
        };
        
        producto.Imagenes = [...new Set(producto.Imagenes)];
        return producto;
    });
}

async function cargarProductosDesdeAPI() {
    showLoading();
    try {
        const response = await fetch(API_BASE_URL); // API_BASE_URL es la Cloud Function
        if (!response.ok) {
            throw new Error(`Error de red: ${response.status} - ${response.statusText}`);
        }
        const datosSQL = await response.json();

        if (!Array.isArray(datosSQL)) {
            throw new Error("La respuesta de la API no es un formato válido.");
        }

        moduleState.products = processImportedData(datosSQL); // Actualizar moduleState.products
        // saveProducts(); // No es necesario guardar en localStorage si siempre se carga de la API
        finalizeDataLoading();

    } catch (error) {
        console.error("Error al cargar productos desde la API:", error);
        mostrarNotificacion(`No se pudieron cargar los datos desde la base de datos. Verifique la conexión y el servicio.`, 'danger');
        hideLoading();
    }
}

function finalizeDataLoading() {
    if (productsDataTable) { productsDataTable.destroy(); } // Destruir antes de reinicializar
    initializeDataTable(); // Reinicializar DataTables con los nuevos datos
    productsDataTable.rows.add(moduleState.products).draw(); // Añadir los productos
    cargarFiltrosDinamicos();
    updateStatistics();
    hideLoading();
    mostrarNotificacion('Datos cargados correctamente.', 'success');
}

function cargarFiltrosDinamicos() {
    const familias = [...new Set(moduleState.products.map(p => p.Familia).filter(Boolean))].sort();
    const filtroFamilia = document.getElementById('filter-familia');
    filtroFamilia.innerHTML = '<option value="">Todas</option>'; // Limpiar y añadir opción por defecto
    familias.forEach(fam => {
        const option = document.createElement('option');
        option.value = fam;
        option.textContent = fam;
        filtroFamilia.appendChild(option);
    });

    const marcas = [...new Set(moduleState.products.map(p => p.Marca).filter(Boolean))].sort();
    const filtroMarca = document.getElementById('filter-marca');
    filtroMarca.innerHTML = '<option value="">Todas</option>'; // Limpiar y añadir opción por defecto
    marcas.forEach(marca => {
        const option = document.createElement('option');
        option.value = marca;
        option.textContent = marca;
        filtroMarca.appendChild(option);
    });
}

// Event Listeners
window.addEventListener('ai:descriptions-ready', (event) => {
    // Cuando las descripciones estén listas desde el módulo AI
    const { products } = event.detail;
    console.log('Descripciones listas para', products.length, 'productos');
});

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    if (event.target.className === 'modal') {
        event.target.style.display = 'none';
    }
}

// Funciones auxiliares para los colores en impresión (copiado de LISTA PRECIOS KOR V2.html)
function getCombustibleColor(combustible) {
    if (!combustible) return 'secondary';
    const c = String(combustible).toLowerCase();

    if (c.includes('gas') && !c.includes('nafta')) {
        return 'warning';
    } else if (c.includes('nafta') && !c.includes('gas')) {
        return 'success';
    } else if (c.includes('diesel')) {
        return 'primary';
    } else if (c.includes('nafta') && c.includes('gas')) {
        return 'info';
    } else if (c.includes('eléctrico')) {
        return 'dark';
    }
    return 'secondary';
}

function getStockColor(stock) {
    if (!stock) return 'secondary';
    const s = String(stock).toLowerCase();
    if (s === 'disponible') return 'success';
    if (s === 'sin stock') return 'danger';
    if (s === 'consultar') return 'warning';
    return 'secondary';
}

function mostrarNotificacion(mensaje, tipo, duracion = 7000) {
    const alertId = `notificacion-${Date.now()}`;
    const alertClass = tipo === 'success' ? 'alert-success' : (tipo === 'danger' ? 'alert-danger' : 'alert-warning');
    const icono = tipo === 'success' ? 'check-circle' : (tipo === 'danger' ? 'exclamation-triangle' : 'exclamation-circle');
    
    const alertHtml = `
        <div id="${alertId}" class="alert ${alertClass} alert-dismissible fade show position-fixed top-0 end-0 m-3 shadow-sm" role="alert" style="z-index: 10000;">
            <i class="fas fa-${icono} me-2"></i>${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
        </div>`;
    
    document.body.insertAdjacentHTML('beforeend', alertHtml); // Usar insertAdjacentHTML
    setTimeout(() => {
        const alertElement = document.getElementById(alertId);
        if (alertElement) {
            // Usar bootstrap.Alert si está disponible, de lo contrario remover directamente
            if (typeof bootstrap !== 'undefined' && bootstrap.Alert) {
                bootstrap.Alert.getOrCreateInstance(alertElement).close();
            } else {
                alertElement.remove();
            }
        }
    }, duracion);
}

// Funciones de impresión (simplificadas y adaptadas)
function imprimirModal() {
    alert('La función de impresión no está completamente implementada en esta versión.');
}

// Funciones de exportación (simplificadas y adaptadas)
function exportarTablaActualAExcel() {
    alert('La función de exportación a Excel no está completamente implementada en esta versión.');
}

function exportarProductoSeleccionadoExcel() {
    alert('La función de exportación de producto seleccionado no está completamente implementada en esta versión.');
}

// Funciones de seguridad (simplificadas y adaptadas)
function checkSecurityOnLoad() {
    // No se implementa la seguridad en esta versión
    return true;
}

// Ejecutar verificación de seguridad al cargar
window.addEventListener('load', function() {
    if (!checkSecurityOnLoad()) {
        return;
    }
});

// Funciones de carga/guardado de selección y filtros (simplificadas y adaptadas)
async function saveSelection() {
    alert('La función de guardar selección no está implementada en esta versión.');
}

async function loadSelection() {
    alert('La función de cargar selección no está implementada en esta versión.');
}

async function saveCurrentFilter() {
    alert('La función de guardar filtro no está implementada en esta versión.');
}

async function confirmSaveFilter() {
    alert('La función de guardar filtro no está implementada en esta versión.');
}

async function loadSavedFilter() {
    alert('La función de cargar filtro no está implementada en esta versión.');
}

// Funciones de estadísticas (simplificadas y adaptadas)
function mostrarEstadisticas() {
    const statsRow = document.getElementById('statisticsRow');
    if (statsRow) {
        statsRow.style.display = statsRow.style.display === 'none' ? 'block' : 'none';
        if (statsRow.style.display === 'block') {
            updateStatistics();
        }
    }
}

function actualizarEstadisticasFiltradas() {
    const filteredDataCount = productsDataTable ? productsDataTable.rows({ search: 'applied' }).count() : 0;
    document.getElementById('total-products').textContent = moduleState.products.length;
    document.getElementById('filtered-products').textContent = filteredDataCount;
    
    if (filteredDataCount > 0) {
        const filteredProducts = productsDataTable.rows({ search: 'applied' }).data().toArray();
        document.getElementById('total-families').textContent = [...new Set(filteredProducts.map(p => p.Familia).filter(Boolean))].length;
        document.getElementById('total-stock').textContent = filteredProducts.filter(p => p.Stock === 'Disponible').length;
        document.getElementById('total-sin-stock').textContent = filteredProducts.filter(p => p.Stock === 'Sin Stock' || p.Stock === 'Consultar').length;
    } else {
        document.getElementById('total-families').textContent = '0';
        document.getElementById('total-stock').textContent = '0';
        document.getElementById('total-sin-stock').textContent = '0';
    }
}

// Funciones de carga de datos (simplificadas y adaptadas)
function handleFileSelectFromModal() {
    mostrarNotificacion('La carga de archivos ha sido reemplazada por la conexión directa a la base de datos.', 'info');
}

function handleFileSelect(event) {
     mostrarNotificacion('La carga de archivos ha sido reemplazada por la conexión directa a la base de datos.', 'info');
}

function recargarDatosAlmacenados() {
    mostrarNotificacion('La recarga de datos almacenados no es aplicable en esta versión. Los datos se cargan directamente de la Cloud Function.', 'info');
}

// Funciones de exportación completa (simplificadas y adaptadas)
function mostrarModalExportacionCompleta() {
    alert('La exportación completa del catálogo no está implementada en esta versión.');
}

function exportarHTMLCompleto() {
    alert('La exportación completa del catálogo no está implementada en esta versión.');
}

// Event listeners para los filtros
document.getElementById('filter-familia').addEventListener('change', applyFilters);
document.getElementById('filter-marca').addEventListener('change', applyFilters);
document.getElementById('filter-stock').addEventListener('change', applyFilters);
document.getElementById('filter-precio-min').addEventListener('change', applyFilters);
document.getElementById('filter-precio-max').addEventListener('change', applyFilters);
document.getElementById('filter-potencia-min').addEventListener('change', applyFilters);
document.getElementById('filter-potencia-max').addEventListener('change', applyFilters);
document.getElementById('filter-cabina').addEventListener('change', applyFilters);
document.getElementById('filter-tta').addEventListener('change', applyFilters);
document.getElementById('filter-combustible').addEventListener('change', applyFilters);
document.getElementById('quick-search').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        quickSearch();
    }
});

// Evento para ajustar columnas de DataTables al redimensionar
window.addEventListener('resize', function() {
    if (productsDataTable) {
        productsDataTable.columns.adjust().responsive.recalc();
    }
});
