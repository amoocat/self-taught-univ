/* ════════════════════════════════════════
   NAVIGATION CONSTANTS + ROUTER
   (모듈별 코드는 frontend/js/ 참조)
════════════════════════════════════════ */
const SIDEBAR_PAGES = ['lecture','mynotes','graph'];
const NO_SIDEBAR    = ['home','about','curriculum','papers','blog'];
const ALL_PAGES     = ['home','about','curriculum','lecture','mynotes','papers','blog','graph'];

let BLOG_POSTS = [];

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
