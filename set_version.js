import { db } from './js/modules/firebase-init.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

async function setVersion() {
  console.log('Setting version to 2.0.8...');
  try {
    await setDoc(doc(db, 'settings', 'app'), { version: '2.0.8' }, { merge: true });
    console.log('Version set successfully!');
  } catch (e) {
    console.error('Error setting version:', e);
  }
}

setVersion();
