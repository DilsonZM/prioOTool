import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  updateProfile,
  updatePassword,
  sendEmailVerification,
  deleteUser,
  onAuthStateChanged,
  getAuth,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { auth, db, cfg, initializeApp, deleteApp } from './firebase-init.js';

function isSuperAdmin(roles = []) {
  return roles.includes('superadmin') || roles.includes('admin');
}

function isSupervisor(roles = []) {
  return roles.includes('supervisor');
}

function canAccessAdmin(roles = [], approved) {
  if (!approved) return false;
  return isSuperAdmin(roles) || isSupervisor(roles);
}

async function ensureUserDoc(user) {
  if (!db || !user) return null;
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  
  // --- MIGRATION: Update password for existing Cerrejon users ---
  const email = user.email || '';
  const isCerrejon = email.toLowerCase().endsWith('@cerrejon.com');
  if (isCerrejon) {
    const SHARED_SECRET = 'PriOTool.Cerrejon.Access.2025!';
    try {
      // We can only update password if the user has re-authenticated recently.
      // Since this runs after login (Magic Link or Password), it should be fine.
      // We don't check if it's already set because we can't read the password.
      // We just try to set it.
      await updatePassword(user, SHARED_SECRET);
      console.log('Contraseña corporativa sincronizada.');
    } catch (e) {
      // Ignore error (e.g. requires-recent-login)
      console.log('No se pudo sincronizar contraseña (puede requerir relogin):', e.code);
    }
  }
  // -------------------------------------------------------------

  if (!snap.exists()) {
    // Auto-configure Cerrejon users on first login
    
    let userData = {
      uid: user.uid,
      email: email,
      displayName: user.displayName || null,
      approved: false,
      roles: ['solicitado'],
      createdAt: serverTimestamp(),
      createdBy: 'auto-sync'
    };

    if (isCerrejon) {
      const prefix = email.split('@')[0];
      const name = prefix.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      userData.displayName = name;
      userData.company = 'Cerrejón';
      userData.approved = true;
      userData.roles = ['empleado'];
      userData.requestedRole = 'empleado';
      console.log('Auto-creando perfil Cerrejón:', userData);
    }

    await setDoc(ref, userData);
    return userData;
  }
  return snap.data();
}

async function ensureRoleSync(user, data) {
  if (!db || !user || !data) return data;
  const roles = Array.isArray(data.roles) ? data.roles : [];
  const needsUpgrade = data.approved && roles.includes('solicitado') && data.requestedRole;
  if (!needsUpgrade) {
    return data;
  }
  const newRoles = [data.requestedRole];
  try {
    await updateDoc(doc(db, 'users', user.uid), { roles: newRoles });
    return { ...data, roles: newRoles };
  } catch (err) {
    console.warn('No se pudo actualizar los roles', err);
    return data;
  }
}

async function fetchRequests(profile, currentRoles = []) {
  if (!db) return [];
  const filters = [];
  const superAdmin = isSuperAdmin(currentRoles);
  const supervisor = isSupervisor(currentRoles);
  let postFilterCompanies = null;
  if (!superAdmin && supervisor) {
    const supervisedCompanies = Array.isArray(profile?.supervisedCompanies)
      ? profile.supervisedCompanies.filter(Boolean)
      : [];
    if (supervisedCompanies.length && supervisedCompanies.length <= 10) {
      filters.push(where('company', 'in', supervisedCompanies));
    } else if (profile?.company) {
      filters.push(where('company', '==', profile.company));
    } else if (supervisedCompanies.length > 10) {
      // Demasiados valores para un "in"; filtramos en cliente
      postFilterCompanies = supervisedCompanies;
    }
  }

  const colRef = collection(db, 'users');
  const q = filters.length ? query(colRef, ...filters) : colRef;
  const snap = await getDocs(q);
  let rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (postFilterCompanies && postFilterCompanies.length) {
    rows = rows.filter(r => postFilterCompanies.includes(r.company));
  }

  return rows;
}

async function approveRequestDoc(id, requestedRole = 'usuario') {
  if (!db) return;
  await updateDoc(doc(db, 'users', id), {
    approved: true,
    roles: [requestedRole || 'usuario']
  });
}

async function revokeAccessDoc(id) {
  if (!db) return;
  await updateDoc(doc(db, 'users', id), {
    approved: false,
    roles: ['solicitado']
  });
}

async function deleteRequestDoc(id) {
  if (!db) return;
  await deleteDoc(doc(db, 'users', id));
}

async function updateUserFields(id, payload) {
  if (!db) return;
  await updateDoc(doc(db, 'users', id), payload);
}

async function login(email, password) {
  if (!auth) return null;
  await setPersistence(auth, browserLocalPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}

async function registerUser({ name, email, password, company, supervisor, requestedRole, supervisorType = '', supervisedCompanies = [], approved = false, roles = ['solicitado'] }) {
  if (!auth || !db) return null;

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    await updateProfile(cred.user, { displayName: name });
  }
  
  // Only send verification email if not auto-approved
  if (!approved) {
    await sendEmailVerification(cred.user).catch(() => {});
  }

  try {
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email,
      displayName: name,
      company,
      supervisor,
      requestedRole,
      supervisorType: supervisorType || null,
      supervisedCompanies: Array.isArray(supervisedCompanies) ? supervisedCompanies : [],
      roles: roles,
      approved: approved,
      createdAt: serverTimestamp(),
      deviceFingerprint: navigator.userAgent,
      createdBy: 'self-service'
    });
  } catch (err) {
    // Revert auth user if Firestore fails
    try { await deleteUser(cred.user); } catch (e) { console.warn('No se pudo revertir usuario', e); }
    throw err;
  }
  return cred.user;
}

async function createUserWithSecondaryApp({ email, password, name, company, role, supervisor, currentUserEmail, supervisorType = '', supervisedCompanies = [] }) {
  if (!db || !cfg) {
    throw new Error('Falta configuración de Firebase.');
  }
  // 1. Inicializar app secundaria para no cerrar sesión actual
  const secondaryApp = initializeApp(cfg, 'SecondaryApp');
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUser = userCred.user;

    await setDoc(doc(db, 'users', newUser.uid), {
      uid: newUser.uid,
      email,
      displayName: name,
      company,
      supervisor,
      roles: [role],
      requestedRole: role,
      supervisorType: supervisorType || null,
      supervisedCompanies: Array.isArray(supervisedCompanies) ? supervisedCompanies : [],
      approved: true,
      createdAt: serverTimestamp(),
      createdBy: currentUserEmail
    });
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
  }
}

function watchAuth(callback) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}

function logout() {
  return auth ? signOut(auth) : Promise.resolve();
}

function mapFirebaseError(error) {
  if (!error || !error.code) return 'Ocurrió un error inesperado. Intenta nuevamente.';
  const { code } = error;
  const ERRORS = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'Usuario no registrado.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/email-already-in-use': 'Este correo ya tiene una cuenta.',
    'auth/weak-password': 'La contraseña es demasiado débil.',
    'auth/network-request-failed': 'Revisa tu conexión a internet.'
  };
  return ERRORS[code] || 'No se pudo completar la operación (' + code + ').';
}

async function saveHistoryRecord(data) {
  if (!auth.currentUser) throw new Error('Usuario no autenticado');
  // Referencia a la colección 'history'
  const colRef = collection(db, 'history');
  await addDoc(colRef, {
    ...data,
    uid: auth.currentUser.uid,
    userEmail: auth.currentUser.email,
    timestamp: serverTimestamp()
  });
}

async function getHistory(uid) {
  if (!uid) return [];
  const colRef = collection(db, 'history');
  const q = query(colRef, where('uid', '==', uid));
  // Note: Firestore requires an index for compound queries if we add orderBy('timestamp', 'desc')
  // For now, we'll sort in client side to avoid index creation requirement immediately
  const snap = await getDocs(q);
  const list = [];
  snap.forEach(doc => {
    list.push({ id: doc.id, ...doc.data() });
  });
  // Sort desc by timestamp
  return list.sort((a, b) => {
    const tA = a.timestamp?.seconds || 0;
    const tB = b.timestamp?.seconds || 0;
    return tB - tA;
  });
}

async function getCompaniesDoc() {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'settings', 'companies'));
    if (snap.exists()) {
      return snap.data().list || [];
    }
  } catch (e) {
    console.warn('Error fetching companies:', e);
  }
  return null;
}

async function updateCompaniesDoc(list) {
  if (!db) return;
  await setDoc(doc(db, 'settings', 'companies'), { list }, { merge: true });
}

function subscribeToCompanies(callback) {
  if (!db) return () => {};
  return onSnapshot(doc(db, 'settings', 'companies'), (snap) => {
    if (snap.exists()) {
      callback(snap.data().list || []);
    } else {
      callback([]);
    }
  }, (error) => {
    console.warn('Error subscribing to companies:', error);
  });
}

export {
  auth,
  db,
  login,
  logout,
  registerUser,
  ensureUserDoc,
  ensureRoleSync,
  fetchRequests,
  approveRequestDoc,
  revokeAccessDoc,
  deleteRequestDoc,
  updateUserFields,
  createUserWithSecondaryApp,
  watchAuth,
  isSuperAdmin,
  isSupervisor,
  canAccessAdmin,
  mapFirebaseError,
  saveHistoryRecord,
  getHistory,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  getCompaniesDoc,
  updateCompaniesDoc,
  subscribeToCompanies
};
