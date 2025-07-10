// products.js - Lógica del módulo de productos

// Estado global del módulo
let moduleState = {
    isConnected: false,
    products: [],
    filteredProducts: [],
    selectedProducts: new Set(),
    currentPage: 1,
    itemsPerPage: 25,
    sortColumn: 'SKU',
    sortDirection: 'ASC',
    filters: {},
    stats: {}
};

// URL del backend (ajustar según tu configuración)
const API_BASE_URL = 'http://localhost:5000/api/products';

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    loadFilterOptions();
    updateUI();
});

// Funciones de Base de Datos
async function connectDatabase() {
    updateButton('connect-db', true, 'Conectando...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/connect`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            moduleState.isConnected = true;
            document.getElementById('db-status-indicator').classList.add('connected');
            document.getElementById('db-status-text').textContent = 'Conectado';
            document.getElementById('db-info').textContent = result.info;
            
            // Habilitar botones
            document.querySelectorAll('button[disabled]').forEach(btn => {
                if (btn.id !== 'connect-db') {
                    btn.disabled = false;
                }
            });
            
            // Cargar productos automáticamente
            await refreshProducts();
            
            // Cargar estadísticas
            await loadStatistics();
            
        } else {
            alert('Error al conectar: ' + result.error);
        }
    } catch (error) {
        alert('Error de conexión: ' + error.message);
    } finally {
        updateButton('connect-db', false, '🔌 Conectar');
    }
}

async function refreshProducts() {
    if (!moduleState.isConnected) return;
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filters: moduleState.filters,
                sort: {
                    column: moduleState.sortColumn,
                    direction: moduleState.sortDirection
                }
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            moduleState.products = result.products;
            moduleState.filteredProducts = result.products;
            renderProductsTable();
            updateStatistics();
        }
    } catch (error) {
        console.error('Error cargando productos:', error);
    } finally {
        hideLoading();
    }
}

// Funciones de Filtros
async function loadFilterOptions() {
    try {
        const response = await fetch(`${API_BASE_URL}/filter-options`);
        const options = await response.json();
        
        // Llenar select de familias
        const familiaSelect = document.getElementById('filter-familia');
        options.familias.forEach(familia => {
            const option = document.createElement('option');
            option.value = familia;
            option.textContent = familia;
            familiaSelect.appendChild(option);
        });
        
        // Llenar select de marcas
        const marcaSelect = document.getElementById('filter-marca');
        options.marcas.forEach(marca => {
            const option = document.createElement('option');
            option.value = marca;
            option.textContent = marca;
            marcaSelect.appendChild(option);
        });
        
        // Cargar filtros guardados
        loadSavedFiltersList(options.saved_filters);
        
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
    
    // Recargar productos
    refreshProducts();
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
    refreshProducts();
}

async function quickSearch() {
    const query = document.getElementById('quick-search').value.trim();
    
    if (!query) {
        refreshProducts();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        
        const result = await response.json();
        
        if (result.success) {
            moduleState.filteredProducts = result.products;
            moduleState.currentPage = 1;
            renderProductsTable();
            updateStatistics();
            
            // Actualizar filtros si la búsqueda incluía operadores
            if (result.applied_filters) {
                updateFilterFields(result.applied_filters);
                updateFilterSummary();
            }
        }
    } catch (error) {
        console.error('Error en búsqueda:', error);
    }
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

// Funciones de Tabla
function renderProductsTable() {
    const tbody = document.getElementById('products-tbody');
    tbody.innerHTML = '';
    
    // Calcular productos para la página actual
    const start = (moduleState.currentPage - 1) * moduleState.itemsPerPage;
    const end = moduleState.itemsPerPage === 'all' ? 
        moduleState.filteredProducts.length : 
        start + moduleState.itemsPerPage;
    
    const pageProducts = moduleState.filteredProducts.slice(start, end);
    
    pageProducts.forEach(product => {
        const row = createProductRow(product);
        tbody.appendChild(row);
    });
    
    // Actualizar paginación
    updatePagination();
    
    // Actualizar checkbox "seleccionar todos"
    updateSelectAllCheckbox();
}

function createProductRow(product) {
    const row = document.createElement('tr');
    const isSelected = moduleState.selectedProducts.has(product.SKU);
    
    if (isSelected) {
        row.classList.add('selected');
    }
    
    row.innerHTML = `
        <td class="checkbox-column">
            <input type="checkbox" ${isSelected ? 'checked' : ''} 
                   onchange="toggleProductSelection('${product.SKU}', this.checked)">
        </td>
        <td>${highlightSearch(product.SKU)}</td>
        <td>${highlightSearch(product.Descripción || '')}</td>
        <td>${product.Marca || ''}</td>
        <td>${product.Familia || ''}</td>
        <td class="numeric">${product.Stock || 0}</td>
        <td class="numeric">${formatPrice(product.Precio_USD_con_IVA)}</td>
        <td>
            <div class="product-actions">
                <button onclick="viewProductDetails('${product.SKU}')" class="btn btn-small">
                    👁️ Ver
                </button>
            </div>
        </td>
    `;
    
    return row;
}

function highlightSearch(text) {
    const searchTerm = document.getElementById('quick-search').value.trim();
    if (!searchTerm || searchTerm.length < 3) return text;
    
    const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

function formatPrice(price) {
    if (!price || price === 0) return 'N/A';
    return `$${parseFloat(price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}

function sortTable(column) {
    if (moduleState.sortColumn === column) {
        moduleState.sortDirection = moduleState.sortDirection === 'ASC' ? 'DESC' : 'ASC';
    } else {
        moduleState.sortColumn = column;
        moduleState.sortDirection = 'ASC';
    }
    
    refreshProducts();
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
    const checkboxes = document.querySelectorAll('#products-tbody input[type="checkbox"]');
    
    checkboxes.forEach(cb => {
        cb.checked = select;
        const sku = cb.parentElement.parentElement.cells[1].textContent;
        
        if (select) {
            moduleState.selectedProducts.add(sku);
        } else {
            moduleState.selectedProducts.delete(sku);
        }
    });
    
    // Actualizar filas
    document.querySelectorAll('#products-tbody tr').forEach(row => {
        if (select) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });
    
    updateStatistics();
    document.getElementById('process-button').disabled = 
        moduleState.selectedProducts.size === 0;
}

function invertSelection() {
    const checkboxes = document.querySelectorAll('#products-tbody input[type="checkbox"]');
    
    checkboxes.forEach(cb => {
        cb.checked = !cb.checked;
        const sku = cb.parentElement.parentElement.cells[1].textContent;
        
        if (cb.checked) {
            moduleState.selectedProducts.add(sku);
            cb.parentElement.parentElement.classList.add('selected');
        } else {
            moduleState.selectedProducts.delete(sku);
            cb.parentElement.parentElement.classList.remove('selected');
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
            
            renderProductsTable();
            updateStatistics();
            
            alert(`${result.selected_skus.length} productos seleccionados`);
        }
    } catch (error) {
        console.error('Error en selección por criterio:', error);
    }
}

function updateSelectAllCheckbox() {
    const checkbox = document.getElementById('select-all-checkbox');
    const pageCheckboxes = document.querySelectorAll('#products-tbody input[type="checkbox"]');
    const checkedCount = document.querySelectorAll('#products-tbody input[type="checkbox"]:checked').length;
    
    if (pageCheckboxes.length === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
    } else if (checkedCount === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
    } else if (checkedCount === pageCheckboxes.length) {
        checkbox.checked = true;
        checkbox.indeterminate = false;
    } else {
        checkbox.checked = false;
        checkbox.indeterminate = true;
    }
}

// Funciones de Paginación
function updatePagination() {
    const totalItems = moduleState.filteredProducts.length;
    const itemsPerPage = moduleState.itemsPerPage === 'all' ? totalItems : moduleState.itemsPerPage;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    document.getElementById('page-info').textContent = 
        `Página ${moduleState.currentPage} de ${totalPages} (${totalItems} productos)`;
    
    document.querySelector('button[onclick="previousPage()"]').disabled = 
        moduleState.currentPage === 1;
    
    document.querySelector('button[onclick="nextPage()"]').disabled = 
        moduleState.currentPage === totalPages || moduleState.itemsPerPage === 'all';
}

function previousPage() {
    if (moduleState.currentPage > 1) {
        moduleState.currentPage--;
        renderProductsTable();
    }
}

function nextPage() {
    const totalItems = moduleState.filteredProducts.length;
    const itemsPerPage = moduleState.itemsPerPage === 'all' ? totalItems : moduleState.itemsPerPage;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (moduleState.currentPage < totalPages) {
        moduleState.currentPage++;
        renderProductsTable();
    }
}

function changePageSize() {
    const select = document.getElementById('items-per-page');
    moduleState.itemsPerPage = select.value === 'all' ? 'all' : parseInt(select.value);
    moduleState.currentPage = 1;
    renderProductsTable();
}

// Funciones de Estadísticas
async function loadStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/statistics`);
        const stats = await response.json();
        
        moduleState.stats = stats;
        updateStatistics();
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

function updateStatistics() {
    // Total productos
    document.getElementById('total-products').textContent = 
        moduleState.stats.total_products || 0;
    
    // Productos filtrados
    document.getElementById('filtered-products').textContent = 
        moduleState.filteredProducts.length;
    
    // Productos seleccionados
    document.getElementById('selected-products').textContent = 
        moduleState.selectedProducts.size;
    
    // Calcular valor total de seleccionados
    let totalValue = 0;
    moduleState.selectedProducts.forEach(sku => {
        const product = moduleState.filteredProducts.find(p => p.SKU === sku);
        if (product && product.Precio_USD_con_IVA) {
            totalValue += parseFloat(product.Precio_USD_con_IVA);
        }
    });
    
    document.getElementById('total-value').textContent = formatPrice(totalValue);
}

// Funciones de Detalles del Producto
async function viewProductDetails(sku) {
    try {
        const response = await fetch(`${API_BASE_URL}/product/${sku}`);
        const product = await response.json();
        
        if (product) {
            showProductDetailsModal(product);
        }
    } catch (error) {
        console.error('Error cargando detalles:', error);
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
    const selectedProducts = moduleState.filteredProducts.filter(p => 
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
    const productsToProcess = moduleState.filteredProducts
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
    const tbody = document.getElementById('products-tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Cargando productos...</td></tr>';
}

function hideLoading() {
    // Se maneja en renderProductsTable
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
