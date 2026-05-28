/* ────────────────────────────────────────
   COURSE DETAIL MODAL
──────────────────────────────────────── */
let _cdCourseId = null;
let _cdEditing  = false;
let _cdOrigDesc = '';
let _cdOrigObj  = [];

function _cdBuildModuleNodes(lectures) {
  const hasModules = lectures.some(l => l.module_name);

  if (!hasModules) {
    // 모듈 없으면 기존 flat list
    return lectures.map(l =>
      `<div class="cd-lec-item${l.completed ? ' done' : ''}"
          onclick="gotoLectureWithId('${_cdCourseId}','${l.id}')" style="cursor:pointer">
        <span class="cd-lec-num">${l.number}</span>
        <span class="cd-lec-check">${l.completed ? '✓' : '○'}</span>
        <span class="cd-lec-title">${_esc(l.title)}</span>
        ${l.youtube_url ? `<a href="${l.youtube_url}" target="_blank" class="cd-yt-link" onclick="event.stopPropagation()">▶</a>` : ''}
      </div>`
    ).join('');
  }

  // 모듈별 그룹핑
  const modOrder = [];
  const modMap   = {};
  lectures.forEach(l => {
    const m = l.module_name || '기타';
    if (!modMap[m]) { modMap[m] = []; modOrder.push(m); }
    modMap[m].push(l);
  });

  const nodes = modOrder.map((m, idx) => {
    const lecs    = modMap[m];
    const diffs   = lecs.map(l => l.difficulty).filter(Boolean);
    const avgD    = diffs.length ? Math.round(diffs.reduce((a,b)=>a+b,0)/diffs.length) : 2;
    const dc      = _DIFF_CLASS[avgD] || 'diff-2';
    const dl      = _DIFF_LABEL[avgD] || '중급';
    const doneN   = lecs.filter(l => l.completed).length;

    return `<div class="cd-mod-node${idx === 0 ? ' open' : ''}">
      <div class="cd-mod-node-head" onclick="this.closest('.cd-mod-node').classList.toggle('open')">
        <span class="cd-mod-dot ${dc}"></span>
        <span class="cd-mod-node-name">${_esc(m)}</span>
        <span class="cd-mod-node-count">${doneN}/${lecs.length}강 · ${dl}</span>
        <span class="cd-mod-node-arrow">▶</span>
      </div>
      <div class="cd-mod-lecs">
        ${lecs.map(l =>
          `<div class="cd-mod-lec${l.completed ? ' done' : ''}"
              onclick="gotoLectureWithId('${_cdCourseId}','${l.id}')" style="cursor:pointer">
            <span class="cd-mod-lec-num">${l.number}</span>
            <span class="cd-mod-lec-title">${_esc(l.title)}</span>
            ${l.youtube_url ? `<a href="${l.youtube_url}" target="_blank" class="cd-yt-link" onclick="event.stopPropagation()">▶</a>` : ''}
          </div>`
        ).join('')}
      </div>
    </div>`;
  }).join('');

  return `<div class="cd-mod-nodes">${nodes}</div>`;
}

async function courseModalOpen(courseId) {
  _cdCourseId = courseId;
  _cdEditing  = false;

  const modal = document.getElementById('courseDetailModal');
  modal.style.display = 'flex';
  _lockScroll();

  if (_allCourses.length === 0) {
    try {
      const r = await fetch('/api/v1/curriculum/');
      if (r.ok) _allCourses = await r.json();
    } catch(e) {}
  }

  const course = _allCourses.find(c => c.id === courseId);
  if (!course) return;

  const prefix = course.code.split('-')[0];
  const tagCls = _CODE_TAG_COLOR[prefix] || 't-gray';
  const codeEl = document.getElementById('cdCode');
  codeEl.textContent = course.code;
  codeEl.className = `course-tag ${tagCls}`;
  document.getElementById('cdTitle').textContent = course.title;
  document.getElementById('cdSource').textContent = course.source;

  const pct = Math.round(course.progress_pct);
  document.getElementById('cdFill').style.width = pct + '%';
  document.getElementById('cdPct').textContent = `${course.completed_count}/${course.lecture_count} 강의 완료`;

  _cdOrigDesc = course.description || '';
  _cdOrigObj  = course.objectives  || [];
  _cdRenderView();

  document.getElementById('cdEditBtn').textContent = '편집';
  document.getElementById('cdEditActions').style.display = 'none';
  document.getElementById('cdDescEdit').style.display = 'none';
  document.getElementById('cdObjEdit').style.display  = 'none';
  document.getElementById('cdDescView').style.display = '';
  document.getElementById('cdObjView').style.display  = '';

  document.getElementById('cdLecList').innerHTML = '<div class="cd-loading">불러오는 중...</div>';
  try {
    const res = await fetch(`/api/v1/curriculum/${courseId}/lectures`);
    if (res.ok) {
      const lectures = await res.json();
      _courseLectures[courseId] = lectures;
      const done = lectures.filter(l => l.completed).length;
      document.getElementById('cdLecCount').textContent = `(${done}/${lectures.length})`;
      document.getElementById('cdLecList').innerHTML = _cdBuildModuleNodes(lectures);
    }
  } catch(e) {
    document.getElementById('cdLecList').innerHTML = '<div class="cd-loading">불러오기 실패</div>';
  }
}

function _cdRenderView() {
  document.getElementById('cdDescView').textContent = _cdOrigDesc || '—';
  const ol = document.getElementById('cdObjView');
  ol.innerHTML = _cdOrigObj.length
    ? _cdOrigObj.map(o => `<li>${_esc(o)}</li>`).join('')
    : '<li class="cd-empty">—</li>';
}

/* ── 커리큘럼 인라인 모듈 그래프 ── */

async function openCourseGraph(courseId) {
  const course = _allCourses.find(c => c.id === courseId);
  if (!course) return;

  document.getElementById('curriculumGrid').style.display = 'none';
  const graphEl = document.getElementById('courseGraphView');
  graphEl.style.display = '';

  const prefix = course.code.split('-')[0];
  const tagCls = _CODE_TAG_COLOR[prefix] || 't-gray';
  const pct    = Math.round(course.progress_pct);

  graphEl.innerHTML = `
    <div class="cg-header">
      <button class="cg-back-btn" onclick="closeCourseGraph()">← 커리큘럼</button>
      <span class="course-tag ${tagCls}">${course.code}</span>
      <span class="cg-title">${_esc(course.title)}</span>
      <span class="cg-meta">${course.lecture_count}강 · ${pct}% 완료</span>
      <button class="cg-edit-btn" onclick="courseModalOpen('${course.id}')">과목 정보</button>
      <button class="cg-edit-btn cg-arrange-btn" id="cgArrangeBtn" onclick="cgToggleArrange()">✎ 편집</button>
    </div>
    <div class="cg-prog-bar"><div class="cg-prog-fill" style="width:${pct}%"></div></div>
    <div id="cgNodesWrap" class="cg-nodes-wrap"><div class="cd-loading">불러오는 중...</div></div>
  `;

  let lectures = _courseLectures[courseId];
  if (!lectures) {
    try {
      const r = await fetch(`/api/v1/curriculum/${courseId}/lectures`);
      lectures = r.ok ? await r.json() : [];
    } catch { lectures = []; }
    _courseLectures[courseId] = lectures;
  }

  const wrap = document.getElementById('cgNodesWrap');
  if (!lectures.length) { wrap.innerHTML = '<div class="cd-loading">강의가 없습니다</div>'; return; }

  const hasModules = lectures.some(l => l.module_name);

  if (!hasModules) {
    wrap.innerHTML = `<div class="cg-flat-grid">${
      lectures.map(l =>
        `<div class="cg-flat-lec${l.completed ? ' done' : ''}"
            onclick="gotoLectureWithId('${courseId}','${l.id}')" style="cursor:pointer">
          <span class="cg-flat-num">${l.number}</span>
          <span class="cg-flat-title">${_esc(l.title)}</span>
          ${l.youtube_url ? `<a href="${l.youtube_url}" target="_blank" class="cd-yt-link" onclick="event.stopPropagation()">▶</a>` : ''}
        </div>`
      ).join('')
    }</div>`;
    return;
  }

  // 모듈별 그룹
  const modOrder = [], modMap = {};
  lectures.forEach(l => {
    const m = l.module_name || '기타';
    if (!modMap[m]) { modMap[m] = []; modOrder.push(m); }
    modMap[m].push(l);
  });

  const _cgCourseId = courseId;

  const nodeItems = modOrder.map((m, idx) => {
    const lecs  = modMap[m];
    const diffs = lecs.map(l => l.difficulty).filter(Boolean);
    const avgD  = diffs.length ? Math.round(diffs.reduce((a,b)=>a+b,0)/diffs.length) : 2;
    const dc    = _DIFF_CLASS[avgD] || 'diff-2';
    const dl    = _DIFF_LABEL[avgD] || '중급';
    const doneN = lecs.filter(l => l.completed).length;
    const safeM = _esc(m);
    const arrow = idx > 0 ? '<div class="cg-arrow">→</div>' : '';
    return `${arrow}
      <div class="cg-node${idx === 0 ? ' open' : ''}" data-idx="${idx}" data-module="${safeM}"
          ondragover="_cgNodeDragOver(event)" ondrop="_cgNodeDrop(event,this,'${_cgCourseId}')">
        <div class="cg-node-head ${dc}" onclick="cgToggleNode(${idx})">
          <div class="cg-node-title">${safeM}</div>
          <div class="cg-node-sub">${dl} · ${lecs.length}강</div>
          <div class="cg-node-done">${doneN > 0 ? `${doneN}/${lecs.length} 완료` : '미시작'}</div>
        </div>
        <div class="cg-node-lecs">
          ${lecs.map(l =>
            `<div class="cg-lec-item${l.completed ? ' done' : ''}" draggable="true"
                data-lec-id="${l.id}" data-module="${safeM}"
                ondragstart="_cgLecDragStart(event,this)"
                ondragend="_cgLecDragEnd()"
                onclick="_cgLecClick(event,'${courseId}','${l.id}')">
              <span class="cg-lec-drag">⠿</span>
              <span class="cg-lec-num">${l.number}</span>
              <span class="cg-lec-title">${_esc(l.title)}</span>
              ${l.youtube_url ? `<a href="${l.youtube_url}" target="_blank" class="cd-yt-link" onclick="event.stopPropagation()">▶</a>` : ''}
            </div>`
          ).join('')}
        </div>
      </div>`;
  });

  wrap.innerHTML = `<div class="cg-nodes-row">${nodeItems.join('')}</div>`;
}

function closeCourseGraph() {
  document.getElementById('courseGraphView').style.display = 'none';
  document.getElementById('curriculumGrid').style.display = '';
}

function cgToggleNode(idx) {
  document.querySelector(`.cg-node[data-idx="${idx}"]`)?.classList.toggle('open');
}

function _cgLecClick(event, courseId, lectureId) {
  // 편집/드래그 모드에서는 무시
  if (document.getElementById('cgNodesWrap')?.classList.contains('cg-arrange-mode')) return;
  gotoLectureWithId(courseId, lectureId);
}

function cgToggleArrange() {
  const wrap = document.getElementById('cgNodesWrap');
  const btn  = document.getElementById('cgArrangeBtn');
  if (!wrap || !btn) return;
  const editing = wrap.classList.toggle('cg-arrange-mode');
  btn.textContent = editing ? '✔ 완료' : '✎ 편집';
  btn.classList.toggle('active', editing);
  // 편집 모드 진입 시 모든 노드 열기
  if (editing) {
    document.querySelectorAll('.cg-node').forEach(n => n.classList.add('open'));
  }
}

let _cgLecDragEl = null;

function _cgLecDragStart(e, el) {
  if (!document.getElementById('cgNodesWrap')?.classList.contains('cg-arrange-mode')) {
    e.preventDefault();
    return;
  }
  _cgLecDragEl = el;
  e.dataTransfer.effectAllowed = 'move';
  el.classList.add('cg-lec-dragging');
}

function _cgLecDragEnd() {
  if (_cgLecDragEl) _cgLecDragEl.classList.remove('cg-lec-dragging');
  _cgLecDragEl = null;
  document.querySelectorAll('.cg-node.cg-drop-target').forEach(n => n.classList.remove('cg-drop-target'));
}

function _cgNodeDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const node = e.currentTarget.closest?.('.cg-node') || e.currentTarget;
  document.querySelectorAll('.cg-node.cg-drop-target').forEach(n => n.classList.remove('cg-drop-target'));
  if (node && _cgLecDragEl && node.dataset.module !== _cgLecDragEl.dataset.module) {
    node.classList.add('cg-drop-target');
  }
}

async function _cgNodeDrop(e, nodeEl, courseId) {
  e.preventDefault();
  if (!_cgLecDragEl) return;

  const targetModule = nodeEl.dataset.module;
  const srcModule    = _cgLecDragEl.dataset.module;
  if (!targetModule || targetModule === srcModule) { _cgLecDragEnd(); return; }

  const lecId = _cgLecDragEl.dataset.lecId;

  // DOM 이동
  const targetLecs = nodeEl.querySelector('.cg-node-lecs');
  if (targetLecs) {
    _cgLecDragEl.dataset.module = targetModule;
    targetLecs.appendChild(_cgLecDragEl);
    nodeEl.classList.add('open');
  }

  _cgLecDragEnd();

  // 카운트 업데이트
  document.querySelectorAll('.cg-node').forEach(n => {
    const cnt = n.querySelectorAll('.cg-lec-item').length;
    const sub = n.querySelector('.cg-node-sub');
    if (sub) sub.textContent = sub.textContent.replace(/\d+강/, cnt + '강');
  });

  // 캐시 업데이트
  const lecs = _courseLectures[courseId];
  if (lecs) {
    const lec = lecs.find(l => l.id === lecId);
    if (lec) lec.module_name = targetModule;
  }

  // API 저장
  try {
    await fetch('/api/v1/curriculum/lectures/batch-meta', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: lecId, module_name: targetModule }]),
    });
  } catch (err) { console.warn('module update failed', err); }
}

function cdClose() {
  document.getElementById('courseDetailModal').style.display = 'none';
  _unlockScroll();
}

function cdOverlayClick(e) {
  if (e.target === document.getElementById('courseDetailModal')) cdClose();
}

function cdToggleEdit() {
  _cdEditing = !_cdEditing;
  document.getElementById('cdEditBtn').textContent = _cdEditing ? '보기' : '편집';
  document.getElementById('cdEditActions').style.display = _cdEditing ? 'flex' : 'none';

  if (_cdEditing) {
    document.getElementById('cdDescView').style.display = 'none';
    document.getElementById('cdObjView').style.display  = 'none';
    document.getElementById('cdDescEdit').style.display = '';
    document.getElementById('cdObjEdit').style.display  = '';
    document.getElementById('cdDescEdit').value = _cdOrigDesc;
    document.getElementById('cdObjEdit').value  = _cdOrigObj.join('\n');
  } else {
    document.getElementById('cdDescView').style.display = '';
    document.getElementById('cdObjView').style.display  = '';
    document.getElementById('cdDescEdit').style.display = 'none';
    document.getElementById('cdObjEdit').style.display  = 'none';
  }
}

async function cdSave() {
  const desc = document.getElementById('cdDescEdit').value.trim();
  const objectives = document.getElementById('cdObjEdit').value
    .split('\n').map(s => s.trim()).filter(Boolean);

  try {
    const res = await fetch(`/api/v1/curriculum/${_cdCourseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc || null, objectives }),
    });
    if (res.ok) {
      _cdOrigDesc = desc;
      _cdOrigObj  = objectives;
      const c = _allCourses.find(c => c.id === _cdCourseId);
      if (c) { c.description = desc || null; c.objectives = objectives; }
      _cdRenderView();
      cdToggleEdit();
    }
  } catch(e) {
    console.warn('Course save failed', e);
  }
}

function cdGoto() {
  cdClose();
  gotoLecture(_cdCourseId);
}
