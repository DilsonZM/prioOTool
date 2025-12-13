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
  mapFirebaseError,
  saveHistoryRecord,
  getHistory,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  getCompaniesDoc,
  updateCompaniesDoc,
  subscribeToCompanies,
  subscribeToVersion
} from './auth-service.js';
import { qs, toggle, setText } from './ui-common.js';

const APP_VERSION = '2.0.7';

function checkAppVersion() {
  subscribeToVersion((remoteVersion) => {
    if (remoteVersion && remoteVersion !== APP_VERSION) {
      Swal.fire({
        title: 'Nueva versión disponible',
        text: `Hay una nueva versión (${remoteVersion}). ¿Deseas actualizar ahora?`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
        cancelButtonText: 'Más tarde'
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.reload(true);
        }
      });
    }
  });
}

// Exponer función de guardado para script.js (no módulo)
window.prioSaveResult = async (data) => {
  // 2. Guardar en Firebase
  try {
    await saveHistoryRecord(data);
    return { success: true };
  } catch (error) {
    console.error('Error guardando historial:', error);
    return { success: false, error };
  }
};

// Función para auto-guardado local (sin preguntar)
window.prioAutoSaveLocal = (data) => {
  try {
    const localHistory = JSON.parse(localStorage.getItem('priotool_history') || '[]');
    localHistory.unshift({
      ...data,
      id: 'local_' + Date.now(),
      timestamp: { seconds: Date.now() / 1000 },
      source: 'local'
    });
    // Limitar historial local a 50 items
    if (localHistory.length > 50) localHistory.pop();
    localStorage.setItem('priotool_history', JSON.stringify(localHistory));
    console.log('Auto-guardado local exitoso');
  } catch (e) {
    console.warn('No se pudo guardar en local:', e);
  }
};

// Catálogo editable de empresas supervisables
let supervisedCompanyOptions = [
  'Cerrejón',
  'CHM Minería S.A.S.',
  'MASSA – Mantenimiento y Servicios S.A.S.',
  'Magnex S.A.S.',
  'Relianz S.A.S.'
];

function initCompanies() {
  // Iniciar chequeo de versión
  checkAppVersion();
  
  // Suscribirse a cambios en tiempo real
  subscribeToCompanies((list) => {
    if (list && Array.isArray(list) && list.length > 0) {
      supervisedCompanyOptions = list;
      renderAllCompanyDropdowns();
      renderCompaniesList(); // Actualizar lista de gestión si está abierta
    }
  });
}

function renderAllCompanyDropdowns() {
  // Populate registration dropdown
  if (regCompany) {
    const currentVal = regCompany.value;
    regCompany.innerHTML = '<option value="">Selecciona una empresa...</option>';
    supervisedCompanyOptions.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      regCompany.appendChild(opt);
    });
    if (currentVal && supervisedCompanyOptions.includes(currentVal)) {
      regCompany.value = currentVal;
    }
  }
  // Populate new user modal dropdown
  if (newUserCompany) {
    const currentVal = newUserCompany.value;
    newUserCompany.innerHTML = '<option value="">Seleccionar...</option>';
    supervisedCompanyOptions.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      newUserCompany.appendChild(opt);
    });
    if (currentVal && supervisedCompanyOptions.includes(currentVal)) {
      newUserCompany.value = currentVal;
    }
  }
  // Update checkbox lists
  if (typeof populateSupervisedCompanies === 'function') {
    populateSupervisedCompanies();
  }
}
// Iniciar carga de empresas
initCompanies();

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
const supervisorCompaniesWrapper = qs('supervisor-companies-wrapper');
const regSupervisedCompanies = qs('reg-supervised-companies');
const supervisorOriginInputs = document.querySelectorAll('input[name="supervisor-origin"]');
const logoutBtn = qs('logoutBtn');
const pendingLogout = qs('pending-logout');
const pendingRequestAgain = qs('pending-request-again');
const pendingClose = qs('pending-close');
const sessionBar = qs('session-bar');
const drawer = qs('side-drawer');
const drawerBackdrop = qs('drawer-backdrop');
const drawerToggle = qs('drawerToggle');
const drawerClose = qs('drawerClose');
const drawerLogout = qs('logoutDrawer');
const drawerRoles = qs('drawer-roles');
const drawerCompany = qs('drawer-company');
const drawerSupervisedWrap = qs('drawer-supervised-wrap');
const drawerSupervised = qs('drawer-supervised');
const drawerEmail = qs('drawer-email');
const scopeModalEl = qs('editScopeModal');
const scopeSelect = qs('edit-scope-companies');
const btnScopeSave = qs('btn-scope-save');
const adminEmpty = qs('admin-empty');
const adminTableWrapper = qs('admin-table-wrapper');
const adminRows = qs('request-rows');
const pageForm = qs('page-form');
const pageAdmin = qs('page-admin');
const pageHistory = qs('page-history');
const navDrawerForm = qs('nav-drawer-form');
const navDrawerAdmin = qs('nav-drawer-admin');
const navDrawerHistory = qs('nav-drawer-history');
const navRequestsBadge = qs('nav-requests-badge');
const pendingPill = qs('session-pending-pill');
const adminFilterOpen = qs('adminFilterOpen');
const adminFilterClose = qs('adminFilterClose');
const adminManageCompaniesBtn = qs('adminManageCompaniesBtn');
const manageCompaniesModalEl = qs('manageCompaniesModal');
const newCompanyInput = qs('new-company-input');
const btnAddCompany = qs('btn-add-company');
const companiesListEl = qs('companies-list');
const btnExportHistory = qs('btn-export-history');
const adminFilterApply = qs('adminFilterApply');
const adminFilterClear = qs('adminFilterClear');
const adminFilterPanel = qs('admin-filter-panel');
const adminActiveFilters = qs('admin-active-filters');
const adminBulkEdit = qs('adminBulkEdit');
const adminCreateUserBtn = qs('adminCreateUserBtn');
const navDrawerCreateUser = qs('nav-drawer-create-user');
const navDrawerCompanies = qs('nav-drawer-companies');
const btnCreateUserSubmit = qs('btn-create-user-submit');
const drawerEditProfile = qs('drawerEditProfile');
const profileCompanyInput = qs('profile-company');
const profileSupervisedSelect = qs('profile-supervised-companies');
const btnProfileSave = qs('btn-profile-save');
const newUserCompany = qs('new-user-company');
const newUserSupervisedContainer = qs('new-user-supervised-container');
const editScopeContainer = qs('edit-scope-companies-container');
const profileSupervisedContainer = qs('profile-supervised-companies-container');
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
let sortState = { key: 'createdAt', dir: 'desc' };

/* ===== Registro: helpers para supervisores ===== */
function renderMultiSelect(container, options, selectedValues = []) {
  if (!container) return;
  container.innerHTML = '';
  
  if (!options || options.length === 0) {
    container.innerHTML = '<div style="padding: 0.5rem; color: #64748b; font-size: 0.9rem;">No hay empresas disponibles</div>';
    return;
  }

  options.forEach(opt => {
    const isSelected = selectedValues.includes(opt);
    const div = document.createElement('div');
    div.className = 'multi-select-item';
    div.innerHTML = `
      <label style="display: flex; align-items: center; width: 100%; cursor: pointer; margin: 0;">
        <input type="checkbox" value="${opt}" ${isSelected ? 'checked' : ''}>
        <span>${opt}</span>
      </label>
    `;
    container.appendChild(div);
  });
}

function populateSupervisedCompanies(containerEl = null, selectedValues = []) {
  // Si no se pasa contenedor, intentamos usar los conocidos si existen
  if (containerEl) {
    renderMultiSelect(containerEl, supervisedCompanyOptions, selectedValues);
  } else {
    // Por defecto actualizamos todos los contenedores conocidos
    if (newUserSupervisedContainer) renderMultiSelect(newUserSupervisedContainer, supervisedCompanyOptions);
    if (editScopeContainer) renderMultiSelect(editScopeContainer, supervisedCompanyOptions);
    if (profileSupervisedContainer) renderMultiSelect(profileSupervisedContainer, supervisedCompanyOptions);
  }
}

function getSelectedSupervisedCompaniesFrom(containerEl) {
  if (!containerEl) return [];
  const checkboxes = containerEl.querySelectorAll('input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

// Deprecated but kept for compatibility if needed (though we replaced usages)
function getSelectedSupervisedCompanies() {
  return []; 
}

function syncUserFields() {
  if (!regRole) return;
  const isSupervisorRole = regRole.value === 'supervisor';
  toggle(supervisorExtras, isSupervisorRole);

  let supervisorType = 'contratista';
  supervisorOriginInputs.forEach(radio => {
    if (radio.checked) supervisorType = radio.value;
  });

  // Empresa base: si supervisor Cerrejón, se bloquea en Cerrejón
  if (regCompany) {
    // regCompany is now a SELECT
    if (isSupervisorRole && supervisorType === 'cerrejon') {
      regCompany.value = 'Cerrejón';
      // Selects don't have readonly, but we can disable options or just set value
      // For UX, we can disable it
      regCompany.disabled = true; 
      // But disabled inputs don't submit value, so we might need to enable on submit or use a hidden input
      // Or just let it be selectable but reset if changed? 
      // Let's just set value. If user changes it, we might validate later.
      // Actually, for Cerrejon supervisor, company MUST be Cerrejon.
      // Let's keep it simple: set value.
    } else {
      regCompany.disabled = false;
      if (regCompany.value === 'Cerrejón' && supervisorType !== 'cerrejon') {
        regCompany.value = '';
      }
    }
  }

  // Empresas supervisadas solo para supervisor de Cerrejón
  if (supervisorCompaniesWrapper) {
    const showSupervised = isSupervisorRole && supervisorType === 'cerrejon';
    toggle(supervisorCompaniesWrapper, showSupervised);
  }

  // Campo supervisor responsable: visible solo si NO es supervisor
  if (regSupervisorWrapper && regSupervisor) {
    toggle(regSupervisorWrapper, !isSupervisorRole);
    regSupervisor.required = !isSupervisorRole;
    if (isSupervisorRole) {
      regSupervisor.value = '';
    }
  }
}

/* ===== Modal de alcance para supervisores (admin/superadmin) ===== */
let scopeTargetId = null;

function openScopeModal(userId) {
  const target = lastRequests.find(r => r.id === userId);
  if (!target) return;
  scopeTargetId = userId;
  const current = Array.isArray(target.supervisedCompanies) ? target.supervisedCompanies : [];
  populateSupervisedCompanies(editScopeContainer, current);
  
  if (scopeModalEl && window.bootstrap) {
    const modal = new bootstrap.Modal(scopeModalEl);
    modal.show();
  }
}

async function saveScopeModal() {
  if (!scopeTargetId) return;
  const selected = getSelectedSupervisedCompaniesFrom(editScopeContainer);
  try {
    setLoading(true);
    await updateUserFields(scopeTargetId, { supervisedCompanies: selected });

    const idx = lastRequests.findIndex(r => r.id === scopeTargetId);
    if (idx !== -1) {
      lastRequests[idx] = { ...lastRequests[idx], supervisedCompanies: selected };
    }
    renderRequests(lastRequests);

    const modalInstance = bootstrap.Modal.getInstance(scopeModalEl);
    if (modalInstance) modalInstance.hide();
    Swal.fire('Guardado', 'Alcance actualizado.', 'success');
  } catch (err) {
    console.error('Error al actualizar alcance', err);
    Swal.fire('Error', mapFirebaseError(err), 'error');
  } finally {
    setLoading(false);
    scopeTargetId = null;
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
  setText(drawerCompany?.id, profile?.company || '—');
  const supervised = Array.isArray(profile?.supervisedCompanies) && profile.supervisedCompanies.length
    ? profile.supervisedCompanies.join(', ')
    : '—';
  const isSup = isSupervisor(roles) || isSuperAdmin(roles) || roles.includes('admin');
  if (drawerSupervisedWrap) {
    drawerSupervisedWrap.style.display = isSup ? 'block' : 'none';
  }
  setText(drawerSupervised?.id, supervised);
  setText(drawerEmail?.id, profile?.email || '—');
}

function updatePendingBadges(count = 0) {
  if (navRequestsBadge) {
    navRequestsBadge.textContent = count;
    navRequestsBadge.classList.toggle('hidden', count === 0);
  }
  if (pendingPill) {
    pendingPill.textContent = `${count} pendientes`;
    pendingPill.classList.toggle('hidden', count === 0);
  }
}

function openDrawer() {
  if (!drawer) return;
  drawer.classList.add('is-open');
  toggle(drawer, true);
  if (drawerBackdrop) {
    drawerBackdrop.classList.remove('hidden');
    // Force reflow to enable transition
    void drawerBackdrop.offsetWidth;
    drawerBackdrop.classList.add('is-visible');
  }
}

function closeDrawer() {
  if (!drawer) return;
  drawer.classList.remove('is-open');
  if (drawerBackdrop) {
    drawerBackdrop.classList.remove('is-visible');
    setTimeout(() => {
      drawerBackdrop.classList.add('hidden');
    }, 300);
  }
  setTimeout(() => toggle(drawer, false), 180);
}

function syncAdminVisibility(roles, approved) {
  const allowed = canAccessAdmin(roles, approved);
  if (navDrawerAdmin) {
    toggle(navDrawerAdmin, allowed);
  }
  if (navDrawerCompanies) {
    const canManageCompanies = isSuperAdmin(roles) || roles.includes('admin');
    toggle(navDrawerCompanies, canManageCompanies);
  }
  if (drawerEditProfile) {
    const canEditProfile = isSupervisor(roles) || isSuperAdmin(roles) || roles.includes('admin');
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
  
  // Filter out empty strings to ensure fallback works if the array is effectively empty
  const scoped = Array.isArray(currentProfile?.supervisedCompanies)
    ? currentProfile.supervisedCompanies.filter(c => c && c.trim())
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

function valueForSort(r, key) {
  switch (key) {
    case 'displayName': return (r.displayName || '').toLowerCase();
    case 'email': return (r.email || '').toLowerCase();
    case 'company': return (r.company || '').toLowerCase();
    case 'supervisor': return (r.supervisor || '').toLowerCase();
    case 'role': return (r.requestedRole || (Array.isArray(r.roles) ? r.roles[0] : '') || '').toLowerCase();
    case 'status': return isPendingRequest(r) ? 'pending' : 'approved';
    case 'createdAt':
      if (r.createdAt?.toMillis) return r.createdAt.toMillis();
      if (r.createdAt?.seconds) return r.createdAt.seconds * 1000;
      const d = r.createdAt ? new Date(r.createdAt) : null;
      return d ? d.getTime() : 0;
    default:
      return '';
  }
}

function applySort(rows) {
  if (!sortState || !sortState.key) return rows;
  const dir = sortState.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = valueForSort(a, sortState.key);
    const vb = valueForSort(b, sortState.key);
    if (va === vb) return 0;
    return va > vb ? dir : -dir;
  });
}

function openProfileEditor() {
  const allowed = isSupervisor(currentRoles) || isSuperAdmin(currentRoles) || currentRoles.includes('admin');
  if (!allowed) return;

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
  
  populateSupervisedCompanies(profileSupervisedContainer, supervised);

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
  const supervised = getSelectedSupervisedCompaniesFrom(profileSupervisedContainer);

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
  const isTargetSupervisor = Array.isArray(r.roles) ? r.roles.includes('supervisor') : r.requestedRole === 'supervisor';

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

    const isSupervisorUser = isSupervisor(currentRoles) && !isSuperAdmin(currentRoles);
    const companyReadOnly = isSupervisorUser ? 'readonly disabled style="background-color: #f3f4f6; color: #6b7280;"' : '';

    const nameInput = `<input type=\"text\" class=\"admin-input\" value=\"${r.displayName || ''}\" data-field=\"displayName\" ${isBulk ? autoSaveAttr.replace('FIELD','displayName') : ''}>`;
    const companyInput = isSupervisorUser 
      ? `<input type=\"text\" class=\"admin-input\" value=\"${r.company || ''}\" data-field=\"company\" readonly disabled style=\"background-color: #f3f4f6; color: #6b7280;\">`
      : `<select class=\"admin-input\" data-field=\"company\" ${isBulk ? autoSaveAttr.replace('FIELD','company') : ''}>
           <option value=\"\">Seleccionar...</option>
           ${supervisedCompanyOptions.map(c => `<option value=\"${c}\" ${c === r.company ? 'selected' : ''}>${c}</option>`).join('')}
         </select>`;
    
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
      if (isTargetSupervisor) {
        parts.push(`<button class=\"admin-edit-btn\" data-scope=\"${r.id}\">Alcance</button>`);
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
  const pendingCount = lastRequests.filter(isPendingRequest).length;
  updatePendingBadges(pendingCount);
  const sorted = applySort(lastRequests);
  buildFilterOptions();
  const filtered = sorted.filter(r => {
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

function attachSortHandlers() {
  const headers = document.querySelectorAll('th.sortable');
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (!key) return;
      if (sortState.key === key) {
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortState = { key, dir: key === 'createdAt' ? 'desc' : 'asc' };
      }
      headers.forEach(h => h.classList.remove('is-asc', 'is-desc'));
      th.classList.add(sortState.dir === 'asc' ? 'is-asc' : 'is-desc');
      renderRequests(lastRequests);
    });
  });
  headers.forEach(th => {
    if (th.dataset.sort === sortState.key) {
      th.classList.add(sortState.dir === 'asc' ? 'is-asc' : 'is-desc');
    }
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

/* ===== HISTORY LOGIC ===== */
async function loadHistoryPage() {
  if (!auth.currentUser) return;
  
  const loader = qs('history-loading');
  const empty = qs('history-empty');
  const list = qs('history-list');
  
  toggle(loader, true);
  toggle(empty, false);
  list.innerHTML = '';
  
  try {
    // 1. Obtener Local
    let localData = [];
    try {
      localData = JSON.parse(localStorage.getItem('priotool_history') || '[]').map(item => ({
        ...item,
        source: 'local'
      }));
    } catch (e) {
      console.warn('Error leyendo historial local', e);
    }

    // 2. Obtener Cloud
    let cloudData = [];
    try {
      cloudData = await getHistory(auth.currentUser.uid);
      cloudData = cloudData.map(item => ({ ...item, source: 'cloud' }));
    } catch (e) {
      console.error('Error fetching cloud history', e);
    }

    // 3. Mezclar y Ordenar
    const allData = [...cloudData, ...localData];
    
    // Ordenar por fecha descendente
    allData.sort((a, b) => {
      const tA = a.timestamp?.seconds || (new Date(a.timestamp).getTime() / 1000);
      const tB = b.timestamp?.seconds || (new Date(b.timestamp).getTime() / 1000);
      return tB - tA;
    });
    
    toggle(loader, false);
    
    if (allData.length === 0) {
      toggle(empty, true);
      return;
    }
    
    allData.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-card';
      
      // Format date
      let dateStr = '—';
      let ts = item.timestamp;
      if (ts) {
        const d = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
        dateStr = d.toLocaleString();
      }
      
      // Color class
      const colorClass = `priority-${(item.priorityCode || 'pl').toLowerCase()}`;
      
      // Icono de fuente
      const sourceIcon = item.source === 'cloud' ? '☁️' : '📱';
      const sourceTitle = item.source === 'cloud' ? 'Nube' : 'Local';

      card.innerHTML = `
        <div class="history-header">
          <div class="history-badge ${colorClass}">${(item.priorityCode || 'PL').toUpperCase()}</div>
          <div class="history-meta">
            <span class="history-date">${dateStr} <span title="${sourceTitle}">${sourceIcon}</span></span>
            <span class="history-asset">Activo: ${item.assetNumber || 'N/A'}</span>
          </div>
        </div>
        <div class="history-body">
          <p><strong>Plazo:</strong> ${item.deadline || '—'}</p>
          ${item.comment ? `<p class="history-comment">"${item.comment}"</p>` : ''}
        </div>
      `;
      list.appendChild(card);
    });
    
  } catch (err) {
    console.error('Error loading history', err);
    toggle(loader, false);
    list.innerHTML = '<p class="error-msg">Error al cargar el historial.</p>';
  }
}

// Exportar Historial a CSV
if (btnExportHistory) {
  btnExportHistory.addEventListener('click', async () => {
    try {
      // 1. Obtener Local
      let localData = [];
      try {
        localData = JSON.parse(localStorage.getItem('priotool_history') || '[]').map(item => ({
          ...item,
          source: 'local'
        }));
      } catch (e) { console.warn(e); }

      // 2. Obtener Cloud (si hay usuario)
      let cloudData = [];
      if (auth.currentUser) {
        try {
          cloudData = await getHistory(auth.currentUser.uid);
          cloudData = cloudData.map(item => ({ ...item, source: 'cloud' }));
        } catch (e) { console.error(e); }
      }

      // 3. Mezclar y Ordenar
      const allData = [...cloudData, ...localData];
      allData.sort((a, b) => {
        const tA = a.timestamp?.seconds || (new Date(a.timestamp).getTime() / 1000);
        const tB = b.timestamp?.seconds || (new Date(b.timestamp).getTime() / 1000);
        return tB - tA;
      });

      if (allData.length === 0) {
        alert('No hay datos para exportar.');
        return;
      }

      // 4. Generar CSV
      const headers = ['Fecha', 'Prioridad', 'Activo', 'Plazo', 'Comentario', 'Fuente'];
      const rows = allData.map(item => {
        let dateStr = '';
        let ts = item.timestamp;
        if (ts) {
          const d = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
          dateStr = d.toLocaleString().replace(/,/g, ''); // Evitar comas en CSV
        }
        
        return [
          dateStr,
          (item.priorityCode || '').toUpperCase(),
          (item.assetNumber || '').replace(/,/g, ' '),
          (item.deadline || '').replace(/,/g, ' '),
          (item.comment || '').replace(/(\r\n|\n|\r)/gm, " ").replace(/,/g, ' '),
          item.source === 'cloud' ? 'Nube' : 'Local'
        ].join(',');
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n'); // BOM para Excel
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `historial_priotool_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Error exportando:', error);
      alert('Error al exportar datos.');
    }
  });
}

/* ===== NAVIGATION ===== */
function showPage(pageId) {
  [pageForm, pageAdmin, pageHistory].forEach(p => {
    if (p) toggle(p, false);
  });
  
  [navDrawerForm, navDrawerAdmin, navDrawerHistory].forEach(n => {
    if (n) n.classList.remove('is-active');
  });
  
  if (pageId === 'form') {
    toggle(pageForm, true);
    navDrawerForm.classList.add('is-active');
  } else if (pageId === 'admin') {
    toggle(pageAdmin, true);
    if (navDrawerAdmin) navDrawerAdmin.classList.add('is-active');
    loadAdminPage();
  } else if (pageId === 'history') {
    toggle(pageHistory, true);
    if (navDrawerHistory) navDrawerHistory.classList.add('is-active');
    loadHistoryPage();
  }
  
  // Close drawer on mobile
  if (window.innerWidth < 768) {
    toggle(drawer, false);
    toggle(drawerBackdrop, false);
  }
}

navDrawerForm.addEventListener('click', () => { showPage('form'); closeDrawer(); });
if (navDrawerAdmin) navDrawerAdmin.addEventListener('click', () => { showPage('admin'); closeDrawer(); });
if (navDrawerHistory) navDrawerHistory.addEventListener('click', () => { showPage('history'); closeDrawer(); });
if (navDrawerCompanies) {
  navDrawerCompanies.addEventListener('click', () => {
    openManageCompaniesModal();
    closeDrawer();
  });
}

async function loadAdminPage() {
  const allowed = canAccessAdmin(currentRoles, currentProfile?.approved);
  if (!allowed) return;
  
  updateCreateUserButtonVisibility();

  try {
    setLoading(true);
    const rows = await fetchRequests(currentProfile, currentRoles);
    updatePendingBadges(rows.filter(isPendingRequest).length);
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

async function refreshPendingCount() {
  const allowed = canAccessAdmin(currentRoles, currentProfile?.approved);
  if (!allowed) {
    updatePendingBadges(0);
    return;
  }
  try {
    const rows = await fetchRequests(currentProfile, currentRoles);
    updatePendingBadges(rows.filter(isPendingRequest).length);
  } catch (err) {
    updatePendingBadges(0);
  }
}

function updateCreateUserButtonVisibility() {
  const canCreate = isSuperAdmin(currentRoles) || currentRoles.includes('admin') || isSupervisor(currentRoles);
  toggle(adminCreateUserBtn, canCreate);
  toggle(navDrawerCreateUser, canCreate);

  const canManageCompanies = isSuperAdmin(currentRoles) || currentRoles.includes('admin') || isSupervisor(currentRoles);
  toggle(adminManageCompaniesBtn, canManageCompanies);
}

function openCreateUserModal() {
  const modalEl = document.getElementById('createUserModal');
  const roleSelect = document.getElementById('new-user-role');
  const supervisedWrapper = document.getElementById('new-user-supervised-wrapper');
  const supervisedSelect = document.getElementById('new-user-supervised');

  if (!modalEl || !roleSelect) return;

  document.getElementById('create-user-form').reset();
  if (supervisedWrapper) supervisedWrapper.classList.add('hidden');

  // Populate supervised companies
  populateSupervisedCompanies(newUserSupervisedContainer);

  // Role change listener
  roleSelect.onchange = () => {
      if (supervisedWrapper) {
          if (roleSelect.value === 'supervisor') {
              supervisedWrapper.classList.remove('hidden');
          } else {
              supervisedWrapper.classList.add('hidden');
          }
      }
  };

  // Definir roles permitidos según jerarquía
  let allowedRoles = [];
  if (isSuperAdmin(currentRoles) || currentRoles.includes('admin')) {
    allowedRoles = ['tecnico', 'analista', 'planeador', 'programador', 'supervisor', 'admin'];
  } else if (isSupervisor(currentRoles)) {
    allowedRoles = ['tecnico', 'analista', 'planeador', 'programador'];
  }

  roleSelect.innerHTML = '<option value=\"\">Seleccionar...</option>' + 
    allowedRoles.map(r => `<option value=\"${r}\">${r}</option>`).join('');

  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

async function handleCreateUser() {
  const email = document.getElementById('new-user-email').value.trim();
  // Generar contraseña aleatoria temporal (ya que el usuario usará magic link o reset password)
  const password = Math.random().toString(36).slice(-8) + "P1!";
  const name = document.getElementById('new-user-name').value.trim();
  const company = document.getElementById('new-user-company').value.trim();
  const role = document.getElementById('new-user-role').value;

  if (!email || !name || !company || !role) {
    Swal.fire('Error', 'Por favor completa todos los campos.', 'warning');
    return;
  }

  let supervisedCompanies = [];
  if (role === 'supervisor') {
      supervisedCompanies = getSelectedSupervisedCompaniesFrom(newUserSupervisedContainer);
      if (supervisedCompanies.length === 0) {
           Swal.fire('Atención', 'Debes seleccionar al menos una empresa para supervisar.', 'warning');
           return;
      }
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
      currentUserEmail: currentProfile?.email,
      supervisedCompanies
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
  const email = qs('login-email').value.trim().toLowerCase();
  
  if (!email) {
    showError(loginAlert, 'Por favor ingresa tu correo.');
    return;
  }

  const isCerrejonEmail = email.endsWith('@cerrejon.com');
  const isAdminEmail = email === 'dilsonzm@gmail.com';

  // --- ADMIN LOGIN (PASSWORD) ---
  if (isAdminEmail) {
    const { value: password } = await Swal.fire({
      title: 'Ingresar contraseña',
      input: 'password',
      inputLabel: 'Ingresa tu contraseña para continuar',
      inputPlaceholder: 'Contraseña',
      showCancelButton: true,
      confirmButtonText: 'Ingresar',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value) {
          return 'Debes ingresar la contraseña';
        }
      }
    });

    if (password) {
      try {
        setLoading(true);
        await login(email, password);
        // Success handled by watchAuth
      } catch (err) {
        console.error('Error login:', err);
        showError(loginAlert, 'Contraseña incorrecta o error de acceso.');
        setLoading(false);
      }
    }
    return;
  }

  // --- INSTANT LOGIN (SHARED SECRET) FOR EVERYONE ELSE ---
  // Cerrejon users -> Auto-approved
  // Contractors -> Must be approved by Admin
  try {
    setLoading(true);
    
    // Determine which secret to use (or use same for simplicity if desired, but let's keep logic clean)
    // Actually, to allow "pass at once", we need to know the password.
    // We will use a specific secret for Contractors too.
    let SHARED_SECRET = 'PriOTool.Contractor.Access.2025!';
    if (isCerrejonEmail) {
      SHARED_SECRET = 'PriOTool.Cerrejon.Access.2025!';
    }
    
    try {
      // 1. Try to login
      await login(email, SHARED_SECRET);
      
      // Login Success
      // Note: watchAuth will check if user is approved. If not, it will show pending screen.
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.addEventListener('mouseenter', Swal.stopTimer)
          toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
      });
      Toast.fire({ icon: 'success', title: '¡Bienvenido nuevamente!' });
      return;

    } catch (loginErr) {
      // 2. If login fails (User not found OR Wrong Password), try to REGISTER (only for Cerrejon)
      // Contractors must register via the form first.
      
      if (isCerrejonEmail && ['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(loginErr.code)) {
        try {
          console.log('Login falló, intentando registrar usuario corporativo...');
          const prefix = email.split('@')[0];
          const name = prefix.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
          
          await registerUser({
            name: name,
            email: email,
            password: SHARED_SECRET,
            company: 'Cerrejón',
            supervisor: 'N/A',
            requestedRole: 'empleado',
            supervisorType: 'cerrejon',
            supervisedCompanies: [],
            approved: true,
            roles: ['empleado']
          });
          
          Swal.fire({
            title: '¡Bienvenido!',
            text: 'Tu cuenta ha sido creada y autorizada automáticamente.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
          return;
        } catch (regErr) {
          if (regErr.code === 'auth/email-already-in-use') throw new Error('CONFLICT_CREDENTIALS');
          throw regErr;
        }
      } else {
        // For contractors, if login fails, it means they haven't registered or password changed
        console.warn('Login error code:', loginErr.code);
        
        if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(loginErr.code)) {
           setLoading(false);
           // Assume user needs to register (or has wrong password, which will be caught at registration)
           Swal.fire({
             title: 'Cuenta no encontrada',
             text: 'No encontramos una cuenta activa para este correo. Te redirigiremos al registro.',
             icon: 'info',
             timer: 2000,
             showConfirmButton: false
           }).then(() => {
              switchForm('register');
              const regEmailInput = qs('reg-email');
              if(regEmailInput) regEmailInput.value = email;
           });
           return;
        } else {
           throw loginErr;
        }
      }
    }

  } catch (err) {
    setLoading(false);
    if (err.message === 'CONFLICT_CREDENTIALS') {
      Swal.fire({
        title: 'Conflicto de Cuenta',
        text: 'Tu usuario ya existe pero tiene una configuración antigua. Contacta al administrador.',
        icon: 'error'
      });
    } else {
      console.error('Error en login:', err);
      showError(loginAlert, 'Error de acceso: ' + err.message);
    }
    return;
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

  const nameInput = qs('reg-name').value.trim();
  const email = qs('reg-email').value.trim();
  // Passwords removed for Auto-Login flow
  const companyInput = regCompany ? regCompany.value.trim() : '';
  // Supervisor input removed
  const requestedRole = regRole ? regRole.value : '';

  // --- LOGIC FOR CERREJON DOMAIN ---
  const isCerrejonEmail = email.toLowerCase().endsWith('@cerrejon.com');
  
  let finalName = nameInput;
  let finalCompany = companyInput;
  let finalRole = requestedRole;
  let isApproved = false;
  let finalRoles = ['solicitado'];
  
  // Default Shared Secret for Contractors
  let finalPassword = 'PriOTool.Contractor.Access.2025!';

  if (isCerrejonEmail) {
    // Auto-extract name from email (e.g. dilson.zuleta.ext -> Dilson Zuleta Ext)
    const prefix = email.split('@')[0];
    finalName = prefix.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    finalCompany = 'Cerrejón';
    finalRole = 'empleado'; // Default role for Cerrejon
    isApproved = true;
    finalRoles = ['empleado'];
    // Use Shared Secret for Cerrejon users
    finalPassword = 'PriOTool.Cerrejon.Access.2025!';
    console.log('Auto-configurando usuario Cerrejón:', { finalName, finalRole });
  } else {
    // Contractor Validation
    if (!companyInput) {
      showError(registerAlert, 'Por favor completa todos los campos obligatorios.');
      return;
    }
  }

  if (!finalName || !email || (!isCerrejonEmail && !finalRole)) {
    showError(registerAlert, 'Por favor completa todos los campos obligatorios.');
    return;
  }

  try {
    setLoading(true);
    await registerUser({
      name: finalName,
      email,
      password: finalPassword,
      company: finalCompany,
      supervisor: 'N/A', // Supervisor field removed
      requestedRole: finalRole,
      supervisorType: 'contractor', // Default
      supervisedCompanies: [],
      approved: isApproved,
      roles: finalRoles
    });

    if (isApproved) {
      Swal.fire({
        title: '¡Bienvenido!',
        text: `Tu cuenta ha sido autorizada automáticamente como ${finalName}.`,
        icon: 'success',
        confirmButtonText: 'Ingresar'
      }).then(() => {
        // User is already logged in by registerUser
        // Reload to trigger auth state change properly or just let watchAuth handle it
        window.location.reload();
      });
    } else {
      Swal.fire({
        title: 'Solicitud enviada',
        text: 'Tu registro está pendiente de aprobación. Te notificaremos cuando el administrador valide tus datos.',
        icon: 'success',
        confirmButtonText: 'Entendido'
      }).then(() => {
        toggle(registerCard, false);
        toggle(loginCard, true);
        registerForm.reset();
      });
    }
  } catch (err) {
    console.error(err);
    if (err.code === 'auth/email-already-in-use') {
      showError(registerAlert, 'Este correo ya está registrado. Intenta iniciar sesión.');
    } else {
      showError(registerAlert, 'Error al registrar: ' + err.message);
    }
  } finally {
    setLoading(false);
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
    showPage('form');
  }
  if (approved && typeof window.prioShowIntro === 'function') {
    window.prioShowIntro();
  }
  if (canAccessAdmin(currentRoles, approved)) {
    refreshPendingCount();
  } else {
    updatePendingBadges(0);
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
  regRole.addEventListener('change', syncUserFields);
}
supervisorOriginInputs.forEach(radio => {
  radio.addEventListener('change', syncUserFields);
});
syncUserFields();
attachSortHandlers();

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
if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);
if (drawerLogout) drawerLogout.addEventListener('click', () => logout());
// if (navDrawerAdmin) navDrawerAdmin.addEventListener('click', () => { goToPage('admin'); closeDrawer(); });
// if (navDrawerForm) navDrawerForm.addEventListener('click', () => { goToPage('form'); closeDrawer(); });
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
    const scopeBtn = evt.target.closest('[data-scope]');
    if (scopeBtn) {
      const id = scopeBtn.dataset.scope;
      openScopeModal(id);
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
  drawerEditProfile.addEventListener('click', () => {
    openProfileEditor();
    closeDrawer();
  });
}
if (btnProfileSave) {
  btnProfileSave.addEventListener('click', saveProfileEdits);
}
if (pendingPill) {
  pendingPill.addEventListener('click', () => {
    if (canAccessAdmin(currentRoles, currentProfile?.approved)) {
      goToPage('admin');
    }
  });
}
if (btnScopeSave) {
  btnScopeSave.addEventListener('click', saveScopeModal);
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
const toggleBtns = document.querySelectorAll('.toggle-password');

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registered'))
      .catch(err => console.log('SW registration failed', err));
  });
}

// Password Toggle
toggleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.previousElementSibling;
    if (input.type === 'password') {
      input.type = 'text';
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    } else {
      input.type = 'password';
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    }
  });
});

// Password Validation
if (password && passwordConfirm) {
  const validatePassword = () => {
    if (password.value !== passwordConfirm.value) {
      passwordConfirm.setCustomValidity("Las contraseñas no coinciden");
      passwordConfirm.classList.remove('valid-match');
    } else {
      passwordConfirm.setCustomValidity("");
      if (passwordConfirm.value) {
        passwordConfirm.classList.add('valid-match');
      } else {
        passwordConfirm.classList.remove('valid-match');
      }
    }
  };
  password.addEventListener('change', validatePassword);
  passwordConfirm.addEventListener('keyup', validatePassword);
}

if (auth) {
  // Check for Magic Link Sign-in
  if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
      email = window.prompt('Por favor confirma tu correo electrónico para ingresar:');
    }
    
    if (email) {
      signInWithEmailLink(auth, email, window.location.href)
        .then((result) => {
          window.localStorage.removeItem('emailForSignIn');
          // User is signed in, watchAuth will handle the rest
          // If new user, we might need to create the user doc here if not exists
          ensureUserDoc(result.user);
        })
        .catch((error) => {
          console.error('Error signing in with email link', error);
          Swal.fire('Error', 'El enlace es inválido o ha expirado.', 'error');
        });
    }
  }

  watchAuth(async user => {
    if (!user) {
      renderState('auth');
      return;
    }
    // initCompanies ya se llama al inicio y mantiene la suscripción activa
    hydrateSession(user);
  });
}

/* ===== Gestión de Empresas ===== */
if (adminManageCompaniesBtn) {
  adminManageCompaniesBtn.addEventListener('click', openManageCompaniesModal);
}

if (btnAddCompany) {
  btnAddCompany.addEventListener('click', handleAddCompany);
}

function openManageCompaniesModal() {
  renderCompaniesList();
  if (window.bootstrap && manageCompaniesModalEl) {
    const modal = new bootstrap.Modal(manageCompaniesModalEl);
    modal.show();
  }
}

function renderCompaniesList() {
  if (!companiesListEl) return;
  companiesListEl.innerHTML = '';
  supervisedCompanyOptions.forEach(c => {
    const li = document.createElement('li');
    li.style.cssText = 'padding: 10px 12px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;';
    li.innerHTML = `
      <span class="company-name-text">${c}</span>
      <input type="text" class="company-name-input hidden" value="${c}" style="padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.9rem;">
      <div style="display: flex; gap: 8px;">
        <button type="button" class="btn-edit-company" data-company="${c}" style="background: none; border: none; color: #3b82f6; cursor: pointer;">✎</button>
        <button type="button" class="btn-save-company hidden" data-original="${c}" style="background: none; border: none; color: #10b981; cursor: pointer;">💾</button>
        <button type="button" class="btn-delete-company" data-company="${c}" style="background: none; border: none; color: #ef4444; cursor: pointer;">🗑️</button>
      </div>
    `;
    companiesListEl.appendChild(li);
  });

  // Attach handlers
  companiesListEl.querySelectorAll('.btn-delete-company').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteCompany(btn.dataset.company));
  });

  companiesListEl.querySelectorAll('.btn-edit-company').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      const span = li.querySelector('.company-name-text');
      const input = li.querySelector('.company-name-input');
      const saveBtn = li.querySelector('.btn-save-company');
      const editBtn = li.querySelector('.btn-edit-company');
      
      toggle(span, false);
      toggle(input, true);
      toggle(saveBtn, true);
      toggle(editBtn, false);
      input.focus();
    });
  });

  companiesListEl.querySelectorAll('.btn-save-company').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      const input = li.querySelector('.company-name-input');
      const originalName = btn.dataset.original;
      const newName = input.value.trim();
      handleEditCompany(originalName, newName);
    });
  });
}

async function handleEditCompany(oldName, newName) {
  if (!newName || newName === oldName) {
    renderCompaniesList(); // Reset view
    return;
  }
  
  if (supervisedCompanyOptions.includes(newName)) {
    Swal.fire('Error', 'Ya existe una empresa con ese nombre.', 'warning');
    return;
  }

  const idx = supervisedCompanyOptions.indexOf(oldName);
  if (idx !== -1) {
    supervisedCompanyOptions[idx] = newName;
    supervisedCompanyOptions.sort();
    renderCompaniesList();
    renderAllCompanyDropdowns();
    
    try {
      await updateCompaniesDoc(supervisedCompanyOptions);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Empresa actualizada',
        showConfirmButton: false,
        timer: 1500
      });
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudo actualizar.', 'error');
    }
  }
}

async function handleAddCompany() {
  const name = newCompanyInput.value.trim();
  if (!name) return;
  if (supervisedCompanyOptions.includes(name)) {
    Swal.fire('Error', 'La empresa ya existe.', 'warning');
    return;
  }
  
  supervisedCompanyOptions.push(name);
  supervisedCompanyOptions.sort();
  newCompanyInput.value = '';
  renderCompaniesList();
  renderAllCompanyDropdowns();
  
  try {
    await updateCompaniesDoc(supervisedCompanyOptions);
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Empresa agregada',
      showConfirmButton: false,
      timer: 1500
    });
  } catch (e) {
    console.error(e);
    Swal.fire('Error', 'No se pudo guardar.', 'error');
  }
}

async function handleDeleteCompany(name) {
  const result = await Swal.fire({
    title: '¿Eliminar empresa?',
    text: name,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (result.isConfirmed) {
    supervisedCompanyOptions = supervisedCompanyOptions.filter(c => c !== name);
    renderCompaniesList();
    renderAllCompanyDropdowns();
    try {
      await updateCompaniesDoc(supervisedCompanyOptions);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Empresa eliminada',
        showConfirmButton: false,
        timer: 1500
      });
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudo guardar.', 'error');
    }
  }
}
