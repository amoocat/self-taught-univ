/* ────────────────────────────────────────
   BLOG FEED — 동적 렌더링
──────────────────────────────────────── */
let _blogLoaded = false;

async function initBlog() {
  if (_blogLoaded) return;
  const list = document.getElementById('feedList');
  try {
    const res = await fetch('/api/v1/feed/');
    if (res.ok) {
      const posts = await res.json();
      if (posts.length > 0) {
        _blogLoaded = true;
        BLOG_POSTS = posts;
        list.innerHTML = posts.map((p, i) => {
          const kw1 = p.keywords[0] || '';
          const kw2 = p.keywords[1] || '';
          return `<div class="feed-item" onclick="selectPost(this,${i})">
            <div class="feed-item-meta">
              <span class="feed-source-badge ${p.badge}">${p.source}</span>
              <span class="feed-date">${p.date}</span>
              ${kw1 ? `<span class="feed-tag">${kw1}</span>` : ''}
              ${kw2 ? `<span class="feed-tag">${kw2}</span>` : ''}
            </div>
            <div class="feed-title">${p.title}</div>
            <div class="feed-preview">${p.summary || ''}</div>
            <div class="feed-item-foot">
              <button class="feed-related-btn" onclick="event.stopPropagation();goto('lecture')">→ 렉쳐와 연결</button>
              <button class="feed-note-btn" onclick="event.stopPropagation();goto('mynotes')">✎ 내 노트에 저장</button>
            </div>
          </div>`;
        }).join('');
        return;
      }
    }
  } catch (e) {
    console.warn('Feed fetch failed', e);
  }
  list.innerHTML = '<div style="padding:24px;color:var(--ink2);font-size:13px">피드 데이터가 없습니다.<br>크롤러를 실행하면 글이 추가됩니다.</div>';
}

let _blogSourceFilter = 'all';
let _blogTabFilter    = 'all';
let _blogSearchQuery  = '';

function _renderBlogFeed() {
  const list = document.getElementById('feedList');
  if (!list) return;
  let posts = BLOG_POSTS;

  if (_blogSourceFilter !== 'all') {
    posts = posts.filter(p => (p.badge || '').includes(_blogSourceFilter) ||
      (p.source || '').toLowerCase().includes(_blogSourceFilter));
  }
  if (_blogTabFilter !== 'all') {
    posts = posts.filter(p => (p.category || 'etc') === _blogTabFilter);
  }
  if (_blogSearchQuery) {
    const q = _blogSearchQuery.toLowerCase();
    posts = posts.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.summary || '').toLowerCase().includes(q)
    );
  }

  if (!posts.length) {
    list.innerHTML = '<div style="padding:24px;color:var(--ink2);font-size:13px">검색 결과가 없습니다.</div>';
    return;
  }

  list.innerHTML = posts.map((p, i) => {
    const kw1 = (p.keywords || [])[0] || '';
    const kw2 = (p.keywords || [])[1] || '';
    return `<div class="feed-item" onclick="selectPost(this,${BLOG_POSTS.indexOf(p)})">
      <div class="feed-item-meta">
        <span class="feed-source-badge ${p.badge}">${p.source}</span>
        <span class="feed-date">${p.date}</span>
        ${kw1 ? `<span class="feed-tag">${kw1}</span>` : ''}
        ${kw2 ? `<span class="feed-tag">${kw2}</span>` : ''}
      </div>
      <div class="feed-title">${p.title}</div>
      <div class="feed-preview">${p.summary || ''}</div>
      <div class="feed-item-foot">
        <button class="feed-related-btn" onclick="event.stopPropagation();goto('lecture')">→ 렉쳐와 연결</button>
        <button class="feed-note-btn" onclick="event.stopPropagation();goto('mynotes')">✎ 내 노트에 저장</button>
      </div>
    </div>`;
  }).join('');

}

function filterBlog(type, el) {
  document.querySelectorAll('.src-item').forEach(e => e.classList.remove('active'));
  if (el) el.classList.add('active');
  _blogSourceFilter = type;
  _renderBlogFeed();
}

function setBlogTab(btn, tab) {
  document.querySelectorAll('.feed-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _blogTabFilter = tab;
  _renderBlogFeed();
}

function searchBlog(q) {
  _blogSearchQuery = q;
  _renderBlogFeed();
}

function selectPost(el, idx) {
  showBlogDetail(idx);
}

function showBlogDetail(idx) {
  const p = BLOG_POSTS[idx];
  if (!p) return;

  const kws = (p.keywords || []).map(k =>
    `<span class="ra-kw-chip" onclick="goto('graph')">${k}</span>`
  ).join('');
  const courses = (p.courses || []).map(([name, color]) =>
    `<span class="ra-kw-chip" style="border-color:${color};color:${color}" onclick="goto('lecture')">${name}</span>`
  ).join('');
  const paperBtn = p.related_paper
    ? `<button class="ra-action-btn" onclick="goto('papers')">📄 관련 논문: ${p.related_paper}</button>`
    : '';

  document.getElementById('blogDetailSourceBadge').textContent = p.source || '';
  document.getElementById('blogDetailBody').innerHTML = `
    <div class="ra-title" style="font-size:22px;line-height:1.35;margin-bottom:6px">${p.title}</div>
    <div class="ra-meta" style="margin-bottom:20px">${p.date}${p.url ? ` · <a href="${p.url}" target="_blank" style="color:var(--gold2);text-decoration:underline">원문 링크</a>` : ''}</div>
    <div class="ra-summary-label">AI 요약</div>
    <div class="ra-summary" style="margin-bottom:20px">${p.summary || '요약 없음'}</div>
    ${kws ? `<div class="ra-kw-section"><div class="ra-kw-label">핵심 키워드</div><div class="ra-kw-chips">${kws}</div></div>` : ''}
    ${courses ? `<div class="ra-kw-section"><div class="ra-kw-label">연관 과목</div><div class="ra-kw-chips">${courses}</div></div>` : ''}
    <div class="ra-actions" style="margin-top:24px">
      ${p.url ? `<button class="ra-action-btn" onclick="window.open('${p.url}','_blank')">🔗 원문 보기</button>` : ''}
      <button class="ra-action-btn gold" onclick="goto('mynotes')">✎ 내 노트에 정리하기</button>
      ${paperBtn}
      <button class="ra-action-btn" onclick="goto('chatbot')">★ AI 학습봇에서 질문하기</button>
      <button class="ra-action-btn" onclick="goto('graph')">◎ 지식 그래프에서 연결 보기</button>
    </div>`;

  document.getElementById('blogLayout').style.display = 'none';
  document.getElementById('blogDetailView').classList.add('active');
}

function closeBlogDetail() {
  document.getElementById('blogDetailView').classList.remove('active');
  document.getElementById('blogLayout').style.display = '';
}

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

/* topbar height */
function setTopbarH() {
  const h = document.querySelector('.topbar').offsetHeight;
  document.documentElement.style.setProperty('--topbar-h', h+'px');
}
setTopbarH();
window.addEventListener('resize', () => {
  setTopbarH();
  if (typeof graphInitialized !== 'undefined' && graphInitialized) {
    const canvas = document.getElementById('graphCanvas');
    d3Svg.attr('width', canvas.clientWidth).attr('height', canvas.clientHeight);
  }
});
