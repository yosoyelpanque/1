/**
 * js/state.js
 * Gestión del Estado Global y Persistencia (LocalStorage).
 */

// Estado inicial por defecto
const defaultState = {
    loggedIn: false,
    currentUser: null,
    inventory: [],
    additionalItems: [],
    resguardantes: [],
    activeResguardante: null,
    locations: {},
    areas: [],
    areaNames: {},
    lastAutosave: null,
    sessionStartTime: null,
    additionalPhotos: {},
    locationPhotos: {},
    notes: {},
    photos: {}, // Mapa de booleanos para saber si un bien tiene foto
    theme: 'light',
    inventoryFinished: false,
    areaDirectory: {},
    closedAreas: {},
    completedAreas: {},
    persistentAreas: [],
    // Cachés de tiempo de ejecución (no se guardan tal cual en JSON)
    serialNumberCache: new Set(),
    cameraStream: null,
    readOnlyMode: false,
    activityLog: [],
    institutionalReportCheckboxes: {},
    actionCheckboxes: {
        labels: {},
        notes: {},
        additional: {},
        mismatched: {},
        personal: {}
    },
    reportCheckboxes: {
        notes: {},
        mismatched: {}
    },
    // Editor de Croquis
    mapLayout: { 'page1': {} },
    currentLayoutPage: 'page1',
    layoutPageNames: { 'page1': 'Página 1' },
    layoutImages: {},
    layoutPageColors: { 'page1': '#ffffff' },
    layoutItemColors: {}
};

// Objeto de estado reactivo (Singleton)
export let state = { ...defaultState };

/**
 * Reinicia el estado a sus valores por defecto (útil para logout o reset).
 * Mantiene el tema y el usuario si se especifica.
 */
export function resetState(keepUser = false) {
    const currentUser = state.currentUser;
    const currentTheme = state.theme;
    
    // Sobrescribir con defaults
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, defaultState);
    
    // Restaurar propiedades persistentes si es necesario
    state.theme = currentTheme;
    state.serialNumberCache = new Set(); // Reiniciar Set
    if (keepUser) {
        state.loggedIn = true;
        state.currentUser = currentUser;
        state.sessionStartTime = new Date().toISOString();
    }
}

/**
 * Recalcula el conteo de ubicaciones basado en los resguardantes actuales.
 * Normaliza nombres (ej: "OFICINA 1" -> "OFICINA").
 */
export function recalculateLocationCounts() {
    state.locations = {};
    
    state.resguardantes.forEach(user => {
        // Determinar qué ubicaciones procesar (Soporte legacy y nuevo array)
        let locsToProcess = [];
        if (user.locations && Array.isArray(user.locations) && user.locations.length > 0) {
            locsToProcess = user.locations;
        } else if (user.locationWithId) {
            locsToProcess = [user.locationWithId];
        }

        locsToProcess.forEach(locFull => {
            if (!locFull) return;

            // Regex robusta para separar Nombre base del ID numérico
            const baseMatch = locFull.match(/^(.*?)\s*(\d+)$/);
            
            let base;
            if (baseMatch) {
                base = baseMatch[1].trim().toUpperCase(); 
            } else {
                base = locFull.trim().toUpperCase();
            }

            state.locations[base] = (state.locations[base] || 0) + 1;
        });
    });
}

/**
 * Actualiza el caché de números de serie y claves para búsqueda rápida de duplicados.
 */
export function updateSerialNumberCache() {
    state.serialNumberCache.clear();
    
    // Cachear inventario principal
    state.inventory.forEach(item => {
        if (item.SERIE) state.serialNumberCache.add(String(item.SERIE).trim().toLowerCase());
        if (item['CLAVE UNICA']) state.serialNumberCache.add(String(item['CLAVE UNICA']).trim().toLowerCase());
    });
    
    // Cachear bienes adicionales
    state.additionalItems.forEach(item => {
        if (item.serie) state.serialNumberCache.add(String(item.serie).trim().toLowerCase());
        if (item.clave) state.serialNumberCache.add(String(item.clave).trim().toLowerCase());
        if (item.claveAsignada) state.serialNumberCache.add(String(item.claveAsignada).trim().toLowerCase());
    });
}

/**
 * Registra una acción en el log de actividad.
 */
export function logActivity(action, details = '') {
    const timestamp = new Date().toLocaleString('es-MX');
    const logEntry = `[${timestamp}] ${action}: ${details}`;
    
    state.activityLog.push(logEntry);

    // Optimización: Mantener solo los últimos 500 registros
    if (state.activityLog.length > 500) {
        state.activityLog = state.activityLog.slice(-500); 
    }
}

/**
 * Guarda el estado actual en LocalStorage.
 * Retorna { success: boolean, error: Error? }
 */
export function saveState() {
    if (state.readOnlyMode) return { success: false, error: 'Read Only Mode' };

    try {
        // Crear copia limpia para guardar (sin objetos complejos como Sets o Streams)
        const stateToSave = { ...state };
        delete stateToSave.serialNumberCache;
        delete stateToSave.cameraStream;
        
        localStorage.setItem('inventarioProState', JSON.stringify(stateToSave));
        state.lastAutosave = new Date();
        return { success: true };
    } catch (e) {
        console.error('Error Crítico al guardar el estado:', e);
        
        // Si falla el guardado (quota exceeded), activamos modo lectura
        state.readOnlyMode = true;
        return { success: false, error: e };
    }
}

/**
 * Carga el estado desde LocalStorage.
 * Retorna true si se cargó algo, false si está vacío.
 */
export function loadState() {
    try {
        const storedState = localStorage.getItem('inventarioProState');
        if (storedState) {
            const loaded = JSON.parse(storedState);
            
            // Fusión (Merge) del estado guardado con la estructura default 
            // (para asegurar compatibilidad si se agregan nuevos campos en actualizaciones)
            Object.assign(state, {
                ...defaultState,
                ...loaded,
                // Restaurar estructuras complejas si es necesario
                mapLayout: loaded.mapLayout || { 'page1': {} },
                currentLayoutPage: loaded.currentLayoutPage || 'page1',
                layoutPageNames: loaded.layoutPageNames || { 'page1': 'Página 1' }
            });

            // Reconstruir índices en memoria
            updateSerialNumberCache();
            recalculateLocationCounts();
            
            return true;
        }
    } catch (e) { 
        console.error('Error al cargar el estado:', e);
        // Si el estado está corrupto, limpiamos
        localStorage.removeItem('inventarioProState');
    }
    return false;
}