/**
 * sw.js - Service Worker para Inventario Pro v8.0
 * Estrategia: Cache First (Primero Caché, luego Red)
 * Objetivo: Funcionar 100% Offline
 */

const CACHE_NAME = 'inventario-pro-v8-cache-v1';

// Lista de archivos requeridos para que la app funcione offline.
// IMPORTANTE: Si falta alguno de estos archivos en tu carpeta, la instalación fallará.
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './logo.png',
    
    // Estilos
    './css/styles.css',

    // Módulos JS
    './js/app.js',
    './js/auth.js',
    './js/db.js',
    './js/files.js',
    './js/inventory.js',
    './js/layout.js',
    './js/reports.js',
    './js/scanner.js',
    './js/state.js',
    './js/ui.js',
    './js/utils.js',

    // Librerías Externas (Deben existir físicamente en /libs)
    './libs/xlsx.full.min.js',
    './libs/qrcode.min.js',
    './libs/html5-qrcode.min.js',
    './libs/js/jszip.min.js', // Nota: Verifica si tu archivo es jszip.min.js o solo jszip.js
    './libs/interact.min.js'
];

// 1. INSTALACIÓN: Cachear todos los recursos estáticos
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');
    
    // Forzar al SW a activarse inmediatamente, sin esperar
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Cacheando archivos de la app');
            return cache.addAll(ASSETS_TO_CACHE);
        }).catch(err => {
            console.error('[Service Worker] Falló el cacheo inicial:', err);
        })
    );
});

// 2. ACTIVACIÓN: Limpiar cachés antiguos si se actualiza la versión
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activado');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Borrando caché antigua:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    
    // Tomar control de todos los clientes abiertos inmediatamente
    return self.clients.claim();
});

// 3. INTERCEPTAR PETICIONES (FETCH): Servir desde Caché
self.addEventListener('fetch', (event) => {
    // Solo manejar peticiones GET (no POST, PUT, etc.)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Si existe en caché, devolverlo
            if (cachedResponse) {
                return cachedResponse;
            }

            // Si no, intentar buscarlo en la red
            return fetch(event.request).catch(() => {
                // Si falla la red y no está en caché (ej: navegando offline a una ruta nueva)
                // Aquí podrías retornar una página offline genérica si quisieras.
                // Por ahora, solo retornamos error.
                console.warn('[Service Worker] Recurso no disponible offline:', event.request.url);
            });
        })
    );
});