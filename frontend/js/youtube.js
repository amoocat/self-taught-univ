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

async function openCourseModule(courseId, moduleName) {
  gotoLecture(courseId);
  await selectCourse(courseId);
  const modBody = document.getElementById('lmBody');
  if (!modBody) return;
  modBody.querySelectorAll('.ll-module-section').forEach(sec => {
    const nameEl = sec.querySelector('.ll-module-name');
    const match  = nameEl && nameEl.textContent.trim() === moduleName;
    sec.classList.toggle('open', match);
    if (match) sec.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
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

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _fmtDur(sec) {
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}
