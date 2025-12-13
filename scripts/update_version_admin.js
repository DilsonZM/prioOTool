// Actualiza la versión en Firestore usando firebase-admin.
// Requiere credenciales de service account.
// Opciones:
//  - Exporta GOOGLE_APPLICATION_CREDENTIALS=/ruta/serviceAccountKey.json
//  - O coloca el JSON fuera del repo y referencia la ruta aquí.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;

// Obtiene la credencial desde GOOGLE_APPLICATION_CREDENTIALS
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error('Falta GOOGLE_APPLICATION_CREDENTIALS apuntando al service account JSON.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function updateVersion() {
  try {
    console.log(`Actualizando versión en Firestore a ${version}...`);
    await db.doc('settings/app').set({
      version,
      forceUpdate: false,
      lastUpdated: new Date()
    }, { merge: true });
    console.log('¡Versión actualizada exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('Error actualizando la versión:', error);
    process.exit(1);
  }
}

updateVersion();
