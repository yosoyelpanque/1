/**
 * js/files.js
 * Manejo de Archivos: Importación Excel, Exportación XLSX y Backups ZIP.
 */

import { state, saveState, logActivity, updateSerialNumberCache, recalculateLocationCounts } from './state.js';
import { elements, showToast, showConfirmationModal } from './ui.js';
import { photoDB } from './db.js';

// --- FUNCIONES HELPER PRIVADAS (Procesamiento Excel) ---

/**
 * Busca inteligentemente la fecha del reporte en la hoja de Excel.
 * Intenta detectar celdas con fechas o textos tipo "Fecha: dd/mm/aaaa".
 */
function findReportDateSmart(sheet) {
    if (!sheet['!ref']) return 'S/F';
    
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const maxRow = Math.min(range.e.r, 10); // Busca solo en las primeras 10 filas
    const maxCol = Math.min(range.e.c, 30); 
    const dateRegex = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/;

    for (let R = 0; R <= maxRow; ++R) {
        for (let C = 0; C <= maxCol; ++C) {
            const cellRef = XLSX.utils.encode_cell({c: C, r: R});
            const cell = sheet[cellRef];
            if (!cell) continue;

            // Caso 1: Fecha numérica de Excel
            if (cell.t === 'n' && cell.v > 43000 && cell.v < 60000) {
                try {
                    const dateObj = XLSX.SSF.parse_date_code(cell.v);
                    if (dateObj && dateObj.d && dateObj.m && dateObj.y) {
                        return `${String(dateObj.d).padStart(2, '0')}/${String(dateObj.m).padStart(2, '0')}/${dateObj.y}`;
                    }
                } catch (e) {}
            }

            // Caso 2: Texto
            if (cell.v) {
                const match = String(cell.v).match(dateRegex);
                if (match) return match[0];
            }
        }
    }
    return 'S/F';
}

/**
 * Intenta extraer el nombre del responsable del área desde el Excel.
 */
function extractResponsibleInfo(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    
    // Estrategia 1: Buscar al final del archivo (firmas)
    const contentRows = data.filter(row => row.some(cell => cell !== null && String(cell).trim() !== ''));
    if (contentRows.length >= 2) {
        const nameRow = contentRows[contentRows.length - 2];
        const titleRow = contentRows[contentRows.length - 1];
        const name = nameRow.find(c => c && String(c).trim().length > 3);
        const title = titleRow.find(c => c && String(c).trim().length > 3);
        if (name && title && isNaN(name)) return { name: String(name).trim(), title: String(title).trim() };
    }

    // Estrategia 2: Buscar palabra clave "Responsable"
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        for (let j = 0; j < row.length; j++) {
            if (String(row[j]).trim().toLowerCase() === 'responsable') {
                if (i + 3 < data.length) {
                    const name = data[i + 2] ? data[i + 2][j] : null;
                    const title = data[i + 3] ? data[i + 3][j] : null;
                    if (name && title) return { name: String(name).trim(), title: String(title).trim() };
                }
            }
        }
    }
    return null;
}

// --- LOGICA PRINCIPAL DE IMPORTACIÓN ---

/**
 * Procesa el archivo Excel cargado por el input.
 */
export function processFile(file) {
    if (state.readOnlyMode) return showToast('Modo lectura: No se pueden cargar archivos.', 'warning');
    
    const fileName = file.name;
    const isDuplicate = state.inventory.some(item => item.fileName === fileName);

    const runImport = () => {
        const { overlay, text } = elements.modals.loading;
        overlay.classList.add('show');
        text.textContent = 'Leyendo estructura del archivo...';
        elements.dashboard.headerAndDashboard.classList.add('hidden'); // Ocultar dashboard para ganar rendimiento UI

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const tipoLibro = sheet['B7']?.v || sheet['L7']?.v || 'Sin Tipo';
                
                addItemsFromFile(sheet, tipoLibro, fileName);
            } catch (error) {
                console.error("Error XLSX:", error);
                showToast('Formato de archivo inválido.', 'error');
                overlay.classList.remove('show');
            }
        };
        reader.readAsBinaryString(file);
    };

    if (isDuplicate) {
        showConfirmationModal(
            'Archivo Duplicado',
            `El archivo "${fileName}" ya existe. ¿Deseas reemplazar los datos existentes con esta nueva versión?`,
            () => {
                // Eliminar datos viejos
                state.inventory = state.inventory.filter(item => item.fileName !== fileName);
                logActivity('Archivo reemplazado', fileName);
                runImport();
            }
        );
    } else {
        runImport();
    }
}

/**
 * Procesa la hoja de cálculo por lotes (chunks) para no congelar la UI.
 */
function addItemsFromFile(sheet, tipoLibro, fileName) {
    // 1. Metadatos
    const areaString = sheet['A10']?.v || 'Sin Área';
    const area = areaString.match(/AREA\s(\d+)/)?.[1] || 'Sin Área';
    const printDate = findReportDateSmart(sheet);
    const listId = Date.now();

    // Guardar nombre de área si es nuevo
    if (area && !state.areaNames[area]) {
        state.areaNames[area] = areaString;
    }

    // Guardar responsable si se detecta
    const responsible = extractResponsibleInfo(sheet);
    if (area && responsible && !state.areaDirectory[area]) {
        state.areaDirectory[area] = {
            fullName: areaString,
            name: responsible.name,
            title: responsible.title
        };
    }

    // 2. Parseo
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 11 });
    const totalRows = rawData.length;
    const claveUnicaRegex = /^(?:\d{5,6}|0\.\d+)$/;
    const newItemsBatch = [];
    
    let processedRows = 0;
    const chunkSize = 500;

    // 3. Loop Asíncrono
    function processChunk() {
        const end = Math.min(processedRows + chunkSize, totalRows);
        
        for (let i = processedRows; i < end; i++) {
            const row = rawData[i];
            const clave = String(row[0] || '').trim();
            
            if (claveUnicaRegex.test(clave)) {
                newItemsBatch.push({
                    'CLAVE UNICA': clave, 
                    'DESCRIPCION': String(row[1] || ''), 
                    'OFICIO': row[2] || '', 
                    'TIPO': row[3] || '',
                    'MARCA': row[4] || '', 
                    'MODELO': row[5] || '', 
                    'SERIE': row[6] || '', 
                    'NOMBRE DE USUARIO': '', 
                    'UBICADO': 'NO', 
                    'IMPRIMIR ETIQUETA': 'NO',
                    'listadoOriginal': tipoLibro, 
                    'areaOriginal': area,
                    'listId': listId, 
                    'fileName': fileName, 
                    'printDate': printDate
                });
            }
        }

        processedRows = end;
        
        // Actualizar UI
        const percent = Math.round((processedRows / totalRows) * 100);
        elements.modals.loading.text.textContent = `Procesando: ${percent}% (${processedRows}/${totalRows})...`;

        if (processedRows < totalRows) {
            setTimeout(processChunk, 0); // Ceder control al navegador
        } else {
            finalizeImport(newItemsBatch, area, tipoLibro, responsible);
        }
    }

    processChunk();
}

function finalizeImport(newItems, area, tipoLibro, responsible) {
    state.inventory = state.inventory.concat(newItems);
    state.inventoryFinished = false;
    
    logActivity('Carga de archivo', `Área ${area}: ${newItems.length} bienes cargados.`);
    
    // Actualizar Estado Global
    updateSerialNumberCache();
    saveState();
    
    // Disparar eventos de actualización UI
    document.dispatchEvent(new CustomEvent('data:imported'));
    
    // UI Final
    elements.modals.loading.overlay.classList.remove('show');
    showToast(`Carga exitosa: ${newItems.length} bienes agregados al Área ${area}.`, 'success');
}

// --- EXPORTACIÓN E IMPORTACIÓN DE SESIÓN (ZIP) ---

export async function exportSession(isFinal = false) {
    const { overlay, text } = elements.modals.loading;
    const type = isFinal ? 'FINALIZADO' : 'backup';
    text.textContent = 'Generando respaldo...';
    overlay.classList.add('show');

    try {
        const zip = new JSZip();
        
        // 1. Guardar JSON del estado
        const stateToSave = { ...state };
        if (isFinal) stateToSave.readOnlyMode = true;
        delete stateToSave.serialNumberCache;
        delete stateToSave.cameraStream;
        
        zip.file("session.json", JSON.stringify(stateToSave));

        // 2. Guardar Fotos
        text.textContent = 'Empaquetando fotos...';
        const allPhotos = await photoDB.getAllItems('photos');
        if (allPhotos.length > 0) {
            const folder = zip.folder("photos");
            allPhotos.forEach(({ key, value }) => folder.file(key, value));
        }

        // 3. Guardar Imágenes de Croquis
        text.textContent = 'Empaquetando croquis...';
        const allLayoutImgs = await photoDB.getAllItems('layoutImages');
        if (allLayoutImgs.length > 0) {
            const folder = zip.folder("layoutImages");
            allLayoutImgs.forEach(({ key, value }) => folder.file(key, value));
        }

        // 4. Generar Archivo
        text.textContent = 'Comprimiendo...';
        const content = await zip.generateAsync({ type: "blob" });
        
        const a = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        a.href = URL.createObjectURL(content);
        a.download = `inventario-${type}-${date}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        logActivity('Respaldo generado', type);
        showToast('Respaldo descargado exitosamente.');

    } catch (e) {
        console.error(e);
        showToast('Error al generar el respaldo.', 'error');
    } finally {
        overlay.classList.remove('show');
    }
}

export async function importSession(file) {
    if (!file.name.endsWith('.zip')) return showToast('Archivo inválido. Debe ser .zip', 'error');

    const { overlay, text } = elements.modals.loading;
    text.textContent = 'Restaurando sesión...';
    overlay.classList.add('show');

    try {
        const jszip = new JSZip();
        const zip = await jszip.loadAsync(file);
        
        // 1. Restaurar JSON
        const sessionFile = zip.file('session.json');
        if (!sessionFile) throw new Error('Zip inválido: falta session.json');
        
        const jsonStr = await sessionFile.async('string');
        const importedState = JSON.parse(jsonStr);
        
        // 2. Restaurar Fotos a IndexedDB (Proceso pesado)
        const photoFolder = zip.folder("photos");
        if (photoFolder) {
            elements.modals.importProgress.modal.classList.add('show');
            overlay.classList.remove('show'); // Cambiar a barra de progreso
            
            const files = [];
            photoFolder.forEach((_, f) => !f.dir && files.push(f));
            
            let count = 0;
            for (const f of files) {
                const blob = await f.async("blob");
                await photoDB.setItem('photos', f.name.split('/').pop(), blob);
                count++;
                
                const pct = Math.round((count / files.length) * 100);
                elements.modals.importProgress.bar.style.width = `${pct}%`;
                elements.modals.importProgress.bar.textContent = `${pct}%`;
            }
            elements.modals.importProgress.modal.classList.remove('show');
        }

        // 3. Restaurar Layout Images
        const layoutFolder = zip.folder("layoutImages");
        if (layoutFolder) {
            const files = [];
            layoutFolder.forEach((_, f) => !f.dir && files.push(f));
            for (const f of files) {
                const blob = await f.async("blob");
                await photoDB.setItem('layoutImages', f.name.split('/').pop(), blob);
            }
        }

        // 4. Guardar Estado y Recargar
        localStorage.setItem('inventarioProState', JSON.stringify(importedState));
        showToast('Sesión restaurada. Recargando...', 'success');
        
        setTimeout(() => window.location.reload(), 1000);

    } catch (e) {
        console.error(e);
        showToast('Error fatal al importar sesión.', 'error');
        overlay.classList.remove('show');
    }
}

// --- EXPORTACIÓN DE REPORTES (XLSX) ---

export function exportInventoryToXLSX() {
    const areaFilter = elements.reports.areaFilter.value;
    let items = state.inventory;
    let additionals = state.additionalItems;
    let fileName = "inventario_completo.xlsx";

    if (areaFilter !== 'all') {
        items = items.filter(i => i.areaOriginal === areaFilter);
        // Filtrar adicionales por usuarios de esa área
        const areaUsers = state.resguardantes.filter(u => u.area === areaFilter).map(u => u.name);
        additionals = additionals.filter(i => areaUsers.includes(i.usuario));
        fileName = `inventario_area_${areaFilter}.xlsx`;
    }

    if (items.length === 0 && additionals.length === 0) return showToast('No hay datos para exportar.', 'warning');

    showToast('Generando Excel...');
    
    try {
        const wb = XLSX.utils.book_new();

        // Hoja 1: Inventario
        const invData = items.map(i => {
            // Lógica para mostrar ubicación precisa
            let loc = i.ubicacionEspecifica;
            if (!loc) {
                const u = state.resguardantes.find(r => r.name === i['NOMBRE DE USUARIO']);
                loc = u ? (u.locationWithId || u.area) : 'N/A';
            }
            return {
                'Clave': i['CLAVE UNICA'],
                'Descripción': i['DESCRIPCION'],
                'Marca': i['MARCA'],
                'Modelo': i['MODELO'],
                'Serie': i['SERIE'],
                'Usuario': i['NOMBRE DE USUARIO'],
                'Ubicación': loc,
                'Ubicado': i['UBICADO'],
                'Nota': state.notes[i['CLAVE UNICA']] || ''
            };
        });
        const wsInv = XLSX.utils.json_to_sheet(invData);
        XLSX.utils.book_append_sheet(wb, wsInv, "Inventario");

        // Hoja 2: Adicionales
        if (additionals.length > 0) {
            const adData = additionals.map(i => ({
                'Descripción': i.descripcion,
                'Clave/Serie': i.clave || i.serie || 'S/N',
                'Usuario': i.usuario,
                'Es Personal': i.personal
            }));
            const wsAd = XLSX.utils.json_to_sheet(adData);
            XLSX.utils.book_append_sheet(wb, wsAd, "Adicionales");
        }

        XLSX.writeFile(wb, fileName);
        logActivity('Exportación Excel', fileName);

    } catch (e) {
        console.error(e);
        showToast('Error al generar Excel.', 'error');
    }
}

export function exportLabelsToXLSX() {
    const items = state.inventory.filter(i => i['IMPRIMIR ETIQUETA'] === 'SI');
    const adItems = state.additionalItems.filter(i => i.claveAsignada);

    if (items.length === 0 && adItems.length === 0) return showToast('No hay etiquetas pendientes.', 'info');

    try {
        const data = [
            ...items.map(i => ({
                'Clave': i['CLAVE UNICA'],
                'Descripción': i['DESCRIPCION'],
                'Usuario': i['NOMBRE DE USUARIO']
            })),
            ...adItems.map(i => ({
                'Clave': i.claveAsignada,
                'Descripción': i.descripcion,
                'Usuario': i.usuario
            }))
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Etiquetas");
        XLSX.writeFile(wb, "etiquetas_pendientes.xlsx");
        
        showToast('Reporte de etiquetas generado.');
    } catch (e) {
        showToast('Error al exportar etiquetas.', 'error');
    }
}