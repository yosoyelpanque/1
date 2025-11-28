/**
 * js/reports.js
 * Generación de Reportes, Impresión y Documentos PDF.
 */

import { state, saveState, logActivity } from './state.js';
import { elements, showToast, showPreprintModal } from './ui.js';
import { escapeHTML, getLocalDate } from './utils.js';
import { photoDB } from './db.js';

/**
 * Prepara una plantilla de impresión, inyecta la fecha y lanza el diálogo del navegador.
 */
export function preparePrint(activeTemplateId, options = {}) {
    const { date } = options;
    const dateToPrint = date || getLocalDate();
    
    // 1. Ocultar todas las plantillas
    document.querySelectorAll('.print-page').forEach(page => {
        page.classList.remove('active');
    });

    // 2. Activar la seleccionada
    const activeTemplate = document.getElementById(activeTemplateId);
    
    if (activeTemplate) {
        // Actualizar fecha en el header
        const dateElement = activeTemplate.querySelector('.print-header-date');
        if (dateElement) {
            dateElement.textContent = dateElement.id.includes('date') 
                ? `Fecha: ${dateToPrint}` 
                : dateToPrint;
        }

        activeTemplate.classList.add('active');
        
        // Caso especial: Layout clones (Impresión de múltiples páginas del croquis)
        if (activeTemplateId === 'print-layout-view') {
            document.querySelectorAll('.print-page.layout-clone').forEach(clone => {
                const cloneDateEl = clone.querySelector('.print-header-date');
                if (cloneDateEl) cloneDateEl.textContent = `Fecha: ${dateToPrint}`;
                clone.classList.add('active');
            });
        }
        
        // 3. Imprimir
        window.print();
    } else {
        showToast('Error: Plantilla de impresión no encontrada.', 'error');
    }
}

/**
 * Renderiza una tabla de reporte simple en el modal "Vista de Reporte".
 */
export function renderReportTable(data, title, options = {}) {
    const { withCheckboxes = false, headers = [], isInstitutionalReport = false, reportType = null } = options;
    const { modal, title: modalTitle, tableHead, tableBody } = elements.modals.reportView;

    modalTitle.textContent = title;
    tableHead.innerHTML = `<tr>${headers.map(h => `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('')}</tr>`;
    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${headers.length}" class="text-center py-4 text-gray-500">No se encontraron datos.</td></tr>`;
        modal.classList.add('show');
        return;
    }

    data.forEach(item => {
        const row = document.createElement('tr');
        let cells = '';
        const clave = item['CLAVE UNICA'];

        // Lógica de checkboxes y acciones
        if (isInstitutionalReport) {
            // Reporte de Regularización
            const isChecked = state.institutionalReportCheckboxes[item.id] || false;
            cells = `
                <td class="px-4 py-4"><input type="checkbox" class="rounded institutional-report-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}></td>
                <td class="px-4 py-4 text-sm">${escapeHTML(item.descripcion)}</td>
                <td class="px-4 py-4 text-sm">${escapeHTML(item.clave || 'N/A')}</td>
                <td class="px-4 py-4 text-sm">${escapeHTML(item.area || 'N/A')}</td>
                <td class="px-4 py-4 text-sm">${escapeHTML(item.marca || 'N/A')}</td>
                <td class="px-4 py-4 text-sm">${escapeHTML(item.serie || 'N/A')}</td>
                <td class="px-4 py-4 text-sm">${escapeHTML(item.usuario)}</td>
                <td class="px-4 py-4">
                    <input type="text" value="${escapeHTML(item.claveAsignada || '')}" placeholder="Asignar..." class="new-clave-input w-24 rounded border p-1 text-sm" data-id="${item.id}">
                </td>
                <td class="px-4 py-4">
                    <button class="save-new-clave-btn px-3 py-1 rounded text-xs bg-indigo-500 text-white" data-id="${item.id}">Guardar</button>
                </td>
            `;
        } else {
            // Reportes estándar (Etiquetas, Notas, Mismatched)
            if (reportType === 'labels') {
                cells += `<td class="px-4 py-4"><button class="report-label-done-btn px-3 py-1 rounded text-xs bg-green-500 text-white" data-clave="${clave}">HECHO</button></td>`;
            } else if (withCheckboxes && reportType) {
                const isChecked = state.reportCheckboxes[reportType]?.[clave] || false;
                cells += `<td class="px-4 py-4"><input type="checkbox" class="rounded report-item-checkbox" data-clave="${clave}" data-report-type="${reportType}" ${isChecked ? 'checked' : ''}></td>`;
            }

            // Mapeo dinámico de columnas
            if (headers.includes('Clave Única')) cells += `<td class="px-4 py-4 text-sm">${clave}</td>`;
            if (headers.includes('Descripción')) cells += `<td class="px-4 py-4 text-sm">${escapeHTML(item['DESCRIPCION'])}</td>`;
            if (headers.includes('Serie')) cells += `<td class="px-4 py-4 text-sm">${escapeHTML(item['SERIE'] || 'N/A')}</td>`;
            if (headers.includes('Usuario')) cells += `<td class="px-4 py-4 text-sm">${escapeHTML(item['NOMBRE DE USUARIO'] || 'N/A')}</td>`;
            if (headers.includes('Ubicado')) cells += `<td class="px-4 py-4 text-sm">${item['UBICADO']}</td>`;
            if (headers.includes('Área Original')) cells += `<td class="px-4 py-4 text-sm">${item.areaOriginal}</td>`;
            if (headers.includes('Nota')) cells += `<td class="px-4 py-4 text-sm">${escapeHTML(state.notes[clave] || '')}</td>`;
            
            if (headers.includes('Usuario/Área Actual')) {
                const u = state.resguardantes.find(r => r.name === item['NOMBRE DE USUARIO']);
                cells += `<td class="px-4 py-4 text-sm">${escapeHTML(item['NOMBRE DE USUARIO'])} (${u?.area || 'N/A'})</td>`;
            }
        }

        row.innerHTML = cells;
        tableBody.appendChild(row);
    });

    modal.classList.add('show');
}

/**
 * Genera el Resumen de Sesión (Estadísticas finales).
 */
export function generateSessionSummary(options = {}) {
    const { author, areaResponsible, location, date } = options;
    const template = elements.printTemplates.sessionSummary;

    // Calcular estadísticas
    const itemsLocated = state.inventory.filter(i => i.UBICADO === 'SI').length;
    const itemsPending = state.inventory.length - itemsLocated;
    const totalAdditional = state.additionalItems.length;
    
    // Llenar HTML
    document.getElementById('print-session-location').innerHTML = `<b>Ubicación Física:</b> ${escapeHTML(location)}`;
    document.getElementById('print-session-author-name').textContent = author;
    document.getElementById('print-session-responsible-name').textContent = areaResponsible;

    // Generar listas HTML (Simplificado para brevedad)
    document.getElementById('print-session-stats-general').innerHTML = `
        <h2>Estadísticas Generales</h2>
        <div class="print-summary-grid">
            <div class="print-summary-item"><strong>${itemsLocated}</strong><span>Encontrados</span></div>
            <div class="print-summary-item"><strong>${itemsPending}</strong><span>Pendientes</span></div>
            <div class="print-summary-item"><strong>${totalAdditional}</strong><span>Adicionales</span></div>
        </div>
    `;

    preparePrint('print-session-summary', { date });
}

/**
 * Genera el Plan de Acción (Tasks Report).
 */
export function generateTasksReport(options = {}) {
    const { date } = options;
    
    const itemsWithNotes = Object.keys(state.notes).filter(k => state.notes[k]);
    const pendingLabels = state.inventory.filter(i => i['IMPRIMIR ETIQUETA'] === 'SI');
    const mismatched = state.inventory.filter(i => i.areaIncorrecta);
    const regularize = state.additionalItems.filter(i => i.personal === 'Si' && !i.tieneFormatoEntrada);

    let html = '';

    if (regularize.length > 0) {
        html += `<h3>🔴 Prioridad Alta: Regularización</h3><ul>`;
        regularize.forEach(i => html += `<li>${escapeHTML(i.usuario)}: ${escapeHTML(i.descripcion)} (Falta formato entrada)</li>`);
        html += `</ul>`;
    }

    if (mismatched.length > 0) {
        html += `<h3>🟠 Bienes Fuera de Área</h3><ul>`;
        mismatched.forEach(i => html += `<li>${i['CLAVE UNICA']}: ${escapeHTML(i['DESCRIPCION'])} (Área Orig: ${i.areaOriginal})</li>`);
        html += `</ul>`;
    }

    if (pendingLabels.length > 0) {
        html += `<h3>🟡 Etiquetado Pendiente: ${pendingLabels.length} bienes</h3>`;
    }

    if (!html) html = '<div style="padding:20px; text-align:center;"><h2>¡Todo en orden!</h2><p>No hay acciones pendientes.</p></div>';

    document.getElementById('print-tasks-content').innerHTML = html;
    preparePrint('print-tasks-report', { date });
}

/**
 * Genera un Resguardo Individual (Uno por uno).
 */
export function generatePrintableResguardo(title, user, items, isAdicional = false, options = {}) {
    const { areaFullName, entrega, recibeCargo, date } = options;
    const template = elements.printTemplates.resguardo;

    // Configurar encabezados
    document.getElementById('print-resguardo-title').textContent = title;
    document.getElementById('print-resguardo-area').textContent = areaFullName;
    document.getElementById('print-resguardo-author-name').textContent = entrega;
    document.getElementById('print-resguardo-author-title').textContent = recibeCargo;
    document.getElementById('print-resguardo-responsible-name').textContent = user; // Recibe

    // Llenar tabla
    const tbody = template.querySelector('tbody');
    tbody.innerHTML = items.map(item => {
        const isItemAd = !!item.id;
        const clave = isItemAd ? (item.claveAsignada || item.clave || 'S/C') : item['CLAVE UNICA'];
        const desc = item.descripcion || item['DESCRIPCION'];
        
        return `<tr>
            <td class="col-num"></td>
            <td class="col-clave">${escapeHTML(clave)}</td>
            <td class="col-desc">${escapeHTML(desc)}</td>
            <td class="col-marca">${escapeHTML(item.marca || item['MARCA'])}</td>
            <td class="col-modelo">${escapeHTML(item.modelo || item['MODELO'])}</td>
            <td class="col-serie">${escapeHTML(item.serie || item['SERIE'])}</td>
            <td class="col-area">${escapeHTML(isItemAd ? item.area : item.areaOriginal)}</td>
            <td class="col-status">${isItemAd ? (item.personal === 'Si' ? 'Personal' : 'Adicional') : 'Institucional'}</td>
        </tr>`;
    }).join('');

    document.getElementById('print-resguardo-count').textContent = `Total: ${items.length}`;
    preparePrint('print-resguardo', { date });
}

/**
 * Genera el Reporte Masivo (Batch Printing).
 * Clona el template N veces para imprimir todo de una sola vez.
 */
export function generateBatchReport() {
    const checkboxes = document.querySelectorAll('.batch-user-checkbox:checked');
    if (checkboxes.length === 0) return;

    const { dateInput, entregaInput, cargoInput, includeAdditionals, modal } = elements.modals.batchPrint;
    const globalDate = dateInput.value;
    const globalEntrega = entregaInput.value;
    const areaId = elements.reports.areaFilter.value;
    const areaName = state.areaNames[areaId] || areaId;

    showToast('Generando documento masivo, espera...', 'info');

    // Limpiar contenedor
    const container = elements.printContainer;
    document.querySelectorAll('.print-page.batch-clone').forEach(el => el.remove());
    document.querySelectorAll('.print-page').forEach(p => p.classList.remove('active'));

    const masterTemplate = elements.printTemplates.resguardo;

    // Loop de clonación
    Array.from(checkboxes).forEach((cb, index) => {
        const userName = cb.value;
        let items = state.inventory.filter(i => i['NOMBRE DE USUARIO'] === userName);
        
        if (includeAdditionals.checked) {
            items = [...items, ...state.additionalItems.filter(i => i.usuario === userName)];
        }

        if (items.length === 0) return;

        const pageClone = masterTemplate.cloneNode(true);
        pageClone.id = `batch-page-${index}`;
        pageClone.classList.add('batch-clone', 'active', 'batch-mode');

        // Llenar datos del clon
        pageClone.querySelector('#print-resguardo-title').textContent = 'Resguardo Individual';
        pageClone.querySelector('#print-resguardo-area').textContent = areaName;
        pageClone.querySelector('.print-header-date').textContent = `Fecha: ${globalDate}`;
        pageClone.querySelector('#print-resguardo-author-name').textContent = globalEntrega;
        pageClone.querySelector('#print-resguardo-responsible-name').textContent = userName;

        // Tabla del clon
        const tbody = pageClone.querySelector('tbody');
        tbody.innerHTML = items.map(item => {
            const isAd = !!item.id;
            return `<tr>
                <td class="col-num"></td>
                <td class="col-clave">${escapeHTML(isAd ? (item.clave || 'S/C') : item['CLAVE UNICA'])}</td>
                <td class="col-desc">${escapeHTML(item.descripcion || item['DESCRIPCION'])}</td>
                <td class="col-serie">${escapeHTML(item.serie || item['SERIE'])}</td>
            </tr>`;
        }).join('');

        pageClone.querySelector('#print-resguardo-count').textContent = `Total: ${items.length}`;
        
        // Salto de página CSS
        if (index < checkboxes.length - 1) {
            pageClone.classList.add('batch-page-break-after');
        }

        container.appendChild(pageClone);
    });

    modal.classList.remove('show');

    // Doble requestAnimationFrame para asegurar renderizado antes de imprimir
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            setTimeout(() => window.print(), 500);
        });
    });
}