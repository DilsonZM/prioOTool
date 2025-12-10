import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

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
const drawer = qs('side-drawer');
const drawerToggle = qs('drawerToggle');
const drawerClose = qs('drawerClose');
const drawerLogout = qs('logoutDrawer');
const drawerRoles = qs('drawer-roles');
const drawerArea = qs('drawer-area');
const drawerGerencia = qs('drawer-gerencia');
const drawerSupervisor = qs('drawer-supervisor');
const drawerEmail = qs('drawer-email');
const adminEmpty = qs('admin-empty');
const adminTableWrapper = qs('admin-table-wrapper');
const adminRows = qs('request-rows');
const pageForm = qs('page-form');
const pageAdmin = qs('page-admin');
const navDrawerForm = qs('nav-drawer-form');
const navDrawerAdmin = qs('nav-drawer-admin');

let currentProfile = null;
let currentRoles = [];

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
  if (state !== 'app') {
    closeDrawer();
  }
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

function isSuperAdmin(roles = []){
  return roles.includes('superadmin') || roles.includes('admin');
}

function isSupervisor(roles = []){
  return roles.includes('supervisor');
}

function setDrawerData(profile, roles){
  const rolesText = roles?.length ? roles.join(', ') : '—';
  setText(drawerRoles?.id, rolesText);
  setText(drawerArea?.id, profile?.area || '—');
  setText(drawerGerencia?.id, profile?.gerencia || '—');
  setText(drawerSupervisor?.id, profile?.supervisor || '—');
  setText(drawerEmail?.id, profile?.email || '—');
}

function openDrawer(){
  if (!drawer) return;
  drawer.classList.add('is-open');
  toggle(drawer, true);
}

function closeDrawer(){
  if (!drawer) return;
  drawer.classList.remove('is-open');
  setTimeout(() => toggle(drawer, false), 180);
}

function syncAdminVisibility(roles){
  const allowed = isSuperAdmin(roles) || isSupervisor(roles);
  if (navDrawerAdmin) {
    toggle(navDrawerAdmin, allowed);
  }
}

function setActiveTab(isAdmin){
  if (navDrawerForm) navDrawerForm.classList.toggle('is-active', !isAdmin);
  if (navDrawerAdmin) navDrawerAdmin.classList.toggle('is-active', !!isAdmin);
}

function goToPage(page){
  const toAdmin = page === 'admin';
  toggle(pageForm, !toAdmin);
  toggle(pageAdmin, toAdmin);
  setActiveTab(toAdmin);
  if (toAdmin) {
    loadAdminPage();
  }
}

function formatDate(ts){
  if (!ts) return '—';
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString();
  } catch (e) {
    return '—';
  }
}

async function fetchRequests(profile){
  if (!db) return [];
  const filters = [];
  const superAdmin = isSuperAdmin(currentRoles);
  const supervisor = isSupervisor(currentRoles);
  if (!superAdmin && supervisor) {
    if (profile?.area) filters.push(where('area', '==', profile.area));
    else if (profile?.gerencia) filters.push(where('gerencia', '==', profile.gerencia));
  }

  const colRef = collection(db, 'users');
  const q = filters.length ? query(colRef, ...filters) : colRef;
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderRequests(rows){
  if (!adminRows || !adminEmpty || !adminTableWrapper) return;
  const filtered = rows.filter(r => !r.approved || (Array.isArray(r.roles) && r.roles.includes('solicitado')));
  adminRows.innerHTML = '';
  if (!filtered.length) {
    toggle(adminEmpty, true);
    toggle(adminTableWrapper, false);
    return;
  }
  toggle(adminEmpty, false);
  toggle(adminTableWrapper, true);

  filtered.forEach(r => {
    const estadoAprobado = !!r.approved;
    const chipClass = estadoAprobado ? 'admin-chip admin-chip--approved' : 'admin-chip admin-chip--pending';
    const estadoTxt = estadoAprobado ? 'Aprobado' : 'Pendiente';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${r.email || '—'}</td>
      <td>${r.requestedRole || (Array.isArray(r.roles) ? r.roles.join(', ') : '—')}</td>
      <td>${r.area || '—'}</td>
      <td>${r.gerencia || '—'}</td>
      <td><span class="${chipClass}">${estadoTxt}</span></td>
      <td>${formatDate(r.createdAt)}</td>
    `;
    adminRows.appendChild(row);
  });
}

async function loadAdminPage(){
  try {
    setLoading(true);
    const rows = await fetchRequests(currentProfile);
    renderRequests(rows);
  } catch (err) {
    console.error('No se pudieron cargar las solicitudes', err);
    adminRows.innerHTML = '<tr><td colspan="6">Error al cargar solicitudes.</td></tr>';
    toggle(adminEmpty, false);
    toggle(adminTableWrapper, true);
  } finally {
    setLoading(false);
  }
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
    currentProfile = { ...syncedData, email: user.email };
    currentRoles = roles;
    setText('session-user', syncedData?.displayName || user.email || 'Usuario');
    setText('session-role', 'Rol: ' + roles.join(', '));
    setDrawerData(currentProfile, roles);
    syncAdminVisibility(roles);
    toggle(sessionBar, approved);
    renderState(approved ? 'app' : 'pending');
    if (approved) {
      goToPage('form');
    }
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

if (drawerToggle) drawerToggle.addEventListener('click', openDrawer);
if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
if (drawerLogout) drawerLogout.addEventListener('click', () => auth && signOut(auth));
if (navDrawerAdmin) navDrawerAdmin.addEventListener('click', () => { goToPage('admin'); closeDrawer(); });
if (navDrawerForm) navDrawerForm.addEventListener('click', () => { goToPage('form'); closeDrawer(); });

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
