# 1. Prepara todos los archivos modificados
git add .

# 2. Crea el commit con el mensaje de la nueva versión (cambia v3.0.X por tu versión)
git commit -m "Actualización a versión v3.0.X"

# 3. Sube los cambios a GitHub (Esto actualiza GitHub Pages automáticamente)
git push origin main

# 4. Vincula la carpeta con tu proyecto de Firebase en la nube
# (En la lista selecciona 'priootool' y cuando pida alias escribe 'priootool' o 'default')
npx firebase use --add

# 5. Sube los archivos a Firebase Hosting guardando el registro de la versión
npx firebase deploy --only hosting -m "v3.0.X"


Markdown
# 🚀 PrioOTool

**PrioOTool** es una Aplicación Web Progresiva (PWA) diseñada para facilitar la evaluación, cálculo y asignación de prioridades a las Órdenes de Trabajo (OT). La herramienta permite estandarizar los criterios de criticidad y severidad, mejorando la toma de decisiones en la gestión de mantenimiento y soporte.

![Versión](https://img.shields.io/badge/Versión-Dinámica-blue.svg)
![Firebase](https://img.shields.io/badge/Firebase-Hosting%20|%20Firestore%20|%20Auth-FFCA28.svg)
![PWA](https://img.shields.io/badge/PWA-Ready-success.svg)

---

## ✨ Características Principales

- **Cálculo de Prioridades:** Interfaz dinámica para la matriz de riesgos y asignación de prioridad (basado en criterios de severidad configurables).
- **Historial de Evaluaciones:** Registro en tiempo real de las OTs evaluadas.
- **Autenticación Segura:** Sistema de login integrado con Firebase Auth.
- **PWA (Progressive Web App):** Soporte de instalación en dispositivos móviles y de escritorio, con Service Worker (`sw.js`) para optimización de caché.
- **Base de Datos en Tiempo Real:** Integración con Cloud Firestore y reglas de seguridad personalizadas (`firestore.rules`).
- **Control Automático de Versiones:** Scripts integrados en Node.js para mantener la versión de la app sincronizada entre el código y la base de datos.

---

## 🛠️ Tecnologías y Arquitectura

- **Frontend:** HTML5, CSS3 (Modularizado), Vanilla JavaScript (ES6 Modules).
- **Backend as a Service (BaaS):** Firebase (Hosting, Firestore, Cloud Functions).
- **Automatización:** Node.js (Scripts de despliegue y versionamiento).

### 📁 Estructura del Proyecto

```text
PrioOTool/
├── assets/                  # Imágenes, logos y SVG de la matriz de prioridad
├── css/                     # Estilos modulares (historial, selects, severidad, etc.)
├── js/                      # Lógica principal del frontend
│   ├── modules/             # JS dividido por módulos (auth, ui, main, firebase)
│   └── script.js            # Punto de entrada principal
├── functions/               # Cloud Functions de Firebase (Node.js)
├── scripts/                 # Scripts administrativos y sincronización de versiones
├── .gitignore               # Archivos ignorados por Git
├── firebase.json            # Configuración de los servicios de Firebase
├── firestore.rules          # Reglas de seguridad de la base de datos
├── manifest.json            # Configuración para la PWA
├── package.json             # Dependencias del proyecto y scripts de Node
├── sw.js                    # Service Worker para funcionalidades offline
└── index.html               # Interfaz principal de la aplicación
💻 Instalación y Configuración Local
Si eres un desarrollador y deseas correr este proyecto de manera local, sigue estos pasos:

1. Requisitos Previos
Instalar Node.js.

Instalar Git.

Tener permisos de acceso al proyecto en Firebase.

2. Clonar e Instalar
Bash
# Clonar el repositorio
git clone [https://github.com/DilsonZM/prioOTool.git](https://github.com/DilsonZM/prioOTool.git)

# Entrar a la carpeta del proyecto
cd prioOTool

# Instalar dependencias globales (si es necesario)
npm install -g firebase-tools

# Instalar dependencias del proyecto (scripts y funciones)
npm install
cd functions && npm install && cd ..
3. Ejecución Local (Emuladores)
Para probar la aplicación localmente sin afectar la base de datos de producción:

Bash
npx firebase login
npx firebase serve
# O si usas emuladores completos:
# npx firebase emulators:start
🔄 Versionamiento Automático
El proyecto cuenta con scripts personalizados para el control de versiones (ej. update_version_node.js, sync-version.js).
Antes de un despliegue importante a producción, puedes ejecutar la actualización de versión mediante Node:

Bash
node update_version_node.js
🚀 Guía de Actualización y Despliegue (Producción)
Cuando el código esté listo para enviarse a los usuarios finales, ejecuta estos comandos paso a paso para actualizar tanto el repositorio como los servidores.

Bash
# 1. Prepara todos los archivos modificados
git add .

# 2. Crea el commit con el mensaje de la nueva versión (cambia v3.0.X)
git commit -m "Actualización a versión v3.0.X"

# 3. Sube los cambios a GitHub (Esto actualiza GitHub Pages automáticamente)
git push origin main

# 4. Vincula la carpeta con el proyecto de Firebase
# (En la lista selecciona 'priootool' y cuando pida alias escribe 'default')
npx firebase use --add

# 5. Sube los archivos a Firebase Hosting guardando el registro de la versión
npx firebase deploy --only hosting -m "v3.0.X"
Nota: Si también modificaste las Reglas de Firestore o las Cloud Functions, elimina el --only hosting del paso 5 o especifica las áreas a desplegar (ej. --only hosting,firestore:rules).

👨‍💻 Autor
Desarrollado y mantenido por DilsonZM.


### ¿Por qué este README es excelente para tu proyecto?
1. **Es descriptivo:** Alguien que vea tu GitHub entenderá inmediatamente que es una PWA para gestionar Órdenes de Trabajo (OT) y su prioridad.
2. **Estructura visual del código:** Muestra un árbol de carpetas basado exactamente en los archivos que subiste al repo (`css/severity-colors.css`, `js/modules/`, `manifest.json`, etc.). Esto ayuda a otros programadores a orientarse rápidamente.
3. **Explica tus scripts particulares:** Menciona tus archivos `update_version_node.js` y `sync-version.js`, dándoles contexto.
4. **Mantiene tu caja mágica de despliegue:** La sección de actualización que te gustó sigue estando ahí, intacta y en un solo bloque al final, lista para copiar y pegar.