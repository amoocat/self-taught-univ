/* ════════════════════════════════════════
   SHARED UTILITIES
════════════════════════════════════════ */
function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _fmtDur(sec) {
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}

const _DIFF_LABEL = { 1: '입문', 2: '중급', 3: '고급' };
const _DIFF_CLASS = { 1: 'diff-1', 2: 'diff-2', 3: 'diff-3' };

/* ════════════════════════════════════════
   NAVIGATION + EVENTS
════════════════════════════════════════ */
const SIDEBAR_PAGES = ['lecture','mynotes','graph'];
const NO_SIDEBAR    = ['home','about','curriculum','papers','blog'];
const ALL_PAGES     = ['home','about','curriculum','lecture','mynotes','papers','blog','graph'];

let BLOG_POSTS = [];
let _allCourses = [];

function goto(page, pushState = true) {
  ALL_PAGES.forEach(p => {
    document.getElementById('page-'+p).classList.remove('active');
    const n = document.getElementById('nav-'+p);
    if (n) n.classList.remove('active');
  });

  document.getElementById('page-'+page).classList.add('active');
  const nav = document.getElementById('nav-'+page);
  if (nav) nav.classList.add('active');

  const sidebar = document.querySelector('.sidebar');
  if (NO_SIDEBAR.includes(page)) {
    sidebar.style.display = 'none';
  } else {
    sidebar.style.display = '';
    document.body.classList.toggle('sidebar-open', SIDEBAR_PAGES.includes(page));
    _ensureSidebarLoaded();
  }

  if (page === 'graph')      drawGraph();
  if (page === 'mynotes')    { if (!obsEditor) obsInit(); }
  if (page === 'blog')       { initBlog(); closeBlogDetail(); }
  if (page === 'curriculum') { initCurriculum(); }
  if (page === 'lecture')    initLecture();
  if (page === 'papers')     initPapers();
  if (page === 'home')       initHome();

  // SPA 라우팅 — path 업데이트
  if (pushState) {
    const path = page === 'home' ? '/' : '/' + page;
    if (location.pathname !== path) history.pushState(null, '', path);
  }
}

// 뒤로/앞으로 버튼 지원
window.addEventListener('popstate', () => {
  const page = location.pathname.slice(1) || 'home';
  if (ALL_PAGES.includes(page)) goto(page, false);
});

// 페이지 진입 시 path에서 초기 페이지 복원
(function initFromPath() {
  const page = location.pathname.slice(1) || 'home';
  if (ALL_PAGES.includes(page) && page !== 'home') goto(page, false);
})();

/* init sidebar hidden for home */
document.querySelector('.sidebar').style.display = 'none';

/* ════════════════════════════════════════
   HOME — 동적 렌더링
════════════════════════════════════════ */
const _SUBJECT_ID_MAP = {
  math: 'linear', stats: 'stats', ml: 'ml', dl: 'dl', cv: 'cv', nlp: 'nlp',
};

function _fillSbSubjectList(courses) {
  const sbList = document.getElementById('sbSubjectList');
  if (!sbList || sbList.dataset.filled) return;
  sbList.innerHTML = courses.map((c, i) => {
    const icon = { math:'📐', stats:'📊', ml:'🤖', dl:'🧠', cv:'👁', nlp:'💬' }[c.category] || '📚';
    const pct  = Math.round(c.progress_pct);
    const sid  = _SUBJECT_ID_MAP[c.category] || c.category;
    return `<div class="sb-item${i===0?' active':''}" id="si-${sid}"
      onclick="selectSubject('${sid}', '${c.id}')"
      >${icon} ${c.title.split(' (')[0]} <span class="sb-pct">${pct > 0 ? pct+'%' : '—'}</span></div>`;
  }).join('');
  sbList.dataset.filled = '1';
}

async function _ensureSidebarLoaded() {
  if (_allCourses.length > 0) { _fillSbSubjectList(_allCourses); return; }
  try {
    const res = await fetch('/api/v1/curriculum/');
    if (!res.ok) return;
    const courses = await res.json();
    _allCourses = courses;
    _fillSbSubjectList(courses);
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

    // 사이드바 과목 목록
    const sbList = document.getElementById('sbSubjectList');
    if (sbList) sbList.dataset.filled = '';  // 홈 방문 시 항상 갱신
    _fillSbSubjectList(courses);

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

let _sbActiveTab = 1;

function switchSbTab(n) {
  const tabCourses = document.getElementById('sbTabCourses');
  const tabModules = document.getElementById('sbTabModules');
  const btn1 = document.getElementById('sbTab1');
  const btn2 = document.getElementById('sbTab2');
  if (!tabCourses || !tabModules) return;

  if (_sbActiveTab === n) {
    const target = n === 1 ? tabCourses : tabModules;
    const hidden = target.style.display === 'none';
    target.style.display = hidden ? '' : 'none';
    _sbActiveTab = hidden ? n : 0;
    return;
  }

  _sbActiveTab = n;
  tabCourses.style.display = n === 1 ? '' : 'none';
  tabModules.style.display = n === 2 ? '' : 'none';
  btn1.classList.toggle('active', n === 1);
  btn2.classList.toggle('active', n === 2);

  if (n === 2) {
    const modList = document.getElementById('sbModuleList');
    if (modList && !modList.dataset.built) _buildSbModuleTab();
  }
}

async function _buildSbModuleTab() {
  const modList = document.getElementById('sbModuleList');
  if (!modList) return;

  const courses = _allCourses || [];
  if (!courses.length) {
    modList.innerHTML = '<div class="sb-loading">과목 데이터 없음</div>';
    return;
  }

  const diffClass = { 1: 'diff-1', 2: 'diff-2', 3: 'diff-3' };
  let html = '';

  for (const c of courses) {
    let lectures = _courseLectures && _courseLectures[c.id];
    if (!lectures) {
      try {
        const res = await fetch(`/api/v1/curriculum/${c.id}/lectures`);
        if (res.ok) {
          lectures = await res.json();
          if (_courseLectures) _courseLectures[c.id] = lectures;
        }
      } catch (e) { lectures = []; }
    }

    const icon = { math:'📐', stats:'📊', ml:'🤖', dl:'🧠', cv:'👁', nlp:'💬' }[c.category] || '📚';
    const modMap = {};
    (lectures || []).forEach(l => {
      const mod = l.module_name || '기타';
      if (!modMap[mod]) modMap[mod] = { diff: l.difficulty || 0, count: 0 };
      modMap[mod].count++;
      if (l.difficulty && l.difficulty > modMap[mod].diff) modMap[mod].diff = l.difficulty;
    });

    if (!Object.keys(modMap).length) continue;

    html += `<div class="sb-mod-group">
      <div class="sb-mod-group-hdr">${icon} ${c.title.split(' (')[0]}</div>
      ${Object.entries(modMap).map(([mod, info]) => {
        const dc = diffClass[info.diff] || 'diff-0';
        return `<div class="sb-mod-item" onclick="gotoLecture('${c.id}')">
          <span class="sb-mod-dot ${dc}"></span>
          <span class="sb-mod-name">${mod}</span>
          <span class="sb-mod-cnt">${info.count}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  modList.innerHTML = html || '<div class="sb-loading">모듈 없음</div>';
  modList.dataset.built = '1';
}

/* topbar height */
function setTopbarH() {
  const h = document.querySelector('.topbar').offsetHeight;
  document.documentElement.style.setProperty('--topbar-h', h+'px');
}
setTopbarH();
window.addEventListener('resize', () => {
  setTopbarH();
  if (graphInitialized) {
    const canvas = document.getElementById('graphCanvas');
    d3Svg.attr('width', canvas.clientWidth).attr('height', canvas.clientHeight);
  }
});

document.addEventListener('click', e => {
  if (e.target.classList.contains('mode-tab')) {
    document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
  }
  const li = e.target.closest('.ll-item');
  if (li) {
    document.querySelectorAll('.ll-item').forEach(b => b.classList.remove('active'));
    li.classList.add('active');
  }
  const pi = e.target.closest('.paper-item');
  if (pi) {
    document.querySelectorAll('.paper-item').forEach(b => b.classList.remove('active'));
    pi.classList.add('active');
  }
});

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
