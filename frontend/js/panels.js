/* ════════════════════════════════════════
   RESIZABLE PANELS
════════════════════════════════════════ */
const _rs = {};

function initResizers() {
  const saved = JSON.parse(localStorage.getItem('panelWidths') || '{}');
  const layouts = {
    lectureLayout: ['--lec-c1', '--lec-c3'],
    obsLayout:     ['--obs-c1', '--obs-c3'],
    blogLayout:    ['--blog-c1'],
  };
  Object.entries(layouts).forEach(([id, vars]) => {
    const el = document.getElementById(id);
    if (!el) return;
    vars.forEach(v => { if (saved[v]) el.style.setProperty(v, saved[v]); });
  });

  document.querySelectorAll('.resizer').forEach(r => {
    r.addEventListener('mousedown', _rsDown);
  });
}

function _rsDown(e) {
  e.preventDefault();
  const resizer = e.currentTarget;
  const layout  = resizer.parentElement;
  const varName = resizer.dataset.target;
  const current = parseFloat(getComputedStyle(layout).getPropertyValue(varName)) ||
                  parseFloat(resizer.dataset.min || '200');

  document.body.classList.add('is-resizing');
  resizer.classList.add('resizer-active');
  Object.assign(_rs, { layout, varName, startX: e.clientX, startVal: current,
    min: +resizer.dataset.min || 120, max: +resizer.dataset.max || 600 });

  // 중복 리스너 방지 — 항상 제거 후 재등록
  document.removeEventListener('mousemove', _rsMove);
  document.removeEventListener('mouseup', _rsUp);
  document.addEventListener('mousemove', _rsMove);
  document.addEventListener('mouseup', _rsUp);
}

function _rsMove(e) {
  if (!_rs.layout) return;
  const { layout, varName, startX, startVal, min, max } = _rs;
  const val = Math.min(max, Math.max(min, startVal + (e.clientX - startX)));
  layout.style.setProperty(varName, val + 'px');
}

function _rsUp() {
  document.body.classList.remove('is-resizing');
  document.querySelectorAll('.resizer-active').forEach(r => r.classList.remove('resizer-active'));
  document.removeEventListener('mousemove', _rsMove);
  document.removeEventListener('mouseup', _rsUp);

  if (_rs.layout) {
    const saved = JSON.parse(localStorage.getItem('panelWidths') || '{}');
    saved[_rs.varName] = _rs.layout.style.getPropertyValue(_rs.varName);
    localStorage.setItem('panelWidths', JSON.stringify(saved));
  }
}

initResizers();
