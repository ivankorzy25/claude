// Función para obtener el logo KOR
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

// Variables globales
let productos = [];
let dataTable;
let productoSeleccionadoParaExportar = null;
let isSecurityEnabled = false;
let securityPassword = null;

// ==== NUEVA CONFIGURACIÓN DE API ====
const API_URL = "https://southamerica-east1-lista-precios-2025.cloudfunctions.net/actualizar-precios-v2";

// Variables globales para los ajustes temporales del modal
let margenAdicionalTemporal = 0;
let descuentoClienteTemporal = 0;

// ==== Sistema de Cotización con Bluelytics ====
let cotizacionUSD = 1200; // Valor por defecto
let fechaCotizacionActual = new Date().toISOString().split('T')[0];
let evolucionDataOficial = [];

// Configuración de almacenamiento
const STORAGE_KEYS = {
    products: 'catalogoKorProducts',
    mapping: 'catalogoKorColumnMapping',
    security: 'catalogoKorSecurity'
};

// Sistema de conversión de unidades de potencia
const CONVERSIONES_POTENCIA = {
    W: 1,
    KW: 1000,
    KVA: 1000 * 0.8,
    HP: 745.7,
    CV: 735.5,
    CC: 0.746
};

// Función para cargar datos de evolución del dólar
async function cargarDatosEvolucion() {
    try {
        const response = await fetch('https://api.bluelytics.com.ar/v2/evolution.json');
        if (!response.ok) {
            throw new Error('No se pudo conectar a la API de Bluelytics.');
        }
        const data = await response.json();
        
        evolucionDataOficial = data
            .filter(d => d.source === 'Oficial')
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        if (evolucionDataOficial.length === 0) {
            throw new Error('La API no devolvió datos para el Dólar Oficial.');
        }

        const fechaInput = document.getElementById('fechaCotizacion');
        const hoy = new Date();
        fechaInput.max = toYYYYMMDD(hoy);
        if (evolucionDataOficial.length > 0) {
            fechaInput.min = evolucionDataOficial[0].date;
        }
        fechaInput.value = toYYYYMMDD(hoy);

        buscarCotizacionHistorica(toYYYYMMDD(hoy));

    } catch (error) {
        console.error('Error al cargar datos de cotización:', error);
        mostrarNotificacion('Error al cargar cotización del dólar. Usando valor por defecto.', 'warning');
        actualizarDisplayCotizacion(cotizacionUSD, new Date());
    }
}

function actualizarCotizacion() {
    const fecha = document.getElementById('fechaCotizacion').value;
    if (fecha) {
        document.getElementById('cotizacionActual').innerHTML = '<div class="cotizacion-spinner"></div>';
        buscarCotizacionHistorica(fecha);
    }
}

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
        
        if (dataTable) {
            dataTable.rows().invalidate('data').draw(false);
        }
        
        actualizarModalSiEstaAbierto();
        
        localStorage.setItem('korCotizacionUSD', cotizacionUSD);
        localStorage.setItem('korFechaCotizacion', fechaCotizacionActual);
    } else {
        mostrarNotificacion(`No se encontraron datos para la fecha seleccionada.`, 'warning');
    }
}

function actualizarModalSiEstaAbierto() {
    const modalElement = document.getElementById('detallesModal');
    if (modalElement && modalElement.classList.contains('show')) {
        const cotizacionModalElem = document.getElementById('cotizacionModalValor');
        if (cotizacionModalElem) {
            cotizacionModalElem.textContent = `$${cotizacionUSD.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        
        document.querySelectorAll('.precio-ars').forEach(elem => {
            const precioUSD = parseFloat(elem.dataset.precioUsd);
            if (!isNaN(precioUSD)) {
                elem.textContent = `AR$ ${(precioUSD * cotizacionUSD).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
        });
        
        if (document.getElementById('margenAdicionalInput')) {
            actualizarPreciosConAjustes();
        }
    }
}

function actualizarCotizacionDesdeModal() {
    const fecha = document.getElementById('fechaCotizacionModal').value;
    if (fecha) {
        document.getElementById('cotizacionModalValor').innerHTML = '<div class="cotizacion-spinner" style="width: 16px; height: 16px;"></div>';
        buscarCotizacionHistorica(fecha);
        document.getElementById('fechaCotizacion').value = fecha;
    }
}

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

function toYYYYMMDD(date) {
    return date.toISOString().split('T')[0];
}

function formatDate(date) {
    const adjustedDate = new Date(date.toISOString().split('T')[0] + 'T12:00:00');
    return adjustedDate.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function actualizarPreciosConAjustes() {
    const producto = productoSeleccionadoParaExportar;
    if (!producto) return;
    
    const pvpSinIVA = producto.precio || 0;
    const ivaPct = producto.iva || 0;
    
    const pvpConMargen = pvpSinIVA * (1 + margenAdicionalTemporal / 100);
    const pvpFinalSinIVA = pvpConMargen * (1 - descuentoClienteTemporal / 100);
    const pvpFinalConIVA = pvpFinalSinIVA * (1 + ivaPct / 100);
    
    document.querySelectorAll('.precio-venta-sin-iva').forEach(elem => {
        elem.textContent = `$${pvpFinalSinIVA.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    });
    
    document.querySelectorAll('.precio-venta-con-iva').forEach(elem => {
        elem.textContent = `$${pvpFinalConIVA.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    });
    
    document.querySelectorAll('.precio-venta-ars-sin-iva').forEach(elem => {
        elem.textContent = `AR$ ${(pvpFinalSinIVA * cotizacionUSD).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    });
    
    document.querySelectorAll('.precio-venta-ars-con-iva').forEach(elem => {
        elem.textContent = `AR$ ${(pvpFinalConIVA * cotizacionUSD).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    });
    
    const tipoVistaActual = document.getElementById('detallesModalBody').dataset.tipoVista;
    if (tipoVistaActual === 'interno') {
        actualizarMargenesGanancia(producto, pvpFinalSinIVA, pvpFinalConIVA);
    }
}

function actualizarMargenesGanancia(producto, pvpFinalSinIVA, pvpFinalConIVA) {
    const bonifGralPct = producto.bonificacion || 0;
    const descContadoPct = producto.descuentoContado || 0;
    const bonifFinancPct = producto.bonificacionFinanciacion || 0;
    const ivaPct = producto.iva || 0;
    
    const pvpOriginalSinIVA = producto.precio || 0;
    const costoContadoSinIVA = pvpOriginalSinIVA * (1 - bonifGralPct/100) * (1 - descContadoPct/100);
    const costoFinancSinIVA = pvpOriginalSinIVA * (1 - bonifFinancPct/100);
    
    const costoContadoConIVA = costoContadoSinIVA * (1 + ivaPct/100);
    const costoFinancConIVA = costoFinancSinIVA * (1 + ivaPct/100);
    
    const margenContadoConIVA = pvpFinalConIVA - costoContadoConIVA;
    const porcentajeMargenContado = costoContadoConIVA !== 0 ? (margenContadoConIVA / costoContadoConIVA) * 100 : 0;
    
    const margenFinanciadoConIVA = pvpFinalConIVA - costoFinancConIVA;
    const porcentajeMargenFinanciado = costoFinancConIVA !== 0 ? (margenFinanciadoConIVA / costoFinancConIVA) * 100 : 0;
    
    const margenContadoElem = document.getElementById('margen-contado');
    const margenFinanciadoElem = document.getElementById('margen-financiado');
    
    if (margenContadoElem) {
        margenContadoElem.innerHTML = `${porcentajeMargenContado.toFixed(2)}% (Ganancia: $${margenContadoConIVA.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
    
    if (margenFinanciadoElem) {
        margenFinanciadoElem.innerHTML = `${porcentajeMargenFinanciado.toFixed(2)}% (Ganancia: $${margenFinanciadoConIVA.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
}

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

function saveProducts() {
    if (productos.length > 0) {
        localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(productos));
    }
}

function loadSavedProducts() {
    const savedProducts = localStorage.getItem(STORAGE_KEYS.products);
    if (savedProducts) {
        try {
            productos = JSON.parse(savedProducts);
            console.log('Productos cargados desde localStorage:', productos.length);
        } catch (e) {
            console.error('Error al cargar productos guardados:', e);
            productos = [];
        }
    }
}

function loadSecurityConfig() {
    const security = localStorage.getItem(STORAGE_KEYS.security);
    if (security) {
        const config = JSON.parse(security);
        isSecurityEnabled = config.enabled;
        securityPassword = config.password;
        updateSecurityStatus();
    }
}

function updateSecurityStatus() {
    const statusEl = document.getElementById('securityStatus');
    if (isSecurityEnabled) {
        statusEl.classList.remove('security-disabled');
        statusEl.classList.add('security-enabled');
        statusEl.innerHTML = '<i class="fas fa-lock me-1"></i>Protegido';
    } else {
        statusEl.classList.remove('security-enabled');
        statusEl.classList.add('security-disabled');
        statusEl.innerHTML = '<i class="fas fa-unlock me-1"></i>Sin Protección';
    }
}

function populateStaticFilters() {
    const combustibles = ["Nafta", "Diesel", "Gas", "Nafta/Gas", "Eléctrico"];
    const cabinas = ["Abierto", "Silent", "Ultra Silent", "Sin Cabina", "Insonorizada"];
    const unidadesPotencia = ["W", "KW", "KVA", "HP", "CC"];

    const filtroCombustible = document.getElementById('filtroCombustible');
    combustibles.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        filtroCombustible.appendChild(option);
    });

    const filtroCabina = document.getElementById('filtroCabina');
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

function processImportedData(dataRows) {
    return dataRows.map(row => {
        const potenciaData = processPotenciaAvanzada(row.Potencia);
        
        const producto = {
            sku: row.SKU,
            familia: row.Familia,
            modelo: row.Modelo,
            marca: row.Marca,
            precio: parseFloat(row.Precio_USD_sin_IVA) || 0,
            iva: parseFloat(row['IVA_%']) || 10.5,
            combustible: row.Combustible,
            stock: row.Stock,
            potencia: potenciaData.valor,
            unidadPotencia: potenciaData.unidad,
            potenciaCompleta: potenciaData.textoOriginal,
            potenciaNormalizada: potenciaData.valorNormalizado,
            potenciaFormateada: potenciaData.textoFormateado,
            motor: row.Motor,
            arranque: row.Arranque,
            cabina: row.Cabina,
            tta: row.TTA_Incluido,
            peso: parseFloat(row['Peso_(kg)']) || 0,
            dimensiones: row.Dimensiones,
            descripcion: row.Descripción,
            caracteristicas: row.Características,
            urlPdf: row.URL_PDF,
            bonificacion: parseFloat(row['Bonificación_%']) || 0,
            descuentoContado: parseFloat(row['Descuento_Contado_%']) || 0,
            bonificacionFinanciacion: parseFloat(row['Bonif_Financiación_%']) || 0,
            financiacion: row.Plan_Financiación,
            precioCompraSinIVA: parseFloat(row.Precio_Compra) || 0,
            imagenes: [
                row.Instagram_Feed_URL_1, row.Instagram_Feed_URL_2, row.Instagram_Feed_URL_3, row.Instagram_Feed_URL_4, row.Instagram_Feed_URL_5, row.Instagram_Feed_URL_6, row.Instagram_Feed_URL_7, row.Instagram_Feed_URL_8, row.Instagram_Feed_URL_9, row.Instagram_Feed_URL_10, row.Instagram_Feed_URL_11,
                row.Instagram_Story_URL_1, row.Instagram_Story_URL_2, row.Instagram_Story_URL_3, row.Instagram_Story_URL_4, row.Instagram_Story_URL_5,
                row.MercadoLibre_URL_1, row.MercadoLibre_URL_2, row.MercadoLibre_URL_3, row.MercadoLibre_URL_4, row.MercadoLibre_URL_5,
                row.Web_Generica_URL_1, row.Web_Generica_URL_2, row.Web_Generica_URL_3, row.Web_Generica_URL_4, row.Web_Generica_URL_5
            ].filter(Boolean)
        };
        
        producto.imagenes = [...new Set(producto.imagenes)];
        return producto;
    });
}

function initializeEmptyTable() {
    if (dataTable) {
        dataTable.clear().draw();
    } else {
        dataTable = $('#productosTable').DataTable({
            data: [],
            columns: [
                { 
                    data: 'imagenes', 
                    render: function(data, type, row) {
                        if (type === 'display') {
                            if (data && data.length > 0 && data[0]) {
                                return `<img src="${data[0]}" alt="Producto" style="width: 60px; height: 60px; object-fit: contain; border-radius: 4px; border: 1px solid #ddd;" onerror="this.onerror=null; this.src='https://placehold.co/60x60/EEE/CCC?text=Error'; this.alt='Error al cargar imagen';">`;
                            }
                            return '<div style="width: 60px; height: 60px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 4px; color: #aaa; font-size: 10px; text-align:center; border: 1px solid #ddd;">Sin Imagen</div>';
                        }
                        return data && data.length > 0 ? data[0] : 'Sin Imagen';
                    },
                    orderable: false,
                    searchable: false 
                },
                { data: 'modelo', render: data => `<strong>${data || '-'}</strong>` },
                { data: 'marca', defaultContent: '-' },
                { 
                    data: 'potenciaNormalizada',
                    render: function(data, type, row) {
                        if (type === 'display') {
                            return `<strong>${row.potenciaFormateada || row.potenciaCompleta || '-'}</strong>`;
                        } else if (type === 'filter') {
                            return `${row.potenciaCompleta} ${row.potenciaFormateada}`;
                        }
                        return row.potenciaNormalizada || 0;
                    },
                    defaultContent: '-'
                },
                { data: 'motor', defaultContent: '-' },
                { data: 'combustible', render: data => {
                    if (!data) return '-';
                    let color = getCombustibleColor(data);
                    return `<span class="badge bg-${color}">${data}</span>`;
                  }
                },
                { data: 'cabina', defaultContent: '-' },
                { data: 'tta', render: data => `<span class="badge bg-${(data === 'Si' || data === 'SI' || data === 'si') ? 'success' : 'secondary'}">${data || 'No'}</span>` },
                { data: 'precio', render: data => data === 0 ? 'Consultar' : `$${(data || 0).toLocaleString('es-AR')}` },
                {
                    data: 'precio',
                    title: 'Precio ARS',
                    render: data =>
                        data === 0
                            ? 'Consultar'
                            : `AR$ ${(data * cotizacionUSD).toLocaleString('es-AR')}`
                },
                { data: 'stock', render: data => {
                    let color = getStockColor(data);
                    return `<span class="badge bg-${color} badge-stock">${data || 'Consultar'}</span>`;
                  }
                },
                { data: null, orderable: false, responsivePriority: 1, render: function(data, type, row) {
                        const productIndex = productos.findIndex(p => p === row);
                        return `
                            <div class="btn-group btn-group-sm" role="group">
                                <button class="btn btn-outline-primary btn-sm" title="Ver Detalles (Cliente)" onclick="verDetalles(${productIndex}, 'cliente')">
                                    <i class="fas fa-eye"></i> Cliente
                                </button>
                                <button class="btn btn-outline-danger btn-sm" title="Ver Detalles (Interno con Costos)" onclick="verDetalles(${productIndex}, 'interno')">
                                    <i class="fas fa-dollar-sign"></i> Costos
                                </button>
                            </div>`;
                    }
                }
            ],
            language: { url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            pageLength: 25,
            responsive: true,
            dom: 'Bfrltip',
            buttons: []
        });
    }
    document.getElementById('totalProductos').textContent = '0';
    document.getElementById('totalFamilias').textContent = '0';
    document.getElementById('totalStock').textContent = '0';
    document.getElementById('totalSinStock').textContent = '0';
    
    const filtroFamilia = document.getElementById('filtroFamilia');
    filtroFamilia.innerHTML = '<option value="">Todas las familias</option>';
    
    const filtroMarca = document.getElementById('filtroMarca');
    filtroMarca.innerHTML = '<option value="">Todas las marcas</option>';
}

async function cargarProductosDesdeAPI() {
    mostrarCargando();
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`Error de red: ${response.status} - ${response.statusText}`);
        }
        const datosSQL = await response.json();

        if (!Array.isArray(datosSQL)) {
            throw new Error("La respuesta de la API no es un formato válido.");
        }

        productos = processImportedData(datosSQL);
        saveProducts();
        finalizeDataLoading();

    } catch (error) {
        console.error("Error al cargar productos desde la API:", error);
        mostrarNotificacion(`No se pudieron cargar los datos desde la base de datos. Verifique la conexión y el servicio.`, 'danger');
        ocultarCargando();
    }
}

function finalizeDataLoading() {
    if (dataTable) { dataTable.destroy(); }
    cargarFiltrosDinamicos();
    inicializarTablaConDatos();
    actualizarEstadisticas();
    ocultarCargando();
    mostrarNotificacion('Datos cargados correctamente.', 'success');
}

function cargarFiltrosDinamicos() {
    const familias = [...new Set(productos.map(p => p.familia).filter(Boolean))].sort();
    const filtroFamilia = document.getElementById('filtroFamilia');
    filtroFamilia.innerHTML = '<option value="">Todas las familias</option>';
    familias.forEach(fam => {
        const option = document.createElement('option');
        option.value = fam;
        option.textContent = fam;
        filtroFamilia.appendChild(option);
    });

    const marcas = [...new Set(productos.map(p => p.marca).filter(Boolean))].sort();
    const filtroMarca = document.getElementById('filtroMarca');
    filtroMarca.innerHTML = '<option value="">Todas las marcas</option>';
    marcas.forEach(marca => {
        const option = document.createElement('option');
        option.value = marca;
        option.textContent = marca;
        filtroMarca.appendChild(option);
    });
}

function inicializarTablaConDatos() {
    dataTable = $('#productosTable').DataTable({
        data: productos,
        columns: [
            { 
                data: 'imagenes', 
                render: function(data, type, row) {
                    if (type === 'display') {
                        if (data && data.length > 0 && data[0]) {
                            return `<img src="${data[0]}" alt="Producto" style="width: 60px; height: 60px; object-fit: contain; border-radius: 4px; border: 1px solid #ddd;" onerror="this.onerror=null; this.src='https://placehold.co/60x60/EEE/CCC?text=Error'; this.alt='Error al cargar imagen';">`;
                        }
                        return '<div style="width: 60px; height: 60px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 4px; color: #aaa; font-size: 10px; text-align:center; border: 1px solid #ddd;">Sin Imagen</div>';
                    }
                    return data && data.length > 0 ? data[0] : 'Sin Imagen';
                },
                orderable: false,
                searchable: false
            },
            { data: 'modelo', render: data => `<strong>${data || '-'}</strong>` },
            { data: 'marca', defaultContent: '-' },
            { 
                data: 'potenciaNormalizada',
                render: function(data, type, row) {
                    if (type === 'display') {
                        return `<strong>${row.potenciaFormateada || row.potenciaCompleta || '-'}</strong>`;
                    } else if (type === 'filter') {
                        return `${row.potenciaCompleta} ${row.potenciaFormateada}`;
                    }
                    return row.potenciaNormalizada || 0;
                },
                defaultContent: '-'
            },
            { data: 'motor', defaultContent: '-' },
            { data: 'combustible', render: data => {
                if (!data) return '-';
                let color = getCombustibleColor(data);
                return `<span class="badge bg-${color}">${data}</span>`;
                }
            },
            { data: 'cabina', defaultContent: '-' },
            { data: 'tta', render: data => `<span class="badge bg-${(data === 'Si' || data === 'SI' || data === 'si') ? 'success' : 'secondary'}">${data || 'No'}</span>` },
            { data: 'precio', render: data => data === 0 ? 'Consultar' : `$${(data || 0).toLocaleString('es-AR')}` },
            {
                data: 'precio',
                title: 'Precio ARS',
                render: data =>
                    data === 0
                        ? 'Consultar'
                        : `AR$ ${(data * cotizacionUSD).toLocaleString('es-AR')}`
            },
            { data: 'stock', render: data => {
                let color = getStockColor(data);
                return `<span class="badge bg-${color} badge-stock">${data || 'Consultar'}</span>`;
                }
            },
            { data: null, orderable: false, responsivePriority: 1, render: function(data, type, row) {
                    const productIndex = productos.findIndex(p => p === row);
                    return `
                        <div class="btn-group btn-group-sm" role="group">
                            <button class="btn btn-outline-primary btn-sm" title="Ver Detalles (Cliente)" onclick="verDetalles(${productIndex}, 'cliente')">
                                <i class="fas fa-eye"></i> Cliente
                            </button>
                            <button class="btn btn-outline-danger btn-sm" title="Ver Detalles (Interno con Costos)" onclick="verDetalles(${productIndex}, 'interno')">
                                <i class="fas fa-dollar-sign"></i> Costos
                            </button>
                        </div>`;
                }
            }
        ],
        language: { url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
        pageLength: 25,
        responsive: true,
        destroy: true,
        dom: 'Bfrltip',
        buttons: []
    });
}

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

function aplicarFiltros() {
    mostrarCargando();
    
    setTimeout(() => {
        const familia = document.getElementById('filtroFamilia').value;
        const marca = document.getElementById('filtroMarca').value;
        const combustible = document.getElementById('filtroCombustible').value;
        const stock = document.getElementById('filtroStock').value;
        const cabina = document.getElementById('filtroCabina').value;
        const tta = document.getElementById('filtroTTA').value;
        const precioMin = parseFloat(document.getElementById('precioMin').value) || 0;
        const precioMax = parseFloat(document.getElementById('precioMax').value) || Infinity;
        const potenciaMin = parseFloat(document.getElementById('potenciaMin').value) || 0;
        const unidadPotencia = document.getElementById('unidadPotencia').value;
        const busqueda = document.getElementById('busquedaTexto').value.toLowerCase().trim();

        $.fn.dataTable.ext.search.pop();
        $.fn.dataTable.ext.search.push(function(settings, data, dataIndex) {
            const producto = productos[dataIndex];
            if (!producto) return false;

            if (familia && producto.familia !== familia) return false;
            if (marca && producto.marca !== marca) return false;
            if (combustible && producto.combustible !== combustible) return false;
            if (stock && producto.stock !== stock) return false;
            if (cabina && producto.cabina !== cabina) return false;
            if (tta && producto.tta !== tta) return false;
            
            const precioProducto = producto.precio || 0;
            if (precioProducto < precioMin || precioProducto > precioMax) return false;
            
            if (potenciaMin > 0) {
                let potenciaMinWatts = potenciaMin;
                
                if (unidadPotencia) {
                    potenciaMinWatts = normalizarPotencia(potenciaMin, unidadPotencia);
                }
                
                if (producto.potenciaNormalizada < potenciaMinWatts) return false;
            }
            
            if (busqueda) {
                const textoProducto = (
                    (producto.modelo || '') + ' ' + 
                    (producto.descripcion || '') + ' ' +
                    (producto.motor || '') + ' ' +
                    (producto.familia || '') + ' ' +
                    (producto.marca || '') + ' ' +
                    (producto.caracteristicas || '') + ' ' +
                    (producto.potenciaCompleta || '') + ' ' +
                    (producto.potenciaFormateada || '')
                ).toLowerCase();
                if (!textoProducto.includes(busqueda)) return false;
            }
            return true;
        });

        dataTable.draw();
        actualizarEstadisticasFiltradas();
        ocultarCargando();
    }, 250);
}

function actualizarEstadisticasFiltradas() {
    const filteredData = dataTable.rows({ search: 'applied' }).data().toArray();
    document.getElementById('totalProductos').textContent = filteredData.length;
    if (filteredData.length > 0) {
        document.getElementById('totalFamilias').textContent = [...new Set(filteredData.map(p => p.familia))].length;
        document.getElementById('totalStock').textContent = filteredData.filter(p => p.stock === 'Disponible').length;
        document.getElementById('totalSinStock').textContent = filteredData.filter(p => p.stock === 'Sin Stock' || p.stock === 'Consultar').length;
    } else {
        document.getElementById('totalFamilias').textContent = '0';
        document.getElementById('totalStock').textContent = '0';
        document.getElementById('totalSinStock').textContent = '0';
    }
}

function limpiarFiltros() {
    document.getElementById('filtroFamilia').value = '';
    document.getElementById('filtroMarca').value = '';
    document.getElementById('filtroCombustible').value = '';
    document.getElementById('filtroStock').value = '';
    document.getElementById('filtroCabina').value = '';
    document.getElementById('filtroTTA').value = '';
    document.getElementById('unidadPotencia').value = '';
    document.getElementById('precioMin').value = '';
    document.getElementById('precioMax').value = '';
    document.getElementById('potenciaMin').value = '';
    document.getElementById('busquedaTexto').value = '';
    
    $.fn.dataTable.ext.search.pop();
    dataTable.search('').columns().search('').draw();
    actualizarEstadisticas();
}

function mostrarEstadisticas() {
    const statsRow = document.getElementById('statisticsRow');
    if (statsRow.style.display === 'none') {
        statsRow.style.display = 'flex';
        actualizarEstadisticas();
    } else {
        statsRow.style.display = 'none';
    }
}

function actualizarEstadisticas() {
    document.getElementById('totalProductos').textContent = productos.length;
    document.getElementById('totalFamilias').textContent = [...new Set(productos.map(p => p.familia).filter(Boolean))].length;
    document.getElementById('totalStock').textContent = productos.filter(p => p.stock === 'Disponible').length;
    document.getElementById('totalSinStock').textContent = productos.filter(p => p.stock === 'Sin Stock' || p.stock === 'Consultar').length;
}

function mostrarCargando() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function ocultarCargando() {
    document.getElementById('loadingOverlay').style.display = 'none';
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
    
    document.body.insertAdjacentHTML('beforeend', alertHtml);
    setTimeout(() => {
        const alertElement = document.getElementById(alertId);
        if (alertElement) {
            alertElement.remove();
        }
    }, duracion);
}

function mostrarModalExportacion() {
    const modal = new bootstrap.Modal(document.getElementById('exportacionModal'));
    modal.show();
}

function exportarTablaActualAExcel() {
    const tipoExportacion = document.querySelector('input[name="tipoExportacion"]:checked').value;
    mostrarCargando();
    
    const datosFiltrados = dataTable.rows({ search: 'applied' }).data().toArray();
    
    if (datosFiltrados.length === 0) {
        mostrarNotificacion('No hay datos en la tabla para exportar.', 'warning');
        ocultarCargando();
        return;
    }

    const datosExportacion = datosFiltrados.map(producto => {
        const precioVentaConIVA = (producto.precio || 0) * (1 + (producto.iva || 0)/100);
        
        let datoBase = {
            'Familia': producto.familia,
            'Modelo': producto.modelo,
            'Marca': producto.marca || '',
            'Descripción': producto.descripcion || '',
            'Potencia': producto.potenciaCompleta || '',
            'Motor': producto.motor || '',
            'Combustible': producto.combustible || '',
            'Cabina': producto.cabina || '',
            'TTA Incluido': producto.tta || '',
            'Precio Venta s/IVA USD': producto.precio,
            'Precio Venta c/IVA USD': precioVentaConIVA.toFixed(2),
            'Precio Venta c/IVA ARS': (precioVentaConIVA * cotizacionUSD).toFixed(2),
            'Stock': producto.stock,
            'URL Ficha PDF': producto.urlPdf || '',
            'Cotización USD': cotizacionUSD,
            'Fecha Cotización': fechaCotizacionActual
        };
        
        if (tipoExportacion === 'interno') {
            const costoBase = producto.precioCompraSinIVA || 0;
            const bonificacion = producto.bonificacion || 0;
            const descuentoContado = producto.descuentoContado || 0;
            const costoConBonificacion = costoBase * (1 - bonificacion / 100);
            const costoContado = costoConBonificacion * (1 - descuentoContado / 100);
            
            let margenContado = '';
            if (costoContado > 0 && producto.precio > 0) {
                margenContado = (((producto.precio - costoContado) / costoContado) * 100).toFixed(2) + '%';
            }
            
            return {
                ...datoBase,
                'Peso (kg)': producto.peso || '',
                'Dimensiones': producto.dimensiones || '',
                'Costo Lista Proveedor s/IVA USD': producto.precioCompraSinIVA,
                'Bonificación %': producto.bonificacion || '',
                'Desc. Contado %': producto.descuentoContado || '',
                'Mi Costo Contado s/IVA USD': costoContado.toFixed(2),
                'Mi Costo Contado c/IVA USD': (costoContado * (1 + (producto.iva || 0)/100)).toFixed(2),
                'Mi Costo Contado c/IVA ARS': (costoContado * (1 + (producto.iva || 0)/100) * cotizacionUSD).toFixed(2),
                'Plan Financiación': producto.financiacion || '',
                'Bonif. Financiación %': producto.bonificacionFinanciacion || '',
                'Margen sobre costo contado': margenContado,
                'IVA %': producto.iva,
                'Características': producto.caracteristicas || '',
                'Observaciones Internas': producto.observaciones || ''
            };
        }
        return datoBase;
    });

    const ws = XLSX.utils.json_to_sheet(datosExportacion);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos Filtrados");
    
    const fileName = `Catalogo_KOR_${tipoExportacion}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    setTimeout(() => {
        ocultarCargando();
        const modal = bootstrap.Modal.getInstance(document.getElementById('exportacionModal'));
        modal.hide();
        mostrarNotificacion('Archivo Excel exportado correctamente.', 'success');
    }, 500);
}

function recargarDatosAlmacenados() {
    mostrarCargando();
    setTimeout(() => {
        console.log("Intentando re-cargar datos almacenados...");
        loadSavedProducts();
        if (productos && productos.length > 0) {
            finalizeDataLoading();
            mostrarNotificacion('Datos almacenados han sido re-cargados.', 'success');
        } else {
            ocultarCargando();
            mostrarNotificacion('No se encontraron datos almacenados para re-cargar.', 'info');
        }
    }, 250);
}

// Función placeholder para verDetalles - se implementará después
function verDetalles(index, tipoVista) {
    mostrarNotificacion('Función de detalles en desarrollo', 'info');
}

// Función placeholder para exportarProductoSeleccionadoExcel
function exportarProductoSeleccionadoExcel() {
    mostrarNotificacion('Función de exportación individual en desarrollo', 'info');
}

// Función placeholder para imprimirModal
function imprimirModal() {
    mostrarNotificacion('Función de impresión en desarrollo', 'info');
}

// Inicialización cuando el DOM esté listo
$(document).ready(function() {
    loadSecurityConfig();
    
    const savedCotizacion = localStorage.getItem('korCotizacionUSD');
    if (savedCotizacion) {
        cotizacionUSD = parseFloat(savedCotizacion);
    }
    
    cargarDatosEvolucion().then(() => {
        cargarProductosDesdeAPI();
    });
    
    initializeEmptyTable();
    populateStaticFilters();
    
    // Event listener para búsqueda con Enter
    document.getElementById('busquedaTexto').addEventListener('keypress', function(e) {
        if (e.which === 13) {
            aplicarFiltros();
        }
    });
});
