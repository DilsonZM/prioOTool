import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const cfg = window.PRIO_FIREBASE_CONFIG;
if (!cfg) {
  console.error('Falta window.PRIO_FIREBASE_CONFIG. Edita js/firebase-config.js con las credenciales reales.');
}

const app = cfg ? initializeApp(cfg) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

export { app, auth, db, cfg, initializeApp, deleteApp };
