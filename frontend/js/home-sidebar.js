/* ════════════════════════════════════════
   HOME — 동적 렌더링
════════════════════════════════════════ */
const _SUBJECT_ID_MAP = {
  math: 'linear', stats: 'stats', ml: 'ml', dl: 'dl', cv: 'cv', nlp: 'nlp',
};

/* ────────────────────────────────────────
   SIDEBAR ACCORDION TREE
──────────────────────────────────────── */

function _buildSbTree() {
  const tree = document.getElementById('sbTree');
  if (!tree || !_allCourses.length) return;

  tree.innerHTML = _allCourses.map((c, i) => {
    const pct = Math.round(c.progress_pct);
    return `<div class="sbt-course-item${c.id === _sbOpenCourseId ? ' open' : ''}" id="sbt-c-${c.id}">
      <div class="sbt-course-hdr" onclick="sbToggleCourse('${c.id}')">
        <span class="sbt-arrow">▶</span>
        <span class="sbt-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="sbt-name">${c.title.split(' (')[0]}</span>
        ${pct > 0 ? `<span class="sbt-pct">${pct}%</span>` : ''}
      </div>
      <div class="sbt-body" id="sbt-b-${c.id}"></div>
    </div>`;
  }).join('');

  // 열려있는 과목이 있으면 바로 렌더
  if (_sbOpenCourseId) _sbRenderBody(_sbOpenCourseId);
}

function _sbRenderBody(courseId) {
  const body = document.getElementById(`sbt-b-${courseId}`);
  if (!body) return;
  const lectures = _courseLectures[courseId];

  if (!lectures) {
    body.innerHTML = '<div class="sbt-loading-row">불러오는 중...</div>';
    return;
  }
  if (!lectures.length) {
    body.innerHTML = '<div class="sbt-loading-row">강의가 없습니다</div>';
    return;
  }

  const modOrder = [], modMap = {};
  lectures.forEach(l => {
    const m = l.module_name || '';
    if (!modMap[m]) { modMap[m] = []; modOrder.push(m); }
    modMap[m].push(l);
  });
  const hasModules = lectures.some(l => l.module_name);

  let html = '';
  for (const m of modOrder) {
    if (hasModules && m) html += `<div class="sbt-module-label">${m}</div>`;
    html += '<div class="sbt-lec-list">';
    for (const l of modMap[m]) {
      const done   = l.completed ? ' done' : '';
      const active = l.id === _currentLectureId ? ' active' : '';
      html += `<div class="sbt-lec-row${done}${active}" id="sbt-l-${l.id}"
        onclick="sbSelectLecture('${courseId}','${l.id}')">
        <span class="sbt-lec-bullet"></span>
        <span class="sbt-lec-title">Lec ${String(l.number).padStart(2, '0')} · ${l.title}</span>
      </div>`;
    }
    html += '</div>';
  }
  body.innerHTML = html;
}

async function sbToggleCourse(courseId) {
  const item = document.getElementById(`sbt-c-${courseId}`);
  if (!item) return;
  const isOpen = item.classList.contains('open');

  // 다른 열린 과목 닫기
  if (_sbOpenCourseId && _sbOpenCourseId !== courseId) {
    document.getElementById(`sbt-c-${_sbOpenCourseId}`)?.classList.remove('open');
  }
  if (isOpen) {
    item.classList.remove('open');
    _sbOpenCourseId = null;
    return;
  }

  item.classList.add('open');
  _sbOpenCourseId = courseId;

  // 아직 강의 목록이 없으면 fetch
  if (!_courseLectures[courseId]) {
    const body = document.getElementById(`sbt-b-${courseId}`);
    if (body) body.innerHTML = '<div class="sbt-loading-row">불러오는 중...</div>';
    try {
      const res = await fetch(`/api/v1/curriculum/${courseId}/lectures`);
      _courseLectures[courseId] = res.ok ? await res.json() : [];
    } catch (e) { _courseLectures[courseId] = []; }
  }
  _sbRenderBody(courseId);
}

function sbSelectLecture(courseId, lectureId) {
  const onLecturePage = document.getElementById('page-lecture')?.classList.contains('active');
  if (onLecturePage && _currentCourseId === courseId) {
    const el = document.querySelector(`.ll-item[data-lecture-id="${lectureId}"]`);
    loadLecture(lectureId, el);
    return;
  }
  _pendingCourseId  = courseId;
  _pendingLectureId = lectureId;
  goto('lecture');
}

function sbSyncHighlight(courseId, lectureId) {
  document.querySelectorAll('.sbt-lec-row.active').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`sbt-l-${lectureId}`);
  if (el) { el.classList.add('active'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}

async function _ensureSidebarLoaded() {
  if (_allCourses.length > 0) { _buildSbTree(); return; }
  try {
    const res = await fetch('/api/v1/curriculum/');
    if (!res.ok) return;
    _allCourses = await res.json();
    _buildSbTree();
  } catch (e) { console.warn('sidebar load failed', e); }
}

async function initHome() {
  try {
    const res = await fetch('/api/v1/curriculum/');
    if (!res.ok) return;
    const courses = await res.json();
    _allCourses = courses;

    // 학기 진도 현황
    const progressSection = document.getElementById('homeProgressList');
    if (progressSection) {
      progressSection.innerHTML = courses.map(c => {
        const pct = Math.round(c.progress_pct);
        return `<div class="progress-item">
          <div class="pi-head">
            <span class="pi-name">${c.title.split(' (')[0]}</span>
            <span class="pi-pct">${pct > 0 ? pct + '%' : '예정'}</span>
          </div>
          <div class="pi-bar"><div class="pi-fill" style="width:${pct}%"></div></div>
        </div>`;
      }).join('');
    }

    // 프로필 드롭다운
    const totalPct = courses.length
      ? Math.round(courses.reduce((s, c) => s + c.progress_pct, 0) / courses.length)
      : 0;
    const activeCourses = courses.filter(c => c.status === 'active');
    const pdProgress = document.getElementById('pdProgress');
    if (pdProgress) pdProgress.textContent = totalPct + '% 완료';
    const pdCourses = document.getElementById('pdCourses');
    if (pdCourses) pdCourses.textContent = `진행 중 (${activeCourses.length}과목)`;
  } catch (e) {
    console.warn('initHome failed', e);
  }
}

function selectSubject(id, courseId) {
  document.querySelectorAll('[id^="si-"]').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('si-'+id);
  if (el) el.classList.add('active');
  if (courseId) gotoLecture(courseId);
}
