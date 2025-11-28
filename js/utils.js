/**
 * js/utils.js
 * Funciones de utilidad general y helpers puros.
 */

// Generador de identificadores únicos (UUID v4)
export function generateUUID() {
    if (crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Sanitización de HTML para prevenir ataques XSS (Cross-Site Scripting)
export function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Función Debounce para optimizar eventos repetitivos (ej: búsqueda en tiempo real)
export function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

// Obtener fecha local en formato dd/mm/aaaa
export function getLocalDate() {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); 
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Helper para resaltar texto de búsqueda en resultados
export function highlightText(text, searchTerm) {
    if (!searchTerm || !searchTerm.trim() || !text) {
        return text; // Devolver texto original si no hay búsqueda
    }
    // Escapar caracteres especiales de regex en el término de búsqueda
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    
    // Aquí NO usamos escapeHTML porque asumimos que el input 'text' ya viene limpio o se limpiará al renderizar
    // pero el <mark> debe ser HTML válido.
    return String(text).replace(regex, `<mark class="bg-yellow-300 rounded-sm px-1">$1</mark>`);
}

// Truncar texto largo
export function truncateString(str, len) {
    if (str && String(str).length > len) {
        return String(str).substring(0, len) + '...';
    }
    return str || '';
}