/**
 * js/auth.js
 * Gestión de Autenticación y Control de Sesiones.
 */

import { state, resetState, logActivity, saveState } from './state.js';
import { elements, showToast, showConfirmationModal, changeTab, updateTheme } from './ui.js';
import { photoDB } from './db.js';

// Lista de verificadores autorizados (Hardcoded para funcionamiento offline)
const verifiers = {
    '41290': 'BENÍTEZ HERNÁNDEZ MARIO',
    '41292': 'ESCAMILLA VILLEGAS BRYAN ANTONY',
    '41282': 'LÓPEZ QUINTANA ALDO',
    '41287': 'MARIN ESPINOSA MIGUEL',
    '41289': 'SANCHEZ ARELLANES RICARDO',
    '41293': 'EDSON OSNAR TORRES JIMENEZ',
    '15990': 'CHÁVEZ SÁNCHEZ ALFONSO',
    '17326': 'DOMÍNGUEZ VAZQUEZ FRANCISCO JAVIER',
    '11885': 'ESTRADA HERNÁNDEZ ROBERTO',
    '19328': 'LÓPEZ ESTRADA LEOPOLDO',
    '44925': 'MENDOZA SOLARES JOSE JUAN',
    '16990': 'PÉREZ RODRÍGUEZ DANIEL',
    '16000': 'PÉREZ YAÑEZ JUAN JOSE',
    '17812': 'RODRÍGUEZ RAMÍREZ RENE',
    '44095': 'LOPEZ JIMENEZ ALAN GABRIEL',
    '2875': 'VIZCAINO ROJAS ALVARO'
};

/**
 * Muestra la aplicación principal y oculta el login.
 * Se llama al iniciar sesión correctamente o al recargar con sesión activa.
 */
export function showMainApp() {
    elements.loginPage.classList.add('hidden');
    elements.mainApp.classList.remove('hidden');
    
    if (state.currentUser) {
        elements.currentUserDisplay.textContent = state.currentUser.name;
        elements.settings.summaryAuthor.value = state.currentUser.name;
    }

    updateTheme(state.theme);
    
    // Disparamos un evento personalizado para que otros módulos sepan que la app inició
    // (Útil para iniciar listeners, autosave, etc. en app.js)
    document.dispatchEvent(new CustomEvent('app:started'));
}

/**
 * Reinicia completamente el estado y la base de datos.
 * Se usa cuando un usuario diferente decide iniciar un nuevo inventario.
 */
async function resetInventoryState(newCurrentUser) {
    const theme = state.theme;

    // 1. UI Feedback
    elements.modals.loading.text.textContent = 'Reiniciando sistema...';
    elements.modals.loading.overlay.classList.add('show');

    try {
        // 2. Limpiar Base de Datos (IndexedDB)
        if (photoDB.db) {
            photoDB.db.close();
            photoDB.db = null;
        }

        await new Promise((resolve, reject) => {
            const req = indexedDB.deleteDatabase(photoDB.dbName);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e);
            req.onblocked = () => {
                console.warn("Borrado de DB bloqueado. Intentando continuar...");
                resolve(); 
            };
        });

        // 3. Reinicializar DB
        await photoDB.init();

        // 4. Resetear Estado en Memoria
        resetState(); // Limpia todo a default
        state.loggedIn = true;
        state.currentUser = newCurrentUser;
        state.theme = theme;
        state.sessionStartTime = new Date().toISOString();

        // 5. Guardar estado limpio
        saveState();
        
        showToast('Se ha iniciado un nuevo inventario.', 'info');
        logActivity('Sesión reiniciada', `Nuevo inventario iniciado por ${newCurrentUser.name}.`);
        
        // 6. Lanzar la App
        showMainApp();

        // Forzar recarga de UI en otros módulos (Inventory, Users)
        // Disparando evento de reset
        document.dispatchEvent(new CustomEvent('app:reset'));

    } catch (error) {
        console.error("Error crítico al reiniciar DB:", error);
        showToast('Error al limpiar base de datos. Se recomienda recargar (F5).', 'error');
        // Intentar continuar de todas formas
        state.loggedIn = true;
        state.currentUser = newCurrentUser;
        saveState();
        showMainApp();
    } finally {
        elements.modals.loading.overlay.classList.remove('show');
    }
}

/**
 * Maneja el clic en el botón "Ingresar".
 */
export function handleEmployeeLogin() {
    const employeeNumber = elements.employeeNumberInput.value.trim();
    const employeeName = verifiers[employeeNumber];
    
    if (employeeName) {
        const newCurrentUser = { number: employeeNumber, name: employeeName };

        // Caso: Ya hay una sesión iniciada pero es OTRO usuario
        if (state.loggedIn && state.currentUser && state.currentUser.number !== newCurrentUser.number) {
             showConfirmationModal(
                'Cambio de Usuario',
                `Actualmente hay un inventario en progreso de ${state.currentUser.name}. \n\n¿Deseas CONTINUAR con ese inventario (asumiendo su identidad) o INICIAR UNO NUEVO (borrando datos)?`,
                // Confirmar: Continuar sesión existente
                () => {
                    logActivity('Cambio de usuario', `Sesión continuada por ${employeeName} (Relevo).`);
                    state.currentUser = newCurrentUser;
                    showToast(`Bienvenido, ${employeeName}. Continuando sesión.`);
                    saveState();
                    showMainApp();
                },
                // Opciones extra para el modal
                { 
                    confirmText: 'Continuar existente', 
                    cancelText: 'Iniciar Nuevo',
                    onCancel: () => {
                         // Callback específico para "Iniciar Nuevo"
                         // Nota: showConfirmationModal llama a onCancel al cerrar, 
                         // aquí asumimos que el botón secundario dispara una lógica distinta.
                         // En la implementación de UI.js, onCancel es el botón "Cancelar".
                         // Vamos a adaptar la lógica:
                         // El modal de UI.js es simple (Confirm/Cancel).
                         // Para este flujo crítico, usaremos el Confirm para "Continuar" y 
                         // interceptaremos el Cancel para preguntar si quiere borrar.
                         
                         // RE-IMPLEMENTACIÓN DE FLUJO PARA EVITAR CONFUSIÓN:
                         // Mejor mostramos un segundo modal si cancela el primero no es viable UX.
                         // Modificamos la llamada para usar una lógica más directa:
                         
                         // Hack para reutilizar el modal simple:
                         // Confirm -> Continuar Sesión
                         // Cancel -> Iniciar Nuevo (Borrar)
                         
                         // Realmente necesitamos confirmar el borrado.
                         setTimeout(() => {
                             showConfirmationModal(
                                 '¿Borrar inventario actual?',
                                 'Has elegido NO continuar la sesión anterior. Esto BORRARÁ permanentemente todos los datos actuales para iniciar de cero. ¿Estás seguro?',
                                 () => resetInventoryState(newCurrentUser), // Confirmar borrado
                                 { confirmText: 'Sí, Borrar e Iniciar', cancelText: 'Cancelar ingreso' }
                             );
                         }, 300);
                    }
                }
            );
        } else {
            // Caso: Login normal (primera vez o mismo usuario)
            state.loggedIn = true;
            state.currentUser = newCurrentUser;
            
            if (!state.sessionStartTime) {
                state.sessionStartTime = new Date().toISOString();
                logActivity('Inicio de sesión', `Usuario ${employeeName} ha iniciado sesión.`);
            } else {
                logActivity('Reanudación de sesión', `Usuario ${employeeName} ha reanudado la sesión.`);
            }
            
            showToast(`Bienvenido, ${employeeName}`);
            saveState();
            showMainApp();
        }

    } else {
        showToast('Número de empleado no válido o no autorizado.', 'error');
    }
    elements.employeeNumberInput.value = '';
}

/**
 * Cierra la sesión actual (sin borrar datos).
 */
export function logout() {
    if(state.currentUser) {
        logActivity('Cierre de sesión', `Usuario ${state.currentUser.name} ha salido.`);
    }
    saveState();
    elements.mainApp.classList.add('hidden');
    elements.loginPage.classList.remove('hidden');
}