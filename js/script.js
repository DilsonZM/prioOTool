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
    { txt: 'Mínima', lvl: 2 },
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
  /* sev:   1     2     3     4     5     6  */
  /* 0 Inminente  <1d */ ['pl', 'p2', 'p0', 'p0', 'p0', 'p0'],
  /* 1 Pronto     <7d */ ['pl', 'p2', 'p1', 'p0', 'p0', 'p0'],
  /* 2 Corto  7–30d   */ ['pl', 'p4', 'p2', 'p2', 'p1', 'p0'],
  /* 3 Mediano30–90d  */ ['pl', 'p5', 'p4', 'p3', 'p2', 'p1'],
  /* 4 Largo   >90d   */ ['pl', 'p5', 'p5', 'p4', 'p2', 'p1'],
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

/* =====================================================
 * 6. BOTÓN «PROCESAR»
 *    Regla especial: si Clientes = "Mínima" (lvl 2) → P5
 *    (tiene prioridad sobre la matriz)
 * ==================================================== */
procesarBtn.addEventListener('click', () => {
  const row = +document.getElementById('tiempoprobable').value; // validado por UI

  const niveles = consequenceIds
    .map(id => +document.getElementById(id).value || 0)
    .filter(Boolean);

  if (!niveles.length) {
    Swal.fire({
      icon: 'warning',
      title: 'Faltan datos',
      text: 'Seleccione al menos una consecuencia.',
      confirmButtonColor: '#fcc328'
    });
    return;
  }

  // Cálculo por matriz con severidad máxima
  const col  = Math.max(...niveles) - 1;         // 0..5
  let code   = PRIORITY_MATRIX[row][col];        // p0..pl

  // === REGLA ESPECIAL CLIENTES: Mínima -> P5 ===
  // Se comenta esta regla porque el usuario reporta que "todo da P5".
  // En la versión original también existía, pero parece ser la causa del comportamiento no deseado.
  /*
  const clientesVal = +document.getElementById('selClientes').value || 0;
  if (clientesVal === 2) {
    code = 'p5';
  }
  */

  // Reproducir sonido
  if (SUCCESS_AUDIO) {
    SUCCESS_AUDIO.play().catch(e => console.log('Audio play failed', e));
  }

  // Mostrar Modal SweetAlert2
  const color = HEX_MAP[code] || '#333';
  const plazo = PLAZO_TEXTO[code];
  // Texto oscuro para colores claros (Amarillo P3, Naranja P2, Verde P4, Azul P5)
  const textColor = ['p3', 'p2', 'p4', 'p5'].includes(code) ? '#1f1301' : '#fff';
  
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
  });
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