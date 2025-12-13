
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
        return `<button type="button" class="select-option-btn ${isSelected}" onclick="selectOption('${id}', '${val}', '${safeText}')">${item.txt}</button>`;
      }).join('');

      Swal.fire({
        title: config.title,
        html: `<div style="max-height: 60vh; overflow-y: auto; padding: 4px;">${optionsHtml}</div>`,
        showConfirmButton: false,
        showCloseButton: true,
        width: '90%',
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
