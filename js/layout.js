/**
 * js/layout.js
 * Lógica del Editor de Croquis (Canvas interactivo) usando Interact.js.
 */

import { state, saveState, logActivity } from './state.js';
import { elements, showToast, showConfirmationModal, handleModalNavigation } from './ui.js';
import { photoDB } from './db.js';

// --- Variables locales para gestión de memoria ---
let activeLayoutUrls = []; // Rastrea URLs de blobs para revocar y evitar fugas de memoria

// --- HELPERS VISUALES ---

function getAreaColor(areaId) {
    if (!state.layoutItemColors[areaId]) {
        let hash = 0;
        for (let i = 0; i < String(areaId).length; i++) {
            hash = String(areaId).charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = hash % 360;
        const s = 70 + (hash % 20);
        const l = 55 + (hash % 10);
        state.layoutItemColors[areaId] = `hsl(${h}, ${s}%, ${l}%)`;
        // No guardamos el estado aquí para no saturar I/O, se guarda al salir o guardar croquis
    }
    return state.layoutItemColors[areaId];
}

function getLocationIcon(locationBase) {
    const base = String(locationBase).toUpperCase();
    if (base.includes('OFICINA')) return 'fa-solid fa-building';
    if (base.includes('CUBICULO') || base.includes('CUBÍCULO')) return 'fa-solid fa-user';
    if (base.includes('BODEGA')) return 'fa-solid fa-box-archive';
    if (base.includes('PASILLO')) return 'fa-solid fa-road';
    if (base.includes('SALA DE JUNTAS')) return 'fa-solid fa-users';
    if (base.includes('SECRETARIAL')) return 'fa-solid fa-keyboard';
    if (base.includes('FOTOCOPIADO')) return 'fa-solid fa-print';
    return 'fa-solid fa-location-dot';
}

// --- FUNCIONES PRINCIPALES ---

/**
 * Carga la lista lateral con las ubicaciones disponibles (que no están en el lienzo).
 */
export function populateLayoutSidebar() {
    const container = elements.layoutEditor.sidebar;
    container.innerHTML = '';
    
    const locationsMap = new Map();

    state.resguardantes.forEach(user => {
        const userLocations = (user.locations && user.locations.length > 0) 
                              ? user.locations 
                              : [user.locationWithId || 'Sin Ubicación'];

        userLocations.forEach(locId => {
            if (!locId) return;
            if (!locationsMap.has(locId)) {
                const baseMatch = locId.match(/^(.*)\s\d+$/);
                const locationBase = baseMatch ? baseMatch[1] : locId;
                locationsMap.set(locId, { locationBase, areaId: user.area, users: [] });
            }
            locationsMap.get(locId).users.push(user.name);
        });
    });

    const itemsOnCurrentPage = state.mapLayout[state.currentLayoutPage] || {};
    const sortedLocations = Array.from(locationsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    sortedLocations.forEach(([locId, data]) => {
        const el = document.createElement('div');
        el.className = 'layout-shape draggable-item';
        el.dataset.locationId = locId;
        el.dataset.areaId = data.areaId; 
        
        if (itemsOnCurrentPage[locId]) el.classList.add('hidden');
        
        const maxUsers = 3;
        let usersHtml = data.users.slice(0, maxUsers).map(name => `<li>${name}</li>`).join('');
        if (data.users.length > maxUsers) usersHtml += `<li><em class="text-xs text-gray-500">+ ${data.users.length - maxUsers} más...</em></li>`;

        const areaColor = getAreaColor(data.areaId);
        
        el.innerHTML = `
            <div class="area-color-dot" style="background-color: ${areaColor};"></div>
            <h5><i class="${getLocationIcon(data.locationBase)} location-icon"></i>${locId}</h5>
            <ul>${usersHtml}</ul>
        `;
        container.appendChild(el);
    });

    if (sortedLocations.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-400 text-center p-4">No hay ubicaciones registradas.</p>';
    }
}

/**
 * Renderiza el lienzo con los elementos guardados en el estado.
 */
export async function loadSavedLayout() {
    const canvas = elements.layoutEditor.canvas;
    canvas.innerHTML = '';
    
    // Limpieza de memoria
    activeLayoutUrls.forEach(url => URL.revokeObjectURL(url));
    activeLayoutUrls = [];
    
    const layoutData = state.mapLayout[state.currentLayoutPage] || {};
    
    for (const id in layoutData) {
        if (layoutData.hasOwnProperty(id)) {
            const item = layoutData[id];
            let dataUrl = null;
            
            if (item.type === 'image' && item.imageId) {
                try {
                    const blob = await photoDB.getItem('layoutImages', item.imageId);
                    if (blob) {
                        dataUrl = URL.createObjectURL(blob);
                        activeLayoutUrls.push(dataUrl);
                    }
                } catch(e) { console.error('Error imagen croquis', e); }
            }
            createShapeOnCanvas(id, item.x, item.y, item.width, item.height, item.type, (item.text || ''), dataUrl, (item.rotation || 0), item.areaId);
        }
    }
}

/**
 * Crea un elemento DOM en el lienzo y le asigna eventos.
 */
export function createShapeOnCanvas(id, x, y, width, height, type = 'location', text = '', imageDataUrl = null, rotation = 0, areaId = null) {
    const canvas = elements.layoutEditor.canvas;
    if (canvas.querySelector(`[data-id="${id}"]`)) return; // Evitar duplicados
    
    const el = document.createElement('div');
    el.className = 'layout-shape layout-on-canvas';
    el.dataset.id = id;
    
    let innerHtml = '';
    let colorDotHtml = ''; 

    if (type === 'location') {
        // Buscar info actualizada de usuarios en esta ubicación
        const usersInLocData = state.resguardantes.filter(u => {
            if (u.locations) return u.locations.includes(id);
            return u.locationWithId === id;
        });

        if (usersInLocData.length === 0) return; // Si nadie la tiene, no la pintamos (o podríamos pintarla vacía)

        // Usar el areaId guardado o el del primer usuario encontrado
        const currentAreaId = areaId || usersInLocData[0].area;
        el.dataset.areaId = currentAreaId; 

        const usersList = usersInLocData.map(u => `<li>${u.name} (Área ${u.area})</li>`).join('');
        
        // Icono basado en nombre
        const baseMatch = id.match(/^(.*)\s\d+$/);
        const locationBase = baseMatch ? baseMatch[1] : id;
        
        const areaColor = getAreaColor(currentAreaId);
        colorDotHtml = `<div class="area-color-dot" style="background-color: ${areaColor};"></div>`;

        innerHtml = `<h5><i class="${getLocationIcon(locationBase)} location-icon"></i>${id}</h5><ul>${usersList}</ul>`;
    } 
    else if (type === 'tool') {
        el.classList.add('tool-shape');
        innerHtml = `<i class="fa-solid fa-arrow-up tool-icon"></i>`;
        width = width || 50; height = height || 50;
    }
    else if (type === 'note') {
        el.classList.add('tool-note');
        innerHtml = `<textarea class="layout-shape-note-textarea" placeholder="Nota...">${text}</textarea>`;
        width = width || 200; height = height || 100;
    }
    else if (type === 'text') {
        el.classList.add('tool-text');
        innerHtml = `<textarea class="layout-shape-text-textarea" placeholder="Texto...">${text}</textarea>`;
        width = width || 150; height = height || 40;
    }
    else if (type === 'image') {
        el.classList.add('tool-image');
        if (imageDataUrl) el.style.backgroundImage = `url(${imageDataUrl})`;
        else innerHtml = `<span>Imagen no encontrada</span>`;
        width = width || 300; height = height || 200;
    }

    // Aplicar estilos posicionales
    el.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
    if (width) el.style.width = `${width}px`;
    if (height) el.style.height = `${height}px`;
    
    // Guardar data attributes para Interact.js
    el.dataset.x = x;
    el.dataset.y = y;
    el.dataset.rotation = rotation; 
    el.dataset.type = type; 
    
    const controlsHtml = `
        <div class="layout-delete-btn" title="Eliminar"><i class="fa-solid fa-xmark"></i></div>
        <div class="layout-rotate-handle" title="Rotar"><i class="fa-solid fa-rotate-right"></i></div>
    `;
    
    el.innerHTML = colorDotHtml + innerHtml + controlsHtml;
    canvas.appendChild(el);
    
    // Listener para guardar texto al escribir
    if (type === 'note' || type === 'text') { 
        el.querySelector('textarea').addEventListener('input', debounce(saveLayoutPositions, 500));
    }
}

/**
 * Guarda el estado actual del DOM (posiciones, tamaños, rotación) en `state`.
 */
export function saveLayoutPositions() {
    const currentPageLayout = {};
    document.querySelectorAll('#layout-canvas .layout-on-canvas').forEach(el => {
        const id = el.dataset.id;
        const type = el.dataset.type;
        const x = parseFloat(el.dataset.x) || 0;
        const y = parseFloat(el.dataset.y) || 0;
        const rotation = parseFloat(el.dataset.rotation) || 0;
        const width = parseFloat(el.style.width);
        const height = parseFloat(el.style.height);
        
        const itemData = { x, y, width, height, type, rotation };

        if (type === 'note' || type === 'text') { 
            itemData.text = el.querySelector('textarea').value;
        }
        if (type === 'image') {
            itemData.imageId = state.layoutImages[id];
        }
        if (type === 'location') {
            itemData.areaId = el.dataset.areaId;
        }
        
        currentPageLayout[id] = itemData;
    });
    
    state.mapLayout[state.currentLayoutPage] = currentPageLayout;
}

// --- CONFIGURACIÓN DE LISTENERS ---

export function initLayoutListeners() {
    const { layoutEditor } = elements;

    // Abrir Modal
    layoutEditor.openBtn.addEventListener('click', () => {
        if(state.readOnlyMode) return showToast('Modo lectura activado.', 'warning');
        loadSavedLayout();
        populateLayoutSidebar();
        updatePaginationUI();
        layoutEditor.modal.classList.add('show');
        handleModalNavigation(layoutEditor.modal);
    });

    // Guardar
    layoutEditor.saveBtn.addEventListener('click', () => {
        if(state.readOnlyMode) return;
        saveLayoutPositions();
        saveState();
        showToast('Croquis guardado.');
    });

    // Cargar Imagen
    layoutEditor.addImageBtn.addEventListener('click', () => layoutEditor.imageInput.click());
    layoutEditor.imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            const dataUrl = event.target.result;
            const imageId = `img_${Date.now()}`;
            const shapeId = `image-${imageId}`;
            try {
                await photoDB.setItem('layoutImages', imageId, file);
                state.layoutImages[shapeId] = imageId;
                createShapeOnCanvas(shapeId, 50, 50, 300, 200, 'image', '', dataUrl);
                saveLayoutPositions();
            } catch (err) {
                showToast('Error al guardar imagen.', 'error');
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    });

    // Drag & Drop desde Sidebar al Canvas (Interact.js dropzone)
    setupInteract();

    // Eliminar elementos del lienzo
    layoutEditor.canvas.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.layout-delete-btn');
        if (!deleteBtn || state.readOnlyMode) return;

        const shape = deleteBtn.closest('.layout-on-canvas');
        if (shape) {
            const id = shape.dataset.id;
            const type = shape.dataset.type;
            
            shape.remove();
            
            // Si era ubicación, devolver a sidebar
            if (type === 'location') {
                const sidebarItem = document.querySelector(`.draggable-item[data-location-id="${id}"]`);
                if (sidebarItem) sidebarItem.classList.remove('hidden');
            }
            if (type === 'image') delete state.layoutImages[id];
            
            saveLayoutPositions();
        }
    });

    // Paginación
    layoutEditor.pageAdd.addEventListener('click', () => {
        saveLayoutPositions();
        const newKey = `page${Date.now()}`;
        state.layoutPageNames[newKey] = `Página ${Object.keys(state.layoutPageNames).length + 1}`;
        state.mapLayout[newKey] = {};
        state.currentLayoutPage = newKey;
        loadSavedLayout();
        populateLayoutSidebar();
        updatePaginationUI();
    });

    layoutEditor.pageRemove.addEventListener('click', () => {
        const keys = Object.keys(state.layoutPageNames);
        if (keys.length <= 1) return showToast('No se puede eliminar la única página.', 'warning');
        
        showConfirmationModal('Eliminar Página', '¿Seguro? Se perderá el diseño de esta página.', () => {
            delete state.mapLayout[state.currentLayoutPage];
            delete state.layoutPageNames[state.currentLayoutPage];
            const remaining = Object.keys(state.layoutPageNames);
            state.currentLayoutPage = remaining[0];
            loadSavedLayout();
            populateLayoutSidebar();
            updatePaginationUI();
        });
    });

    layoutEditor.pagePrev.addEventListener('click', () => navigatePage(-1));
    layoutEditor.pageNext.addEventListener('click', () => navigatePage(1));
    layoutEditor.pageName.addEventListener('change', (e) => {
        state.layoutPageNames[state.currentLayoutPage] = e.target.value;
        showToast('Nombre actualizado.');
    });
    layoutEditor.pageReset.addEventListener('click', () => {
        showConfirmationModal('Limpiar Lienzo', '¿Eliminar todo en esta página?', () => {
            state.mapLayout[state.currentLayoutPage] = {};
            loadSavedLayout();
            populateLayoutSidebar();
        });
    });
}

function navigatePage(direction) {
    saveLayoutPositions();
    const keys = Object.keys(state.layoutPageNames);
    const idx = keys.indexOf(state.currentLayoutPage);
    const newIdx = idx + direction;
    
    if (newIdx >= 0 && newIdx < keys.length) {
        state.currentLayoutPage = keys[newIdx];
        loadSavedLayout();
        populateLayoutSidebar();
        updatePaginationUI();
    }
}

function updatePaginationUI() {
    const { pageName, pagePrev, pageNext, pageRemove } = elements.layoutEditor;
    pageName.value = state.layoutPageNames[state.currentLayoutPage];
    
    const keys = Object.keys(state.layoutPageNames);
    const idx = keys.indexOf(state.currentLayoutPage);
    
    pagePrev.disabled = idx <= 0;
    pageNext.disabled = idx >= keys.length - 1;
    pageRemove.disabled = keys.length <= 1;
}

// --- INTERACT.JS SETUP ---

function setupInteract() {
    // Configuración global de Drag & Resize para elementos en el lienzo
    interact('.layout-on-canvas')
        .draggable({
            listeners: {
                move(event) {
                    if(state.readOnlyMode) return;
                    const target = event.target;
                    const x = (parseFloat(target.dataset.x) || 0) + event.dx;
                    const y = (parseFloat(target.dataset.y) || 0) + event.dy;
                    const rotation = (parseFloat(target.dataset.rotation) || 0);

                    target.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
                    target.dataset.x = x;
                    target.dataset.y = y;
                }
            },
            modifiers: [
                interact.modifiers.snap({
                    targets: [ interact.snappers.grid({ x: 10, y: 10 }) ],
                    range: Infinity,
                    relativePoints: [ { x: 0, y: 0 } ]
                })
            ]
        })
        .resizable({
            edges: { left: true, right: true, bottom: true, top: true },
            listeners: {
                move (event) {
                    if(state.readOnlyMode) return;
                    let target = event.target;
                    let x = (parseFloat(target.dataset.x) || 0);
                    let y = (parseFloat(target.dataset.y) || 0);
                    const rotation = (parseFloat(target.dataset.rotation) || 0);

                    target.style.width = event.rect.width + 'px';
                    target.style.height = event.rect.height + 'px';

                    x += event.deltaRect.left;
                    y += event.deltaRect.top;

                    target.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
                    target.dataset.x = x;
                    target.dataset.y = y;
                }
            },
            modifiers: [
                interact.modifiers.snap({ targets: [ interact.snappers.grid({ x: 10, y: 10 }) ] }),
                interact.modifiers.restrictSize({ min: { width: 30, height: 30 } })
            ]
        });

    // Zona de "Drop" (El lienzo acepta elementos de la sidebar)
    interact('#layout-canvas').dropzone({
        accept: '.draggable-item, .draggable-tool',
        ondrop: function(event) {
            if(state.readOnlyMode) return;
            const draggableElement = event.relatedTarget;
            const canvasWrapper = elements.layoutEditor.canvasWrapper;
            
            // Calcular posición relativa al scroll
            const canvasRect = canvasWrapper.getBoundingClientRect();
            const itemRect = draggableElement.getBoundingClientRect();
            
            const x = (itemRect.left - canvasRect.left) + canvasWrapper.scrollLeft;
            const y = (itemRect.top - canvasRect.top) + canvasWrapper.scrollTop;
            
            // Snap to grid manual
            const snappedX = Math.round(x / 10) * 10;
            const snappedY = Math.round(y / 10) * 10;
            
            if (draggableElement.classList.contains('draggable-item')) {
                // Es una ubicación real
                const locId = draggableElement.dataset.locationId;
                const areaId = draggableElement.dataset.areaId; 
                createShapeOnCanvas(locId, snappedX, snappedY, null, null, 'location', '', null, 0, areaId);
                draggableElement.classList.add('hidden'); // Ocultar de sidebar
            } 
            else if (draggableElement.classList.contains('draggable-tool')) {
                // Es una herramienta (nota, texto, flecha)
                const toolType = draggableElement.dataset.toolType;
                const toolId = `${toolType}-${Date.now()}`;
                
                if (toolType === 'note') createShapeOnCanvas(toolId, snappedX, snappedY, 200, 100, 'note');
                else if (toolType === 'arrow') createShapeOnCanvas(toolId, snappedX, snappedY, 50, 50, 'tool');
                else if (toolType === 'text') createShapeOnCanvas(toolId, snappedX, snappedY, 150, 40, 'text');
            }
            
            // Resetear posición del elemento arrastrado (se queda en sidebar)
            draggableElement.style.transform = 'none';
            draggableElement.dataset.x = 0;
            draggableElement.dataset.y = 0;
            
            saveLayoutPositions();
        }
    });

    // Arrastrar elementos de la sidebar (sin soltar aun)
    interact('.draggable-item, .draggable-tool').draggable({
        listeners: {
            move(event) {
                const target = event.target;
                const x = (parseFloat(target.dataset.x) || 0) + event.dx;
                const y = (parseFloat(target.dataset.y) || 0) + event.dy;
                target.style.transform = `translate(${x}px, ${y}px)`;
                target.dataset.x = x;
                target.dataset.y = y;
            }
        },
        inertia: true
    });

    // Control de Rotación (Handle azul)
    interact('.layout-rotate-handle').draggable({
        onmove: (event) => {
            if(state.readOnlyMode) return;
            const handle = event.target;
            const shape = handle.closest('.layout-on-canvas');
            if (!shape) return;

            const rect = shape.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const angle = Math.atan2(event.pageY - centerY, event.pageX - centerX) * (180 / Math.PI);
            
            let rotation = Math.round(angle + 90);
            rotation = Math.round(rotation / 15) * 15; // Snap a 15 grados

            const x = parseFloat(shape.dataset.x) || 0;
            const y = parseFloat(shape.dataset.y) || 0;

            shape.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
            shape.dataset.rotation = rotation;
        }
    });
}