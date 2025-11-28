/**
 * js/ui.js
 * Manejo de Interfaz de Usuario, referencias al DOM y componentes visuales.
 */

import { state } from './state.js';
import { escapeHTML, highlightText, getLocalDate } from './utils.js';
import { photoDB } from './db.js';

// --- REFERENCIAS AL DOM (Centralizadas) ---
export const elements = {
    // Vistas principales
    loginPage: document.getElementById('login-page'),
    mainApp: document.getElementById('main-app'),
    appContainer: document.getElementById('app-container'),
    
    // Login
    employeeNumberInput: document.getElementById('employee-number-input'),
    employeeLoginBtn: document.getElementById('employee-login-btn'),
    clearSessionLink: document.getElementById('clear-session-link'),
    currentUserDisplay: document.getElementById('current-user-name'),
    logoutBtn: document.getElementById('logout-btn'),

    // Dashboard y Header
    dashboard: {
        container: document.getElementById('dashboard-container'),
        headerAndDashboard: document.getElementById('header-and-dashboard'),
        toggleBtn: document.getElementById('dashboard-toggle-btn'),
        dailyProgressCard: document.getElementById('daily-progress-card'),
        progressTooltip: document.getElementById('progress-tooltip'),
    },
    stats: {
        totalItems: document.getElementById('total-items'),
        locatedItems: document.getElementById('located-items'),
        pendingItems: document.getElementById('pending-items'),
        dailyProgress: document.getElementById('daily-progress'),
        workingAreas: document.getElementById('working-areas-count'),
        additionalCount: document.getElementById('additional-items-count'),
    },

    // Navegación
    tabsContainer: document.getElementById('tabs-container'),
    tabContents: document.querySelectorAll('.tab-content'),
    mainContentArea: document.getElementById('main-content-area'),

    // Carga de Archivos
    fileInput: document.getElementById('file-input'),
    uploadBtn: document.getElementById('upload-btn'),
    
    // Usuario Activo (Banner)
    activeUserBanner: {
        banner: document.getElementById('active-user-banner'),
        name: document.getElementById('active-user-banner-name'),
        area: document.getElementById('active-user-banner-area'),
        selectDesktop: document.getElementById('active-user-location-select'),
        selectMobile: document.getElementById('active-user-location-select-mobile'),
        deactivateBtn: document.getElementById('deactivate-user-btn')
    },

    // Formulario de Usuarios
    userForm: {
        name: document.getElementById('user-name'),
        locationSelect: document.getElementById('user-location-select'),
        locationManual: document.getElementById('user-location-manual'),
        areaSelect: document.getElementById('user-area-select'),
        createBtn: document.getElementById('create-user-btn'),
        addLocationBtn: document.getElementById('add-location-btn'),
        locationsList: document.getElementById('new-user-locations-list'),
        list: document.getElementById('registered-users-list'),
        search: document.getElementById('user-search-input'),
        countBadge: document.getElementById('user-count-badge')
    },

    // Inventario
    inventory: {
        tableBody: document.getElementById('inventory-table-body'),
        searchInput: document.getElementById('search-input'),
        statusFilter: document.getElementById('status-filter'),
        areaFilter: document.getElementById('area-filter-inventory'),
        bookTypeFilter: document.getElementById('book-type-filter'),
        selectAllCheckbox: document.getElementById('select-all-checkbox'),
        
        // Botones de Acción
        ubicadoBtn: document.getElementById('ubicado-btn'),
        reEtiquetarBtn: document.getElementById('re-etiquetar-btn'),
        desubicarBtn: document.getElementById('desubicar-btn'),
        addNoteBtn: document.getElementById('add-note-btn'),
        qrScanBtn: document.getElementById('qr-scan-btn'),
        clearSearchBtn: document.getElementById('clear-search-btn'),
        
        // Paginación
        prevPageBtn: document.getElementById('prev-page-btn'),
        nextPageBtn: document.getElementById('next-page-btn'),
        pageInfo: document.getElementById('page-info'),
        
        // Búsqueda en Adicionales
        additionalResultsContainer: document.getElementById('additional-search-results-container'),
        additionalResultsList: document.getElementById('additional-search-results-list')
    },

    // Adicionales
    adicionales: {
        form: document.getElementById('adicional-form'),
        addBtn: document.getElementById('add-adicional-btn'),
        list: document.getElementById('adicionales-list'),
        areaFilter: document.getElementById('ad-area-filter'),
        userFilter: document.getElementById('ad-user-filter'),
        printResguardoBtn: document.getElementById('print-adicionales-resguardo-btn'),
        total: document.getElementById('additional-items-total'),
        inputs: {
            clave: document.getElementById('ad-clave'),
            serie: document.getElementById('ad-serie'),
            claveFeedback: document.getElementById('ad-clave-feedback'),
            serieFeedback: document.getElementById('ad-serie-feedback')
        }
    },

    // Reportes
    reports: {
        areaProgressContainer: document.getElementById('area-progress-container'),
        stats: document.getElementById('general-stats'),
        areaFilter: document.getElementById('report-area-filter'),
        userFilter: document.getElementById('report-user-filter'),
        reportButtons: document.querySelectorAll('.report-btn'),
        exportXlsxBtn: document.getElementById('export-xlsx-btn'),
        exportLabelsXlsxBtn: document.getElementById('export-labels-xlsx-btn'),
        reportViewModal: {
            modal: document.getElementById('report-view-modal'),
            title: document.getElementById('report-view-title'),
            content: document.getElementById('report-view-content'),
            tableHead: document.getElementById('report-view-table-head'),
            tableBody: document.getElementById('report-view-table-body'),
            closeBtn: document.getElementById('report-view-close-btn'),
            closeFooterBtn: document.getElementById('report-view-close-footer-btn')
        }
    },

    // Ajustes
    settings: {
        themes: document.querySelectorAll('[data-theme]'),
        autosaveInterval: document.getElementById('autosave-interval'),
        loadedListsContainer: document.getElementById('loaded-lists-container'),
        loadedListsCount: document.getElementById('loaded-lists-count'),
        directoryContainer: document.getElementById('directory-container'),
        directoryCount: document.getElementById('directory-count'),
        
        exportSessionBtn: document.getElementById('export-session-btn'),
        importSessionBtn: document.getElementById('import-session-btn'),
        importFileInput: document.getElementById('import-file-input'),
        finalizeInventoryBtn: document.getElementById('finalize-inventory-btn'),
        
        importPhotosBtn: document.getElementById('import-photos-btn'),
        importPhotosInput: document.getElementById('import-photos-input'),
        restorePhotosBtn: document.getElementById('restore-photos-from-backup-btn'),
        restorePhotosInput: document.getElementById('restore-photos-input'),
        
        compareInventoryBtn: document.getElementById('compare-inventory-btn'),
        compareFileInput: document.getElementById('compare-file-input'),
        
        // Datos para resumen
        summaryAuthor: document.getElementById('summary-author'),
        summaryAreaResponsible: document.getElementById('summary-area-responsible'),
        summaryLocation: document.getElementById('summary-location'),
        
        aboutHeader: document.getElementById('about-header'),
        aboutContent: document.getElementById('about-content')
    },

    // --- MODALES (Estructuras completas) ---
    modals: {
        loading: {
            overlay: document.getElementById('loading-overlay'),
            text: document.getElementById('loading-text')
        },
        importProgress: {
            modal: document.getElementById('import-progress-modal'),
            text: document.getElementById('import-progress-text'),
            bar: document.getElementById('import-progress-bar')
        },
        confirmation: {
            modal: document.getElementById('confirmation-modal'),
            title: document.getElementById('modal-title'),
            text: document.getElementById('modal-text'),
            confirmBtn: document.getElementById('modal-confirm'),
            cancelBtn: document.getElementById('modal-cancel')
        },
        photo: {
            modal: document.getElementById('photo-modal'),
            title: document.getElementById('photo-modal-title'),
            img: document.getElementById('item-photo-img'),
            input: document.getElementById('photo-input'),
            viewContainer: document.getElementById('photo-view-container'),
            uploadContainer: document.getElementById('photo-upload-container'),
            cameraViewContainer: document.getElementById('camera-view-container'),
            cameraStream: document.getElementById('camera-stream'),
            photoCanvas: document.getElementById('photo-canvas'),
            captureBtn: document.getElementById('capture-photo-btn'),
            deleteBtn: document.getElementById('delete-photo-btn'),
            closeBtn: document.getElementById('photo-close-btn'),
            useCameraBtn: document.getElementById('use-camera-btn'),
            switchToUploadBtn: document.getElementById('switch-to-upload-btn'),
            cameraSelect: document.getElementById('photo-camera-select')
        },
        notes: {
            modal: document.getElementById('notes-modal'),
            textarea: document.getElementById('note-textarea'),
            saveBtn: document.getElementById('note-save-btn'),
            cancelBtn: document.getElementById('note-cancel-btn')
        },
        editUser: {
            modal: document.getElementById('edit-user-modal'),
            name: document.getElementById('edit-user-name'),
            locationType: document.getElementById('edit-user-location-type'),
            locationManual: document.getElementById('edit-user-location-manual'),
            addLocationBtn: document.getElementById('edit-add-location-btn'),
            locationsList: document.getElementById('edit-user-locations-list'),
            areaSelect: document.getElementById('edit-user-area'),
            saveBtn: document.getElementById('edit-user-save-btn'),
            cancelBtn: document.getElementById('edit-user-cancel-btn')
        },
        editAdicional: {
            modal: document.getElementById('edit-adicional-modal'),
            form: document.getElementById('edit-adicional-form'),
            saveBtn: document.getElementById('edit-adicional-save-btn'),
            cancelBtn: document.getElementById('edit-adicional-cancel-btn')
        },
        itemDetailView: {
            modal: document.getElementById('item-detail-view-modal'),
            title: document.getElementById('detail-view-title'),
            closeBtn: document.getElementById('detail-view-close-btn'),
            photo: document.getElementById('detail-view-photo'),
            noPhoto: document.getElementById('detail-view-no-photo'),
            clave: document.getElementById('detail-view-clave'),
            descripcion: document.getElementById('detail-view-descripcion'),
            marca: document.getElementById('detail-view-marca'),
            modelo: document.getElementById('detail-view-modelo'),
            serie: document.getElementById('detail-view-serie'),
            usuario: document.getElementById('detail-view-usuario'),
            ubicacion: document.getElementById('detail-view-ubicacion-especifica'),
            area: document.getElementById('detail-view-area'),
            areaWarning: document.getElementById('detail-view-area-warning'),
            ubicarBtn: document.getElementById('detail-view-ubicar-btn'),
            reetiquetarBtn: document.getElementById('detail-view-reetiquetar-btn'),
            notaBtn: document.getElementById('detail-view-nota-btn'),
            fotoBtn: document.getElementById('detail-view-foto-btn')
        },
        reportView: { // Duplicado intencional por compatibilidad si es necesario
            modal: document.getElementById('report-view-modal'),
            title: document.getElementById('report-view-title'),
            content: document.getElementById('report-view-content'),
            tableHead: document.getElementById('report-view-table-head'),
            tableBody: document.getElementById('report-view-table-body'),
            closeBtn: document.getElementById('report-view-close-btn'),
            closeFooterBtn: document.getElementById('report-view-close-footer-btn')
        },
        qrScanner: {
            modal: document.getElementById('qr-scanner-modal'),
            reader: document.getElementById('qr-reader'),
            closeBtn: document.getElementById('qr-scanner-close-btn'),
            cameraSelect: document.getElementById('qr-camera-select')
        },
        batchPrint: {
            modal: document.getElementById('batch-print-modal'),
            closeBtn: document.getElementById('batch-close-btn'),
            cancelBtn: document.getElementById('batch-cancel-btn'),
            generateBtn: document.getElementById('batch-generate-btn'),
            dateInput: document.getElementById('batch-date'),
            entregaInput: document.getElementById('batch-entrega'),
            cargoInput: document.getElementById('batch-cargo-entrega'),
            includeAdditionals: document.getElementById('batch-include-additionals'),
            areaNameDisplay: document.getElementById('batch-area-name'),
            usersListContainer: document.getElementById('batch-users-list'),
            selectAllBtn: document.getElementById('batch-select-all'),
            deselectAllBtn: document.getElementById('batch-deselect-all'),
            countDisplay: document.getElementById('batch-selected-count')
        },
        layoutEditor: {
            modal: document.getElementById('layout-editor-modal'),
            openBtn: document.getElementById('open-layout-editor-btn'),
            closeBtn: document.getElementById('layout-close-btn'),
            saveBtn: document.getElementById('layout-save-btn'),
            printBtn: document.getElementById('layout-print-btn'),
            sidebar: document.getElementById('layout-sidebar-locations'),
            canvas: document.getElementById('layout-canvas'),
            canvasWrapper: document.getElementById('layout-canvas-wrapper'),
            addImageBtn: document.getElementById('layout-add-image-btn'),
            imageInput: document.getElementById('layout-image-input'),
            pagePrev: document.getElementById('layout-page-prev'),
            pageNext: document.getElementById('layout-page-next'),
            pageAdd: document.getElementById('layout-page-add'),
            pageReset: document.getElementById('layout-page-reset'),
            pageRemove: document.getElementById('layout-page-remove'),
            pageName: document.getElementById('layout-page-name')
        },
        reconciliation: {
            modal: document.getElementById('reconciliation-modal'),
            stats: {
                new: document.getElementById('diff-count-new'),
                mod: document.getElementById('diff-count-mod'),
                del: document.getElementById('diff-count-del')
            },
            tabs: {
                new: document.getElementById('tab-diff-new'),
                mod: document.getElementById('tab-diff-mod'),
                del: document.getElementById('tab-diff-del')
            },
            content: document.getElementById('diff-content-container'),
            applyBtn: document.getElementById('reconciliation-apply-btn'),
            closeBtn: document.getElementById('reconciliation-close-btn'),
            cancelBtn: document.getElementById('reconciliation-cancel-btn')
        },
        preprint: {
            modal: document.getElementById('preprint-edit-modal'),
            title: document.getElementById('preprint-title'),
            fieldsContainer: document.getElementById('preprint-fields'),
            dateInput: document.getElementById('preprint-date'),
            confirmBtn: document.getElementById('preprint-confirm-btn'),
            cancelBtn: document.getElementById('preprint-cancel-btn')
        }
    },

    // Utilidades UI
    toastContainer: document.getElementById('toast-container'),
    readOnlyOverlay: document.getElementById('read-only-mode-overlay'),
    printContainer: document.getElementById('print-view-container'),
    printTemplates: {
        sessionSummary: document.getElementById('print-session-summary'),
        areaClosure: document.getElementById('print-area-closure'),
        resguardo: document.getElementById('print-resguardo'),
        simplePending: document.getElementById('print-simple-pending'),
        tasksReport: document.getElementById('print-tasks-report'),
        layout: document.getElementById('print-layout-view')
    }
};

// --- FUNCIONES VISUALES (HELPERS) ---

/**
 * Muestra una notificación tipo "Toast" en la esquina inferior.
 */
export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-red-500' : (type === 'warning' ? 'bg-yellow-500' : 'bg-green-500');
    
    toast.className = `toast-notification show rounded-lg p-4 text-white shadow-lg transition-all duration-300 transform translate-y-2 opacity-0 ${bgColor}`;
    toast.textContent = message;
    
    elements.toastContainer.appendChild(toast);
    
    // Animación de entrada
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });

    // Auto-cierre
    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

/**
 * Muestra un Toast con opción de "Deshacer".
 */
export function showUndoToast(message, onUndo) {
    const toast = document.createElement('div');
    let timeoutId;

    const closeToast = () => {
        toast.classList.add('opacity-0');
        toast.addEventListener('transitionend', () => toast.remove());
        clearTimeout(timeoutId);
    };

    toast.className = 'toast-notification flex items-center justify-between show rounded-lg p-4 text-white shadow-lg transition-all duration-300 transform opacity-0 bg-slate-700';
    toast.innerHTML = `<span>${message}</span>`;

    const undoButton = document.createElement('button');
    undoButton.className = 'ml-4 font-bold underline hover:text-gray-200';
    undoButton.textContent = 'Deshacer';
    undoButton.onclick = () => {
        onUndo();
        closeToast();
    };
    
    toast.appendChild(undoButton);
    elements.toastContainer.appendChild(toast);

    requestAnimationFrame(() => toast.classList.remove('opacity-0'));
    timeoutId = setTimeout(closeToast, 5000);
}

/**
 * Modal de Confirmación Genérico.
 */
export function showConfirmationModal(title, text, onConfirm, options = {}) {
    const { confirmText = 'Confirmar', cancelText = 'Cancelar', onCancel = () => {} } = options;
    const { modal, title: titleEl, text: textEl, confirmBtn, cancelBtn } = elements.modals.confirmation;

    cancelBtn.style.display = '';
    titleEl.textContent = title;
    textEl.textContent = text;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    
    modal.classList.add('show');
    
    const cleanup = handleModalNavigation(modal);

    const closeModal = () => {
        modal.classList.remove('show');
        confirmBtn.removeEventListener('click', confirmHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
        cleanup(); 
    };

    const confirmHandler = () => {
        onConfirm();
        closeModal();
    };

    const cancelHandler = () => {
        onCancel();
        closeModal();
    };

    confirmBtn.addEventListener('click', confirmHandler, { once: true });
    cancelBtn.addEventListener('click', cancelHandler, { once: true });
}

/**
 * Gestión de accesibilidad y foco en modales (Atrapa el foco).
 */
export function handleModalNavigation(modalElement) {
    const focusableElements = modalElement.querySelectorAll('button, [href], input, select, textarea');
    if (focusableElements.length === 0) return () => {};

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    setTimeout(() => firstElement.focus(), 50);

    const keydownHandler = (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        } else if (e.key === 'Escape') {
            const cancelBtn = modalElement.querySelector('.close-modal-btn, #modal-cancel, #note-cancel-btn, #photo-close-btn, #edit-adicional-cancel-btn, #edit-user-cancel-btn, #log-close-btn, #preprint-cancel-btn, #layout-close-btn');
            if (cancelBtn) cancelBtn.click();
        }
    };

    modalElement.addEventListener('keydown', keydownHandler);
    return () => modalElement.removeEventListener('keydown', keydownHandler);
}

/**
 * Cambio de Pestañas.
 */
export function changeTab(tabName) {
    elements.tabContents.forEach(tab => tab.classList.remove('active'));
    
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) targetTab.classList.add('active');
    
    document.querySelectorAll('.tab-btn').forEach(btn => 
        btn.classList.toggle('active', btn.dataset.tab === tabName)
    );
    
    const contentArea = elements.mainContentArea;
    contentArea.className = 'p-6 rounded-xl shadow-md glass-effect';
    contentArea.classList.add(`bg-tab-${tabName}`);
}

/**
 * Aplicar Tema (Claro/Oscuro).
 */
export function updateTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
}

/**
 * Bloquear/Desbloquear interfaz para Modo Lectura.
 */
export function toggleReadOnlyMode(isReadOnly) {
    if (isReadOnly) {
        elements.readOnlyOverlay.classList.remove('hidden');
        document.querySelectorAll('button:not(.close-modal-btn), input, select, textarea').forEach(el => {
            if (el.closest('.modal-content') && (el.id.includes('close') || el.id.includes('cancel'))) return;
            if (el.classList.contains('tab-btn')) return;
            if (el.id === 'dashboard-toggle-btn') return;
            if (el.id === 'logout-btn') return; 
            if (el.id === 'export-session-btn') return; 

            el.disabled = true;
            el.classList.add('opacity-60', 'cursor-not-allowed');
        });
    } else {
        elements.readOnlyOverlay.classList.add('hidden');
        document.querySelectorAll('[disabled]').forEach(el => {
            el.disabled = false;
            el.classList.remove('opacity-60', 'cursor-not-allowed');
        });
    }
}

// --- RENDERIZADORES COMPLEJOS ---

export function createInventoryRowElement(item, searchTerm = '', isEditMode = false) {
    const clave = item['CLAVE UNICA'] || '';
    const descripcion = item['DESCRIPCION'] || '';
    const marca = item['MARCA'] || '';
    const modelo = item['MODELO'] || '';
    const serie = item['SERIE'] || '';
    const usuario = item['NOMBRE DE USUARIO'] || '';

    const row = document.createElement('tr');
    let rowClasses = 'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';
    
    if (!isEditMode) rowClasses += ' cursor-pointer';
    if (state.notes[clave]) rowClasses += ' has-note';
    if (item.UBICADO === 'SI') rowClasses += ' item-located';
    
    row.className = rowClasses;
    row.dataset.clave = clave;
    
    const mismatchTag = item.areaIncorrecta ? `<span class="mismatched-area-tag" title="Ubicado en el área de otro listado">⚠️</span>` : '';
    
    const userData = state.resguardantes.find(u => u.name === usuario);
    let locationDisplay = '';
    if (item.ubicacionEspecifica) {
        locationDisplay = `📍 Encontrado en: ${item.ubicacionEspecifica}`;
    } else if (userData) {
         locationDisplay = userData.locations ? userData.locations.join(', ') : userData.locationWithId;
    }
    
    const userDetails = userData 
        ? `${userData.name}\nÁrea: ${userData.area}\n${locationDisplay}` 
        : usuario;
    
    const truncate = (str, len) => (str && String(str).length > len ? String(str).substring(0, len) + '...' : str || '');

    const editClass = isEditMode ? 'inventory-editable-cell' : '';
    const contentEditableAttr = isEditMode ? 'contenteditable="true"' : '';
    
    const renderCell = (field, value, truncateLen = 0) => {
        const safeValue = escapeHTML(value);
        if (isEditMode) {
            return `<div class="${editClass} w-full h-full min-h-[24px]" ${contentEditableAttr} data-field="${field}">${safeValue}</div>`;
        } else {
            const text = truncateLen > 0 ? truncate(safeValue, truncateLen) : safeValue;
            return highlightText(text, escapeHTML(searchTerm));
        }
    };

    row.innerHTML = `
        <td class="px-2 py-2"><input type="checkbox" class="inventory-item-checkbox rounded"></td>
        <td class="px-2 py-2 text-sm font-mono" title="${escapeHTML(clave)}">${highlightText(escapeHTML(clave), searchTerm)}</td>

        <td class="px-2 py-2 text-sm" title="${escapeHTML(descripcion)}">
            ${renderCell('DESCRIPCION', descripcion, 30)}
            ${!isEditMode ? mismatchTag : ''} 
        </td>
        <td class="px-2 py-2 text-sm" title="${escapeHTML(marca)}">
            ${renderCell('MARCA', marca)}
        </td>
        <td class="px-2 py-2 text-sm" title="${escapeHTML(modelo)}">
            ${renderCell('MODELO', modelo)}
        </td>
        <td class="px-2 py-2 text-sm" title="${escapeHTML(serie)}">
            ${renderCell('SERIE', serie)}
        </td>
        <td class="px-2 py-2 text-sm" title="${escapeHTML(userDetails)}">
            ${highlightText(escapeHTML(usuario), searchTerm)}
        </td>
        <td class="px-2 py-2 text-sm text-center">${item['UBICADO'] === 'SI' ? '<span class="text-green-600 font-bold">SI</span>' : '<span class="text-red-400">NO</span>'}</td>
        <td class="px-2 py-2 text-sm text-center">${item['IMPRIMIR ETIQUETA'] === 'SI' ? '<span class="text-orange-500 font-bold">SI</span>' : 'NO'}</td>
        <td class="px-2 py-2 text-center">
            <div class="flex items-center justify-center space-x-3">
                <i class="fa-solid fa-note-sticky text-xl ${state.notes[clave] ? 'text-yellow-500' : 'text-gray-400'} note-icon cursor-pointer hover:scale-110 transition-transform" title="Añadir/Ver Nota"></i>
                <i class="fa-solid fa-camera text-xl ${state.photos[clave] ? 'text-indigo-500' : 'text-gray-400'} camera-icon cursor-pointer hover:scale-110 transition-transform" title="Añadir/Ver Foto"></i>
                <i class="fa-solid fa-circle-info text-xl text-gray-400 hover:text-blue-500 md:hidden view-details-btn cursor-pointer" title="Ver Detalles"></i>
                <i class="fa-solid fa-qrcode text-xl text-gray-400 hover:text-indigo-500 view-qr-btn cursor-pointer" title="Ver Código QR"></i>
            </div>
        </td>`;
    
    return row;
}

// --- MODAL DE PRE-IMPRESIÓN (AÑADIDO PARA SOLUCIONAR EL ERROR) ---

export function showPreprintModal(reportType, data = {}) {
    const { modal, title, fieldsContainer, confirmBtn, cancelBtn, dateInput } = elements.modals.preprint;
    let fieldsHtml = '';
    let defaultValues = {};
    let titleText = '';

    const selectedArea = data.filterArea || elements.reports.areaFilter.value;
    const selectedUser = data.filterUser || elements.reports.userFilter.value;
    
    const areaId = data.areaId || (selectedArea !== 'all' ? selectedArea : (state.resguardantes.find(u => u.name === selectedUser)?.area || null));
    const areaResponsibleData = areaId ? state.areaDirectory[areaId] : null;

    dateInput.value = getLocalDate();

    // Configuración del modal según tipo
    switch (reportType) {
        case 'session_summary':
            titleText = 'Generar Resumen de Sesión';
            defaultValues = {
                author: elements.settings.summaryAuthor.value.trim(),
                areaResponsible: elements.settings.summaryAreaResponsible.value.trim(),
                location: elements.settings.summaryLocation.value.trim()
            };
            fieldsHtml = `
                <div><label class="block text-sm font-medium">Ubicación Física del Inventario:</label><input type="text" id="preprint-location" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.location}"></div>
                <div><label class="block text-sm font-medium">Realizado por (Entrega):</label><input type="text" id="preprint-author" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.author}"></div>
                <div><label class="block text-sm font-medium">Responsable del Área (Recibe):</label><input type="text" id="preprint-areaResponsible" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.areaResponsible}"></div>
            `;
            break;
        case 'tasks_report':
            titleText = 'Generar Plan de Acción';
            fieldsHtml = `<div class="p-3 bg-blue-50 text-blue-800 rounded-lg text-sm"><i class="fa-solid fa-info-circle mr-2"></i>Se generará un documento PDF con las tareas pendientes.</div>`;
            break;
        case 'area_closure':
            titleText = 'Generar Acta de Cierre de Área';
            defaultValues = {
                areaId: data.areaId,
                responsible: data.responsible || (areaResponsibleData?.name || ''), 
                location: data.location || '',
                areaFullName: state.areaNames[data.areaId] || `Área ${data.areaId}`,
                entrega: state.currentUser.name,
                recibe: data.responsible || (areaResponsibleData?.name || ''), 
                recibeCargo: areaResponsibleData?.title || 'Responsable de Área'
            };
            fieldsHtml = `
                <div><label class="block text-sm font-medium">Nombre Completo del Área:</label><input type="text" id="preprint-areaFullName" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.areaFullName}"></div>
                <div><label class="block text-sm font-medium">Ubicación de Firma:</label><input type="text" id="preprint-location" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.location}" placeholder="Ej. Oficina 1..."></div>
                <div><label class="block text-sm font-medium">Entrega (Inventario):</label><input type="text" id="preprint-entrega" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.entrega}"></div>
                <div><label class="block text-sm font-medium">Recibe de Conformidad:</label><input type="text" id="preprint-recibe" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.recibe}" placeholder="Nombre completo"></div>
                <div><label class="block text-sm font-medium">Cargo de Quien Recibe:</label><input type="text" id="preprint-recibeCargo" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.recibeCargo}"></div>
            `;
            break;
        case 'simple_pending':
            titleText = 'Imprimir Reporte de Pendientes';
            defaultValues = {
                areaDisplay: selectedArea !== 'all' ? `${state.areaNames[selectedArea] || selectedArea}` : 'Todas las Áreas', 
                entrega: state.currentUser.name,
                recibe: "_________________________"
            };
            fieldsHtml = `
                <div><label class="block text-sm font-medium">Reporte para:</label><input type="text" id="preprint-areaDisplay" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.areaDisplay}"></div>
                <div><label class="block text-sm font-medium">Realizó (Entrega):</label><input type="text" id="preprint-entrega" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.entrega}"></div>
                <div><label class="block text-sm font-medium">Recibe Copia:</label><input type="text" id="preprint-recibe" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.recibe}"></div>
            `;
            break;
        case 'individual_resguardo':
        case 'adicionales_informe':
            titleText = 'Imprimir Resguardo';
            const isAdicional = reportType === 'adicionales_informe';
            const isForArea = data.isForArea || false;
            const isForUser = data.isForUser || false;

            let userForReport = 'Usuario';
            if (isAdicional) {
                userForReport = isForUser ? selectedUser : (isForArea ? `Responsables del Área ${areaId}` : 'Todas las Áreas');
            } else { 
                userForReport = selectedUser !== 'all' ? selectedUser : '_________________________'; 
            }
            
            const entregaValue = areaResponsibleData?.name || '_________________________';
            const receiverName = (isForArea && isAdicional) ? entregaValue : userForReport;

            defaultValues = {
                areaFullName: areaId ? (state.areaNames[areaId] || `Área ${areaId}`) : 'Todas las Áreas', 
                entrega: entregaValue,
                recibe: receiverName, 
                recibeCargo: areaResponsibleData?.title || 'Responsable de Área',
                isForArea: isForArea,
                isForUser: isForUser
            };
            fieldsHtml = `
                <div><label class="block text-sm font-medium">Nombre Completo del Área:</label><input type="text" id="preprint-areaFullName" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.areaFullName}"></div>
                <div><label class="block text-sm font-medium">Responsable del Área (Entrega):</label><input type="text" id="preprint-entrega" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.entrega}"></div>
                <div><label class="block text-sm font-medium">Firma de Conformidad (Recibe):</label><input type="text" id="preprint-recibe" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.recibe}"></div>
                <div><label class="block text-sm font-medium">Cargo de Quien Entrega:</label><input type="text" id="preprint-recibeCargo" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.recibeCargo}"></div>
            `;
            break;
    }

    title.textContent = titleText;
    fieldsContainer.innerHTML = fieldsHtml; 
    modal.classList.add('show');
    
    // Limpieza de eventos anteriores
    const cleanupNav = handleModalNavigation(modal);
    const safeClose = () => {
        modal.classList.remove('show');
        cleanupNav();
        cancelBtn.onclick = null;
        confirmBtn.onclick = null;
    };

    cancelBtn.onclick = safeClose;

    // Manejar confirmación con IMPORTACIÓN DINÁMICA para evitar ciclo
    confirmBtn.onclick = async () => {
        const updatedOptions = { ...defaultValues };
        updatedOptions.date = dateInput.value.trim() || getLocalDate(); 

        fieldsContainer.querySelectorAll('input').forEach(input => {
            const key = input.id.replace('preprint-', '');
            updatedOptions[key] = input.value;
        });

        // Importación dinámica de reports.js para romper la dependencia circular
        const reportsModule = await import('./reports.js');

        switch (reportType) {
            case 'session_summary':
                reportsModule.generateSessionSummary(updatedOptions);
                break;
            case 'tasks_report':
                reportsModule.generateTasksReport(updatedOptions);
                break;
            case 'area_closure':
                reportsModule.generateAreaClosureReport(updatedOptions);
                break;
            case 'simple_pending':
                reportsModule.generateSimplePendingReport(updatedOptions);
                break;
            case 'individual_resguardo':
                 const items = data.items || state.inventory.filter(item => item['NOMBRE DE USUARIO'] === selectedUser);
                 const t = data.title || 'Resguardo Individual de Bienes';
                 const isAd = data.isAdicional || false; 
                 reportsModule.generatePrintableResguardo(t, updatedOptions.recibe, items, isAd, updatedOptions);
                 break;
            case 'adicionales_informe':
                let itemsToPrint = state.additionalItems;
                if (selectedArea !== 'all') {
                    const usersInArea = state.resguardantes.filter(u => u.area === selectedArea).map(u => u.name);
                    itemsToPrint = itemsToPrint.filter(item => usersInArea.includes(item.usuario));
                }
                if (selectedUser !== 'all') {
                    itemsToPrint = itemsToPrint.filter(item => item.usuario === selectedUser);
                } 
                reportsModule.generatePrintableResguardo('Mobiliario y Equipo Ubicado de Manera Adicional Global', updatedOptions.recibe, itemsToPrint, true, updatedOptions);
                break;
        }
        safeClose();
    };
}