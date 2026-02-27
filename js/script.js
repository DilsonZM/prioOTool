/* =====================================================
 * 1. LISTAS PARA POBLAR LOS SELECT
 * ==================================================== */
const DATA = {
  tiempo: [
    { txt: 'Inminente (≤ 1 día)',          row: 0 },
    { txt: 'Prontamente (≤ 7 días)',       row: 1 },
    { txt: 'Corto plazo (7 – 30 días)',    row: 2 },
    { txt: 'Mediano plazo (30 – 90 días)', row: 3 },
    { txt: 'Largo plazo (> 90 días)',      row: 4 }
  ],
  seguridad: [
    { txt: 'Sin efecto', lvl: 1 },
    { txt: 'Preocupacion minima por la seguridad', lvl: 2 },
    { txt: 'Lesión o enfermedad con primeros auxilios', lvl: 3 },
    { txt: 'Lesión o enfermedad con restricción o con tratamiento médico', lvl: 4 },
    { txt: 'Lesión / enfermedad con pérdida de tiempo', lvl: 5 },
    { txt: 'Fatalidad o incapacidad permanente', lvl: 6 }
  ],
  ambiente: [
    { txt: 'Sin efecto', lvl: 1 },
    { txt: 'Impacto mínimo y reversible – 1 sem. para remediar', lvl: 2 },
    { txt: 'Preocupación – impacto limitado pero reversible < 3 mes. Para remediar', lvl: 3 },
    { txt: 'Impacto limitado pero reversible < 2 años para remediar', lvl: 4 },
    { txt: 'Efectos masivos pero reversibles – 2-10 años para remediar', lvl: 5 },
    { txt: 'Efectos masivos e irreversibles – > 10 años para remediar', lvl: 6 }
  ],
  clientes: [
    { txt: 'Sin efecto', lvl: 1 },
    { txt: 'Mínima', lvl: 2 },
    { txt: 'Preocupación', lvl: 3 },
    { txt: 'Pérdida de reputación con impacto local', lvl: 4 },
    { txt: 'Pérdida de reputación con impacto local y Nacional', lvl: 5 },
    { txt: 'Grave pérdida de reputación con impacto nacional e internacional', lvl: 6 }
  ],
  costos: [
    { txt: 'Sin costos considerables', lvl: 1 },
    { txt: '< 10 000 USD', lvl: 2 },
    { txt: '10 000 – 100 000 USD', lvl: 3 },
    { txt: '100 000 – 300 000 USD', lvl: 4 },
    { txt: '300 000 – 500 000 USD', lvl: 5 },
    { txt: '> 500 000 USD', lvl: 6 }
  ]
};

/* =====================================================
 * 2. MATRIZ Tiempo × Severidad  → Prioridad
 *    Fila: tiempo (0..4)
 *    Col : severidad (1..6) mapeada a índice 0..5
 *    Nota: ajustada para incluir P5 según la guía nueva.
 * ==================================================== */
const PRIORITY_MATRIX = [
  // MINIMA, PRIMEROS_AUX, TRATAMIENTO, PERDIDA_TIEMPO, FATALIDAD
  ["P2",   "P1",          "P0",        "P0",           "P0"], // &lt;1 día
  ["P3",   "P2",          "P1",        "P0",           "P0"], // &lt;7 días
  ["P4",   "P3",          "P2",        "P1",           "P0"], // 7–30 días
  ["P5",   "P4",          "P3",        "P2",           "P1"], // 30–90 días
  ["P5",   "P5",          "P4",        "P3",           "P2"], // &gt;90 días
];

/* =====================================================
 *  Plazos por código de prioridad (mismos textos)
 * ==================================================== */
const PLAZO_TEXTO = {
  p0: 'Inmediato',
  p1: '7 días',
  p2: '30 días',
  p3: '60 días',
  p4: '90 días',
  p5: '180 días',   // P5: definimos 120 días (entre P4=90 y PL=1 año)
  pl: '1 año'
};

/* =====================================================
 * 3. FUNCIÓN PARA POBLAR SELECTS
 * ==================================================== */
function poblar(id, lista, key) {
  const sel = document.getElementById(id);
  lista.forEach(o =>
    sel.insertAdjacentHTML('beforeend', `<option value="${o[key]}">${o.txt}</option>`)
  );
}

/* =====  Poblar combos una sola vez  ===== */
poblar('tiempoprobable', DATA.tiempo,    'row');
poblar('selSeguridad',   DATA.seguridad, 'lvl');
poblar('selAmbiente',    DATA.ambiente,  'lvl');
poblar('selClientes',    DATA.clientes,  'lvl');
poblar('selCostos',      DATA.costos,    'lvl');

/* =====================================================
 * 4. BLOQUEAR CONSECUENCIAS HASTA QUE HAYA TIEMPO
 * ==================================================== */
const consequenceIds = ['selSeguridad','selAmbiente','selClientes','selCostos'];
const procesarBtn    = document.getElementById('procesar');

/* 4.1  Activa / desactiva */
function toggleConsequenceInputs(enable) {
  consequenceIds.forEach(id => (document.getElementById(id).disabled = !enable));
  procesarBtn.disabled = !enable;
}

/* 4.2  Estado inicial: deshabilitado */
toggleConsequenceInputs(false);

/* 4.3  Cambia con el tiempo probable */
document.getElementById('tiempoprobable').addEventListener('change', e => {
  const tieneTiempo = e.target.value !== '';
  toggleConsequenceInputs(tieneTiempo);
});

/* =====================================================
 * 5. REFERENCIAS DOM PARA RESULTADOS
 * ==================================================== */
// const resultados = document.querySelector('.resultados'); // Ya no se usa visualmente en el DOM
// const spanPrio  = document.getElementById('calculo_prioridad');
// const spanPlazo = document.getElementById('dias_de_ejecucion');

/* =====================================================
 *  COLOR SEGÚN PRIORIDAD (incluye P5)
 * ==================================================== */
const COLOR_MAP = {
  p0:'priority-p0',
  p1:'priority-p1',
  p2:'priority-p2',
  p3:'priority-p3',
  p4:'priority-p4',
  p5:'priority-p5',
  pl:'priority-pl'
};

const HEX_MAP = {
  p0: '#C00000', // Dark Red
  p1: '#FF0000', // Red
  p2: '#FFC000', // Orange
  p3: '#FFFF00', // Yellow
  p4: '#92D050', // Green
  p5: '#00B0F0', // Light Blue
  pl: '#A0A0A0'  // Grey
};

// Sonido de éxito (URL pública corta)
let SUCCESS_AUDIO = null;
try {
  SUCCESS_AUDIO = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3');
} catch (e) {
  console.warn('Audio not supported', e);
}

// Elimina un borrador local auto-guardado (si existe) cuando se guarda en la nube
function removeDraftLocal(entry) {
  const isDefaultDraft = (item) =>
    (item.comment || '') === 'Cálculo rápido' &&
    (item.assetNumber || '') === '' &&
    (item.priorityCode || '') === (entry.priorityCode || '') &&
    (item.deadline || '') === (entry.deadline || '') &&
    JSON.stringify(item.inputs || {}) === JSON.stringify(entry.inputs || {});

  try {
    const localHistory = JSON.parse(localStorage.getItem('priotool_history') || '[]');
    // Eliminar solo un borrador (el más reciente) que coincida con el cálculo
    for (let i = localHistory.length - 1; i >= 0; i--) {
      if (isDefaultDraft(localHistory[i])) {
        localHistory.splice(i, 1);
        localStorage.setItem('priotool_history', JSON.stringify(localHistory));
        break;
      }
    }
  } catch (err) {
    console.warn('No se pudo limpiar borrador local', err);
  }
}

/* =====================================================
 * 6. BOTÓN «PROCESAR»
 *    Regla especial: si Clientes = "Mínima" (lvl 2) → P5
 *    (tiene prioridad sobre la matriz)
 * ==================================================== */
procesarBtn.addEventListener('click', () => {
  console.log('Click en Procesar');
  try {
    const row = +document.getElementById('tiempoprobable').value; // validado por UI

    const niveles = consequenceIds
      .map(id => +document.getElementById(id).value || 0)
      .filter(Boolean);

    if (!niveles.length) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'warning',
          title: 'Faltan datos',
          text: 'Seleccione al menos una consecuencia.',
          confirmButtonColor: '#fcc328'
        });
      } else {
        alert('Faltan datos: Seleccione al menos una consecuencia.');
      }
      return;
    }

    // Cálculo con la nueva matriz y lógica
    const maxLvl = Math.max(...niveles);
    let code;

    if (maxLvl === 1) {
      code = 'pl'; // Caso especial para "Sin efecto"
    } else {
      const col = maxLvl - 2; // Mapea nivel 2-6 a columna 0-4
      // Se convierte a minúsculas para que coincida con las claves de los mapas de colores/texto.
      code = PRIORITY_MATRIX[row][col].toLowerCase();
    }

    // Reproducir sonido
    if (SUCCESS_AUDIO) {
      SUCCESS_AUDIO.play().catch(e => console.log('Audio play failed', e));
    }

    // Mostrar Modal SweetAlert2
    const color = HEX_MAP[code] || '#333';
    const plazo = PLAZO_TEXTO[code];
    // Texto oscuro para colores claros (Amarillo P3, Naranja P2, Verde P4, Azul P5)
    const textColor = ['p3', 'p2', 'p4', 'p5'].includes(code) ? '#1f1301' : '#fff';
    
    // Datos base para guardar (local o nube)
    const baseDataToSave = {
      priorityCode: code,
      deadline: plazo,
      assetNumber: '', // Se completa solo si se guarda en la nube
      comment: 'Cálculo rápido',
      inputs: {
          time: row,
          consequences: niveles
      }
    };
    let savedToCloud = false;

    if (typeof Swal === 'undefined') {
      console.error('SweetAlert2 no está cargado');
      alert(`Prioridad: ${code.toUpperCase()}\nPlazo: ${plazo}`);
      return;
    }

    Swal.fire({
      title: '',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
          <div style="
            background-color: ${color};
            color: ${textColor};
            width: 120px;
            height: 120px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3.5em;
            font-weight: 800;
            box-shadow: 0 10px 25px ${color}66;
            margin-bottom: 10px;
            animation: pulse 2s infinite;
          ">
            ${code.toUpperCase()}
          </div>
          <h2 style="margin: 0; font-size: 1.5em; color: #333; font-weight: 700;">PRIORIDAD</h2>
          <div style="width: 60px; height: 4px; background: ${color}; margin: 10px 0; border-radius: 2px;"></div>
          <p style="font-size: 1.1em; color: #64748b; margin: 0;">Tiempo límite de ejecución:</p>
          <div style="font-size: 2.2em; font-weight: 800; color: #0f172a;">${plazo}</div>
        </div>
        <style>
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 ${color}66; }
            70% { box-shadow: 0 0 0 20px transparent; }
            100% { box-shadow: 0 0 0 0 transparent; }
          }
        </style>
      `,
      showClass: {
        popup: 'animate__animated animate__zoomIn'
      },
      hideClass: {
        popup: 'animate__animated animate__zoomOut'
      },
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#333',
      showDenyButton: true,
      denyButtonText: 'Guardar',
      denyButtonColor: '#00B0F0',
      background: '#fff',
      padding: '2rem',
      backdrop: `rgba(0,0,0,0.4)`,
      didOpen: () => {
        const popup = Swal.getPopup();
        if(popup) {
          popup.style.borderRadius = '24px';
          popup.style.border = `4px solid ${color}`;
        }
      }
    }).then(async (result) => {
      if (result.isDenied) {
        await Swal.fire({
          title: 'Guardar Resultado',
          html: `
            <div style="text-align: left;">
              <label for="assetNumber" style="display:block; margin-bottom:5px; font-weight:600; color:#333;">Número de Activo</label>
              <input type="text" id="assetNumber" class="swal2-input" placeholder="Ej: 12345" style="margin: 0 0 15px 0; width: 100%; box-sizing: border-box;">
              
              <label for="comment" style="display:block; margin-bottom:5px; font-weight:600; color:#333;">Comentario</label>
              <textarea id="comment" class="swal2-textarea" placeholder="Opcional" style="margin: 0; width: 100%; box-sizing: border-box;"></textarea>
            </div>
          `,
          confirmButtonText: '<span style="color:#000; font-weight:bold;">Guardar</span>',
          confirmButtonColor: '#fcc328',
          showCancelButton: true,
          cancelButtonText: 'Cancelar',
          reverseButtons: true,
          preConfirm: () => {
            const assetNumber = Swal.getPopup().querySelector('#assetNumber').value;
            const comment = Swal.getPopup().querySelector('#comment').value;
            if (!assetNumber) {
              Swal.showValidationMessage('El número de activo es obligatorio');
            }
            return { assetNumber, comment };
          }
        }).then(async (inputResult) => {
          if (!inputResult.isConfirmed) return;

          const { assetNumber, comment } = inputResult.value;
          const dataToSave = {
            ...baseDataToSave,
            assetNumber,
            comment
          };

          if (window.prioSaveResult) {
             Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });
             const saveResponse = await window.prioSaveResult(dataToSave);
             if (saveResponse.success) {
                 savedToCloud = true;
                 removeDraftLocal(baseDataToSave);
                 Swal.fire('Guardado', 'El registro se ha guardado correctamente', 'success');
             } else {
                 console.error(saveResponse.error);
                 Swal.fire('Error', `No se pudo guardar: ${saveResponse.error.message || saveResponse.error}`, 'error');
             }
          } else {
             Swal.fire('Error', 'Función de guardado no disponible', 'error');
          }
        });
      }
      // Si no se guardó en la nube, persistimos en local para evitar duplicados
      if (!savedToCloud && window.prioAutoSaveLocal) {
        window.prioAutoSaveLocal(baseDataToSave);
      }
    });
  } catch (error) {
    console.error('Error en procesarBtn:', error);
    alert('Ocurrió un error al procesar: ' + error.message);
  }
});

/* =====================================================
 * 7. BOTÓN «BORRAR»
 * ==================================================== */
document.getElementById('borrar').addEventListener('click', () => {
  ['tiempoprobable', ...consequenceIds].forEach(id => {
    document.getElementById(id).selectedIndex = 0;
  });
  toggleConsequenceInputs(false);
  // spanPrio.textContent  = '—';
  // spanPlazo.textContent = '—';
  // pintarColor('');
  // resultados.classList.add('hidden');
});

/* =====================================================
 * 8. MODAL INTRODUCTORIO (solo primera visita)
 * ==================================================== */
const introModalEl = document.getElementById('introModal');
if (introModalEl && window.bootstrap) {
  const INTRO_STORAGE_KEY = 'priotool_intro_seen';
  let introModalInstance = null;

  const launchIntroModal = () => {
    if (localStorage.getItem(INTRO_STORAGE_KEY)) {
      return;
    }

    if (!introModalInstance) {
      introModalInstance = new bootstrap.Modal(introModalEl, { backdrop: 'static' });
      introModalEl.addEventListener('hidden.bs.modal', () => {
        localStorage.setItem(INTRO_STORAGE_KEY, 'true');
      });
    }

    introModalInstance.show();
  };

  window.prioShowIntro = launchIntroModal;
}
/* =====================================================
 * CUSTOM SELECT LOGIC (Replaces native selects with Swal)
 * ==================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const selectMap = {
    'tiempoprobable': { data: DATA.tiempo, key: 'row', title: 'Tiempo Probable de Falla' },
    'selSeguridad':   { data: DATA.seguridad, key: 'lvl', title: 'Seguridad y Salud' },
    'selAmbiente':    { data: DATA.ambiente, key: 'lvl', title: 'Ambiente' },
    'selClientes':    { data: DATA.clientes, key: 'lvl', title: 'Clientes' },
    'selCostos':      { data: DATA.costos, key: 'lvl', title: 'Costos' }
  };

  Object.keys(selectMap).forEach(id => {
    const originalSelect = document.getElementById(id);
    if (!originalSelect) return;

    // Hide original
    originalSelect.style.display = 'none';

    // Create fake trigger
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';
    trigger.id = `trigger-${id}`;
    trigger.textContent = 'Selecciona...';
    
    // Insert after original
    originalSelect.parentNode.insertBefore(trigger, originalSelect.nextSibling);

    // Sync initial state
    if (originalSelect.disabled) {
        trigger.disabled = true;
        trigger.classList.add('disabled');
    }

    // Click handler
    trigger.addEventListener('click', () => {
      if (originalSelect.disabled) return;

      const config = selectMap[id];
      const currentVal = originalSelect.value;

      // Generate HTML for options
      const optionsHtml = config.data.map(item => {
        const val = item[config.key];
        const isSelected = currentVal == val ? 'selected' : '';
        // Escape single quotes in text for the onclick handler
        const safeText = item.txt.replace(/'/g, "\\'");
        
        let severityClass = '';
        if (id === 'tiempoprobable') {
            // Time: 0 (Inminente) -> 4 (Largo)
            const timeMap = {
                0: 'sev-lvl-6', // Inminente (Critical - Red)
                1: 'sev-lvl-5', // Prontamente (High - Red/Orange)
                2: 'sev-lvl-4', // Corto plazo (Med/High - Orange)
                3: 'sev-lvl-3', // Mediano plazo (Med - Yellow)
                4: 'sev-lvl-2'  // Largo plazo (Low - Green)
            };
            severityClass = timeMap[val] || 'sev-lvl-1';
        } else {
            // Consequences: 1 (Sin efecto) -> 6 (Fatalidad)
            const consMap = {
                1: 'sev-lvl-1', // Grey
                2: 'sev-lvl-2', // Green
                3: 'sev-lvl-3', // Yellow
                4: 'sev-lvl-4', // Orange
                5: 'sev-lvl-5', // Red/Orange
                6: 'sev-lvl-6'  // Red
            };
            severityClass = consMap[val] || 'sev-lvl-1';
        }

        return `<button type="button" class="select-option-btn ${isSelected} ${severityClass}" onclick="selectOption('${id}', '${val}', '${safeText}')">${item.txt}</button>`;
      }).join('');

      Swal.fire({
        title: config.title,
        html: `<div style="max-height: 60vh; overflow-y: auto; padding: 4px;">${optionsHtml}</div>`,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: {
          popup: 'swal2-popup-custom-select'
        }
      });
    });
  });

  // Observer to sync disabled state
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'disabled') {
        const id = mutation.target.id;
        const trigger = document.getElementById(`trigger-${id}`);
        if (trigger) {
          trigger.disabled = mutation.target.disabled;
          trigger.classList.toggle('disabled', mutation.target.disabled);
        }
      }
    });
  });

  Object.keys(selectMap).forEach(id => {
    const el = document.getElementById(id);
    if(el) observer.observe(el, { attributes: true });
  });

  // Reset triggers on "Borrar"
  const btnBorrar = document.getElementById('borrar');
  if(btnBorrar) {
      btnBorrar.addEventListener('click', () => {
          document.querySelectorAll('.custom-select-trigger').forEach(t => t.textContent = 'Selecciona...');
      });
  }
});

// Global function for option selection
window.selectOption = function(selectId, value, text) {
  const originalSelect = document.getElementById(selectId);
  const trigger = document.getElementById(`trigger-${selectId}`);
  
  if(originalSelect && trigger) {
      originalSelect.value = value;
      trigger.textContent = text;
      
      // Trigger change event
      const event = new Event('change', { bubbles: true });
      originalSelect.dispatchEvent(event);
  }
  
  Swal.close();
};
