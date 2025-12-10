import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const cfg = window.PRIO_FIREBASE_CONFIG;
if (!cfg) {
  console.error('Falta window.PRIO_FIREBASE_CONFIG. Edita js/firebase-config.js con las credenciales reales.');
}

const app = cfg ? initializeApp(cfg) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

/* ===== DOM helpers ===== */
const qs = id => document.getElementById(id);
const toggle = (el, show) => {
  if (!el) return;
  el.classList[show ? 'remove' : 'add']('hidden');
};
const setText = (id, value) => {
  const el = qs(id);
  if (el) el.textContent = value;
};

const shells = {
  auth: qs('auth-shell'),
  pending: qs('pending-card'),
  app: qs('app-shell')
};
const loader = qs('loading-overlay');
const loginCard = qs('login-card');
const registerCard = qs('register-card');
const loginForm = qs('login-form');
const registerForm = qs('register-form');
const loginAlert = qs('login-alert');
const registerAlert = qs('register-alert');
const logoutBtn = qs('logoutBtn');
const pendingLogout = qs('pending-logout');
const pendingRequestAgain = qs('pending-request-again');
const pendingClose = qs('pending-close');
const sessionBar = qs('session-bar');

const viewButtons = document.querySelectorAll('.btn-link[data-view]');
viewButtons.forEach(btn => {
  btn.addEventListener('click', () => switchForm(btn.dataset.view));
});

function switchForm(view){
  const toLogin = view === 'login';
  toggle(loginCard, true === toLogin);
  toggle(registerCard, true !== toLogin);
  loginAlert?.classList.add('hidden');
  registerAlert?.classList.add('hidden');
}

function renderState(state){
  toggle(shells.auth, state === 'auth');
  toggle(shells.pending, state === 'pending');
  toggle(shells.app, state === 'app');
}

function setLoading(on){
  toggle(loader, !!on);
}

async function ensureUserDoc(user){
  if (!db) return null;
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || null,
      approved: false,
      roles: [],
      createdAt: serverTimestamp(),
      createdBy: 'auto-sync'
    });
    return (await getDoc(ref)).data();
  }
  return snap.data();
}

async function ensureRoleSync(user, data){
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

function showError(el, message){
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function resetAlerts(){
  loginAlert?.classList.add('hidden');
  registerAlert?.classList.add('hidden');
}

async function handleLogin(evt){
  evt.preventDefault();
  if (!auth) return;
  resetAlerts();
  const email = qs('login-email').value.trim();
  const password = qs('login-password').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    showError(loginAlert, mapFirebaseError(err));
  }
}

async function handleRegister(evt){
  evt.preventDefault();
  if (!auth || !db) return;
  resetAlerts();
  const name = qs('reg-name').value.trim();
  const email = qs('reg-email').value.trim();
  const password = qs('reg-password').value;
  const area = qs('reg-area').value.trim();
  const supervisor = qs('reg-supervisor').value.trim();
  const gerencia = qs('reg-gerencia').value.trim();
  const requestedRole = qs('reg-role').value;

  if (password.length < 8) {
    showError(registerAlert, 'La contraseña debe tener al menos 8 caracteres.');
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }
    await sendEmailVerification(cred.user).catch(() => {});
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email,
      displayName: name,
      area,
      supervisor,
      gerencia,
      requestedRole,
      roles: ['solicitado'],
      approved: false,
      createdAt: serverTimestamp(),
      deviceFingerprint: navigator.userAgent,
      createdBy: 'self-service'
    });
    renderState('pending');
  } catch (err) {
    showError(registerAlert, mapFirebaseError(err));
  }
}

function mapFirebaseError(error){
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

async function hydrateSession(user){
  if (!user || !db) {
    setText('session-user', '—');
    setText('session-role', 'Rol: —');
    renderState('auth');
    return;
  }
  setLoading(true);
  try {
    const data = await ensureUserDoc(user);
    const syncedData = await ensureRoleSync(user, data);
    const approved = !!syncedData?.approved;
    const roles = syncedData?.roles?.length ? syncedData.roles : [syncedData?.requestedRole || 'pendiente'];
    setText('session-user', syncedData?.displayName || user.email || 'Usuario');
    setText('session-role', 'Rol: ' + roles.join(', '));
    toggle(sessionBar, approved);
    renderState(approved ? 'app' : 'pending');
    if (approved && typeof window.prioShowIntro === 'function') {
      window.prioShowIntro();
    }
  } catch (err) {
    console.error('Error al obtener el perfil:', err);
    renderState('auth');
    showError(loginAlert, 'No pudimos validar tu perfil. Intenta más tarde.');
  } finally {
    setLoading(false);
  }
}

if (loginForm) loginForm.addEventListener('submit', handleLogin);
if (registerForm) registerForm.addEventListener('submit', handleRegister);
if (logoutBtn) logoutBtn.addEventListener('click', () => auth && signOut(auth));
if (pendingLogout) pendingLogout.addEventListener('click', () => auth && signOut(auth));
if (pendingRequestAgain) pendingRequestAgain.addEventListener('click', async () => {
  if (auth) {
    try { await signOut(auth); } catch (e) { /* noop */ }
  }
  renderState('auth');
  switchForm('register');
});
if (pendingClose) pendingClose.addEventListener('click', async () => {
  if (auth) {
    try { await signOut(auth); } catch (e) { /* noop */ }
  }
  renderState('auth');
  switchForm('login');
});

// Permite cerrar al clicar fuera de la tarjeta
if (shells.pending) {
  shells.pending.addEventListener('click', async (evt) => {
    if (evt.target === shells.pending) {
      if (auth) {
        try { await signOut(auth); } catch (e) { /* noop */ }
      }
      renderState('auth');
      switchForm('login');
    }
  });
}

if (auth) {
  onAuthStateChanged(auth, user => {
    if (!user) {
      renderState('auth');
      return;
    }
    hydrateSession(user);
  });
}
