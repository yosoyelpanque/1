/**
 * js/inventory.js
 * Lógica de negocio del Inventario: Filtrado, Paginación y Acciones.
 */

import { state, saveState, logActivity, updateSerialNumberCache } from './state.js';
import { elements, showToast, showConfirmationModal, createInventoryRowElement, showPreprintModal } from './ui.js';
import { debounce } from './utils.js';

// --- Variables Locales del Módulo ---
let currentPage = 1;
const itemsPerPage = 50;
let filteredItems = [];

/**
 * Aplica los filtros (Búsqueda, Estado, Área, Tipo) y actualiza la lista visible.
 */
export function filterAndRenderInventory() {
    const searchTerm = elements.inventory.searchInput.value.trim().toLowerCase();
    const statusFilter = elements.inventory.statusFilter.value;
    const areaFilter = elements.inventory.areaFilter.value;
    const bookTypeFilter = elements.inventory.bookTypeFilter.value;

    // 1. Filtrar Inventario Principal
    filteredItems = state.inventory.filter(item =>
        (!searchTerm || [item['CLAVE UNICA'], item['DESCRIPCION'], item['MARCA'], item['MODELO'], item['SERIE']].some(f => String(f||'').toLowerCase().includes(searchTerm))) &&
        (statusFilter === 'all' || item.UBICADO === statusFilter) &&
        (areaFilter === 'all' || item.areaOriginal === areaFilter) &&
        (bookTypeFilter === 'all' || item.listadoOriginal === bookTypeFilter)
    );
    
    // 2. Renderizar Tabla
    renderInventoryTable();

    // 3. Auto-abrir detalles si hay coincidencia exacta única (UX rápida)
    if (searchTerm && filteredItems.length === 1 && String(filteredItems[0]['CLAVE UNICA']).toLowerCase() === searchTerm) {
        // Disparamos evento para que app.js lo capture y abra el modal
        document.dispatchEvent(new CustomEvent('inventory:open-detail', { 
            detail: { clave: filteredItems[0]['CLAVE UNICA'] } 
        }));
    }

    // 4. Buscar en Adicionales (Resultados secundarios)
    renderAdditionalSearchResults(searchTerm);
}

/**
 * Renderiza la tabla HTML basada en la paginación actual.
 */
function renderInventoryTable() {
    const { tableBody, pageInfo, prevPageBtn, nextPageBtn } = elements.inventory;
    const fragment = document.createDocumentFragment();

    const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const itemsToRender = filteredItems.slice(start, end);

    // Estado del modo edición
    const isEditMode = document.getElementById('inventory-edit-mode-toggle')?.checked || false;
    const searchTerm = elements.inventory.searchInput.value.trim();

    if (itemsToRender.length === 0) {
        const emptyRow = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 12; 
        cell.className = 'text-center py-4 text-gray-500 dark:text-gray-400';
        cell.textContent = 'No se encontraron bienes con los filtros actuales.';
        emptyRow.appendChild(cell);
        fragment.appendChild(emptyRow);
    } else {
        itemsToRender.forEach(item => {
            const rowElement = createInventoryRowElement(item, searchTerm, isEditMode);
            fragment.appendChild(rowElement);
        });
    }
    
    tableBody.innerHTML = '';
    tableBody.appendChild(fragment);

    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

/**
 * Busca coincidencias en los bienes adicionales y las muestra debajo de la barra de búsqueda.
 */
function renderAdditionalSearchResults(searchTerm) {
    const { additionalResultsContainer, additionalResultsList } = elements.inventory;

    if (!searchTerm) {
        additionalResultsContainer.classList.add('hidden');
        return;
    }

    const additionalMatches = state.additionalItems.filter(item =>
        (item.clave && String(item.clave).toLowerCase().includes(searchTerm)) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(searchTerm)) ||
        (item.marca && item.marca.toLowerCase().includes(searchTerm)) ||
        (item.modelo && item.modelo.toLowerCase().includes(searchTerm)) ||
        (item.serie && String(item.serie).toLowerCase().includes(searchTerm)) ||
        (item.claveAsignada && String(item.claveAsignada).toLowerCase().includes(searchTerm))
    );

    if (additionalMatches.length > 0) {
        additionalResultsList.innerHTML = additionalMatches.map(item => {
            const isPersonal = item.personal === 'Si';
            const itemClass = isPersonal ? 'personal-item' : 'additional-item';
            return `
                <div class="flex items-center justify-between p-3 rounded-lg shadow-sm border-l-4 ${itemClass}">
                    <div>
                        <p class="font-semibold">${item.descripcion}</p>
                        <p class="text-sm opacity-80">Clave: ${item.clave || 'N/A'}, Serie: ${item.serie || 'N/A'}</p>
                        <p class="text-xs opacity-70 mt-1">Asignado a: <strong>${item.usuario}</strong></p>
                    </div>
                    <i class="fa-solid fa-star text-purple-400" title="Bien Adicional"></i>
                </div>
            `;
        }).join('');
        additionalResultsContainer.classList.remove('hidden');
    } else {
        additionalResultsContainer.classList.add('hidden');
    }
}

/**
 * Maneja las acciones masivas (Ubicar, Re-etiquetar, Des-ubicar).
 */
export function handleInventoryActions(action) {
    if (state.readOnlyMode) return showToast('Modo de solo lectura activado.', 'warning');

    const checkboxes = document.querySelectorAll('.inventory-item-checkbox:checked');
    const selectedClaves = Array.from(checkboxes).map(cb => cb.closest('tr').dataset.clave);

    if (selectedClaves.length === 0) return showToast('Seleccione al menos un bien.', 'error');
    
    // CASO 1: DES-UBICAR
    if (action === 'desubicar') {
        showConfirmationModal(
            'Des-ubicar Bienes', 
            `¿Estás seguro de que quieres marcar ${selectedClaves.length} bien(es) como NO ubicados? Esto eliminará la asignación de usuario.`, 
            () => {
                selectedClaves.forEach(clave => {
                    const item = state.inventory.find(i => i['CLAVE UNICA'] === clave);
                    if (item) {
                        item.UBICADO = 'NO';
                        item['NOMBRE DE USUARIO'] = '';
                        item['IMPRIMIR ETIQUETA'] = 'NO'; 
                        item.fechaUbicado = null;
                        item.areaIncorrecta = false;
                        item.ubicacionEspecifica = null; // Limpiar anclaje
                        logActivity('Bien des-ubicado', `Clave: ${clave}`);
                        checkAreaCompletion(item.areaOriginal); 
                    }
                });
                showToast(`${selectedClaves.length} bien(es) marcado(s) como NO ubicado(s).`);
                filterAndRenderInventory(); 
                saveState();
                // Actualizar dashboard
                document.dispatchEvent(new CustomEvent('inventory:updated'));
            }
        );
        return; 
    }

    // CASO 2: UBICAR / RE-ETIQUETAR (Requiere usuario activo)
    if (!state.activeResguardante) {
        return showToast('Debe activar un usuario para poder ubicar o re-etiquetar bienes.', 'error');
    }
    
    const activeUser = state.activeResguardante;
    const { searchInput } = elements.inventory;
    let itemsRequiringConfirmation = [];

    // Procesar selección
    selectedClaves.forEach(clave => {
        const item = state.inventory.find(i => i['CLAVE UNICA'] === clave);
        if (!item) return;

        // Verificar si ya pertenece a OTRO usuario
        const isAssignedToOther = item.UBICADO === 'SI' && item['NOMBRE DE USUARIO'] && item['NOMBRE DE USUARIO'] !== activeUser.name;
        
        if (isAssignedToOther) {
            itemsRequiringConfirmation.push({ item, clave });
        } else {
            processItemAssignment(item, activeUser, action);
        }
    });

    // Manejar reasignaciones (con confirmación una por una es tedioso, simplificamos con lógica de grupo o individual)
    if (itemsRequiringConfirmation.length > 0) {
        // Por simplicidad en UX masiva, pedimos confirmación general o para el primero
        const first = itemsRequiringConfirmation[0];
        showConfirmationModal(
            'Reasignar Bienes', 
            `Hay ${itemsRequiringConfirmation.length} bien(es) asignados a otros usuarios (ej: ${first.item['NOMBRE DE USUARIO']}). ¿Deseas reasignarlos todos a ${activeUser.name}?`, 
            () => {
                itemsRequiringConfirmation.forEach(({ item, clave }) => {
                    logActivity('Bien reasignado', `Clave: ${clave} de ${item['NOMBRE DE USUARIO']} a ${activeUser.name}`);
                    processItemAssignment(item, activeUser, action);
                });
                finishAction(action, selectedClaves.length);
            }
        );
    } else {
        finishAction(action, selectedClaves.length);
    }

    function finishAction(act, count) {
        const message = act === 'ubicar' 
            ? `Se ubicaron ${count} bienes.` 
            : `Se marcaron ${count} bienes para re-etiquetar y fueron ubicados.`;
        
        showToast(message);
        
        // Limpiar búsqueda para seguir escaneando rápido
        if (searchInput.value) {
            searchInput.value = '';
            searchInput.focus();
        }
        
        filterAndRenderInventory(); 
        saveState();
        document.dispatchEvent(new CustomEvent('inventory:updated'));
    }
}

/**
 * Lógica interna para asignar un bien a un usuario y actualizar metadatos.
 */
function processItemAssignment(item, user, action) {
    // 1. Obtener la ubicación precisa del selector del banner (si existe en el DOM)
    const selectDesktop = elements.activeUserBanner.selectDesktop;
    const preciseLocation = selectDesktop ? selectDesktop.value : (user.locationWithId || 'N/A');

    // 2. Asignar datos
    item.UBICADO = 'SI';
    item['NOMBRE DE USUARIO'] = user.name;
    item.fechaUbicado = new Date().toISOString();
    item.areaIncorrecta = item.areaOriginal !== user.area;
    item.ubicacionEspecifica = preciseLocation; // El Anclaje
    
    // 3. Manejar etiqueta
    if (action === 're-etiquetar') {
        item['IMPRIMIR ETIQUETA'] = 'SI';
        logActivity('Bien marcado para re-etiquetar', `Clave: ${item['CLAVE UNICA']}, Usuario: ${user.name}`);
    } else {
        // Si solo "Ubica", limpiamos la marca de etiqueta si la tenía
        if (item['IMPRIMIR ETIQUETA'] === 'SI') {
            item['IMPRIMIR ETIQUETA'] = 'NO';
        }
        logActivity('Bien ubicado', `Clave: ${item['CLAVE UNICA']}, Usuario: ${user.name}`);
    }

    checkAreaCompletion(item.areaOriginal);
    checkInventoryCompletion();
}

/**
 * Verifica si se ha completado todo el inventario.
 */
function checkInventoryCompletion() {
    if (state.inventoryFinished || state.inventory.length === 0) return;

    const allLocated = state.inventory.every(item => item.UBICADO === 'SI');
    if (allLocated) {
        state.inventoryFinished = true;
        logActivity('Inventario completado', 'Todos los bienes han sido ubicados.');
        showConfirmationModal(
            '¡Inventario Completado!',
            '¡Felicidades! Has ubicado todos los bienes. ¿Deseas generar el Resumen de Sesión?',
            () => { 
                // Llamamos a la función de UI para mostrar el modal de reporte
                // Usando un evento o llamada directa si UI exporta showPreprintModal
                showPreprintModal('session_summary');
            }
        );
        saveState();
    }
}

/**
 * Verifica si un área específica se ha completado.
 */
function checkAreaCompletion(areaId) {
    if (!areaId || state.closedAreas[areaId]) return; 

    const areaItems = state.inventory.filter(item => item.areaOriginal === areaId);
    const isAreaComplete = areaItems.length > 0 && areaItems.every(item => item.UBICADO === 'SI');
    const wasPreviouslyComplete = !!state.completedAreas[areaId];

    if (isAreaComplete && !wasPreviouslyComplete) {
        state.completedAreas[areaId] = true; 
        logActivity('Área completada', `Todos los bienes del área ${areaId} han sido ubicados.`);
        showToast(`¡Área ${state.areaNames[areaId] || areaId} completada! Puedes generar el Acta de Cierre en Ajustes.`);
        saveState(); 
        
        // Notificar a Settings para actualizar lista
        document.dispatchEvent(new CustomEvent('area:completed'));

    } else if (!isAreaComplete && wasPreviouslyComplete) {
        delete state.completedAreas[areaId];
        logActivity('Área ya no completada', `El área ${areaId} vuelve a tener pendientes.`);
        saveState();
        document.dispatchEvent(new CustomEvent('area:completed'));
    }
}

/**
 * Inicializa los listeners del módulo Inventario.
 * Se llama desde app.js
 */
export function initInventoryListeners() {
    const { inventory } = elements;

    // Búsqueda con Debounce
    const debouncedSearch = debounce(() => {
        currentPage = 1;
        filterAndRenderInventory();
    }, 300);
    inventory.searchInput.addEventListener('input', debouncedSearch);

    // Filtros
    inventory.statusFilter.addEventListener('change', () => { currentPage = 1; filterAndRenderInventory(); });
    inventory.areaFilter.addEventListener('change', () => { currentPage = 1; filterAndRenderInventory(); });
    inventory.bookTypeFilter.addEventListener('change', () => { currentPage = 1; filterAndRenderInventory(); });

    // Acciones
    inventory.ubicadoBtn.addEventListener('click', () => handleInventoryActions('ubicar'));
    inventory.reEtiquetarBtn.addEventListener('click', () => handleInventoryActions('re-etiquetar'));
    inventory.desubicarBtn.addEventListener('click', () => handleInventoryActions('desubicar'));
    
    // Checkbox "Seleccionar Todo"
    inventory.selectAllCheckbox.addEventListener('change', e => {
        document.querySelectorAll('.inventory-item-checkbox').forEach(cb => cb.checked = e.target.checked);
    });

    // Limpiar
    inventory.clearSearchBtn.addEventListener('click', () => {
        inventory.searchInput.value = '';
        inventory.statusFilter.value = 'all';
        inventory.areaFilter.value = 'all';
        inventory.bookTypeFilter.value = 'all';
        currentPage = 1;
        filterAndRenderInventory();
        inventory.searchInput.focus();
    });

    // Paginación
    inventory.prevPageBtn.addEventListener('click', () => { 
        if (currentPage > 1) { currentPage--; renderInventoryTable(); }
    });
    inventory.nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
        if (currentPage < totalPages) { currentPage++; renderInventoryTable(); }
    });

    // Modo Edición (Listener del toggle en Ajustes)
    const editModeToggle = document.getElementById('inventory-edit-mode-toggle');
    if (editModeToggle) {
        editModeToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                showToast('Modo Edición ACTIVADO.', 'warning');
            } else {
                showToast('Modo Edición DESACTIVADO.', 'info');
            }
            renderInventoryTable();
        });
    }

    // Edición Rápida en Celdas (Event Delegation en TableBody)
    inventory.tableBody.addEventListener('focusout', (e) => {
        const cell = e.target;
        // Verificar si es una celda editable
        if (!cell.classList.contains('inventory-editable-cell')) return;

        const row = cell.closest('tr');
        const clave = row.dataset.clave;
        const field = cell.dataset.field; 
        const newValue = cell.textContent.trim();

        const item = state.inventory.find(i => i['CLAVE UNICA'] === clave);
        
        if (item && item[field] !== newValue) {
            const oldValue = item[field];
            item[field] = newValue;
            
            if (field === 'SERIE') updateSerialNumberCache();
            
            saveState();
            logActivity('Edición rápida', `Bien ${clave}: ${field} cambiado.`);
            showToast('Cambio guardado.');
        }
    });

    // Prevenir Enter en celdas editables
    inventory.tableBody.addEventListener('keydown', (e) => {
        if (e.target.classList.contains('inventory-editable-cell') && e.key === 'Enter') {
            e.preventDefault();
            e.target.blur(); // Guardar
        }
    });
}