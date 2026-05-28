/* ════════════════════════════════════════
   PAPERS — 동적 렌더링
════════════════════════════════════════ */
let _papersLoaded = false;
let _allPapers = [];

function searchPapers(q) {
  const filtered = q
    ? _allPapers.filter(p =>
        p.title.toLowerCase().includes(q.toLowerCase()) ||
        (p.authors || '').toLowerCase().includes(q.toLowerCase())
      )
    : _allPapers;
  renderPaperList(filtered);
}

async function initPapers() {
  if (_papersLoaded) return;
  const listEl = document.getElementById('paperListItems');
  if (!listEl) return;
  listEl.innerHTML = '<div class="ln-empty">불러오는 중...</div>';
  try {
    const res = await fetch('/api/v1/papers/');
    if (!res.ok) throw new Error();
    _allPapers = await res.json();
    _papersLoaded = true;
    renderPaperList(_allPapers);
    if (_allPapers.length > 0) loadPaper(_allPapers[0].id);
  } catch (e) {
    listEl.innerHTML = '<div class="ln-empty">논문 목록을 불러올 수 없습니다</div>';
  }
}

async function addPaper() {
  const input = document.getElementById('arxivInput');
  const btn = document.querySelector('.paper-add-btn');
  const msg = document.getElementById('paperAddMsg');
  const arxivId = (input?.value || '').trim();
  if (!arxivId) return;

  btn.disabled = true;
  btn.textContent = '추가 중...';
  msg.style.display = 'none';

  try {
    const res = await fetch('/api/v1/papers/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arxiv_id: arxivId }),
    });
    const data = await res.json();
    if (!res.ok) {
      showPaperMsg(msg, 'err', data.detail || '추가 실패');
      return;
    }
    _allPapers.unshift(data);
    _papersLoaded = true;
    renderPaperList(_allPapers);
    loadPaper(data.id);
    input.value = '';
    showPaperMsg(msg, 'ok', `"${data.title.slice(0, 40)}..." 추가됨`);
  } catch (e) {
    showPaperMsg(msg, 'err', '서버에 연결할 수 없습니다');
  } finally {
    btn.disabled = false;
    btn.textContent = '+ 추가';
  }
}

function showPaperMsg(el, type, text) {
  el.className = `paper-add-msg ${type}`;
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function renderPaperList(papers) {
  const listEl = document.getElementById('paperListItems');
  if (!listEl) return;
  listEl.innerHTML = papers.map((p, i) => {
    const firstAuthor = (p.authors || '').split(',')[0].trim();
    const etAl = (p.authors || '').includes(',') ? ' et al.' : '';
    return `<div class="paper-item${i === 0 ? ' active' : ''}" onclick="loadPaper('${p.id}', this)">
      <div class="paper-year">${p.year || ''}${p.venue ? ' · ' + p.venue : ''}</div>
      <div class="paper-title">${p.title}</div>
      <div class="paper-authors">${firstAuthor}${etAl}</div>
    </div>`;
  }).join('');
}

let _paperChatHistory = [];
let _paperChatPaperId = null;
let _paperChatStreaming = false;

async function loadPaper(id, clickedEl) {
  if (clickedEl) {
    document.querySelectorAll('.paper-item').forEach(b => b.classList.remove('active'));
    clickedEl.classList.add('active');
  }
  const toolbar = document.getElementById('paperReaderToolbar');
  const body = document.getElementById('paperReaderBody');
  if (!toolbar || !body) return;

  _paperChatHistory = [];
  _paperChatPaperId = id;

  body.innerHTML = '<div class="ph-block"><div class="ph-line" style="width:100%"></div><div class="ph-line" style="width:70%"></div></div>';

  try {
    const res = await fetch(`/api/v1/papers/${id}`);
    if (!res.ok) throw new Error();
    const p = await res.json();

    const firstAuthor = (p.authors || '').split(',')[0].trim();
    const etAl = (p.authors || '').includes(',') ? ' et al.' : '';

    toolbar.innerHTML = `
      <div class="reader-title">${p.title} — ${firstAuthor}${etAl}${p.year ? ', ' + p.year : ''}</div>
      ${p.arxiv_id ? `<a class="reader-btn" href="https://arxiv.org/abs/${p.arxiv_id}" target="_blank" rel="noopener">arXiv →</a>` : ''}
      <button class="reader-btn" onclick="goto('mynotes')">→ 내 노트</button>`;

    const annHtml = p.annotations && p.annotations.length > 0
      ? p.annotations.map(a => `
          <div class="ann-item">
            <div class="ann-kw">${a.keyword}</div>
            <div class="ann-ex">${a.explanation}</div>
          </div>`).join('')
      : `<div class="ln-empty" style="padding:16px;text-align:center;font-size:12px">
           주석이 없어요.<br>아래 버튼으로 AI 주석을 생성해보세요.
         </div>`;

    body.innerHTML = `
      <div class="paper-text">
        <div class="paper-abstract-label">ABSTRACT</div>
        <div class="paper-abstract">${p.abstract || '초록 없음'}</div>
        <div class="paper-sec-title">저자</div>
        <div class="paper-para">${p.authors || ''}</div>
        ${p.venue ? `<div class="paper-sec-title">게재 정보</div><div class="paper-para">${p.venue}${p.year ? ' · ' + p.year : ''}</div>` : ''}
      </div>
      <div class="annotation-panel">
        <div class="ann-head">
          AI 키워드 주석
          <button class="reader-btn" id="annotateBtn" onclick="annotatePaper('${p.id}')">✦ 주석 생성</button>
        </div>
        <div id="paperAnnotations">${annHtml}</div>
        <div class="paper-chat-section">
          <div class="paper-chat-head">논문 Q&amp;A</div>
          <div class="paper-chat-msgs" id="paperChatMsgs">
            <div class="paper-chat-msg ai">이 논문에 대해 궁금한 점을 질문해보세요!</div>
          </div>
          <div class="paper-chat-row">
            <input id="paperChatInput" class="paper-chat-input" placeholder="논문에 대해 질문하세요..."
              onkeydown="if(event.key==='Enter')paperChatSend()">
            <button class="paper-chat-send" onclick="paperChatSend()">전송</button>
          </div>
        </div>
      </div>`;
  } catch (e) {
    body.innerHTML = '<div class="ln-empty">논문 정보를 불러올 수 없습니다</div>';
  }
}

async function annotatePaper(paperId) {
  const btn = document.getElementById('annotateBtn');
  const panel = document.getElementById('paperAnnotations');
  if (!btn || !panel) return;

  btn.disabled = true;
  btn.textContent = '생성 중...';
  panel.innerHTML = '<div class="ln-empty" style="padding:16px;text-align:center;font-size:12px">GPT-4o 분석 중...</div>';

  try {
    const res = await fetch(`/api/v1/papers/${paperId}/annotate`, { method: 'POST' });
    if (!res.ok) throw new Error();
    const annotations = await res.json();

    panel.innerHTML = annotations.length > 0
      ? annotations.map(a => `
          <div class="ann-item">
            <div class="ann-kw">${a.keyword}</div>
            <div class="ann-ex">${a.explanation}</div>
          </div>`).join('')
      : '<div class="ln-empty" style="padding:16px;text-align:center;font-size:12px">주석을 생성할 수 없었어요.</div>';

    btn.textContent = '✦ 재생성';
  } catch (e) {
    panel.innerHTML = '<div class="ln-empty" style="padding:16px;color:#e74c3c;font-size:12px">주석 생성 실패. 다시 시도해주세요.</div>';
    btn.textContent = '✦ 주석 생성';
  } finally {
    btn.disabled = false;
  }
}

function paperChatAddMsg(role, html, streaming = false) {
  const wrap = document.getElementById('paperChatMsgs');
  if (!wrap) return null;
  const el = document.createElement('div');
  el.className = `paper-chat-msg ${role}`;
  if (streaming) {
    el.innerHTML = `<div class="pcm-body"></div>`;
    wrap.appendChild(el);
    wrap.scrollTop = wrap.scrollHeight;
    return el.querySelector('.pcm-body');
  }
  el.innerHTML = `<div class="pcm-body">${html.replace(/\n/g, '<br>')}</div>`;
  wrap.appendChild(el);
  wrap.scrollTop = wrap.scrollHeight;
  return null;
}

async function paperChatSend() {
  if (_paperChatStreaming || !_paperChatPaperId) return;
  const input = document.getElementById('paperChatInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  paperChatAddMsg('user', text);
  _paperChatHistory.push({ role: 'user', content: text });
  _paperChatStreaming = true;

  const bodyEl = paperChatAddMsg('ai', '', true);
  if (!bodyEl) { _paperChatStreaming = false; return; }

  try {
    const resp = await fetch(`/api/v1/chat/paper/${_paperChatPaperId}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: _paperChatHistory.slice(0, -1),
      }),
    });

    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    const wrap = document.getElementById('paperChatMsgs');

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
          bodyEl.innerHTML = fullText.replace(/\n/g, '<br>');
          if (wrap) wrap.scrollTop = wrap.scrollHeight;
        } catch {}
      }
    }

    if (fullText) {
      _paperChatHistory.push({ role: 'assistant', content: fullText });
    }
  } catch (e) {
    bodyEl.innerHTML = '연결 오류. 잠시 후 다시 시도해주세요.';
    _paperChatHistory.pop();
    console.error('Paper chat error:', e);
  } finally {
    _paperChatStreaming = false;
  }
}
