# Inventario Pro v8.0 (PWA Modular)

Sistema de gestión de inventario físico y activos fijos, diseñado como una **Progressive Web App (PWA)**. Esta versión es modular, no requiere instalación de servidores (Node.js/Python) y puede ejecutarse 100% offline una vez instalada.

## 🚀 Características Principales

* **100% Offline:** Funciona sin internet gracias al Service Worker y caché local.
* **Gestión de Inventario:** Altas, bajas, cambios y re-etiquetado.
* **Conciliación Inteligente:** Comparación automática contra nuevos listados de Excel.
* **Evidencia Fotográfica:** Captura y almacenamiento de fotos en base de datos local (IndexedDB).
* **Croquis Interactivo:** Editor visual para ubicar bienes en un plano.
* **Reportes PDF y Excel:** Generación de actas de resguardo, etiquetas y reportes masivos.
* **Escáner QR:** Integrado para cámara de dispositivos móviles.

## 📂 Estructura del Proyecto

```text
/inventario-pro
│
├── index.html           # Punto de entrada de la aplicación
├── manifest.json        # Configuración de instalación PWA (Iconos, nombre, color)
├── sw.js                # Service Worker (Motor Offline)
├── logo.png             # Logotipo de la aplicación (Requerido para instalar)
├── README.md            # Documentación del proyecto
│
├── /css
│   └── styles.css       # Estilos personalizados (Tailwind + Custom CSS)
│
├── /js                  # Lógica Modular (ES6 Modules)
│   ├── app.js           # Orquestador principal
│   ├── auth.js          # Autenticación y control de sesión
│   ├── db.js            # Base de datos (IndexedDB) para fotos
│   ├── files.js         # Importación/Exportación (Excel, ZIP)
│   ├── inventory.js     # Lógica de negocio del inventario
│   ├── layout.js        # Editor de croquis (Interact.js)
│   ├── reports.js       # Generación de reportes e impresión
│   ├── scanner.js       # Control de cámara y QR
│   ├── state.js         # Estado global y persistencia (LocalStorage)
│   ├── ui.js            # Manejo del DOM y componentes visuales
│   └── utils.js         # Funciones auxiliares
│
└── /libs                # Dependencias externas (Offline)
    ├── xlsx.full.min.js
    ├── qrcode.min.js
    ├── html5-qrcode.min.js
    ├── jszip.min.js
    └── interact.min.js