const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyBHspARYHlx6GdPz7PKI6Ig_w9rL5tveMI',
  authDomain: 'priootool.firebaseapp.com',
  projectId: 'priootool',
  storageBucket: 'priootool.firebasestorage.app',
  messagingSenderId: '886571452258',
  appId: '1:886571452258:web:f70f55df100a62ee634e3b',
  measurementId: 'G-T65CQ9D0BM'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateVersion() {
  try {
    console.log('Actualizando versión en Firestore a 3.0.5 (V Final)...');
    await setDoc(doc(db, 'settings', 'app'), {
      version: '3.0.5',
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
