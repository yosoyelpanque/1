/**
 * js/scanner.js
 * Gestión de Cámara y Escáner QR.
 */

import { state, logActivity, saveState } from './state.js';
import { elements, showToast, changeTab } from './ui.js';
import { filterAndRenderInventory } from './inventory.js';
import { photoDB } from './db.js';

// Variable local para la instancia del escáner
let html5QrCode = null;

// --- ESCÁNER DE CÓDIGOS QR ---

export async function startQrScanner() {
    if (state.readOnlyMode) return showToast('Modo lectura: Escáner desactivado.', 'warning');
    
    const { modal, reader } = elements.modals.qrScanner;
    modal.classList.add('show');

    // Limpieza preventiva
    if (html5QrCode && html5QrCode.isScanning) {
        await html5QrCode.stop();
    }

    // Inicializar librería
    html5QrCode = new Html5Qrcode("qr-reader");

    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        stopQrScanner();
        
        // Acción al encontrar código
        elements.inventory.searchInput.value = decodedText;
        filterAndRenderInventory(); // Filtrar inventario
        changeTab('inventory'); // Asegurar que estamos en la pestaña correcta
        
        showToast(`Bien con clave ${decodedText} encontrado.`);
        logActivity('Escaneo QR', `Se encontró la clave: ${decodedText}.`);
    };

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    // Iniciar escaneo (Cámara trasera por defecto)
    html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        qrCodeSuccessCallback
    ).catch(err => {
        console.error("Error al iniciar escáner QR:", err);
        showToast('Error al iniciar la cámara. Revisa los permisos.', 'error');
        stopQrScanner();
    });
}

export function stopQrScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            elements.modals.qrScanner.modal.classList.remove('show');
        }).catch(err => {
            console.error("Error al detener escáner:", err);
            elements.modals.qrScanner.modal.classList.remove('show');
        });
    } else {
        elements.modals.qrScanner.modal.classList.remove('show');
    }
}

// --- CÁMARA PARA FOTOS DE EVIDENCIA ---

export async function startCamera() {
    if (state.readOnlyMode) return showToast('Modo lectura: Cámara desactivada.', 'warning');
    
    const { cameraStream: videoEl, uploadContainer, cameraViewContainer } = elements.modals.photo;
    
    stopCamera(); // Detener stream anterior si existe

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const constraints = {
                video: { 
                    facingMode: "environment" // Cámara trasera
                }
            };
            
            // Solicitar acceso
            state.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoEl.srcObject = state.cameraStream;
            
            // Actualizar UI
            uploadContainer.classList.add('hidden');
            cameraViewContainer.classList.remove('hidden');
            
        } catch (err) {
            console.error("Error al acceder a la cámara:", err);
            showToast('No se pudo acceder a la cámara. Revisa permisos o usa HTTPS.', 'error');
        }
    } else {
        showToast('Tu navegador no soporta acceso directo a la cámara.', 'error');
    }
}

export function stopCamera() {
    if (state.cameraStream) {
        state.cameraStream.getTracks().forEach(track => track.stop());
        state.cameraStream = null;
    }
}

export function capturePhoto(type, id) {
    const { cameraStream: videoEl, photoCanvas, modal, input } = elements.modals.photo;
    
    if (!state.cameraStream) return;

    // Configurar canvas al tamaño del video
    const context = photoCanvas.getContext('2d');
    photoCanvas.width = videoEl.videoWidth;
    photoCanvas.height = videoEl.videoHeight;
    
    // Dibujar frame actual
    context.drawImage(videoEl, 0, 0, photoCanvas.width, photoCanvas.height);
    
    // Convertir a Blob (JPG calidad 0.9)
    photoCanvas.toBlob(blob => {
        if (blob) {
            if (blob.size > 5 * 1024 * 1024) { // Límite 5MB
                return showToast('La imagen es demasiado grande.', 'error');
            }

            // Guardar en IndexedDB
            const key = `${type}-${id}`;
            photoDB.setItem('photos', key, blob).then(() => {
                // Actualizar estado en memoria para reflejar que ya tiene foto
                if (type === 'inventory') state.photos[id] = true;
                if (type === 'additional') state.additionalPhotos[id] = true;
                if (type === 'location') state.locationPhotos[id] = true;

                logActivity('Foto capturada', `Tipo: ${type}, ID: ${id}`);
                showToast('Foto guardada correctamente.');
                
                // Limpieza UI
                modal.classList.remove('show');
                stopCamera();
                saveState();
                
                // Disparar evento para actualizar iconos en tablas
                document.dispatchEvent(new CustomEvent('photo:updated', { detail: { type, id } }));

            }).catch(err => {
                console.error('Error guardando foto en DB:', err);
                showToast('Error al guardar la foto en la base de datos.', 'error');
            });
        }
    }, 'image/jpeg', 0.90);
}