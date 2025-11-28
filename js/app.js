/**
 * js/app.js
 * Punto de entrada principal. Orquesta la inicialización y conecta los módulos.
 */

import { state, loadState, saveState, recalculateLocationCounts, startAutosave, resetState } from './state.js';
import { elements, showToast, updateTheme, changeTab, handleModalNavigation, showMainApp as uiShowMainApp, showConfirmationModal } from './ui.js';
import { photoDB } from './db.js';
import { handleEmployeeLogin, showMainApp } from './auth.js';
import { initInventoryListeners, filterAndRenderInventory } from './inventory.js';
import { initLayoutListeners } from './layout.js';
import { processFile } from './files.js';
import { importSession } from './files.js';

// --- INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Iniciar Base de Datos
        await photoDB.init();
        console.log('DB Fotos inicializada');

        // 2. Cargar Estado
        if (loadState()) {
            recalculateLocationCounts();
            if (state.loggedIn) {
                showMainApp(); // De auth.js
            } else {
                elements.loginPage.classList.remove('hidden');
                elements.mainApp.classList.add('hidden');
            }
        } else {
            elements.loginPage.classList.remove('hidden');
            elements.mainApp.classList.add('hidden');
        }

        // 3. Inicializar Listeners de Módulos Específicos
        initInventoryListeners();
        initLayoutListeners();
        
        // 4. Iniciar Autosave
        startAutosave();

        // 5. Configurar Listeners Globales (App.js)
        setupGlobalListeners();

    } catch (err) {
        console.error('Error fatal al iniciar la aplicación:', err);
        showToast('Error al iniciar la aplicación. Revisa la consola.', 'error');
    }
});

// --- LISTENERS GLOBALES ---

function setupGlobalListeners() {
    // Login
    elements.employeeLoginBtn.addEventListener('click', handleEmployeeLogin);
    elements.employeeNumberInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleEmployeeLogin();
        }
    });

    // Dashboard Toggle
    elements.dashboard.toggleBtn.addEventListener('click', () => {
        elements.dashboard.headerAndDashboard.classList.toggle('hidden');
        const icon = elements.dashboard.toggleBtn.querySelector('i');
        icon.classList.toggle('fa-chevron-up');
        icon.classList.toggle('fa-chevron-down'); // Feedback visual simple
    });

    // Navegación por Pestañas
    elements.tabsContainer.addEventListener('click', e => {
        const tabBtn = e.target.closest('.tab-btn');
        if (tabBtn && tabBtn.dataset.tab) {
            changeTab(tabBtn.dataset.tab);
        }
    });

    // Carga de Archivos (Excel Principal)
    elements.uploadBtn.addEventListener('click', () => {
        elements.fileInput.value = ''; 
        elements.fileInput.click();
    });
    elements.fileInput.addEventListener('change', (e) => {
        [...e.target.files].forEach(file => processFile(file));
        e.target.value = '';
    });

    // Importar Sesión (.zip) desde Ajustes
    elements.settings.importSessionBtn.addEventListener('click', () => elements.settings.importFileInput.click());
    elements.settings.importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) importSession(file);
        e.target.value = '';
    });

    // Cambiar Tema
    elements.settings.themes.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            state.theme = theme;
            updateTheme(theme);
            saveState();
        });
    });

    // Limpiar Sesión (Botón de emergencia en Login)
    elements.clearSessionLink.addEventListener('click', (e) => {
        e.preventDefault();
        showConfirmationModal('Limpiar Sesión Completa', 'Esto borrará TODO el progreso, incluyendo usuarios e inventario guardado en este navegador. ¿Estás seguro?', async () => {
            localStorage.removeItem('inventarioProState');
            // Intentar borrar DB
            if (photoDB.db) photoDB.db.close();
            const req = indexedDB.deleteDatabase('InventarioProPhotosDB');
            req.onsuccess = () => window.location.reload();
            req.onerror = () => window.location.reload();
            req.onblocked = () => window.location.reload();
        });
    });

    // Protección de Cierre (Prevent Close)
    window.addEventListener('beforeunload', (event) => {
        if (state.loggedIn && !state.readOnlyMode) {
            event.preventDefault();
            event.returnValue = ''; // Estándar moderno
        }
    });

    // --- EVENTOS PERSONALIZADOS (Comunicación entre módulos) ---
    
    // Al abrir detalle desde inventario (Búsqueda exacta)
    document.addEventListener('inventory:open-detail', (e) => {
        // Importación dinámica circular o uso de UI global
        // En este caso, ui.js exporta showItemDetailView, pero necesitamos lógica
        // Vamos a simular un click en la fila para abrir el modal correctamente
        const clave = e.detail.clave;
        const row = document.querySelector(`tr[data-clave="${clave}"]`);
        if (row) row.click();
    });

    // Al actualizar inventario (Refrescar Dashboard)
    document.addEventListener('inventory:updated', () => {
        // Actualizar contadores visuales si es necesario
        // renderDashboard() está en ui.js o se llama desde inventory.js
        // Por ahora inventory.js maneja la tabla, pero podemos actualizar stats aquí
        renderDashboardStats();
    });

    document.addEventListener('data:imported', () => {
        filterAndRenderInventory();
        renderDashboardStats();
    });
}

// Función auxiliar para actualizar los números del Dashboard
// (Se ha movido aquí para centralizar la actualización de stats globales)
function renderDashboardStats() {
    const totalItems = state.inventory.length;
    const locatedItems = state.inventory.filter(item => item.UBICADO === 'SI').length;
    
    // Contar progreso diario
    const todayStr = new Date().toISOString().slice(0, 10);
    const dailyInv = state.inventory.filter(i => i.fechaUbicado && i.fechaUbicado.startsWith(todayStr)).length;
    const dailyAdd = state.additionalItems.filter(i => i.fechaRegistro && i.fechaRegistro.startsWith(todayStr)).length;

    elements.stats.totalItems.textContent = totalItems;
    elements.stats.locatedItems.textContent = locatedItems;
    elements.stats.pendingItems.textContent = totalItems - locatedItems;
    elements.stats.dailyProgress.textContent = dailyInv + dailyAdd;
    elements.stats.workingAreas.textContent = new Set(state.inventory.map(i => i.areaOriginal)).size;
    elements.stats.additionalCount.textContent = state.additionalItems.length;
}