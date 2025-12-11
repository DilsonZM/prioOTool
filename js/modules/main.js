import {
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
  mapFirebaseError
} from './auth-service.js';
import { qs, toggle, setText } from './ui-common.js';

// Catálogo editable de empresas supervisables (puedes sobrescribir con window.PRIO_SUPERVISED_COMPANIES)
const SUPERVISED_COMPANY_OPTIONS = Array.isArray(window.PRIO_SUPERVISED_COMPANIES)
  ? window.PRIO_SUPERVISED_COMPANIES
  : [
      'Cerrejón',
      'Contratista A',
      'Contratista B',
      'Contratista C'
    ];

/* ===== DOM helpers ===== */
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
const regRole = qs('reg-role');
const regCompany = qs('reg-company');
const regSupervisor = qs('reg-supervisor');
const regSupervisorWrapper = qs('reg-supervisor-wrapper');
const supervisorExtras = qs('supervisor-extras');
const supervisorOriginInputs = document.querySelectorAll('input[name="supervisor-origin"]');
const supervisorCompaniesWrapper = qs('supervisor-companies-wrapper');
const regSupervisedCompanies = qs('reg-supervised-companies');
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
const drawerSupervised = qs('drawer-supervised');
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
const drawerEditProfile = qs('drawerEditProfile');
const profileCompanyInput = qs('profile-company');
const profileSupervisedSelect = qs('profile-supervised-companies');
const btnProfileSave = qs('btn-profile-save');
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

/* ===== Registro: helpers para supervisores ===== */
function populateSupervisedCompanies(selectEl = regSupervisedCompanies) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  SUPERVISED_COMPANY_OPTIONS.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    selectEl.appendChild(opt);
  });
}

function getSelectedSupervisedCompanies() {
  if (!regSupervisedCompanies) return [];
  return Array.from(regSupervisedCompanies.selectedOptions)
    .map(o => o.value)
    .filter(Boolean);
}

function getSelectedSupervisedCompaniesFrom(selectEl) {
  if (!selectEl) return [];
  return Array.from(selectEl.selectedOptions)
    .map(o => o.value)
    .filter(Boolean);
}

function syncSupervisorFields() {
  if (!regRole) return;
  const isSupervisorRole = regRole.value === 'supervisor';
  toggle(supervisorExtras, isSupervisorRole);

  // El campo "Supervisor responsable" solo aplica a no-supervisores
  if (regSupervisorWrapper && regSupervisor) {
    toggle(regSupervisorWrapper, !isSupervisorRole);
    regSupervisor.required = !isSupervisorRole;
    if (isSupervisorRole) {
      regSupervisor.value = '';
    }
  }

  // Controlar opciones según origen (Cerrejón vs contratista)
  let origin = '';
  supervisorOriginInputs.forEach(radio => {
    if (radio.checked) origin = radio.value;
  });

  const isCerrejonSupervisor = isSupervisorRole && origin === 'cerrejon';

  if (supervisorCompaniesWrapper) {
    toggle(supervisorCompaniesWrapper, isCerrejonSupervisor);
  }

  if (regCompany) {
    if (isCerrejonSupervisor) {
      regCompany.value = 'Cerrejón';
      regCompany.readOnly = true;
    } else {
      const wasLocked = regCompany.readOnly;
      regCompany.readOnly = false;
      if (wasLocked || !regCompany.value) {
        regCompany.value = '';
      }
    }
  }
}

/* ===== UI state ===== */
function switchForm(view) {
  const toLogin = view === 'login';
  toggle(loginCard, true === toLogin);
  toggle(registerCard, true !== toLogin);
  loginAlert?.classList.add('hidden');
  registerAlert?.classList.add('hidden');
}

function renderState(state) {
  toggle(shells.auth, state === 'auth');
  toggle(shells.pending, state === 'pending');
  toggle(shells.app, state === 'app');
  if (state !== 'app') {
    closeDrawer();
  }
}

function setLoading(on) {
  toggle(loader, !!on);
}

function showError(el, message) {
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function resetAlerts() {
  loginAlert?.classList.add('hidden');
  registerAlert?.classList.add('hidden');
}

function setDrawerData(profile, roles) {
  const rolesText = roles?.length ? roles.join(', ') : '—';
  setText(drawerRoles?.id, rolesText);
  setText(drawerArea?.id, profile?.area || '—');
  setText(drawerGerencia?.id, profile?.gerencia || '—');
  setText(drawerSupervisor?.id, profile?.supervisor || '—');
  const supervised = Array.isArray(profile?.supervisedCompanies) && profile.supervisedCompanies.length
    ? profile.supervisedCompanies.join(', ')
    : '—';
  setText(drawerSupervised?.id, supervised);
  setText(drawerEmail?.id, profile?.email || '—');
}

function openDrawer() {
  if (!drawer) return;
  drawer.classList.add('is-open');
  toggle(drawer, true);
}

function closeDrawer() {
  if (!drawer) return;
  drawer.classList.remove('is-open');
  setTimeout(() => toggle(drawer, false), 180);
}

function syncAdminVisibility(roles, approved) {
  const allowed = canAccessAdmin(roles, approved);
  if (navDrawerAdmin) {
    toggle(navDrawerAdmin, allowed);
  }
  if (drawerEditProfile) {
    const canEditProfile = isSupervisor(roles);
    toggle(drawerEditProfile, canEditProfile);
  }
}

function setActiveTab(isAdmin) {
  if (navDrawerForm) navDrawerForm.classList.toggle('is-active', !isAdmin);
  if (navDrawerAdmin) navDrawerAdmin.classList.toggle('is-active', !!isAdmin);
}

function goToPage(page) {
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

/* ===== Filtros admin ===== */
function renderFilterChips() {
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
      fArea.innerHTML = '<option value=\"\">Todas</option>';
      Array.from(companies).sort().forEach(v => {
          fArea.insertAdjacentHTML('beforeend', `<option value=\"${v}\">${v}</option>`);
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
      fRole.innerHTML = '<option value=\"\">Todos</option>';
      Array.from(roles).sort().forEach(v => {
          fRole.insertAdjacentHTML('beforeend', `<option value=\"${v}\">${v}</option>`);
      });
      fRole.value = current;
  }
}

// Alias para compatibilidad con llamadas existentes
function buildFilterOptions() {
    updateFilterOptions();
}

/* ===== Tabla admin ===== */
function formatDate(ts) {
  if (!ts) return '—';
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString();
  } catch (e) {
    return '—';
  }
}

function isPendingRequest(r) {
  return !r.approved || (Array.isArray(r.roles) && r.roles.includes('solicitado'));
}

function matchesSelect(val, term) {
  if (!term) return true;
  return (val || '').toString().toLowerCase() === term.toLowerCase();
}

function companyMatchesScope(company) {
  const target = (company || '').trim().toLowerCase();
  if (!target) return false;
  const scoped = Array.isArray(currentProfile?.supervisedCompanies)
    ? currentProfile.supervisedCompanies
    : [];
  if (scoped.length) {
    return scoped.some(c => (c || '').trim().toLowerCase() === target);
  }
  // Fallback: si no hay lista, usar la propia empresa del supervisor
  if (currentProfile?.company) {
    return currentProfile.company.trim().toLowerCase() === target;
  }
  return false;
}

function canManageRequest(r) {
  if (isSuperAdmin(currentRoles) || currentRoles.includes('admin')) return true;
  if (isSupervisor(currentRoles)) {
    return companyMatchesScope(r.company);
  }
  return false;
}

function openProfileEditor() {
  if (!isSupervisor(currentRoles)) return;
  populateSupervisedCompanies(profileSupervisedSelect);

  const company = currentProfile?.company || '';
  const supervised = Array.isArray(currentProfile?.supervisedCompanies)
    ? currentProfile.supervisedCompanies.filter(Boolean)
    : [];
  const isCerrejon = company.trim().toLowerCase() === 'cerrejón';

  if (profileCompanyInput) {
    profileCompanyInput.value = company;
    profileCompanyInput.readOnly = isCerrejon;
    profileCompanyInput.placeholder = isCerrejon ? 'Cerrejón' : 'Contratista';
  }
  if (profileSupervisedSelect) {
    Array.from(profileSupervisedSelect.options).forEach(opt => {
      opt.selected = supervised.some(val => val.toLowerCase() === opt.value.toLowerCase());
    });
  }

  const modalEl = document.getElementById('editProfileModal');
  if (modalEl && window.bootstrap) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

async function saveProfileEdits() {
  if (!currentProfile?.uid) return;
  const isCerrejon = (currentProfile.company || '').trim().toLowerCase() === 'cerrejón';
  const companyVal = profileCompanyInput ? profileCompanyInput.value.trim() : '';
  const supervised = getSelectedSupervisedCompaniesFrom(profileSupervisedSelect);

  const finalCompany = isCerrejon ? 'Cerrejón' : companyVal;
  if (!finalCompany) {
    alert('Ingresa la empresa base.');
    return;
  }

  try {
    setLoading(true);
    await updateUserFields(currentProfile.uid, {
      company: finalCompany,
      supervisedCompanies: supervised
    });

    currentProfile = {
      ...currentProfile,
      company: finalCompany,
      supervisedCompanies: supervised
    };
    setDrawerData(currentProfile, currentRoles);
    const adminVisible = pageAdmin && !pageAdmin.classList.contains('hidden');
    if (adminVisible) {
      await loadAdminPage();
    }

    const modalEl = document.getElementById('editProfileModal');
    if (modalEl) {
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();
    }
    Swal.fire('Guardado', 'Perfil actualizado.', 'success');
  } catch (err) {
    console.error('Error actualizando perfil', err);
    Swal.fire('Error', mapFirebaseError(err), 'error');
  } finally {
    setLoading(false);
  }
}

async function autoSave(id, field, value) {
  const row = document.getElementById(`row-${id}`);
  if (!row) return;

  // Feedback visual: borde azul mientras guarda
  const input = row.querySelector(`[data-field=\"${field}\"]`);
  if (input) {
    input.style.borderColor = '#3b82f6';
    input.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.1)';
  }

  const payload = { [field]: value };
  if (field === 'requestedRole') {
    payload.roles = [value];
  }

  try {
    await updateUserFields(id, payload);
    
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
  const puedeAprobar = canManageRequest(r);

  // Renderizamos inputs si:
  // 1. Estamos en modo masivo Y la fila NO está excluida
  // 2. O si se forzó la edición individual
  const isBulk = isBulkEditMode && !excludedFromBulk.has(r.id);
  const isEditable = isBulk || forceEdit;

  if (isEditable && puedeAprobar) {
    const currentRole = r.requestedRole || (Array.isArray(r.roles) ? r.roles[0] : '');
    const roleOptions = ['tecnico', 'analista', 'planeador', 'programador', 'supervisor', 'admin']
      .map(opt => `<option value=\"${opt}\" ${opt === currentRole ? 'selected' : ''}>${opt}</option>`)
      .join('');

    // Si es modo masivo, usamos auto-save (onblur/onchange)
    // Si es modo individual (forceEdit), usamos inputs normales y botón Guardar
    const autoSaveAttr = isBulk ? `onblur=\"autoSave('${r.id}', 'FIELD', this.value)\"` : '';
    const autoSaveSelect = isBulk ? `onchange=\"autoSave('${r.id}', 'requestedRole', this.value)\"` : '';

    const nameInput = `<input type=\"text\" class=\"admin-input\" value=\"${r.displayName || ''}\" data-field=\"displayName\" ${isBulk ? autoSaveAttr.replace('FIELD','displayName') : ''}>`;
    const companyInput = `<input type=\"text\" class=\"admin-input\" value=\"${r.company || ''}\" data-field=\"company\" ${isBulk ? autoSaveAttr.replace('FIELD','company') : ''}>`;
    const supervisorInput = `<input type=\"text\" class=\"admin-input\" value=\"${r.supervisor || ''}\" data-field=\"supervisor\" ${isBulk ? autoSaveAttr.replace('FIELD','supervisor') : ''}>`;
    
    let actions = '';
    if (isBulk) {
      actions = `<button class=\"admin-cancel-btn\" data-cancel=\"${r.id}\" title=\"Salir de edición\">✕</button>`;
    } else {
      actions = `
        <button class=\"admin-save-btn\" data-save=\"${r.id}\">Guardar</button>
        <button class=\"admin-cancel-btn\" data-cancel=\"${r.id}\">Cancelar</button>
      `;
    }

    row.innerHTML = `
      <td>${nameInput}</td>
      <td>${r.email || '—'}</td>
      <td>
        <select class=\"admin-input\" data-field=\"requestedRole\" ${autoSaveSelect}>
          <option value=\"\">Seleccionar...</option>
          ${roleOptions}
        </select>
      </td>
      <td>${companyInput}</td>
      <td>${supervisorInput}</td>
      <td><span class=\"${chipClass}\">${estadoTxt}</span></td>
      <td>${formatDate(r.createdAt)}</td>
      <td>
        <div class=\"admin-actions-cell\">
          ${actions}
        </div>
      </td>
    `;
  } else {
    // Modo visualización normal
    let actionCell = '—';
    if (puedeAprobar) {
      const parts = [];
      parts.push(`<button class=\"admin-edit-btn\" data-edit=\"${r.id}\">Editar</button>`);
      if (!estadoAprobado) {
        parts.push(`<button class=\"admin-approve-btn\" data-approve=\"${r.id}\" data-role=\"${r.requestedRole || ''}\">Aprobar</button>`);
      }
      parts.push(`<button class=\"admin-delete-btn\" data-delete=\"${r.id}\" title=\"Eliminar\">🗑️</button>`);
      actionCell = `<div class=\"admin-actions-cell\">${parts.join('')}</div>`;
    }
    row.innerHTML = `
      <td>${r.displayName || '—'}</td>
      <td>${r.email || '—'}</td>
      <td>${r.requestedRole || (Array.isArray(r.roles) ? r.roles.join(', ') : '—')}</td>
      <td>${r.company || '—'}</td>
      <td>${r.supervisor || '—'}</td>
      <td><span class=\"${chipClass}\">${estadoTxt}</span></td>
      <td>${formatDate(r.createdAt)}</td>
      <td>${actionCell}</td>
    `;
  }
  return row;
}

function renderRequests(rows) {
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

async function approveRequest(id, requestedRole) {
  const target = lastRequests.find(r => r.id === id);
  if (!target || !canManageRequest(target)) return;
  try {
    setLoading(true);
    await approveRequestDoc(id, requestedRole || 'usuario');
    await loadAdminPage();
  } catch (err) {
    console.error('No se pudo aprobar', err);
    alert('No se pudo aprobar: ' + (err?.code || err?.message || 'error'));
  } finally {
    setLoading(false);
  }
}

async function revokeAccess(id) {
  const target = lastRequests.find(r => r.id === id);
  if (!target || !canManageRequest(target)) return;
  if (currentProfile?.uid === id) {
    alert('No puedes revocar tu propio acceso.');
    return;
  }
  try {
    setLoading(true);
    await revokeAccessDoc(id);
    await loadAdminPage();
  } catch (err) {
    console.error('No se pudo revocar', err);
    alert('No se pudo revocar: ' + (err?.code || err?.message || 'error'));
  } finally {
    setLoading(false);
  }
}

async function deleteRequest(id) {
  const target = lastRequests.find(r => r.id === id);
  if (!target || !canManageRequest(target)) return;
  if (currentProfile?.uid === id) {
    Swal.fire('Error', 'No puedes eliminar tu propio usuario.', 'error');
    return;
  }

  // Buscar el usuario en la caché local para saber su estado
  const user = lastRequests.find(r => r.id === id);
  const isApproved = user && user.approved;
  
  Swal.fire({
    title: '¿Qué deseas hacer?',
    text: isApproved 
      ? 'Puedes eliminar el usuario permanentemente o solo revocar su acceso.' 
      : 'Esta acción eliminará el usuario permanentemente.',
    icon: 'warning',
    showCancelButton: true,
    showDenyButton: isApproved, // Solo mostrar si está aprobado
    confirmButtonText: 'Eliminar Usuario',
    denyButtonText: 'Revocar Acceso',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d33', // Rojo para eliminar
    denyButtonColor: '#f39c12', // Naranja para revocar
    cancelButtonColor: '#6c757d', // Gris para cancelar
    reverseButtons: true
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        setLoading(true);
        await deleteRequestDoc(id);
        lastRequests = lastRequests.filter(r => r.id !== id);
        renderRequests(lastRequests);
        
        Swal.fire({
          title: '¡Eliminado!',
          text: 'El usuario ha sido eliminado permanentemente.',
          icon: 'success'
        });
      } catch (err) {
        console.error('No se pudo eliminar', err);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo eliminar el usuario.',
          icon: 'error'
        });
      } finally {
        setLoading(false);
      }
    } else if (result.isDenied) {
      try {
        setLoading(true);
        await revokeAccessDoc(id);
        await loadAdminPage();
        
        Swal.fire({
          title: '¡Revocado!',
          text: 'El acceso del usuario ha sido revocado.',
          icon: 'info'
        });
      } catch (err) {
        console.error('No se pudo revocar', err);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo revocar el acceso.',
          icon: 'error'
        });
      } finally {
        setLoading(false);
      }
    }
  });
}

async function saveInlineEdit(id) {
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
    await updateUserFields(id, payload);
    
    // Actualizar caché local
    const reqIndex = lastRequests.findIndex(r => r.id === id);
    if (reqIndex !== -1) {
       lastRequests[reqIndex] = { ...lastRequests[reqIndex], ...payload };
    }

    // Si NO es edición masiva, volvemos a modo lectura
    if (!isBulkEditMode) {
      const newRow = createRequestRow(lastRequests[reqIndex]);
      row.replaceWith(newRow);
    }
  } catch (err) {
    console.error('No se pudo actualizar', err);
    alert('Error al guardar: ' + err.message);
  } finally {
    setLoading(false);
  }
}

function cancelInlineEdit(id) {
  const reqIndex = lastRequests.findIndex(r => r.id === id);
  if (reqIndex === -1) return;
  const r = lastRequests[reqIndex];
  const row = document.getElementById(`row-${id}`);
  
  if (isBulkEditMode) {
    excludedFromBulk.add(id);
    const newRow = createRequestRow(r, false);
    if (row) row.replaceWith(newRow);
  } else {
    const newRow = createRequestRow(r, false);
    if (row) row.replaceWith(newRow);
  }
}

function enableInlineEdit(id) {
  const r = lastRequests.find(req => req.id === id);
  if (!r) return;
  
  const row = document.getElementById(`row-${id}`);
  if (!row) return;

  const newRow = createRequestRow(r, true);
  row.replaceWith(newRow);
}

async function loadAdminPage() {
  const allowed = canAccessAdmin(currentRoles, currentProfile?.approved);
  if (!allowed) return;
  
  updateCreateUserButtonVisibility();

  try {
    setLoading(true);
    const rows = await fetchRequests(currentProfile, currentRoles);
    renderRequests(rows);
    renderFilterChips();
  } catch (err) {
    console.error('No se pudieron cargar las solicitudes', err);
    const msg = err?.code || err?.message || 'Error al cargar solicitudes.';
    adminRows.innerHTML = `<tr><td colspan=\"6\">${msg}</td></tr>`;
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

  document.getElementById('create-user-form').reset();

  // Definir roles permitidos según jerarquía
  let allowedRoles = [];
  if (isSuperAdmin(currentRoles) || currentRoles.includes('admin')) {
    allowedRoles = ['tecnico', 'inspector', 'planeador', 'programador', 'supervisor', 'admin'];
  } else if (isSupervisor(currentRoles)) {
    allowedRoles = ['tecnico', 'inspector', 'planeador', 'programador'];
  }

  roleSelect.innerHTML = '<option value=\"\">Seleccionar...</option>' + 
    allowedRoles.map(r => `<option value=\"${r}\">${r}</option>`).join('');

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
    await createUserWithSecondaryApp({
      email,
      password,
      name,
      company,
      role,
      supervisor: currentProfile?.displayName || currentProfile?.email,
      currentUserEmail: currentProfile?.email
    });

    const modalEl = document.getElementById('createUserModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    Swal.fire('Éxito', 'Usuario creado correctamente.', 'success');

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

/* ===== Auth flow ===== */
async function handleLogin(evt) {
  evt.preventDefault();
  if (!auth) return;
  resetAlerts();
  const email = qs('login-email').value.trim();
  const password = qs('login-password').value;
  try {
    await login(email, password);
  } catch (err) {
    showError(loginAlert, mapFirebaseError(err));
  }
}

async function handleRegister(evt) {
  evt.preventDefault();
  if (!auth || !db) return;
  resetAlerts();

  if (registerForm && !registerForm.checkValidity()) {
    registerForm.reportValidity();
    return;
  }

  const name = qs('reg-name').value.trim();
  const email = qs('reg-email').value.trim();
  const password = qs('reg-password').value;
  const passwordConfirm = qs('reg-password-confirm').value;
  const companyInput = regCompany ? regCompany.value.trim() : '';
  const supervisorInput = regSupervisor ? regSupervisor.value.trim() : '';
  const requestedRole = regRole ? regRole.value : '';

  const isSupervisorRole = requestedRole === 'supervisor';
  let supervisorType = '';
  supervisorOriginInputs.forEach(radio => {
    if (radio.checked) supervisorType = radio.value;
  });
  const supervisedCompanies = supervisorType === 'cerrejon' ? getSelectedSupervisedCompanies() : [];

  if (!name || !email || !requestedRole) {
    showError(registerAlert, 'Por favor completa todos los campos obligatorios.');
    return;
  }

  if (!isSupervisorRole) {
    if (!companyInput || !supervisorInput) {
      showError(registerAlert, 'Por favor completa todos los campos obligatorios.');
      return;
    }
  } else {
    if (!supervisorType) {
      showError(registerAlert, 'Indica si eres supervisor de Cerrejón o de tu contratista.');
      return;
    }
    if (supervisorType === 'cerrejon' && !supervisedCompanies.length) {
      showError(registerAlert, 'Selecciona las empresas que supervisas.');
      return;
    }
    if (supervisorType === 'contratista' && !companyInput) {
      showError(registerAlert, 'Indica la empresa a la que perteneces.');
      return;
    }
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
    const company = isSupervisorRole && supervisorType === 'cerrejon' ? 'Cerrejón' : companyInput;
    const supervisorValue = isSupervisorRole ? name : supervisorInput;
    await registerUser({
      name,
      email,
      password,
      company,
      supervisor: supervisorValue,
      requestedRole,
      supervisorType,
      supervisedCompanies
    });
    renderState('pending');
  } catch (err) {
    console.error('Error en registro:', err);
    showError(registerAlert, mapFirebaseError(err));
  }
}

async function hydrateSession(user) {
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
    updateCreateUserButtonVisibility();
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

/* ===== Eventos ===== */
const viewButtons = document.querySelectorAll('.btn-link[data-view]');
viewButtons.forEach(btn => {
  btn.addEventListener('click', () => switchForm(btn.dataset.view));
});

// Configurar campos dinámicos de registro
populateSupervisedCompanies();
populateSupervisedCompanies(profileSupervisedSelect);
if (regRole) {
  regRole.addEventListener('change', syncSupervisorFields);
}
supervisorOriginInputs.forEach(radio => {
  radio.addEventListener('change', syncSupervisorFields);
});
syncSupervisorFields();

if (loginForm) loginForm.addEventListener('submit', handleLogin);
if (registerForm) registerForm.addEventListener('submit', handleRegister);
if (logoutBtn) logoutBtn.addEventListener('click', () => logout());
if (pendingLogout) pendingLogout.addEventListener('click', () => logout());
if (pendingRequestAgain) pendingRequestAgain.addEventListener('click', async () => {
  try { await logout(); } catch (e) { /* noop */ }
  renderState('auth');
  switchForm('register');
});
if (pendingClose) pendingClose.addEventListener('click', async () => {
  try { await logout(); } catch (e) { /* noop */ }
  renderState('auth');
  switchForm('login');
});

if (drawerToggle) drawerToggle.addEventListener('click', openDrawer);
if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
if (drawerLogout) drawerLogout.addEventListener('click', () => logout());
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
    excludedFromBulk.clear();
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
if (drawerEditProfile) {
  drawerEditProfile.addEventListener('click', openProfileEditor);
}
if (btnProfileSave) {
  btnProfileSave.addEventListener('click', saveProfileEdits);
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

if (shells.pending) {
  shells.pending.addEventListener('click', async (evt) => {
    if (evt.target === shells.pending) {
      try { await logout(); } catch (e) { /* noop */ }
      renderState('auth');
      switchForm('login');
    }
  });
}

const password = qs('reg-password');
const passwordConfirm = qs('reg-password-confirm');

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
  watchAuth(user => {
    if (!user) {
      renderState('auth');
      return;
    }
    hydrateSession(user);
  });
}
