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
const adminFilterOpen = qs('adminFilterOpen');
const adminFilterClose = qs('adminFilterClose');
const adminFilterApply = qs('adminFilterApply');
const adminFilterClear = qs('adminFilterClear');
const adminFilterPanel = qs('admin-filter-panel');
const adminActiveFilters = qs('admin-active-filters');
const fStatusPending = qs('fStatusPending');
const fStatusApproved = qs('fStatusApproved');
const fArea = qs('fArea');
const fGerencia = qs('fGerencia');
const fRole = qs('fRole');

let lastRequests = [];
let adminFilters = {
  statuses: ['pending', 'approved'],
  area: '',
  gerencia: '',
  role: ''
};

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

function canAccessAdmin(roles = [], approved){
  if (!approved) return false;
  return isSuperAdmin(roles) || isSupervisor(roles);
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

function syncAdminVisibility(roles, approved){
  const allowed = canAccessAdmin(roles, approved);
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
  const allowed = canAccessAdmin(currentRoles, currentProfile?.approved);
  if (toAdmin && !allowed) return;
  toggle(pageForm, !toAdmin);
  toggle(pageAdmin, toAdmin);
  setActiveTab(toAdmin);
  if (toAdmin) {
    loadAdminPage();
  }
}

function renderFilterChips(){
  if (!adminActiveFilters) return;
  adminActiveFilters.innerHTML = '';
  const chips = [];
  if (adminFilters.statuses.length === 1) {
    chips.push({ key:'status', label: adminFilters.statuses[0] === 'pending' ? 'Pendientes' : 'Aprobados' });
  }
  if (adminFilters.area) chips.push({ key:'area', label:'Área: ' + adminFilters.area });
  if (adminFilters.gerencia) chips.push({ key:'gerencia', label:'Gerencia: ' + adminFilters.gerencia });
  if (adminFilters.role) chips.push({ key:'role', label:'Rol: ' + adminFilters.role });

  if (!chips.length) return;
  chips.forEach(chip => {
    const el = document.createElement('div');
    el.className = 'chip';
    el.innerHTML = `${chip.label} <button type="button" aria-label="Quitar filtro">×</button>`;
    el.querySelector('button').addEventListener('click', () => {
      if (chip.key === 'status') {
        adminFilters.statuses = ['pending','approved'];
        fStatusPending.checked = true;
        fStatusApproved.checked = true;
      }
      if (chip.key === 'area') {
        adminFilters.area = '';
        fArea.value = '';
      }
      if (chip.key === 'gerencia') {
        adminFilters.gerencia = '';
        fGerencia.value = '';
      }
      if (chip.key === 'role') {
        adminFilters.role = '';
        fRole.value = '';
      }
      renderRequests(lastRequests);
      renderFilterChips();
    });
    adminActiveFilters.appendChild(el);
  });
}

function buildFilterOptions(){
  const areas = new Set();
  const gerencias = new Set();
  const roles = new Set();
  lastRequests.forEach(r => {
    if (r.area) areas.add(r.area);
    if (r.gerencia) gerencias.add(r.gerencia);
    if (r.requestedRole) roles.add(r.requestedRole);
    else if (Array.isArray(r.roles) && r.roles.length) roles.add(r.roles[0]);
  });
  const fill = (sel, set) => {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Todas</option>';
    Array.from(set).sort().forEach(v => {
      sel.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`);
    });
    sel.value = current || '';
  };
  fill(fArea, areas);
  fill(fGerencia, gerencias);
  if (fRole) {
    const current = fRole.value;
    fRole.innerHTML = '<option value="">Todos</option>';
    Array.from(roles).sort().forEach(v => {
      fRole.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`);
    });
    fRole.value = current || '';
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

function isPendingRequest(r){
  return !r.approved || (Array.isArray(r.roles) && r.roles.includes('solicitado'));
}

function matchesSelect(val, term){
  if (!term) return true;
  return (val || '').toString().toLowerCase() === term.toLowerCase();
}

function renderRequests(rows){
  if (!adminRows || !adminEmpty || !adminTableWrapper) return;
  lastRequests = rows || [];
  buildFilterOptions();
  const filtered = lastRequests.filter(r => {
    const pending = isPendingRequest(r);
    const statusOk = adminFilters.statuses.includes('pending') && pending || adminFilters.statuses.includes('approved') && !pending;
    const areaOk = matchesSelect(r.area, adminFilters.area);
    const gerOk = matchesSelect(r.gerencia, adminFilters.gerencia);
    const roleOk = matchesSelect(r.requestedRole || (Array.isArray(r.roles) ? r.roles[0] : ''), adminFilters.role);
    return statusOk && areaOk && gerOk && roleOk;
  });
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
    const puedeAprobar = isSuperAdmin(currentRoles) || currentRoles.includes('admin');
    let actionCell = '—';
    if (puedeAprobar) {
      const parts = [];
      parts.push(`<button class="admin-edit-btn" data-edit="${r.id}">Editar</button>`);
      if (!estadoAprobado) {
        parts.push(`<button class="admin-approve-btn" data-approve="${r.id}" data-role="${r.requestedRole || ''}">Aprobar</button>`);
      } else {
        parts.push(`<button class="admin-revoke-btn" data-revoke="${r.id}">Revocar</button>`);
      }
      actionCell = `<div class="admin-actions-cell">${parts.join('')}</div>`;
    }
    row.innerHTML = `
      <td>${r.displayName || '—'}</td>
      <td>${r.email || '—'}</td>
      <td>${r.requestedRole || (Array.isArray(r.roles) ? r.roles.join(', ') : '—')}</td>
      <td>${r.area || '—'}</td>
      <td>${r.gerencia || '—'}</td>
      <td><span class="${chipClass}">${estadoTxt}</span></td>
      <td>${formatDate(r.createdAt)}</td>
      <td>${actionCell}</td>
    `;
    adminRows.appendChild(row);
  });
}

async function approveRequest(id, requestedRole){
  const allowed = isSuperAdmin(currentRoles) || currentRoles.includes('admin');
  if (!allowed) return;
  try {
    setLoading(true);
    const roleToSet = requestedRole || 'usuario';
    await updateDoc(doc(db, 'users', id), {
      approved: true,
      roles: [roleToSet]
    });
    await loadAdminPage();
  } catch (err) {
    console.error('No se pudo aprobar', err);
    alert('No se pudo aprobar: ' + (err?.code || err?.message || 'error'));
  } finally {
    setLoading(false);
  }
}

async function revokeAccess(id){
  const allowed = isSuperAdmin(currentRoles) || currentRoles.includes('admin');
  if (!allowed) return;
  if (currentProfile?.uid === id) {
    alert('No puedes revocar tu propio acceso.');
    return;
  }
  try {
    setLoading(true);
    await updateDoc(doc(db, 'users', id), {
      approved: false,
      roles: ['solicitado']
    });
    await loadAdminPage();
  } catch (err) {
    console.error('No se pudo revocar', err);
    alert('No se pudo revocar: ' + (err?.code || err?.message || 'error'));
  } finally {
    setLoading(false);
  }
}

async function editRequest(id, data){
  const allowed = isSuperAdmin(currentRoles) || currentRoles.includes('admin');
  if (!allowed) return;
  const newRole = prompt('Nuevo rol (dejar vacío para mantener)', data.requestedRole || (Array.isArray(data.roles) ? data.roles[0] : '')) || '';
  const newArea = prompt('Área', data.area || '') || '';
  const newGer = prompt('Gerencia', data.gerencia || '') || '';
  if (!newRole && !newArea && !newGer) return;
  try {
    setLoading(true);
    const payload = {};
    if (newRole) payload.requestedRole = newRole;
    if (newArea) payload.area = newArea;
    if (newGer) payload.gerencia = newGer;
    await updateDoc(doc(db, 'users', id), payload);
    await loadAdminPage();
  } catch (err) {
    console.error('No se pudo actualizar', err);
    alert('No se pudo actualizar: ' + (err?.code || err?.message || 'error'));
  } finally {
    setLoading(false);
  }
}

async function loadAdminPage(){
  const allowed = canAccessAdmin(currentRoles, currentProfile?.approved);
  if (!allowed) return;
  try {
    setLoading(true);
    const rows = await fetchRequests(currentProfile);
    renderRequests(rows);
    renderFilterChips();
  } catch (err) {
    console.error('No se pudieron cargar las solicitudes', err);
    const msg = err?.code || err?.message || 'Error al cargar solicitudes.';
    adminRows.innerHTML = `<tr><td colspan="6">${msg}</td></tr>`;
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
    syncAdminVisibility(roles, approved);
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
if (adminRows) {
  adminRows.addEventListener('click', evt => {
    const btn = evt.target.closest('[data-approve]');
    if (btn) {
      const id = btn.dataset.approve;
      const role = btn.dataset.role;
      approveRequest(id, role);
      return;
    }
    const revokeBtn = evt.target.closest('[data-revoke]');
    if (revokeBtn) {
      const id = revokeBtn.dataset.revoke;
      revokeAccess(id);
      return;
    }
    const editBtn = evt.target.closest('[data-edit]');
    if (editBtn) {
      const id = editBtn.dataset.edit;
      const data = lastRequests.find(r => r.id === id);
      if (data) editRequest(id, data);
    }
  });
}
if (adminFilterOpen) adminFilterOpen.addEventListener('click', () => toggle(adminFilterPanel, true));
if (adminFilterClose) adminFilterClose.addEventListener('click', () => toggle(adminFilterPanel, false));
if (adminFilterClear) adminFilterClear.addEventListener('click', () => {
  fStatusPending.checked = true;
  fStatusApproved.checked = true;
  fArea.value = '';
  fGerencia.value = '';
  fRole.value = '';
});
if (adminFilterApply) adminFilterApply.addEventListener('click', () => {
  const statuses = [];
  if (fStatusPending.checked) statuses.push('pending');
  if (fStatusApproved.checked) statuses.push('approved');
  adminFilters = {
    statuses: statuses.length ? statuses : ['pending','approved'],
    area: fArea.value,
    gerencia: fGerencia.value,
    role: fRole.value
  };
  toggle(adminFilterPanel, false);
  renderRequests(lastRequests);
  renderFilterChips();
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
