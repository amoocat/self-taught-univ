/* ════════════════════════════════════════
   CURRICULUM — 동적 렌더링
════════════════════════════════════════ */
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

/* ────────────────────────────────────────
   YOUTUBE 플레이리스트 모달
──────────────────────────────────────── */

let _ytPlaylists          = [];
let _ytSelected           = new Set();   // 선택된 playlist_id 집합
let _ytFilterData         = null;        // filter 결과 캐시
let _registeredPlaylistIds = new Set();  // DB에 이미 저장된 playlist_id
let _ytNextPageToken      = null;        // 채널 발견 더 보기 토큰
let _ytDisplayedChannels  = new Set();   // discover에서 이미 헤더 표시된 channel_id
let _ytDiscoverSourceId   = null;        // null=좋아요, 문자열=소스 플리 ID
let _ytDiscoverSourceTitle = '좋아요 영상'; // 현재 discover 소스 이름 (UI 표시용)

function _lockScroll() {
  const sw = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.overflow = 'hidden';
  if (sw > 0) document.body.style.paddingRight = sw + 'px';
}
function _unlockScroll() {
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
}

async function ytModalOpen() {
  const modal = document.getElementById('ytImportModal');
  modal.style.display = 'flex';
  _lockScroll();
  _ytSelected.clear();
  _ytFilterData          = null;
  _ytNextPageToken       = null;
  _ytDisplayedChannels   = new Set();
  _ytDiscoverSourceId    = null;
  _ytDiscoverSourceTitle = '좋아요 영상';
  document.getElementById('ytDiscoverBar').style.display = 'none';
  document.getElementById('ytDiscoverPlPicker').style.display = 'none';
  _showStep1();
  await _ytLoadRegisteredPlaylists();
  await _ytLoadPlaylists();
}

function ytModalClose() {
  document.getElementById('ytImportModal').style.display = 'none';
  _unlockScroll();
}

function ytModalOverlayClick(e) {
  if (e.target === document.getElementById('ytImportModal')) ytModalClose();
}

async function _ytLoadRegisteredPlaylists() {
  try {
    const res  = await fetch('/api/v1/youtube/registered-playlists');
    const data = await res.json();
    _registeredPlaylistIds = new Set(data.playlist_ids || []);
  } catch (_) {
    _registeredPlaylistIds = new Set();
  }
}

function _showStep1() {
  document.getElementById('ytStep1').style.display = '';
  document.getElementById('ytStep2').style.display = 'none';
}

function _showStep2() {
  document.getElementById('ytStep1').style.display = 'none';
  document.getElementById('ytStep2').style.display = '';
}

async function _ytLoadPlaylists() {
  const listEl = document.getElementById('ytModalPlaylists');
  const desc   = document.getElementById('ytStep1Desc');
  desc.textContent = '플레이리스트 불러오는 중...';
  listEl.innerHTML = '';

  try {
    const res  = await fetch('/api/v1/youtube/oauth/status');
    const auth = await res.json();
    if (!auth.authenticated) {
      desc.innerHTML = 'YouTube 계정이 연결되지 않았습니다. '
        + '<a style="color:var(--red);cursor:pointer" onclick="window.location.href=\'/api/v1/youtube/oauth\'">계정 연결하기 →</a>';
      return;
    }

    const r    = await fetch('/api/v1/youtube/playlists');
    const data = await r.json();
    if (data.error) { desc.textContent = data.error; return; }

    _ytPlaylists = data.playlists || [];
    desc.textContent = `${_ytPlaylists.length}개 플레이리스트 · 가져올 항목을 선택하세요`;
    document.getElementById('ytDiscoverBar').style.display = '';

    listEl.innerHTML = _ytPlaylists.map((pl, i) => `
      <div class="yt-pl-item" id="ytRow${i}">
        ${_ytPlItemHtml(i, pl, `${pl.video_count}개 영상${pl.description ? ' · ' + pl.description.slice(0,50) : ''}`)}
      </div>
    `).join('');
  } catch (e) {
    desc.textContent = '불러오기 실패';
  }
}

function ytTogglePl(idx) {
  const cb  = document.getElementById(`ytCb${idx}`);
  const row = document.getElementById(`ytRow${idx}`);
  cb.checked = !cb.checked;
  const pid = _ytPlaylists[idx]?.playlist_id;
  if (cb.checked) { _ytSelected.add(pid); row.classList.add('selected'); }
  else            { _ytSelected.delete(pid); row.classList.remove('selected'); }

  const count = _ytSelected.size;
  document.getElementById('ytSelectedCount').textContent = `${count}개 선택`;
  document.getElementById('ytFilterBtn').disabled = count === 0;
  document.getElementById('ytSaveNowBtn').disabled = count === 0;
  _ytSyncSelectAllBtn();
}

function ytSelectAll() {
  const allSelected = _ytPlaylists.length > 0
    && _ytPlaylists.every(pl => _ytSelected.has(pl.playlist_id));

  _ytPlaylists.forEach((pl, i) => {
    const cb  = document.getElementById(`ytCb${i}`);
    const row = document.getElementById(`ytRow${i}`);
    if (!cb || !row) return;
    if (allSelected) {
      cb.checked = false;
      row.classList.remove('selected');
      _ytSelected.delete(pl.playlist_id);
    } else {
      cb.checked = true;
      row.classList.add('selected');
      _ytSelected.add(pl.playlist_id);
    }
  });

  const count = _ytSelected.size;
  document.getElementById('ytSelectedCount').textContent = `${count}개 선택`;
  document.getElementById('ytFilterBtn').disabled = count === 0;
  document.getElementById('ytSaveNowBtn').disabled = count === 0;
  _ytSyncSelectAllBtn();
}

function _ytSyncSelectAllBtn() {
  const btn = document.getElementById('ytSelectAllBtn');
  if (!btn) return;
  const allSelected = _ytPlaylists.length > 0
    && _ytPlaylists.every(pl => _ytSelected.has(pl.playlist_id));
  btn.textContent = allSelected ? '모두 해제' : '모두 선택';
}

async function ytAddFromUrl() {
  const input = document.getElementById('ytUrlInput');
  const raw   = input.value.trim();
  if (!raw) return;

  // 영상 URL(v=) 이면 채널 플리 탐색, 그 외는 단일 플리 추가
  const isVideo = /(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/.test(raw)
               && !/(?:list=|\/playlist\/)/.test(raw);

  const btn = input.nextElementSibling;
  btn.disabled    = true;
  btn.textContent = '확인 중...';

  try {
    const ok = isVideo
      ? await _ytAddChannelPlaylists(raw, btn)
      : await _ytAddSinglePlaylist(raw);
    if (ok) input.value = '';
  } catch (e) {
    alert('네트워크 오류. 다시 시도해주세요.');
  } finally {
    btn.disabled    = false;
    btn.textContent = '추가';
  }
}

async function _ytAddSinglePlaylist(raw) {
  const res  = await fetch(`/api/v1/youtube/playlist-meta?id=${encodeURIComponent(raw)}`);
  const data = await res.json();

  if (!res.ok) { alert(data.detail || '플레이리스트를 찾을 수 없습니다.'); return false; }
  if (_ytPlaylists.some(p => p.playlist_id === data.playlist_id)) {
    alert('이미 목록에 있는 플레이리스트입니다.'); return false;
  }

  _ytPlaylists.push({
    playlist_id:   data.playlist_id,
    title:         data.title,
    thumbnail_url: data.thumbnail_url,
    video_count:   '?',
    description:   '',
  });

  const i      = _ytPlaylists.length - 1;
  const listEl = document.getElementById('ytModalPlaylists');
  const item   = document.createElement('div');
  item.className = 'yt-pl-item';
  item.id        = `ytRow${i}`;
  item.innerHTML = _ytPlItemHtml(i, data, '공개 플레이리스트');
  listEl.appendChild(item);
  _ytUpdateStepDesc();
  ytTogglePl(i);
  return true;
}

async function _ytAddChannelPlaylists(raw, btn) {
  const m   = /(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(raw);
  const vid = m ? m[1] : raw.trim();

  btn.textContent = '채널 조회 중...';

  const res  = await fetch(`/api/v1/youtube/channel-playlists?video_id=${encodeURIComponent(vid)}`);
  const data = await res.json();

  if (!res.ok) { alert(data.detail || '채널을 찾을 수 없습니다.'); return false; }
  if (!data.playlists?.length) { alert('이 채널에 공개 플레이리스트가 없습니다.'); return false; }

  // 채널 구분선 헤더
  const listEl = document.getElementById('ytModalPlaylists');
  const header = document.createElement('div');
  header.className = 'yt-channel-header';
  header.innerHTML = `📺 <strong>${_esc(data.channel_title)}</strong><span class="yt-ch-count">${data.playlist_count}개 플리</span>`;
  listEl.appendChild(header);

  let added = 0;
  for (const pl of data.playlists) {
    if (_ytPlaylists.some(p => p.playlist_id === pl.playlist_id)) continue;
    _ytPlaylists.push(pl);
    const i    = _ytPlaylists.length - 1;
    const item = document.createElement('div');
    item.className = 'yt-pl-item';
    item.id        = `ytRow${i}`;
    item.innerHTML = _ytPlItemHtml(
      i, pl,
      `${pl.video_count}개 영상${pl.description ? ' · ' + pl.description.slice(0, 50) : ''}`,
    );
    listEl.appendChild(item);
    added++;
  }

  if (added === 0) { alert('이 채널의 플리는 이미 모두 목록에 있습니다.'); return false; }
  _ytUpdateStepDesc();
  return true;
}

const _CAT_COLOR = {
  llm: '#6a2a8a', nlp: '#1a5a8a', dl: '#1a4a2a', ml: '#2a4a1a',
  rl: '#8a4a1a', cv: '#8a1a4a', math: '#0a1628', stat: '#884400',
  data: '#1a4a6a', mlops: '#4a3a1a',
};

function _ytPlItemHtml(i, pl, metaText) {
  const reg = _registeredPlaylistIds.has(pl.playlist_id);
  const cat = (pl.category || '').toLowerCase();
  const catBadge = cat
    ? `<span class="yt-pl-cat-badge" style="background:${_CAT_COLOR[cat]||'#333'}">${cat.toUpperCase()}</span>`
    : '';
  return `
    <div class="yt-pl-item" data-cat="${cat}" data-idx="${i}">
    <div class="yt-pl-row" onclick="ytTogglePl(${i})">
      <input type="checkbox" id="ytCb${i}" onclick="event.stopPropagation();ytTogglePl(${i})">
      ${pl.thumbnail_url
        ? `<img class="yt-pl-thumb" src="${pl.thumbnail_url}" alt="">`
        : `<div class="yt-pl-thumb"></div>`}
      <div class="yt-pl-info">
        <div class="yt-pl-name">
          ${_esc(pl.title)}
          ${catBadge}
          ${reg ? '<span class="yt-pl-reg-badge">등록됨</span>' : ''}
        </div>
        <div class="yt-pl-meta">${metaText}</div>
      </div>
      <button class="yt-pl-expand-btn" id="ytExpBtn${i}" onclick="event.stopPropagation();ytExpandPl(${i})" title="영상 목록">▼</button>
      ${reg
        ? '<span class="yt-pl-reg-badge">등록됨</span>'
        : `<button class="yt-pl-reg-now-btn" id="ytRegBtn${i}" onclick="event.stopPropagation();ytRegisterOne(${i})">등록</button>`}
    </div>
    <div class="yt-pl-videos" id="ytVideos${i}" style="display:none"></div>
    </div>`;
}

function _ytUpdateStepDesc() {
  const desc = document.getElementById('ytStep1Desc');
  desc.textContent = `${_ytPlaylists.length}개 플레이리스트 · 가져올 항목을 선택하세요`;
  // 필터 칩 표시
  if (_ytPlaylists.length > 0) {
    document.getElementById('ytCatFilter').style.display = '';
  }
}

let _ytActiveCat = 'all';
function ytFilterCat(cat) {
  _ytActiveCat = cat;
  // 칩 active 상태
  document.querySelectorAll('.yt-cat-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.cat === cat);
  });
  // 플리 행 show/hide + 채널 헤더 show/hide
  const listEl = document.getElementById('ytModalPlaylists');
  const items  = listEl.querySelectorAll('.yt-pl-item');
  items.forEach(el => {
    const elCat = el.dataset.cat || '';
    el.style.display = (cat === 'all' || elCat === cat) ? '' : 'none';
  });
  // 채널 헤더: 아래 보이는 플리가 하나도 없으면 헤더도 숨김
  const headers = listEl.querySelectorAll('.yt-channel-header');
  headers.forEach(hdr => {
    let sib = hdr.nextElementSibling;
    let hasVisible = false;
    while (sib && !sib.classList.contains('yt-channel-header')) {
      if (sib.classList.contains('yt-pl-item') && sib.style.display !== 'none') {
        hasVisible = true; break;
      }
      sib = sib.nextElementSibling;
    }
    hdr.style.display = hasVisible ? '' : 'none';
  });
}

function ytDiscoverPickPl() {
  const select = document.getElementById('ytDiscoverPlSelect');
  select.innerHTML = _ytPlaylists.map(pl =>
    `<option value="${_esc(pl.playlist_id)}">${_esc(pl.title)} (${pl.video_count}개)</option>`
  ).join('');
  document.getElementById('ytDiscoverPlPicker').style.display = '';
}

function ytDiscoverWithPl() {
  const select = document.getElementById('ytDiscoverPlSelect');
  const opt    = select.options[select.selectedIndex];
  if (!opt) return;
  _ytDiscoverSourceId    = opt.value;
  _ytDiscoverSourceTitle = opt.text;
  document.getElementById('ytDiscoverPlPicker').style.display = 'none';
  _ytNextPageToken     = null;
  _ytDisplayedChannels = new Set();
  ytDiscoverRun(document.getElementById('ytDiscoverPlBtn'));
}

function ytDiscoverCancelPl() {
  document.getElementById('ytDiscoverPlPicker').style.display = 'none';
}

async function ytDiscover() {
  _ytDiscoverSourceId    = null;
  _ytDiscoverSourceTitle = '좋아요 영상';
  _ytNextPageToken       = null;
  _ytDisplayedChannels   = new Set();
  await ytDiscoverRun(document.getElementById('ytDiscoverBtn'));
}

async function ytAutoImport() {
  const btn = document.getElementById('ytAutoImportBtn');
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'AI 분석 중...';

  try {
    const res  = await fetch('/api/v1/youtube/discover/auto-import', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      alert(data.detail || 'AI 자동 가져오기 실패. YouTube 계정 연결을 확인해주세요.');
      return;
    }

    if (!data.selected) {
      alert(data.message || '선택된 플레이리스트가 없습니다.');
      return;
    }

    const plNames = (data.selected_playlists || []).map(p => `• ${p.title} (${p.category})`).join('\n');
    const promoted = data.curated?.promoted ?? 0;
    alert(
      `AI가 ${data.discovered}개 플리 중 ${data.selected}개를 선택했습니다.\n\n`
      + plNames
      + `\n\n→ 새 강의 ${promoted}개 추가됨`
    );
  } catch (e) {
    alert('네트워크 오류. 다시 시도해주세요.');
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

function openCourseModule(courseId, moduleName) {
  gotoLecture(courseId, moduleName);
}

async function ytDiscoverRun(btn) {
  const origText = btn.textContent;
  btn.disabled    = true;
  btn.textContent = `${_ytDiscoverSourceTitle} 분석 중...`;

  try {
    const data = await _ytFetchDiscover(null);
    if (!data) { btn.disabled = false; btn.textContent = origText; return; }

    const added = _ytRenderDiscoverChannels(data.channels || []);
    _ytNextPageToken = data.next_page_token || null;
    _ytUpdateStepDesc();
    _ytSyncDiscoverMoreBtn();
    btn.textContent = added > 0
      ? `✅ ${data.channel_count}개 채널 발견 완료`
      : '✅ 완료 (새 플리 없음)';
  } catch (e) {
    alert('네트워크 오류. 다시 시도해주세요.');
    btn.disabled    = false;
    btn.textContent = origText;
  }
}

async function ytDiscoverMore() {
  if (!_ytNextPageToken) return;
  const btn = document.getElementById('ytDiscoverMoreBtn');
  btn.disabled    = true;
  btn.textContent = '불러오는 중...';

  try {
    const data = await _ytFetchDiscover(_ytNextPageToken);
    if (!data) { _ytSyncDiscoverMoreBtn(); return; }

    _ytRenderDiscoverChannels(data.channels || []);
    _ytNextPageToken = data.next_page_token || null;
    _ytUpdateStepDesc();
    _ytSyncDiscoverMoreBtn();
  } catch (e) {
    alert('네트워크 오류. 다시 시도해주세요.');
    _ytSyncDiscoverMoreBtn();
  }
}

async function _ytFetchDiscover(pageToken) {
  const params = new URLSearchParams();
  if (pageToken)           params.set('page_token', pageToken);
  if (_ytDiscoverSourceId) params.set('source_playlist_id', _ytDiscoverSourceId);
  const url = '/api/v1/youtube/discover' + (params.toString() ? '?' + params.toString() : '');
  const res  = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    alert(data.detail || '채널 발견 실패. YouTube 계정 연결을 확인해주세요.');
    return null;
  }
  if (!data.channels?.length && !pageToken) {
    alert(`${_ytDiscoverSourceTitle} ${data.total_study_videos}개 분석 — 학습 관련 채널 없음`);
    return null;
  }
  return data;
}

function _ytRenderDiscoverChannels(channels) {
  const listEl = document.getElementById('ytModalPlaylists');
  let added = 0;
  for (const ch of channels) {
    if (!_ytDisplayedChannels.has(ch.channel_id)) {
      _ytDisplayedChannels.add(ch.channel_id);
      const icon     = _ytDiscoverSourceId ? '📋' : '👍';
      const srcLabel = _ytDiscoverSourceId
        ? `${_ytDiscoverSourceTitle} 내 영상 ${ch.video_count}개`
        : `좋아요 ${ch.video_count}개`;
      const safeChId = ch.channel_id.replace(/[^a-zA-Z0-9_-]/g, '');
      const header = document.createElement('div');
      header.className = 'yt-channel-header';
      header.dataset.channelId = ch.channel_id;
      header.innerHTML = `${icon} <strong>${_esc(ch.channel_title)}</strong>`
        + `<span class="yt-ch-count">${srcLabel} · 플리 ${ch.playlists.length}개</span>`
        + `<button class="yt-ch-select-btn" onclick="ytSelectChannel('${safeChId}')" data-channel-ref="${safeChId}">전체 선택</button>`;
      listEl.appendChild(header);
    }
    const safeChId = ch.channel_id.replace(/[^a-zA-Z0-9_-]/g, '');
    for (const pl of ch.playlists) {
      if (_ytPlaylists.some(p => p.playlist_id === pl.playlist_id)) continue;
      _ytPlaylists.push(pl);
      const i    = _ytPlaylists.length - 1;
      const item = document.createElement('div');
      item.className = 'yt-pl-item';
      item.id        = `ytRow${i}`;
      item.dataset.channelRef = safeChId;
      item.innerHTML = _ytPlItemHtml(
        i, pl,
        `${pl.video_count}개 영상${pl.description ? ' · ' + pl.description.slice(0, 50) : ''}`,
      );
      listEl.appendChild(item);
      added++;
    }
  }
  return added;
}

function ytSelectChannel(safeChId) {
  const listEl = document.getElementById('ytModalPlaylists');
  const items  = listEl.querySelectorAll(`.yt-pl-item[data-channel-ref="${safeChId}"]`);
  const allSelected = [...items].every(el => {
    const idx = parseInt(el.dataset.idx);
    return _ytSelected.has(_ytPlaylists[idx]?.playlist_id);
  });
  items.forEach(el => {
    const idx = parseInt(el.dataset.idx ?? el.id?.replace('ytRow',''));
    const pl  = _ytPlaylists[idx];
    if (!pl) return;
    if (allSelected) {
      _ytSelected.delete(pl.playlist_id);
      document.getElementById(`ytCb${idx}`)?.setAttribute('checked', false);
      el.classList.remove('selected');
    } else {
      _ytSelected.add(pl.playlist_id);
      document.getElementById(`ytCb${idx}`)?.setAttribute('checked', true);
      el.classList.add('selected');
    }
  });
  // 헤더 버튼 텍스트 토글
  const hdr = listEl.querySelector(`.yt-channel-header [data-channel-ref="${safeChId}"]`);
  if (hdr) hdr.textContent = allSelected ? '전체 선택' : '선택 해제';
  // 선택 수 업데이트
  const count = _ytSelected.size;
  document.getElementById('ytSelectedCount').textContent = `${count}개 선택`;
  document.getElementById('ytFilterBtn').disabled = count === 0;
  document.getElementById('ytSaveNowBtn').disabled = count === 0;
}

function _ytSyncDiscoverMoreBtn() {
  let btn = document.getElementById('ytDiscoverMoreBtn');
  if (_ytNextPageToken) {
    if (!btn) {
      btn = document.createElement('button');
      btn.id        = 'ytDiscoverMoreBtn';
      btn.className = 'yt-discover-btn';
      btn.onclick   = ytDiscoverMore;
      document.querySelector('.yt-discover-bar').appendChild(btn);
    }
    btn.textContent = '더 보기 →';
    btn.disabled    = false;
    btn.style.display = '';
  } else if (btn) {
    btn.style.display = 'none';
  }
}

async function ytExpandPl(i) {
  const pl       = _ytPlaylists[i];
  const videosEl = document.getElementById(`ytVideos${i}`);
  const btnEl    = document.getElementById(`ytExpBtn${i}`);

  if (videosEl.style.display !== 'none') {
    videosEl.style.display = 'none';
    btnEl.textContent = '▼';
    return;
  }
  videosEl.style.display = '';
  btnEl.textContent = '▲';

  if (videosEl.dataset.loaded === '1') return;

  videosEl.innerHTML = '<div class="yt-vid-loading">영상 목록 불러오는 중...</div>';
  try {
    const res  = await fetch('/api/v1/youtube/playlists/filter', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify([pl.playlist_id]),
    });
    const data   = await res.json();
    const plData = data.playlists?.[0];

    if (!plData?.videos?.length) {
      videosEl.innerHTML = '<div class="yt-vid-loading">학습 관련 영상 없음</div>';
      videosEl.dataset.loaded = '1';
      return;
    }

    videosEl.innerHTML = plData.videos.map(v => `
      <div class="yt-vid-item">
        ${v.thumbnail_url
          ? `<img src="${v.thumbnail_url}" class="yt-vid-thumb" alt="">`
          : `<div class="yt-vid-thumb-ph"></div>`}
        <div class="yt-vid-info">
          <span class="yt-cat-badge ${v.category || ''}">${v.category || '—'}</span>
          <span class="yt-vid-title">${_esc(v.title)}</span>
          ${v.duration_sec ? `<span class="yt-vid-dur">${_fmtDur(v.duration_sec)}</span>` : ''}
        </div>
      </div>`).join('');
    videosEl.dataset.loaded = '1';
  } catch(e) {
    videosEl.innerHTML = '<div class="yt-vid-loading">불러오기 실패</div>';
  }
}

async function ytFilterSelected() {
  if (_ytSelected.size === 0) return;
  const btn = document.getElementById('ytFilterBtn');
  btn.disabled = true;
  btn.textContent = '필터링 중...';

  try {
    const res  = await fetch('/api/v1/youtube/playlists/filter', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify([..._ytSelected]),
    });
    _ytFilterData = await res.json();
    _renderStep2();
    _showStep2();
  } catch (e) {
    alert('필터링 실패. 다시 시도해주세요.');
  } finally {
    btn.disabled = _ytSelected.size === 0;
    btn.textContent = '필터링 미리보기 →';
  }
}

function _renderStep2() {
  const { total, playlists } = _ytFilterData;
  document.getElementById('ytStep2Summary').textContent =
    `${playlists.length}개 플리에서 학습 영상 ${total}개 발견`;
  document.getElementById('ytSaveCount').textContent = `${total}개 강의로 저장`;

  const listEl = document.getElementById('ytFilterResults');
  if (total === 0) {
    listEl.innerHTML = '<div style="padding:24px;text-align:center;font-size:12px;color:var(--gray2);font-family:var(--font-mono)">학습 관련 영상이 없습니다.</div>';
    document.getElementById('ytSaveBtn').disabled = true;
    return;
  }

  listEl.innerHTML = playlists.map(pl => {
    if (!pl.videos.length) return '';
    const rows = pl.videos.map(v => `
      <div class="yt-pl-item">
        ${v.thumbnail_url ? `<img class="yt-pl-thumb" src="${v.thumbnail_url}" alt="">` : '<div class="yt-pl-thumb"></div>'}
        <div class="yt-pl-info">
          <div class="yt-pl-name">${_esc(v.title)}</div>
          <div class="yt-pl-meta">${v.duration_sec ? _fmtDur(v.duration_sec) : ''}</div>
        </div>
        <span class="yt-cat-badge ${v.category}">${v.category}</span>
      </div>
    `).join('');
    return `<div class="yt-pl-group-header">${_esc(pl.playlist_title)} · ${pl.total_filtered}개</div>${rows}`;
  }).join('');
}

function ytBackToStep1() { _showStep1(); }

async function ytSaveNow() {
  if (!_ytSelected || !_ytSelected.size) return;
  const btn = document.getElementById('ytSaveNowBtn');
  btn.disabled = true;
  btn.textContent = '저장 중...';
  try {
    const res  = await fetch('/api/v1/youtube/playlists/sync-llm', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify([..._ytSelected]),
    });
    const data = await res.json();
    const llm  = data.llm || {};
    const saved = llm.promoted || 0;
    ytModalClose();
    alert(`완료! ${saved}개 강의가 저장되었습니다.`);
    initCurriculum();
  } catch (e) {
    alert('저장 실패. 다시 시도해주세요.');
    btn.disabled = false;
    btn.textContent = '바로 등록';
  }
}

async function ytRegisterOne(idx) {
  const pl  = _ytPlaylists[idx];
  if (!pl) return;
  const btn = document.getElementById(`ytRegBtn${idx}`);
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    const res  = await fetch('/api/v1/youtube/playlists/sync-llm', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify([pl.playlist_id]),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.detail || `서버 오류 (${res.status})`;
      alert(`등록 실패: ${msg}`);
      if (btn) { btn.disabled = false; btn.textContent = '등록'; }
      return;
    }
    const saved   = (data.llm || {}).promoted || 0;
    const skipped = (data.llm || {}).skipped  || 0;
    if (btn) {
      btn.textContent = saved > 0 ? '등록됨' : '스킵됨';
      btn.disabled = true;
      btn.className = saved > 0 ? 'yt-pl-reg-badge' : 'yt-pl-reg-now-btn';
    }
    if (saved > 0) _registeredPlaylistIds.add(pl.playlist_id);
    if (saved === 0) {
      alert(`저장된 강의 없음 (스킵: ${skipped}개)\n이미 등록된 강의이거나 학습 무관 영상일 수 있습니다.\nGPT 쿼터 초과 시 키워드 분류로 재시도됩니다.`);
      if (btn) { btn.disabled = false; btn.textContent = '재시도'; }
    } else {
      alert(`완료! ${saved}개 강의가 저장되었습니다.`);
      initCurriculum();
    }
  } catch (e) {
    console.error('ytRegisterOne error:', e);
    alert(`저장 실패: ${e.message}`);
    if (btn) { btn.disabled = false; btn.textContent = '등록'; }
  }
}

async function ytSaveFiltered() {
  if (!_ytFilterData || !_ytFilterData.total) return;
  const btn = document.getElementById('ytSaveBtn');
  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    const res  = await fetch('/api/v1/youtube/playlists/sync', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify([..._ytSelected]),
    });
    const data = await res.json();
    const total = Object.values(data.result || {}).reduce((s, r) => s + r.saved, 0);
    ytModalClose();
    alert(`완료! ${total}개 강의가 저장되었습니다.`);
    initCurriculum();
  } catch (e) {
    alert('저장 실패. 다시 시도해주세요.');
    btn.disabled = false;
    btn.textContent = '키워드 저장';
  }
}

async function ytSaveWithLLM() {
  if (!_ytSelected || !_ytSelected.size) return;
  const btn = document.getElementById('ytSaveLlmBtn');
  const keyBtn = document.getElementById('ytSaveBtn');
  btn.disabled = true;
  keyBtn.disabled = true;
  btn.textContent = 'AI 분류 중...';

  try {
    const res = await fetch('/api/v1/youtube/playlists/sync-llm', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify([..._ytSelected]),
    });
    const data = await res.json();
    const llm = data.llm || {};
    const promoted = llm.promoted || 0;
    const skipped  = llm.skipped  || 0;
    const newC     = (llm.new_courses || []).join(', ');
    let msg = `AI 분류 완료!\n\n강의 저장: ${promoted}개`;
    if (skipped)  msg += `\n무관 영상 제외: ${skipped}개`;
    if (newC)     msg += `\n새 강좌 생성: ${newC}`;
    ytModalClose();
    alert(msg);
    initCurriculum();
  } catch (e) {
    alert('AI 분류 실패. 다시 시도해주세요.');
    btn.disabled = false;
    keyBtn.disabled = false;
    btn.textContent = 'AI 분류 저장';
  }
}

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
      `<div class="cd-lec-item${l.completed ? ' done' : ''}">
        <span class="cd-lec-num">${l.number}</span>
        <span class="cd-lec-check">${l.completed ? '✓' : '○'}</span>
        <span class="cd-lec-title">${_esc(l.title)}</span>
        ${l.youtube_url ? `<a href="${l.youtube_url}" target="_blank" class="cd-yt-link">▶</a>` : ''}
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

    const safeM = m.replace(/'/g, "\\'");
    return `<div class="cd-mod-node${idx === 0 ? ' open' : ''}">
      <div class="cd-mod-node-head">
        <div class="cd-mod-node-toggle" onclick="this.closest('.cd-mod-node').classList.toggle('open')">
          <span class="cd-mod-dot ${dc}"></span>
          <span class="cd-mod-node-name">${_esc(m)}</span>
          <span class="cd-mod-node-count">${doneN}/${lecs.length}강 · ${dl}</span>
          <span class="cd-mod-node-arrow">▶</span>
        </div>
        <button class="cd-mod-goto-btn" onclick="openCourseModule('${_cdCourseId}','${safeM}')">강의 보기 →</button>
      </div>
      <div class="cd-mod-lecs">
        ${lecs.map(l =>
          `<div class="cd-mod-lec${l.completed ? ' done' : ''}">
            <span class="cd-mod-lec-num">${l.number}</span>
            <span class="cd-mod-lec-title">${_esc(l.title)}</span>
            ${l.youtube_url ? `<a href="${l.youtube_url}" target="_blank" class="cd-yt-link">▶</a>` : ''}
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
        `<div class="cg-flat-lec${l.completed ? ' done' : ''}">
          <span class="cg-flat-num">${l.number}</span>
          <span class="cg-flat-title">${_esc(l.title)}</span>
          ${l.youtube_url ? `<a href="${l.youtube_url}" target="_blank" class="cd-yt-link">▶</a>` : ''}
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
        <div class="cg-node-head ${dc}">
          <div class="cg-node-head-main" onclick="cgToggleNode(${idx})">
            <div class="cg-node-title">${safeM}</div>
            <div class="cg-node-sub">${dl} · ${lecs.length}강</div>
            <div class="cg-node-done">${doneN > 0 ? `${doneN}/${lecs.length} 완료` : '미시작'}</div>
          </div>
          <button class="cg-mod-goto-btn" onclick="openCourseModule('${_cgCourseId}','${safeM}')">▶ 강의</button>
        </div>
        <div class="cg-node-lecs">
          ${lecs.map(l =>
            `<div class="cg-lec-item${l.completed ? ' done' : ''}" draggable="true"
                data-lec-id="${l.id}" data-module="${safeM}"
                ondragstart="_cgLecDragStart(event,this)"
                ondragend="_cgLecDragEnd()"
                ondragover="_cgLecItemDragOver(event,this)"
                ondrop="_cgLecItemDrop(event,this,'${_cgCourseId}')">
              <span class="cg-lec-drag">⠿</span>
              <span class="cg-lec-num">${l.number}</span>
              <span class="cg-lec-title">${_esc(l.title)}</span>
              ${l.youtube_url ? `<a href="${l.youtube_url}" target="_blank" class="cd-yt-link">▶</a>` : ''}
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
  document.querySelectorAll('.cg-lec-item').forEach(i => i.classList.remove('cg-lec-drop-before', 'cg-lec-drop-after'));
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

  if (!targetModule) { _cgLecDragEnd(); return; }

  const lecId = _cgLecDragEl.dataset.lecId;
  const targetLecs = nodeEl.querySelector('.cg-node-lecs');

  if (targetModule === srcModule) {
    // 같은 모듈: 맨 끝에 추가 (lec-item 위에 드롭된 경우는 _cgLecItemDrop이 처리)
    if (targetLecs) targetLecs.appendChild(_cgLecDragEl);
  } else {
    // 다른 모듈로 이동
    if (targetLecs) {
      _cgLecDragEl.dataset.module = targetModule;
      targetLecs.appendChild(_cgLecDragEl);
      nodeEl.classList.add('open');
    }
    const lecs = _courseLectures[courseId];
    if (lecs) {
      const lec = lecs.find(l => l.id === lecId);
      if (lec) lec.module_name = targetModule;
    }
  }

  _cgLecDragEnd();
  _cgUpdateNodeCounts();
  await _cgRenumberAllAndSave(courseId);
}

function _cgLecItemDragOver(e, el) {
  e.preventDefault();
  e.stopPropagation();
  if (!_cgLecDragEl || el === _cgLecDragEl) return;
  e.dataTransfer.dropEffect = 'move';

  document.querySelectorAll('.cg-lec-item').forEach(i => i.classList.remove('cg-lec-drop-before', 'cg-lec-drop-after'));
  document.querySelectorAll('.cg-node.cg-drop-target').forEach(n => n.classList.remove('cg-drop-target'));

  const rect = el.getBoundingClientRect();
  const before = e.clientY < rect.top + rect.height / 2;
  el.classList.add(before ? 'cg-lec-drop-before' : 'cg-lec-drop-after');
}

async function _cgLecItemDrop(e, el, courseId) {
  e.preventDefault();
  e.stopPropagation();
  if (!_cgLecDragEl || el === _cgLecDragEl) { _cgLecDragEnd(); return; }

  const rect = el.getBoundingClientRect();
  const before = e.clientY < rect.top + rect.height / 2;
  const targetModule = el.dataset.module;

  _cgLecDragEl.dataset.module = targetModule;
  if (before) {
    el.parentNode.insertBefore(_cgLecDragEl, el);
  } else {
    el.parentNode.insertBefore(_cgLecDragEl, el.nextSibling);
  }

  el.closest('.cg-node')?.classList.add('open');
  _cgLecDragEnd();
  _cgUpdateNodeCounts();
  await _cgRenumberAllAndSave(courseId);
}

function _cgUpdateNodeCounts() {
  document.querySelectorAll('.cg-node').forEach(n => {
    const cnt = n.querySelectorAll('.cg-lec-item').length;
    const sub = n.querySelector('.cg-node-sub');
    if (sub) sub.textContent = sub.textContent.replace(/\d+강/, cnt + '강');
  });
}

async function _cgRenumberAllAndSave(courseId) {
  const allItems = [...document.querySelectorAll('.cg-node .cg-lec-item')];
  const updates = allItems.map((item, idx) => {
    const newNum = idx + 1;
    const numEl = item.querySelector('.cg-lec-num');
    if (numEl) numEl.textContent = newNum;
    const lecs = _courseLectures[courseId];
    if (lecs) {
      const lec = lecs.find(l => l.id === item.dataset.lecId);
      if (lec) lec.number = newNum;
    }
    return { id: item.dataset.lecId, number: newNum };
  });

  try {
    await fetch('/api/v1/curriculum/lectures/batch-meta', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch (err) { console.warn('renumber failed', err); }
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
