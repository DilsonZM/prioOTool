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
const resultados = document.querySelector('.resultados');
const spanPrio  = document.getElementById('calculo_prioridad');
const spanPlazo = document.getElementById('dias_de_ejecucion');

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

function pintarColor(code){
  const clase = COLOR_MAP[code] || '';
  resultados.querySelectorAll('article').forEach(a=>{
    Object.values(COLOR_MAP).forEach(c=>a.classList.remove(c));
    if (clase) a.classList.add(clase);
  });
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
    alert('Seleccione al menos una consecuencia.');
    return;
  }

  // Cálculo por matriz con severidad máxima
  const col  = Math.max(...niveles) - 1;         // 0..5
  let code   = PRIORITY_MATRIX[row][col];        // p0..pl

  // === REGLA ESPECIAL CLIENTES: Mínima -> P5 ===
  const clientesVal = +document.getElementById('selClientes').value || 0;
  if (clientesVal === 2) {
    code = 'p5';
  }

  spanPrio.textContent  = code.toUpperCase();
  spanPlazo.textContent = PLAZO_TEXTO[code];
  pintarColor(code);
  resultados.classList.remove('hidden');
});

/* =====================================================
 * 7. BOTÓN «BORRAR»
 * ==================================================== */
document.getElementById('borrar').addEventListener('click', () => {
  ['tiempoprobable', ...consequenceIds].forEach(id => {
    document.getElementById(id).selectedIndex = 0;
  });
  toggleConsequenceInputs(false);
  spanPrio.textContent  = '—';
  spanPlazo.textContent = '—';
  pintarColor('');
  resultados.classList.add('hidden');
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