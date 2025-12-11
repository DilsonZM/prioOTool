import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendEmailVerification, deleteUser } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, updateDoc, deleteDoc, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

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
const adminBulkEdit = qs('adminBulkEdit');
const adminCreateUserBtn = qs('adminCreateUserBtn');
const navDrawerCreateUser = qs('nav-drawer-create-user');
const btnCreateUserSubmit = qs('btn-create-user-submit');
const fStatusPending = qs('fStatusPending');
const fStatusApproved = qs('fStatusApproved');
const fArea = qs('fArea');
const fRole = qs('fRole');
const fDateStart = qs('fDateStart');
const fDateEnd = qs('fDateEnd');

let lastRequests = [];
let adminFilters = {
  statuses: ['pending', 'approved'],
  area: '',
  role: '',
  dateStart: '',
  dateEnd: ''
};
let isBulkEditMode = false;
const excludedFromBulk = new Set(); // IDs de filas que el usuario canceló en modo masivo
let deleteTargetId = null; // ID del usuario a eliminar

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
  if (adminFilters.role) chips.push({ key:'role', label:'Rol: ' + adminFilters.role });
  if (adminFilters.dateStart || adminFilters.dateEnd) {
    const start = adminFilters.dateStart ? new Date(adminFilters.dateStart).toLocaleDateString() : 'Inicio';
    const end = adminFilters.dateEnd ? new Date(adminFilters.dateEnd).toLocaleDateString() : 'Fin';
    chips.push({ key:'date', label:`Fecha: ${start} - ${end}` });
  }

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
      if (chip.key === 'role') {
        adminFilters.role = '';
        fRole.value = '';
      }
      if (chip.key === 'date') {
        adminFilters.dateStart = '';
        adminFilters.dateEnd = '';
        fDateStart.value = '';
        fDateEnd.value = '';
      }
      renderRequests(lastRequests);
      renderFilterChips();
    });
    adminActiveFilters.appendChild(el);
  });
}

function updateFilterOptions(changedField = null) {
  // Helper: verifica si un registro cumple los filtros actuales (ignorando uno específico)
  const matches = (r, ignoreField) => {
    // Status
    if (ignoreField !== 'status') {
       const pending = isPendingRequest(r);
       if (!fStatusPending.checked && pending) return false;
       if (!fStatusApproved.checked && !pending) return false;
    }

    // Date
    if (ignoreField !== 'date') {
        const startVal = fDateStart.value;
        const endVal = fDateEnd.value;
        if (startVal || endVal) {
            const created = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
            if (startVal) {
                const s = new Date(startVal); s.setHours(0,0,0,0);
                if (created < s) return false;
            }
            if (endVal) {
                const e = new Date(endVal); e.setHours(23,59,59,999);
                if (created > e) return false;
            }
        }
    }

    // Company
    if (ignoreField !== 'company') {
        const val = fArea.value;
        if (val && r.company !== val) return false;
    }

    // Role
    if (ignoreField !== 'role') {
        const val = fRole.value;
        const rRole = r.requestedRole || (Array.isArray(r.roles) ? r.roles[0] : '');
        if (val && rRole !== val) return false;
    }

    return true;
  };

  // Update Company Options
  if (changedField !== 'company') {
      const companies = new Set();
      lastRequests.forEach(r => {
          if (matches(r, 'company')) {
              if (r.company) companies.add(r.company);
          }
      });
      const current = fArea.value;
      fArea.innerHTML = '<option value="">Todas</option>';
      Array.from(companies).sort().forEach(v => {
          fArea.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`);
      });
      fArea.value = current; 
  }

  // Update Role Options
  if (changedField !== 'role') {
      const roles = new Set();
      lastRequests.forEach(r => {
          if (matches(r, 'role')) {
              const rRole = r.requestedRole || (Array.isArray(r.roles) ? r.roles[0] : '');
              if (rRole) roles.add(rRole);
          }
      });
      const current = fRole.value;
      fRole.innerHTML = '<option value="">Todos</option>';
      Array.from(roles).sort().forEach(v => {
          fRole.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`);
      });
      fRole.value = current;
  }
}

// Alias para compatibilidad con llamadas existentes
function buildFilterOptions() {
    updateFilterOptions();
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

async function autoSave(id, field, value) {
  const row = document.getElementById(`row-${id}`);
  if (!row) return;

  // Feedback visual: borde azul mientras guarda
  const input = row.querySelector(`[data-field="${field}"]`);
  if (input) {
    input.style.borderColor = '#3b82f6';
    input.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.1)';
  }

  const payload = { [field]: value };
  if (field === 'requestedRole') {
    payload.roles = [value];
  }

  try {
    await updateDoc(doc(db, 'users', id), payload);
    
    // Actualizar caché local
    const reqIndex = lastRequests.findIndex(r => r.id === id);
    if (reqIndex !== -1) {
       lastRequests[reqIndex] = { ...lastRequests[reqIndex], ...payload };
    }

    // Feedback visual: éxito (verde momentáneo)
    if (input) {
      input.style.borderColor = '#10b981';
      input.style.boxShadow = '0 0 0 2px rgba(16,185,129,0.1)';
      setTimeout(() => {
        input.style.borderColor = '';
        input.style.boxShadow = '';
      }, 1000);
    }
  } catch (err) {
    console.error('Error auto-save', err);
    if (input) {
      input.style.borderColor = '#ef4444';
      alert('Error al guardar: ' + err.message);
    }
  }
}
// Exponemos autoSave globalmente para que funcione en los atributos onblur/onchange
window.autoSave = autoSave;

function createRequestRow(r, forceEdit = false) {
  const estadoAprobado = !!r.approved;
  const chipClass = estadoAprobado ? 'admin-chip admin-chip--approved' : 'admin-chip admin-chip--pending';
  const estadoTxt = estadoAprobado ? 'Aprobado' : 'Pendiente';
  const row = document.createElement('tr');
  row.id = `row-${r.id}`;
  const puedeAprobar = isSuperAdmin(currentRoles) || currentRoles.includes('admin');

  // Renderizamos inputs si:
  // 1. Estamos en modo masivo Y la fila NO está excluida
  // 2. O si se forzó la edición individual
  const isBulk = isBulkEditMode && !excludedFromBulk.has(r.id);
  const isEditable = isBulk || forceEdit;

  if (isEditable && puedeAprobar) {
    const currentRole = r.requestedRole || (Array.isArray(r.roles) ? r.roles[0] : '');
    const roleOptions = ['tecnico', 'analista', 'planeador', 'programador', 'supervisor', 'admin']
      .map(opt => `<option value="${opt}" ${opt === currentRole ? 'selected' : ''}>${opt}</option>`)
      .join('');

    // Si es modo masivo, usamos auto-save (onblur/onchange)
    // Si es modo individual (forceEdit), usamos inputs normales y botón Guardar
    const autoSaveAttr = isBulk ? `onblur="autoSave('${r.id}', 'FIELD', this.value)"` : '';
    const autoSaveSelect = isBulk ? `onchange="autoSave('${r.id}', 'requestedRole', this.value)"` : '';

    const nameInput = `<input type="text" class="admin-input" value="${r.displayName || ''}" data-field="displayName" ${isBulk ? autoSaveAttr.replace('FIELD','displayName') : ''}>`;
    const companyInput = `<input type="text" class="admin-input" value="${r.company || ''}" data-field="company" ${isBulk ? autoSaveAttr.replace('FIELD','company') : ''}>`;
    const supervisorInput = `<input type="text" class="admin-input" value="${r.supervisor || ''}" data-field="supervisor" ${isBulk ? autoSaveAttr.replace('FIELD','supervisor') : ''}>`;
    
    let actions = '';
    if (isBulk) {
      actions = `<button class="admin-cancel-btn" data-cancel="${r.id}" title="Salir de edición">✕</button>`;
    } else {
      actions = `
        <button class="admin-save-btn" data-save="${r.id}">Guardar</button>
        <button class="admin-cancel-btn" data-cancel="${r.id}">Cancelar</button>
      `;
    }

    row.innerHTML = `
      <td>${nameInput}</td>
      <td>${r.email || '—'}</td>
      <td>
        <select class="admin-input" data-field="requestedRole" ${autoSaveSelect}>
          <option value="">Seleccionar...</option>
          ${roleOptions}
        </select>
      </td>
      <td>${companyInput}</td>
      <td>${supervisorInput}</td>
      <td><span class="${chipClass}">${estadoTxt}</span></td>
      <td>${formatDate(r.createdAt)}</td>
      <td>
        <div class="admin-actions-cell">
          ${actions}
        </div>
      </td>
    `;
  } else {
    // Modo visualización normal
    let actionCell = '—';
    if (puedeAprobar) {
      const parts = [];
      parts.push(`<button class="admin-edit-btn" data-edit="${r.id}">Editar</button>`);
      if (!estadoAprobado) {
        parts.push(`<button class="admin-approve-btn" data-approve="${r.id}" data-role="${r.requestedRole || ''}">Aprobar</button>`);
      }
      parts.push(`<button class="admin-delete-btn" data-delete="${r.id}" title="Eliminar">🗑️</button>`);
      actionCell = `<div class="admin-actions-cell">${parts.join('')}</div>`;
    }
    row.innerHTML = `
      <td>${r.displayName || '—'}</td>
      <td>${r.email || '—'}</td>
      <td>${r.requestedRole || (Array.isArray(r.roles) ? r.roles.join(', ') : '—')}</td>
      <td>${r.company || '—'}</td>
      <td>${r.supervisor || '—'}</td>
      <td><span class="${chipClass}">${estadoTxt}</span></td>
      <td>${formatDate(r.createdAt)}</td>
      <td>${actionCell}</td>
    `;
  }
  return row;
}

function renderRequests(rows){
  if (!adminRows || !adminEmpty || !adminTableWrapper) return;
  lastRequests = rows || [];
  buildFilterOptions();
  const filtered = lastRequests.filter(r => {
    const pending = isPendingRequest(r);
    const statusOk = adminFilters.statuses.includes('pending') && pending || adminFilters.statuses.includes('approved') && !pending;
    const areaOk = matchesSelect(r.company, adminFilters.area); // Usamos company
    const roleOk = matchesSelect(r.requestedRole || (Array.isArray(r.roles) ? r.roles[0] : ''), adminFilters.role);
    
    let dateOk = true;
    if (adminFilters.dateStart || adminFilters.dateEnd) {
      const created = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      if (adminFilters.dateStart) {
        const start = new Date(adminFilters.dateStart);
        start.setHours(0,0,0,0);
        if (created < start) dateOk = false;
      }
      if (dateOk && adminFilters.dateEnd) {
        const end = new Date(adminFilters.dateEnd);
        end.setHours(23,59,59,999);
        if (created > end) dateOk = false;
      }
    }

    return statusOk && areaOk && roleOk && dateOk;
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
    adminRows.appendChild(createRequestRow(r));
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

async function deleteRequest(id){
  const allowed = isSuperAdmin(currentRoles) || currentRoles.includes('admin');
  if (!allowed) return;
  if (currentProfile?.uid === id) {
    Swal.fire('Error', 'No puedes eliminar tu propio usuario.', 'error');
    return;
  }

  // Buscar el usuario en la caché local para saber su estado
  const user = lastRequests.find(r => r.id === id);
  const isApproved = user && user.approved;
  
  // Usamos estilos nativos de SweetAlert2 para asegurar visibilidad
  Swal.fire({
    title: "¿Qué deseas hacer?",
    text: isApproved 
      ? "Puedes eliminar el usuario permanentemente o solo revocar su acceso." 
      : "Esta acción eliminará el usuario permanentemente.",
    icon: "warning",
    showCancelButton: true,
    showDenyButton: isApproved, // Solo mostrar si está aprobado
    confirmButtonText: "Eliminar Usuario",
    denyButtonText: "Revocar Acceso",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#d33", // Rojo para eliminar
    denyButtonColor: "#f39c12", // Naranja para revocar
    cancelButtonColor: "#6c757d", // Gris para cancelar
    reverseButtons: true
  }).then(async (result) => {
    if (result.isConfirmed) {
      // Eliminar Usuario
      try {
        setLoading(true);
        await deleteDoc(doc(db, 'users', id));
        // Remove from local cache
        lastRequests = lastRequests.filter(r => r.id !== id);
        renderRequests(lastRequests);
        
        Swal.fire({
          title: "¡Eliminado!",
          text: "El usuario ha sido eliminado permanentemente.",
          icon: "success"
        });
      } catch (err) {
        console.error('No se pudo eliminar', err);
        Swal.fire({
          title: "Error",
          text: "No se pudo eliminar el usuario.",
          icon: "error"
        });
      } finally {
        setLoading(false);
      }
    } else if (result.isDenied) {
      // Revocar Acceso
      try {
        setLoading(true);
        await updateDoc(doc(db, 'users', id), {
          approved: false,
          roles: ['solicitado']
        });
        await loadAdminPage();
        
        Swal.fire({
          title: "¡Revocado!",
          text: "El acceso del usuario ha sido revocado.",
          icon: "info"
        });
      } catch (err) {
        console.error('No se pudo revocar', err);
        Swal.fire({
          title: "Error",
          text: "No se pudo revocar el acceso.",
          icon: "error"
        });
      } finally {
        setLoading(false);
      }
    }
  });
}

async function saveInlineEdit(id){
  const row = document.getElementById(`row-${id}`);
  if (!row) return;
  
  const inputs = row.querySelectorAll('[data-field]');
  const payload = {};
  let hasChanges = false;

  inputs.forEach(input => {
    const field = input.dataset.field;
    const val = input.value.trim();
    if (val) {
      payload[field] = val;
      hasChanges = true;
    }
  });

  if (payload.requestedRole) {
    payload.roles = [payload.requestedRole];
  }

  if (!hasChanges) {
    cancelInlineEdit(id);
    return;
  }

  try {
    setLoading(true);
    await updateDoc(doc(db, 'users', id), payload);
    
    // Actualizar caché local
    const reqIndex = lastRequests.findIndex(r => r.id === id);
    if (reqIndex !== -1) {
       lastRequests[reqIndex] = { ...lastRequests[reqIndex], ...payload };
    }

    // Si NO es edición masiva, volvemos a modo lectura
    if (!isBulkEditMode) {
      const newRow = createRequestRow(lastRequests[reqIndex]);
      row.replaceWith(newRow);
    } else {
      // Si es masiva, nos quedamos en modo edición pero actualizamos visualmente si es necesario
      // (Opcional: mostrar un toast de éxito)
    }
  } catch (err) {
    console.error('No se pudo actualizar', err);
    alert('Error al guardar: ' + err.message);
  } finally {
    setLoading(false);
  }
}

function cancelInlineEdit(id){
  const reqIndex = lastRequests.findIndex(r => r.id === id);
  if (reqIndex === -1) return;
  const r = lastRequests[reqIndex];
  const row = document.getElementById(`row-${id}`);
  
  if (isBulkEditMode) {
    // En modo masivo, "Cancelar" significa excluir esta fila de la edición
    excludedFromBulk.add(id);
    const newRow = createRequestRow(r, false);
    if (row) row.replaceWith(newRow);
  } else {
    // En modo individual, volvemos a renderizar la fila en modo lectura
    const newRow = createRequestRow(r, false);
    if (row) row.replaceWith(newRow);
  }
}

function enableInlineEdit(id){
  const r = lastRequests.find(req => req.id === id);
  if (!r) return;
  
  const row = document.getElementById(`row-${id}`);
  if (!row) return;

  // Reemplazamos la fila actual con una versión editable forzada
  const newRow = createRequestRow(r, true);
  row.replaceWith(newRow);
}

async function editRequest(id, data){
  // Deprecated in favor of inline edit
  enableInlineEdit(id);
}

async function loadAdminPage(){
  const allowed = canAccessAdmin(currentRoles, currentProfile?.approved);
  if (!allowed) return;
  
  updateCreateUserButtonVisibility();

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

function updateCreateUserButtonVisibility() {
  const canCreate = isSuperAdmin(currentRoles) || currentRoles.includes('admin') || isSupervisor(currentRoles);
  toggle(adminCreateUserBtn, canCreate);
  toggle(navDrawerCreateUser, canCreate);
}

function openCreateUserModal() {
  const modalEl = document.getElementById('createUserModal');
  const roleSelect = document.getElementById('new-user-role');
  if (!modalEl || !roleSelect) return;

  // Limpiar formulario
  document.getElementById('create-user-form').reset();

  // Definir roles permitidos según jerarquía
  let allowedRoles = [];
  if (isSuperAdmin(currentRoles) || currentRoles.includes('admin')) {
    allowedRoles = ['tecnico', 'inspector', 'planeador', 'programador', 'supervisor', 'admin'];
  } else if (isSupervisor(currentRoles)) {
    allowedRoles = ['tecnico', 'inspector', 'planeador', 'programador'];
  }

  // Llenar select
  roleSelect.innerHTML = '<option value="">Seleccionar...</option>' + 
    allowedRoles.map(r => `<option value="${r}">${r}</option>`).join('');

  // Mostrar modal (Bootstrap 5)
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

async function handleCreateUser() {
  const email = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-password').value;
  const name = document.getElementById('new-user-name').value.trim();
  const company = document.getElementById('new-user-company').value.trim();
  const role = document.getElementById('new-user-role').value;

  if (!email || !password || !name || !company || !role) {
    Swal.fire('Error', 'Por favor completa todos los campos.', 'warning');
    return;
  }

  try {
    setLoading(true);
    
    // 1. Inicializar app secundaria para no cerrar sesión actual
    const secondaryApp = initializeApp(cfg, "SecondaryApp");
    const secondaryAuth = getAuth(secondaryApp);

    // 2. Crear usuario en Auth
    const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUser = userCred.user;

    // 3. Crear documento en Firestore (usando la instancia db principal)
    await setDoc(doc(db, 'users', newUser.uid), {
      uid: newUser.uid,
      email: email,
      displayName: name,
      company: company,
      supervisor: currentProfile.displayName || currentProfile.email, // Asignar supervisor automáticamente
      roles: [role],
      requestedRole: role,
      approved: true, // Aprobado automáticamente
      createdAt: serverTimestamp(),
      createdBy: currentProfile.email
    });

    // 4. Limpieza
    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);

    // 5. Cerrar modal y notificar
    const modalEl = document.getElementById('createUserModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    Swal.fire('Éxito', 'Usuario creado correctamente.', 'success');

    // 6. Recargar tabla si estamos en admin
    if (!adminRows.closest('.hidden')) {
      loadAdminPage();
    }

  } catch (err) {
    console.error('Error creando usuario:', err);
    const friendlyMsg = mapFirebaseError(err);
    Swal.fire('Error', friendlyMsg, 'error');
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

  // 1. Validación estricta del formulario (HTML5 required, email, etc.)
  // Esto evita que se envíen datos si falta algún campo "required" en el HTML
  if (registerForm && !registerForm.checkValidity()) {
    registerForm.reportValidity();
    return;
  }

  const name = qs('reg-name').value.trim();
  const email = qs('reg-email').value.trim();
  const password = qs('reg-password').value;
  const passwordConfirm = qs('reg-password-confirm').value;
  const company = qs('reg-company').value.trim();
  const supervisor = qs('reg-supervisor').value.trim();
  const requestedRole = qs('reg-role').value;

  // 2. Doble verificación manual para asegurar que no viajen strings vacíos
  if (!name || !email || !company || !supervisor || !requestedRole) {
    showError(registerAlert, 'Por favor completa todos los campos obligatorios.');
    return;
  }

  if (password.length < 8) {
    showError(registerAlert, 'La contraseña debe tener al menos 8 caracteres.');
    return;
  }

  if (password !== passwordConfirm) {
    showError(registerAlert, 'Las contraseñas no coinciden.');
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
      company,
      supervisor,
      requestedRole,
      roles: ['solicitado'],
      approved: false,
      createdAt: serverTimestamp(),
      deviceFingerprint: navigator.userAgent,
      createdBy: 'self-service'
    });
    renderState('pending');
  } catch (err) {
    console.error('Error en registro:', err);
    // Si el usuario se creó en Auth pero falló Firestore, lo borramos para evitar inconsistencias
    if (auth.currentUser) {
      try { await deleteUser(auth.currentUser); } catch(e){ console.warn('No se pudo revertir usuario', e); }
    }
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
    updateCreateUserButtonVisibility(); // Actualizar visibilidad de botón crear usuario
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
    const deleteBtn = evt.target.closest('[data-delete]');
    if (deleteBtn) {
      const id = deleteBtn.dataset.delete;
      deleteRequest(id);
      return;
    }
    const editBtn = evt.target.closest('[data-edit]');
    if (editBtn) {
      const id = editBtn.dataset.edit;
      enableInlineEdit(id);
      return;
    }
    const saveBtn = evt.target.closest('[data-save]');
    if (saveBtn) {
      const id = saveBtn.dataset.save;
      saveInlineEdit(id);
      return;
    }
    const cancelBtn = evt.target.closest('[data-cancel]');
    if (cancelBtn) {
      const id = cancelBtn.dataset.cancel;
      cancelInlineEdit(id);
    }
  });
}
if (adminFilterOpen) adminFilterOpen.addEventListener('click', () => {
  toggle(adminFilterPanel, true);
  updateFilterOptions(); // Inicializar opciones al abrir
});

// Listeners para actualización dinámica de filtros
if (fStatusPending) fStatusPending.addEventListener('change', () => updateFilterOptions('status'));
if (fStatusApproved) fStatusApproved.addEventListener('change', () => updateFilterOptions('status'));
if (fDateStart) fDateStart.addEventListener('change', () => updateFilterOptions('date'));
if (fDateEnd) fDateEnd.addEventListener('change', () => updateFilterOptions('date'));
if (fArea) fArea.addEventListener('change', () => updateFilterOptions('company'));
if (fRole) fRole.addEventListener('change', () => updateFilterOptions('role'));

if (adminFilterClose) adminFilterClose.addEventListener('click', () => toggle(adminFilterPanel, false));
if (adminFilterClear) adminFilterClear.addEventListener('click', () => {
  fStatusPending.checked = true;
  fStatusApproved.checked = true;
  fArea.value = '';
  fRole.value = '';
  fDateStart.value = '';
  fDateEnd.value = '';
  updateFilterOptions(); // Reset options
});
if (adminFilterApply) adminFilterApply.addEventListener('click', () => {
  const statuses = [];
  if (fStatusPending.checked) statuses.push('pending');
  if (fStatusApproved.checked) statuses.push('approved');
  adminFilters = {
    statuses: statuses.length ? statuses : ['pending','approved'],
    area: fArea.value,
    role: fRole.value,
    dateStart: fDateStart.value,
    dateEnd: fDateEnd.value
  };
  toggle(adminFilterPanel, false);
  renderRequests(lastRequests);
  renderFilterChips();
});

if (adminBulkEdit) {
  adminBulkEdit.addEventListener('click', () => {
    isBulkEditMode = !isBulkEditMode;
    adminBulkEdit.classList.toggle('pill-ghost', !isBulkEditMode);
    adminBulkEdit.textContent = isBulkEditMode ? 'Salir de edición' : 'Edición rápida';
    excludedFromBulk.clear(); // Reseteamos exclusiones al cambiar modo
    renderRequests(lastRequests);
  });
}

if (adminCreateUserBtn) {
  adminCreateUserBtn.addEventListener('click', openCreateUserModal);
}
if (navDrawerCreateUser) {
  navDrawerCreateUser.addEventListener('click', () => {
    closeDrawer();
    openCreateUserModal();
  });
}
if (btnCreateUserSubmit) {
  btnCreateUserSubmit.addEventListener('click', handleCreateUser);
}

const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener('click', () => {
    if (deleteTargetId) {
      performDelete(deleteTargetId);
    }
  });
}
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
if (cancelDeleteBtn) {
  cancelDeleteBtn.addEventListener('click', () => {
    const modalEl = document.getElementById('deleteModal');
    if (modalEl) modalEl.classList.add('hidden');
    deleteTargetId = null;
  });
}
const closeDeleteModal = document.getElementById('closeDeleteModal');
if (closeDeleteModal) {
  closeDeleteModal.addEventListener('click', () => {
    const modalEl = document.getElementById('deleteModal');
    if (modalEl) modalEl.classList.add('hidden');
    deleteTargetId = null;
  });
}

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

  const password = qs('reg-password');
  const passwordConfirm = qs('reg-password-confirm');
  
  // Validación en tiempo real de contraseñas
  if (password && passwordConfirm) {
    const validatePasswords = () => {
      const p1 = password.value;
      const p2 = passwordConfirm.value;
      if (p2 && p1 !== p2) {
        passwordConfirm.style.borderColor = '#ef4444';
        passwordConfirm.setCustomValidity('Las contraseñas no coinciden');
      } else {
        passwordConfirm.style.borderColor = '';
        passwordConfirm.setCustomValidity('');
      }
    };
    password.addEventListener('input', validatePasswords);
    passwordConfirm.addEventListener('input', validatePasswords);
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