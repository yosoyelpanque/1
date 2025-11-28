/**
 * js/db.js
 * Capa de abstracción para IndexedDB.
 * Maneja el almacenamiento de objetos binarios grandes (Blobs) como fotografías.
 */

export const photoDB = {
    db: null,
    dbName: 'InventarioProPhotosDB',
    version: 2, // Incrementado para incluir store de layoutImages

    // Inicializar conexión
    init: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Almacén para fotos de bienes (Inventario y Adicionales)
                if (!db.objectStoreNames.contains('photos')) {
                    db.createObjectStore('photos');
                }
                // Almacén para imágenes del editor de croquis
                if (!db.objectStoreNames.contains('layoutImages')) {
                    db.createObjectStore('layoutImages');
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                // Manejar cierre inesperado (ej: otra pestaña actualiza versión)
                this.db.onversionchange = () => {
                    this.db.close();
                    console.warn('La base de datos se cerró por un cambio de versión en otra pestaña.');
                };
                resolve();
            };

            request.onerror = (event) => {
                console.error('Error con IndexedDB:', event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
    },

    // Guardar un item (blob/file)
    setItem: function(storeName, key, value) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(value, key);

                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            } catch (e) {
                reject(e);
            }
        });
    },

    // Obtener un item
    getItem: function(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);

                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            } catch (e) {
                reject(e);
            }
        });
    },

    // Eliminar un item
    deleteItem: function(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(key);

                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            } catch (e) {
                reject(e);
            }
        });
    },

    // Obtener todos los items (Usado para exportar backups .zip)
    getAllItems: function(storeName) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const keysRequest = store.getAllKeys();
                const valuesRequest = store.getAll();

                Promise.all([
                    new Promise((res, rej) => { 
                        keysRequest.onsuccess = () => res(keysRequest.result); 
                        keysRequest.onerror = (e) => rej(e.target.error); 
                    }),
                    new Promise((res, rej) => { 
                        valuesRequest.onsuccess = () => res(valuesRequest.result); 
                        valuesRequest.onerror = (e) => rej(e.target.error); 
                    })
                ]).then(([keys, values]) => {
                    // Combinar llaves y valores en un array de objetos
                    const result = keys.map((key, index) => ({ key, value: values[index] }));
                    resolve(result);
                }).catch(reject);
            } catch (e) {
                reject(e);
            }
        });
    }
};

// Helper para eliminar la base de datos completa (Reset de fábrica)
export function deleteDB(dbName) {
    return new Promise((resolve, reject) => {
        // Cerrar conexiones abiertas primero si existen
        if (photoDB.db) {
            photoDB.db.close();
        }

        const request = indexedDB.deleteDatabase(dbName);
        
        request.onsuccess = () => resolve();
        
        request.onerror = (event) => reject(event.target.error);
        
        request.onblocked = () => {
            console.warn('La eliminación de IndexedDB fue bloqueada. Cierre otras pestañas.');
            // Intentamos resolver de todas formas, el navegador intentará borrar cuando se desbloquee
            resolve(); 
        };
    });
}