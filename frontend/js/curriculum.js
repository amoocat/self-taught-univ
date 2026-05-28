/* ─── CURRICULUM — 동적 렌더링
──────────────────────────────────────── */
const _CODE_TAG_COLOR = {
  'MATH': 't-navy', 'STAT': 't-gold', 'ML': 't-green',
  'DL': 't-gray', 'CV': 't-gray', 'NLP': 't-gray',
};
let _curriculumLoaded = false;

async function backfillMetadata() {
  const btn = document.getElementById('backfillBtn');
  btn.disabled = true;
  btn.textContent = 'AI 분석 중...';
  try {
    const res = await fetch('/api/v1/curriculum/backfill-metadata?reset=true', { method: 'POST' });
    const data = await res.json();
    alert(data.message || `${data.updated}개 강의에 모듈 + 난이도가 배정되었습니다.`);
    if (_currentCourseId) {
      delete _courseLectures[_currentCourseId];
      await selectCourse(_currentCourseId);
    }
  } catch (e) {
    alert('AI 배정 실패. 다시 시도해주세요.');
  } finally {
    btn.disabled = false;
    btn.textContent = '★ AI 메타데이터 배정';
  }
}

async function rescanPlaylists() {
  const btn = document.getElementById('rescanBtn');
  btn.disabled = true;
  btn.textContent = '재스캔 중...';
  try {
    const res = await fetch('/api/v1/youtube/playlists/rescan-llm', { method: 'POST' });
    const data = await res.json();
    const llm = data.llm || {};
    const newPl = Object.keys(data.inbox || {}).length;
    alert(`재스캔 완료!\n\n플레이리스트: ${data.playlists_scanned}개\n새 강의 추가: ${llm.promoted || 0}개\n무관 영상 제외: ${llm.skipped || 0}개${llm.new_courses?.length ? '\n신규 강좌: ' + llm.new_courses.join(', ') : ''}`);
    initCurriculum();
  } catch (e) {
    alert('재스캔 실패. 다시 시도해주세요.');
  } finally {
    btn.disabled = false;
    btn.textContent = '↺ 플리 재스캔';
  }
}

let _cgDragSrc = null;

function _cdCardHtml(c) {
  const prefix = c.code.split('-')[0];
  const tagCls = _CODE_TAG_COLOR[prefix] || 't-gray';
  const pct = Math.round(c.progress_pct);
  const statusHtml = c.status === 'done'
    ? `<span class="s-done">✓ 완료</span>`
    : c.status === 'active'
      ? `<span class="s-active">● 진행 중</span>`
      : `<span class="s-todo">○ 예정</span>`;
  return `<div class="course-card" draggable="true" data-course-id="${c.id}"
      onclick="openCourseGraph('${c.id}')"
      ondragstart="_cdDragStart(event,this)"
      ondragover="_cdDragOver(event)"
      ondrop="_cdDrop(event,this)"
      ondragend="_cdDragEnd()">
    <span class="course-tag ${tagCls}">${c.code}</span>
    <div class="course-drag-handle">⠿</div>
    <div class="course-title">${c.title}</div>
    <div class="course-source">${c.source}</div>
    <div class="course-bar"><div class="course-fill" style="width:${pct}%"></div></div>
    <div class="course-foot"><span class="course-pct">${pct > 0 ? pct+'% 완료' : '0%'}</span>${statusHtml}</div>
  </div>`;
}

function _cdDragStart(e, el) {
  // 드래그 핸들에서 시작한 경우만 허용
  const handle = el.querySelector('.course-drag-handle');
  if (!e.composedPath().includes(handle)) {
    e.preventDefault();
    return;
  }
  _cgDragSrc = el;
  e.dataTransfer.effectAllowed = 'move';
  el.classList.add('cd-dragging');
}

function _cdDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const target = e.currentTarget;
  document.querySelectorAll('.course-card.cd-drag-over').forEach(c => c.classList.remove('cd-drag-over'));
  if (target !== _cgDragSrc) target.classList.add('cd-drag-over');
}

function _cdDrop(e, target) {
  e.stopPropagation();
  if (!_cgDragSrc || _cgDragSrc === target) return;
  const grid = document.getElementById('curriculumGrid');
  const cards = [...grid.querySelectorAll('.course-card')];
  const srcIdx = cards.indexOf(_cgDragSrc);
  const tgtIdx = cards.indexOf(target);
  if (srcIdx < tgtIdx) grid.insertBefore(_cgDragSrc, target.nextSibling);
  else                  grid.insertBefore(_cgDragSrc, target);
  _cdSaveOrder();
}

function _cdDragEnd() {
  document.querySelectorAll('.course-card').forEach(c => {
    c.classList.remove('cd-dragging', 'cd-drag-over');
  });
  _cgDragSrc = null;
}

async function _cdSaveOrder() {
  const cards = [...document.querySelectorAll('#curriculumGrid .course-card')];
  const items = cards.map((el, idx) => ({ id: el.dataset.courseId, order_index: idx }));
  try {
    await fetch('/api/v1/curriculum/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    });
    // 전역 캐시 순서 동기화
    const idOrder = Object.fromEntries(items.map(x => [x.id, x.order_index]));
    _allCourses.sort((a, b) => (idOrder[a.id] ?? 99) - (idOrder[b.id] ?? 99));
  } catch (e) { console.warn('reorder save failed', e); }
}

async function initCurriculum() {
  const grid = document.getElementById('curriculumGrid');
  try {
    const res = await fetch('/api/v1/curriculum/');
    if (res.ok) {
      const courses = await res.json();
      if (courses.length > 0) {
        _curriculumLoaded = true;
        _allCourses = courses;
        grid.innerHTML = courses.map(_cdCardHtml).join('');
        return;
      }
    }
  } catch (e) {
    console.warn('Curriculum fetch failed', e);
  }
  // fallback
  grid.innerHTML = `
    <div class="course-card"><span class="course-tag t-navy">MATH-101</span><div class="course-title">선형대수학 (Linear Algebra)</div><div class="course-source">MIT 18.06 · Gilbert Strang</div><div class="course-bar"><div class="course-fill" style="width:42%"></div></div><div class="course-foot"><span class="course-pct">42% 완료</span><span class="s-active">● 진행 중</span></div></div>
    <div class="course-card"><span class="course-tag t-gold">STAT-201</span><div class="course-title">확률론과 통계</div><div class="course-source">Stanford CS109 · KAIST 강의</div><div class="course-bar"><div class="course-fill" style="width:18%"></div></div><div class="course-foot"><span class="course-pct">18% 완료</span><span class="s-active">● 진행 중</span></div></div>
    <div class="course-card"><span class="course-tag t-green">ML-301</span><div class="course-title">머신러닝 기초</div><div class="course-source">Stanford CS229 · Andrew Ng</div><div class="course-bar"><div class="course-fill" style="width:5%"></div></div><div class="course-foot"><span class="course-pct">5% 완료</span><span class="s-active">● 진행 중</span></div></div>
    <div class="course-card"><span class="course-tag t-gray">DL-401</span><div class="course-title">딥러닝</div><div class="course-source">Stanford CS231n · deeplearning.ai</div><div class="course-bar"><div class="course-fill" style="width:0%"></div></div><div class="course-foot"><span class="course-pct">0%</span><span class="s-todo">○ 예정</span></div></div>
    <div class="course-card"><span class="course-tag t-gray">CV-402</span><div class="course-title">컴퓨터 비전</div><div class="course-source">Stanford CS231n</div><div class="course-bar"><div class="course-fill" style="width:0%"></div></div><div class="course-foot"><span class="course-pct">0%</span><span class="s-todo">○ 예정</span></div></div>
    <div class="course-card"><span class="course-tag t-gray">NLP-403</span><div class="course-title">자연어처리</div><div class="course-source">Stanford CS224n</div><div class="course-bar"><div class="course-fill" style="width:0%"></div></div><div class="course-foot"><span class="course-pct">0%</span><span class="s-todo">○ 예정</span></div></div>`;
}
