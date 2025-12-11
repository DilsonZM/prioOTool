const qs = id => document.getElementById(id);

function toggle(el, show) {
  if (!el) return;
  el.classList[show ? 'remove' : 'add']('hidden');
}

function setText(id, value) {
  const el = qs(id);
  if (el) el.textContent = value;
}

export { qs, toggle, setText };
