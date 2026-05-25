/* ════════════════════════════════════════
   LECTURE PAGE + HINT PANEL + NOTES PANEL
════════════════════════════════════════ */
let _currentCourseId = null;
let _currentLectureId = null;
let _currentLectures = [];
let _pendingCourseId = null;
let _lectureAccordionBuilt = false;
const _courseLectures = {}; // courseId → lectures 캐시

let _savedLecC1 = null;
let _savedLecC2 = null;

let _hintHistory = [];
let _hintStreaming = false;
let _hintOpen = false;

function youtubeEmbedUrl(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}

function gotoLecture(courseId) {
  _pendingCourseId = courseId;
  goto('lecture');
}

async function initLecture() {
  if (_allCourses.length === 0) {
    try {
      const cRes = await fetch('/api/v1/curriculum/');
      if (cRes.ok) _allCourses = await cRes.json();
    } catch (e) {
      console.warn('Curriculum fetch failed', e);
    }
  }

  if (!_lectureAccordionBuilt) {
    const listEl = document.getElementById('lectureList');
    listEl.innerHTML =
      `<div class="ll-panel-ctrl">
        <button class="ll-collapse-btn" id="llCollapseBtn" onclick="toggleLecturePanel()" title="패널 접기">‹</button>
      </div>` +
      _allCourses.map(c => {
        const cat = (c.category || '').toUpperCase().slice(0, 6);
        return `<div class="ll-course-group" data-course-id="${c.id}">
          <div class="ll-course-hdr" onclick="selectCourse('${c.id}')">
            <span class="ll-course-cat">${cat}</span>
            <span class="ll-course-title-text">${_esc(c.title.split(' (')[0])}</span>
            <span class="ll-caret">▶</span>
          </div>
          <div class="ll-course-body"></div>
        </div>`;
      }).join('');
    _lectureAccordionBuilt = true;
  }

  const targetId = _pendingCourseId || _currentCourseId
    || (_allCourses.length > 0 ? _allCourses[0].id : null);
  _pendingCourseId = null;
  if (targetId) await selectCourse(targetId);
}

async function selectCourse(courseId) {
  const group = document.querySelector(`.ll-course-group[data-course-id="${courseId}"]`);
  if (!group) return;

  const isOpen = group.classList.contains('open');

  // 같은 과목 클릭 → 토글
  if (isOpen) {
    group.classList.remove('open');
    return;
  }

  // 다른 과목 열기
  group.classList.add('open');
  group.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  _currentCourseId = courseId;
  const course = _allCourses.find(c => c.id === courseId);
  const body = group.querySelector('.ll-course-body');

  let lectures = _courseLectures[courseId];
  if (!lectures) {
    if (body) body.innerHTML = '<div class="lm-loading">불러오는 중...</div>';
    try {
      const res = await fetch(`/api/v1/curriculum/${courseId}/lectures`);
      if (!res.ok) throw new Error();
      lectures = await res.json();
      _courseLectures[courseId] = lectures;
    } catch (e) {
      if (body) body.innerHTML = '<div class="lm-loading">강의 목록을 불러올 수 없습니다</div>';
      return;
    }
  }

  _currentLectures = lectures;
  if (body) body.innerHTML = _buildLecList(lectures, course);
  if (lectures.length > 0 && !_currentLectureId) loadLecture(lectures[0].id);
}

function toggleLecturePanel() {
  const layout = document.getElementById('lectureLayout');
  const list   = document.getElementById('lectureList');
  const btn    = document.getElementById('llCollapseBtn');
  if (!layout || !list) return;

  const collapsed = list.classList.contains('ll-collapsed');
  if (collapsed) {
    list.classList.remove('ll-collapsed');
    layout.style.setProperty('--lec-c1', _savedLecC1 || '240px');
    if (btn) { btn.textContent = '‹'; btn.title = '패널 접기'; }
  } else {
    _savedLecC1 = getComputedStyle(layout).getPropertyValue('--lec-c1').trim() || '240px';
    layout.style.setProperty('--lec-c1', '28px');
    list.classList.add('ll-collapsed');
    if (btn) { btn.textContent = '›'; btn.title = '패널 펼치기'; }
  }
}

function _lecItemHtml(l) {
  const hasvid  = !!l.youtube_url;
  const unavail = l.is_available === false;
  const thumbSrc = l.thumbnail_url
    || (l.youtube_video_id ? `https://img.youtube.com/vi/${l.youtube_video_id}/mqdefault.jpg` : null);
  const thumb = thumbSrc
    ? `<img class="ll-thumb" src="${thumbSrc}" alt="" loading="lazy">`
    : `<div class="ll-thumb ll-thumb-ph">${hasvid ? '▶' : ''}</div>`;
  const dur = l.duration_sec ? `<span class="ll-dur">${_fmtDur(l.duration_sec)}</span>` : '';
  const diffBadge = l.difficulty
    ? `<span class="ll-diff-badge ${_DIFF_CLASS[l.difficulty]}">${_DIFF_LABEL[l.difficulty]}</span>`
    : '';
  return `<div class="ll-item${l.completed ? ' done' : ''}${unavail ? ' unavail' : ''}" data-lecture-id="${l.id}" onclick="loadLecture('${l.id}',this)">
    ${thumb}
    <div class="ll-content">
      <div class="ll-num">Lec ${String(l.number).padStart(2,'0')}${unavail ? ' <span class="ll-unavail-badge">삭제됨</span>' : ''}${diffBadge}</div>
      <div class="ll-name">${l.title}</div>
      <div class="ll-foot">${l.completed ? '<span class="ll-check">✓ 완료</span>' : ''}${dur}</div>
    </div>
  </div>`;
}

function _buildLecList(lectures, course) {
  if (!lectures.length)
    return `<div class="ln-empty" style="padding:12px 14px">강의가 없습니다</div>`;

  const hasModule = lectures.some(l => l.module_name);
  const hasDiff   = lectures.some(l => l.difficulty);

  if (!hasModule && !hasDiff) {
    return (course ? `<div class="ll-section">${course.source}</div>` : '')
      + lectures.map(_lecItemHtml).join('');
  }

  if (!hasModule) {
    // 난이도만 있을 때
    const groups = { 1: [], 2: [], 3: [] };
    lectures.forEach(l => { (groups[l.difficulty] || groups[2]).push(l); });
    return [1, 2, 3].map(d => {
      if (!groups[d].length) return '';
      return `<div class="ll-diff-section">
        <div class="ll-diff-header ${_DIFF_CLASS[d]}">
          <span class="ll-diff-label">${_DIFF_LABEL[d]}</span>
          <span class="ll-diff-count">${groups[d].length}강</span>
        </div>
        ${groups[d].map(_lecItemHtml).join('')}
      </div>`;
    }).join('');
  }

  // 모듈별 그룹핑 (모듈 안에서 난이도순 정렬)
  const moduleOrder = [];
  const moduleMap = {};
  lectures.forEach(l => {
    const m = l.module_name || '기타';
    if (!moduleMap[m]) { moduleMap[m] = []; moduleOrder.push(m); }
    moduleMap[m].push(l);
  });

  return moduleOrder.map((mod, idx) => {
    const lecs = moduleMap[mod];
    // 모듈 안에서 난이도별 서브그룹
    const hasDiffInMod = lecs.some(l => l.difficulty);
    let inner;
    if (hasDiffInMod) {
      const sub = { 1: [], 2: [], 3: [] };
      lecs.forEach(l => { (sub[l.difficulty] || sub[2]).push(l); });
      inner = [1, 2, 3].map(d => {
        if (!sub[d].length) return '';
        return `<div class="ll-diff-sub">
          <span class="ll-diff-dot ${_DIFF_CLASS[d]}" title="${_DIFF_LABEL[d]}"></span>
          ${sub[d].map(_lecItemHtml).join('')}
        </div>`;
      }).join('');
    } else {
      inner = lecs.map(_lecItemHtml).join('');
    }

    return `<div class="ll-module-section${idx === 0 ? ' open' : ''}">
      <div class="ll-module-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="ll-module-arrow">▶</span>
        <span class="ll-module-name">${_esc(mod)}</span>
        <span class="ll-module-count">${lecs.length}강</span>
      </div>
      <div class="ll-module-body">${inner}</div>
    </div>`;
  }).join('');
}


async function loadLecture(id, clickedEl) {
  _currentLectureId = id;
  if (clickedEl) {
    document.querySelectorAll('.ll-item').forEach(b => b.classList.remove('active'));
    clickedEl.classList.add('active');
  }
  const lec = _currentLectures.find(l => l.id === id);

  // 완료 버튼 + 힌트 버튼 상태 갱신
  const completeBtn = document.getElementById('lc-complete-btn');
  if (completeBtn) {
    completeBtn.style.display = '';
    if (lec && lec.completed) {
      completeBtn.textContent = '✓ 완료됨';
      completeBtn.classList.add('done');
    } else {
      completeBtn.textContent = '완료 표시';
      completeBtn.classList.remove('done');
    }
  }
  const hintBtn = document.getElementById('lc-hint-btn');
  if (hintBtn) hintBtn.style.display = '';
  hintReset();

  const pane = document.getElementById('lecturePaneBody');
  pane.innerHTML = '<div class="ph-block"><div class="ph-line" style="width:100%"></div><div class="ph-line" style="width:75%"></div></div>';

  try {
    const res = await fetch(`/api/v1/curriculum/lectures/${id}`);
    if (res.ok) {
      const data = await res.json();
      const metaEl = document.getElementById('lecturePaneMeta');
      if (metaEl) metaEl.textContent = `Lecture ${String(data.number).padStart(2,'0')} · ${data.title}`;

      const videoHtml = data.youtube_url
        ? `<div class="lc-video-wrap"><iframe src="${youtubeEmbedUrl(data.youtube_url)}" allowfullscreen loading="lazy"></iframe></div>`
        : `<div class="lc-video-none"><span class="lc-video-icon">▶</span><span>동영상 없음</span></div>`;

      const noteHtml = data.content
        ? marked.parse(data.content)
        : `<div class="ph-block"><div class="ph-line" style="width:100%"></div><div class="ph-line" style="width:80%"></div><div class="ph-line" style="width:60%"></div></div>`;

      pane.innerHTML = `<div class="lc-title">${data.title}</div>` + videoHtml + noteHtml;
    }
  } catch (e) {
    console.warn('Lecture detail fetch failed', e);
    const t = lec ? lec.title : '';
    pane.innerHTML = `<div class="lc-title">${t}</div><div class="ph-block"><div class="ph-line" style="width:100%"></div><div class="ph-line" style="width:80%"></div></div>`;
  }

  loadLectureNotes(id);
}

async function loadLectureNotes(lectureId) {
  const listEl = document.getElementById('lectureNotesList');
  const metaEl = document.getElementById('lectureNotesMeta');
  if (!listEl) return;
  try {
    const res = await fetch(`/api/v1/notes/?lecture_id=${lectureId}`);
    if (!res.ok) throw new Error();
    const notes = await res.json();
    if (metaEl) metaEl.textContent = `이 강의 관련 노트 (${notes.length})`;
    if (notes.length === 0) {
      listEl.innerHTML = `<div class="ln-empty">이 강의에 연결된 노트가 없습니다</div><div class="note-add-inline" onclick="addLectureNote()">[ + 이 강의 노트 추가 ]</div>`;
      return;
    }
    listEl.innerHTML = notes.map(n =>
      `<div class="my-note-item" onclick="openNoteInEditor('${n.id}')">
        <div class="mn-title">${n.title}</div>
        <div class="mn-preview">${n.content_md || ''}</div>
        <div class="mn-foot"><span>${n.updated}</span></div>
      </div>`
    ).join('') + `<div class="note-add-inline" onclick="addLectureNote()">[ + 이 강의 노트 추가 ]</div>`;
  } catch (e) {
    listEl.innerHTML = `<div class="ln-empty">노트를 불러올 수 없습니다</div>`;
  }
}

function hintReset() {
  _hintHistory = [];
  _hintOpen = false;
  const panel = document.getElementById('hintPanel');
  if (panel) panel.classList.remove('open');
  const msgs = document.getElementById('hintMsgs');
  if (msgs) msgs.innerHTML = '<div class="hint-msg ai">막히는 부분을 질문해보세요. 단계적인 힌트를 드릴게요!</div>';
}

function hintToggle() {
  _hintOpen = !_hintOpen;
  const panel = document.getElementById('hintPanel');
  if (panel) panel.classList.toggle('open', _hintOpen);
  if (_hintOpen) {
    setTimeout(() => {
      const inp = document.getElementById('hintInput');
      if (inp) inp.focus();
    }, 200);
  }
}

function hintAddMsg(role, html, streaming = false) {
  const wrap = document.getElementById('hintMsgs');
  if (!wrap) return null;
  const el = document.createElement('div');
  el.className = `hint-msg ${role}`;
  if (streaming) {
    wrap.appendChild(el);
    wrap.scrollTop = wrap.scrollHeight;
    return el;
  }
  el.innerHTML = html.replace(/\n/g, '<br>');
  wrap.appendChild(el);
  wrap.scrollTop = wrap.scrollHeight;
  return null;
}

async function hintSend() {
  if (_hintStreaming || !_currentLectureId) return;
  const input = document.getElementById('hintInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  hintAddMsg('user', text);
  _hintHistory.push({ role: 'user', content: text });
  _hintStreaming = true;

  const streamEl = hintAddMsg('ai', '', true);
  if (!streamEl) { _hintStreaming = false; return; }

  try {
    const resp = await fetch(`/api/v1/chat/lecture/${_currentLectureId}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: _hintHistory.slice(0, -1),
      }),
    });

    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    const wrap = document.getElementById('hintMsgs');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break;
        try {
          const { text: chunk } = JSON.parse(payload);
          fullText += chunk;
          streamEl.innerHTML = fullText.replace(/\n/g, '<br>');
          if (wrap) wrap.scrollTop = wrap.scrollHeight;
        } catch {}
      }
    }

    if (fullText) _hintHistory.push({ role: 'assistant', content: fullText });
  } catch (e) {
    streamEl.innerHTML = '연결 오류. 잠시 후 다시 시도해주세요.';
    _hintHistory.pop();
    console.error('Hint chat error:', e);
  } finally {
    _hintStreaming = false;
  }
}

async function markLectureComplete() {
  if (!_currentCourseId || !_currentLectureId) return;
  const btn = document.getElementById('lc-complete-btn');
  try {
    await fetch(`/api/v1/curriculum/${_currentCourseId}/lectures/${_currentLectureId}/complete`, { method: 'POST' });
    const lec = _currentLectures.find(l => l.id === _currentLectureId);
    if (lec) lec.completed = true;
    if (btn) { btn.textContent = '✓ 완료됨'; btn.classList.add('done'); }
    // 사이드바 아이템도 갱신
    const item = document.querySelector(`.ll-item[data-lecture-id="${_currentLectureId}"]`);
    if (item) {
      item.classList.add('done');
      if (!item.querySelector('.ll-check')) {
        item.insertAdjacentHTML('beforeend', '<div class="ll-check">✓ 완료</div>');
      }
    }
  } catch (e) {
    console.warn('markLectureComplete failed', e);
  }
}

function addLectureNote() { lnNewNote(); }
function openNoteInEditor(noteId) { lnOpenNote(noteId); }

/* ── 인라인 노트 에디터 ── */
let _lnCurrentId = null;
let _lnDirty = false;

function lnShowView(v) {
  const lv = document.getElementById('lnListView');
  const ev = document.getElementById('lnEditorView');
  if (!lv || !ev) return;
  lv.style.display = v === 'list'   ? 'flex' : 'none';
  ev.style.display = v === 'editor' ? 'flex' : 'none';
  if (v === 'editor') lnSetMode('edit');
}

function lnMarkDirty() { _lnDirty = true; }

function lnSetMode(mode) {
  document.getElementById('lnBtnEdit').classList.toggle('active', mode === 'edit');
  document.getElementById('lnBtnPreview').classList.toggle('active', mode === 'preview');
  const ta  = document.getElementById('lnTextArea');
  const pre = document.getElementById('lnPreview');
  if (mode === 'preview') {
    pre.innerHTML = marked.parse(ta.value || '');
    ta.style.display = 'none';
    pre.style.display = 'block';
  } else {
    pre.style.display = 'none';
    ta.style.display = '';
    ta.focus();
  }
}

async function lnNewNote() {
  if (!_currentLectureId) return;
  try {
    const res = await fetch('/api/v1/notes/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '새 노트', content_md: '', tags: [], lecture_id: _currentLectureId }),
    });
    if (res.ok) {
      const note = await res.json();
      _lnCurrentId = note.id;
      document.getElementById('lnTitleInput').value = note.title;
      document.getElementById('lnTextArea').value = '';
      _lnDirty = false;
      lnShowView('editor');
      const ti = document.getElementById('lnTitleInput');
      ti.focus(); ti.select();
      return;
    }
  } catch (e) { console.warn('lnNewNote failed', e); }
  _lnCurrentId = 'tmp_' + Date.now();
  document.getElementById('lnTitleInput').value = '새 노트';
  document.getElementById('lnTextArea').value = '';
  _lnDirty = false;
  lnShowView('editor');
}

async function lnOpenNote(noteId) {
  try {
    const res = await fetch(`/api/v1/notes/${noteId}`);
    if (!res.ok) throw new Error();
    const note = await res.json();
    _lnCurrentId = note.id;
    document.getElementById('lnTitleInput').value = note.title || '';
    document.getElementById('lnTextArea').value = note.content_md || note.content || '';
    _lnDirty = false;
    lnShowView('editor');
  } catch (e) { console.warn('lnOpenNote failed', e); }
}

async function lnSave() {
  const title   = (document.getElementById('lnTitleInput').value || '').trim() || '새 노트';
  const content = document.getElementById('lnTextArea').value;
  const btn     = document.getElementById('lnSaveBtn');
  const isTemp  = String(_lnCurrentId).startsWith('tmp_');
  const body    = { title, content_md: content, tags: [] };
  if (isTemp && _currentLectureId) body.lecture_id = _currentLectureId;

  btn.disabled = true; btn.textContent = '저장 중...';
  try {
    const res = await fetch(
      isTemp ? '/api/v1/notes/' : `/api/v1/notes/${_lnCurrentId}`,
      { method: isTemp ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body) }
    );
    if (!res.ok) throw new Error();
    const saved = await res.json();
    _lnCurrentId = saved.id;
    _lnDirty = false;
    btn.textContent = '✓ 저장됨';
    setTimeout(() => { btn.disabled = false; btn.textContent = '저장'; }, 1500);
  } catch (e) {
    btn.textContent = '실패';
    setTimeout(() => { btn.disabled = false; btn.textContent = '저장'; }, 1500);
  }
}

function lnBackToList() {
  if (_lnDirty) {
    if (!confirm('저장하지 않은 내용이 있습니다. 목록으로 돌아갈까요?')) return;
  }
  lnShowView('list');
  loadLectureNotes(_currentLectureId);
}
