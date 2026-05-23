/* ════════════════════════════════════════
   FLOATING CHATBOT
════════════════════════════════════════ */
let chatOpen = false;
let chatMode = 'study';
let chatHistory = [];
let chatSessionId = null;
let chatSubject = '선형대수학';
let chatStreaming = false;
let chatUnread = 1;

function chatToggle() {
  chatOpen = !chatOpen;
  const win = document.getElementById('chatWindow');
  const fab = document.getElementById('chatFab');
  win.classList.toggle('open', chatOpen);
  fab.classList.toggle('open', chatOpen);

  if (chatOpen) {
    chatUnread = 0;
    document.getElementById('chatFabBadge').classList.add('hidden');
    setTimeout(() => document.getElementById('chatInput').focus(), 250);
  }
}

function chatSetMode(mode) {
  chatMode = mode;
  document.getElementById('modeStudy').classList.toggle('active', mode === 'study');
  document.getElementById('modeTest').classList.toggle('active', mode === 'test');
  document.getElementById('chatScoreBar').style.display = 'none';
  document.getElementById('chatChips').style.display = mode === 'study' ? 'flex' : 'none';

  chatHistory = [];
  chatSessionId = null;

  if (mode === 'test') {
    chatAddMsg('ai', '테스트 모드예요! 아무 말이나 입력하면 첫 문제를 드릴게요.');
  } else {
    chatAddMsg('ai', '학습 모드예요. 궁금한 개념을 자유롭게 질문해보세요!');
  }
}

async function chatInitSession() {
  try {
    const params = new URLSearchParams({ mode: chatMode, subject: chatSubject });
    const res = await fetch(`/api/v1/chat/sessions?${params}`, { method: 'POST' });
    const data = await res.json();
    chatSessionId = data.session_id;
  } catch (e) {
    console.warn('Session init failed', e);
  }
}

async function chatSaveHistory() {
  if (!chatSessionId) return;
  try {
    await fetch(`/api/v1/chat/sessions/${chatSessionId}/messages`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatHistory),
    });
  } catch (e) {
    console.warn('History save failed', e);
  }
}

function chatAddMsgStreaming(role) {
  const wrap = document.getElementById('chatMessages');
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;
  const av = document.createElement('div');
  av.className = 'chat-msg-av';
  av.textContent = role === 'ai' ? 'AI' : '나';
  const body = document.createElement('div');
  body.className = 'chat-msg-body';
  el.appendChild(av);
  el.appendChild(body);
  wrap.appendChild(el);
  wrap.scrollTop = wrap.scrollHeight;

  if (!chatOpen && role === 'ai') {
    chatUnread++;
    const badge = document.getElementById('chatFabBadge');
    badge.textContent = chatUnread;
    badge.classList.remove('hidden');
  }
  return body;
}

async function chatCallStream(text) {
  if (chatStreaming) return;
  chatStreaming = true;

  if (!chatSessionId) {
    await chatInitSession();
  }

  chatHistory.push({ role: 'user', content: text });
  chatShowTyping();

  try {
    const resp = await fetch('/api/v1/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: chatSessionId,
        mode: chatMode,
        subject: chatSubject,
        message: text,
        history: chatHistory.slice(0, -1),
      }),
    });

    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    chatRemoveTyping();
    const bodyEl = chatAddMsgStreaming('ai');
    const wrap = document.getElementById('chatMessages');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

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
          wrap.scrollTop = wrap.scrollHeight;
        } catch {}
      }
    }

    if (fullText) {
      chatHistory.push({ role: 'assistant', content: fullText });
      chatSaveHistory();
    }
  } catch (e) {
    chatRemoveTyping();
    chatAddMsg('ai', '연결 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    console.error('Chat stream error:', e);
    chatHistory.pop();
  } finally {
    chatStreaming = false;
  }
}

function chatSend() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text || chatStreaming) return;

  chatAddMsg('user', text);
  input.value = '';
  document.getElementById('chatFabBadge').classList.add('hidden');

  chatCallStream(text);
}

function chatSuggest(text) {
  document.getElementById('chatInput').value = text;
  chatSend();
}

function chatAddMsg(role, html) {
  const wrap = document.getElementById('chatMessages');
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;
  el.innerHTML = `
    <div class="chat-msg-av">${role === 'ai' ? 'AI' : '나'}</div>
    <div class="chat-msg-body">${html.replace(/\n/g,'<br>')}</div>`;
  wrap.appendChild(el);
  wrap.scrollTop = wrap.scrollHeight;

  if (!chatOpen && role === 'ai') {
    chatUnread++;
    const badge = document.getElementById('chatFabBadge');
    badge.textContent = chatUnread;
    badge.classList.remove('hidden');
  }
}

function chatShowTyping() {
  const wrap = document.getElementById('chatMessages');
  const el = document.createElement('div');
  el.className = 'chat-msg ai chat-typing';
  el.id = 'chatTyping';
  el.innerHTML = `
    <div class="chat-msg-av">AI</div>
    <div class="chat-msg-body">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  wrap.appendChild(el);
  wrap.scrollTop = wrap.scrollHeight;
}

function chatRemoveTyping() {
  const el = document.getElementById('chatTyping');
  if (el) el.remove();
}

function chatClear() {
  document.getElementById('chatMessages').innerHTML = `
    <div class="chat-msg ai">
      <div class="chat-msg-av">AI</div>
      <div class="chat-msg-body">대화가 초기화됐어요. 다시 시작해볼까요?</div>
    </div>`;
  chatHistory = [];
  chatSessionId = null;
}

// ESC로 닫기
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('courseDetailModal')?.style.display === 'flex') cdClose();
    else if (chatOpen) chatToggle();
  }
});
let OBS_NOTES = [];

let obsCurrentId = null;
let obsEditor = null;
let obsDirty = false;

async function obsInit() {
  // CodeMirror 초기화 (동기)
  const wrap = document.getElementById('obsEditorWrap');
  obsEditor = CodeMirror(wrap, {
    mode: 'markdown',
    theme: 'base16-light',
    lineNumbers: false,
    lineWrapping: true,
    autofocus: false,
    extraKeys: { "Ctrl-S": obsSave, "Cmd-S": obsSave },
  });

  // [[링크]] 하이라이팅 + 자동완성
  obsEditor.on('change', (cm, change) => {
    obsDirty = true;
    obsHighlightWikiLinks(cm);

    // [[ 입력 시 자동완성
    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const before = line.slice(0, cursor.ch);
    if (before.endsWith('[[')) {
      CodeMirror.showHint(cm, () => {
        const list = OBS_NOTES
          .filter(n => n.id !== obsCurrentId)
          .map(n => ({
            text: n.title + ']]',
            displayText: n.title,
            className: 'obs-hint-item',
          }));
        return {
          list,
          from: CodeMirror.Pos(cursor.line, cursor.ch),
          to: CodeMirror.Pos(cursor.line, cursor.ch),
        };
      }, { completeSingle: false });
    }
  });

  // 클릭으로 [[링크]] 이동
  obsEditor.on('mousedown', (cm, e) => {
    const pos = cm.coordsChar({ left: e.clientX, top: e.clientY });
    const line = cm.getLine(pos.line);
    const match = [...line.matchAll(/\[\[([^\]]+)\]\]/g)];
    for (const m of match) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (pos.ch >= start && pos.ch <= end) {
        const linked = OBS_NOTES.find(n => n.title === m[1]);
        if (linked) { e.preventDefault(); obsOpen(linked.id); }
      }
    }
  });

  document.getElementById('obsEmpty').style.display = 'flex';
  document.getElementById('obsEditorHead').style.display = 'none';
  wrap.style.display = 'none';

  // API에서 노트 로딩 (비동기)
  try {
    const res = await fetch('/api/v1/notes/');
    if (res.ok) {
      OBS_NOTES = await res.json();
    }
  } catch (e) {
    console.warn('Notes fetch failed', e);
  }
  obsRenderList(OBS_NOTES);
}

function obsHighlightWikiLinks(cm) {
  // 기존 마커 제거 후 재적용
  cm.getAllMarks().forEach(m => m.clear());
  const lineCount = cm.lineCount();
  for (let i = 0; i < lineCount; i++) {
    const line = cm.getLine(i);
    const matches = [...line.matchAll(/\[\[([^\]]+)\]\]/g)];
    for (const m of matches) {
      const from = { line: i, ch: m.index };
      const to   = { line: i, ch: m.index + m[0].length };
      cm.markText(from, to, {
        className: 'cm-wiki-link',
        title: m[1],
      });
    }
  }
}

function obsRenderList(notes) {
  const list = document.getElementById('obsNoteList');
  list.innerHTML = '';
  notes.forEach(n => {
    const el = document.createElement('div');
    el.className = 'obs-note-item' + (n.id === obsCurrentId ? ' active' : '');
    el.innerHTML = `
      <div class="obs-note-item-title">${n.title}</div>
      <div class="obs-note-item-meta">
        <span>${n.tags.map(t=>'#'+t).join(' ')}</span>
        <span>${n.updated}</span>
        <button class="obs-delete-btn" title="삭제" onclick="event.stopPropagation();obsDelete('${n.id}')">✕</button>
      </div>`;
    el.onclick = () => obsOpen(n.id);
    list.appendChild(el);
  });
}

async function obsDelete(id) {
  if (!confirm('이 노트를 삭제할까요?')) return;
  try {
    const res = await fetch(`/api/v1/notes/${id}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      OBS_NOTES = OBS_NOTES.filter(n => n.id !== id);
      if (obsCurrentId === id) {
        obsCurrentId = null;
        document.getElementById('obsEmpty').style.display = 'flex';
        document.getElementById('obsEditorHead').style.display = 'none';
        document.getElementById('obsEditorWrap').style.display = 'none';
      }
      obsRenderList(OBS_NOTES);
    }
  } catch (e) {
    console.warn('Delete note failed', e);
  }
}

function obsOpen(id) {
  if (obsDirty && obsCurrentId) {
    const cur = OBS_NOTES.find(n => n.id === obsCurrentId);
    if (cur) cur.content = obsEditor.getValue();
  }

  const note = OBS_NOTES.find(n => n.id === id);
  if (!note) return;

  obsCurrentId = id;
  obsDirty = false;

  document.getElementById('obsEmpty').style.display = 'none';
  document.getElementById('obsEditorHead').style.display = 'flex';
  document.getElementById('obsEditorWrap').style.display = 'flex';
  document.getElementById('obsPreview').style.display = 'none';
  document.getElementById('btnEdit').classList.add('active');
  document.getElementById('btnPreview').classList.remove('active');

  document.getElementById('obsTitleInput').value = note.title;
  obsEditor.setValue(note.content);
  obsHighlightWikiLinks(obsEditor);

  obsRenderList(OBS_NOTES);
  obsRenderBacklinks(id);
  obsRenderTags(note.tags);
  obsRenderMiniGraph(id);

  setTimeout(() => obsEditor.refresh(), 50);
}

function obsOpenNote(noteId) { obsOpen(noteId); }

async function obsNewNote(lectureId) {
  try {
    const body = { title: '새 노트', content_md: '# 새 노트\n\n', tags: [] };
    if (lectureId) body.lecture_id = lectureId;
    const res = await fetch('/api/v1/notes/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const note = await res.json();
      OBS_NOTES.unshift(note);
      obsOpen(note.id);
      setTimeout(() => { const ti = document.getElementById('obsTitleInput'); ti.focus(); ti.select(); }, 100);
      return;
    }
  } catch (e) {
    console.warn('Create note failed', e);
  }
  // fallback: 로컬 임시 노트
  const id = 'tmp_' + Date.now();
  const note = { id, title: '새 노트', content: '# 새 노트\n\n', content_md: '# 새 노트\n\n', tags: [], updated: '방금' };
  OBS_NOTES.unshift(note);
  obsOpen(id);
  setTimeout(() => { const ti = document.getElementById('obsTitleInput'); ti.focus(); ti.select(); }, 100);
}

function obsTitleChanged() {
  const note = OBS_NOTES.find(n => n.id === obsCurrentId);
  if (note) { note.title = document.getElementById('obsTitleInput').value; obsDirty = true; }
}

async function obsSave() {
  if (!obsCurrentId) return;
  const note = OBS_NOTES.find(n => n.id === obsCurrentId);
  if (!note) return;
  note.title      = document.getElementById('obsTitleInput').value;
  note.content    = obsEditor.getValue();
  note.content_md = note.content;
  note.updated    = '방금';
  obsDirty = false;

  // 태그 파싱 (#태그 형식)
  const tagMatches = note.content.match(/#([^\s#\n]+)/g) || [];
  note.tags = [...new Set(tagMatches.map(t => t.slice(1)))];

  // API 저장
  try {
    const isTemp = String(note.id).startsWith('tmp_');
    const method = isTemp ? 'POST' : 'PUT';
    const url    = isTemp ? '/api/v1/notes/' : `/api/v1/notes/${note.id}`;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: note.title, content: note.content, tags: note.tags }),
    });
    if (res.ok) {
      const saved = await res.json();
      Object.assign(note, saved);
      obsCurrentId = note.id;
    }
  } catch (e) {
    console.warn('Save note failed', e);
  }

  obsRenderList(OBS_NOTES);
  obsRenderTags(note.tags);

  // 저장 피드백
  const btn = document.querySelector('.obs-save-btn');
  const orig = btn.textContent;
  btn.textContent = '✓ 저장됨';
  setTimeout(() => btn.textContent = orig, 1200);
}

function obsSetMode(mode) {
  document.getElementById('btnEdit').classList.toggle('active', mode === 'edit');
  document.getElementById('btnPreview').classList.toggle('active', mode === 'preview');

  if (mode === 'preview') {
    const note = OBS_NOTES.find(n => n.id === obsCurrentId);
    if (!note) return;
    note.content = obsEditor.getValue();

    // [[링크]] → 클릭 가능한 span으로 변환
    const rendered = note.content.replace(/\[\[([^\]]+)\]\]/g, (_, title) =>
      `<span class="wiki-link" onclick="obsOpen('${OBS_NOTES.find(n=>n.title===title)?.id||''}')">${title}</span>`
    );
    document.getElementById('obsPreview').innerHTML = marked.parse(rendered);
    document.getElementById('obsPreview').style.display = 'block';
    document.getElementById('obsEditorWrap').style.display = 'none';
  } else {
    document.getElementById('obsPreview').style.display = 'none';
    document.getElementById('obsEditorWrap').style.display = 'flex';
    setTimeout(() => obsEditor.refresh(), 50);
  }
}

function obsSearch(q) {
  const filtered = q
    ? OBS_NOTES.filter(n =>
        n.title.toLowerCase().includes(q.toLowerCase()) ||
        n.content.toLowerCase().includes(q.toLowerCase())
      )
    : OBS_NOTES;
  obsRenderList(filtered);
}

function obsRenderBacklinks(id) {
  const note = OBS_NOTES.find(n => n.id === id);
  if (!note) return;
  const panel = document.getElementById('obsBacklinks');

  const backlinks = OBS_NOTES.filter(n =>
    n.id !== id && n.content.includes(`[[${note.title}]]`)
  );

  if (!backlinks.length) {
    panel.innerHTML = '<div class="obs-backlink-empty">이 노트를 링크한 노트가 없습니다</div>';
    return;
  }

  panel.innerHTML = backlinks.map(n => {
    // 링크 주변 컨텍스트 추출
    const idx = n.content.indexOf(`[[${note.title}]]`);
    const ctx = n.content.slice(Math.max(0, idx - 30), idx + note.title.length + 50)
      .replace(/\[\[|\]\]/g, '');
    return `<div class="obs-backlink-item" onclick="obsOpen('${n.id}')">
      <div class="obs-backlink-title">${n.title}</div>
      <div class="obs-backlink-ctx">...${ctx}...</div>
    </div>`;
  }).join('');
}

function obsRenderTags(tags) {
  document.getElementById('obsTags').innerHTML = tags.map(t =>
    `<span class="obs-tag">#${t}</span>`
  ).join('');
}

function obsRenderMiniGraph(currentId) {
  const svg = d3.select('#obsMiniGraph');
  svg.selectAll('*').remove();

  const W = document.getElementById('obsMiniGraph').clientWidth || 200;
  const H = 140;

  const note = OBS_NOTES.find(n => n.id === currentId);
  if (!note) return;

  // 현재 노트와 연결된 노트만
  const linkedTitles = [...note.content.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
  const linkedNotes  = OBS_NOTES.filter(n => linkedTitles.includes(n.title));
  const backlinkedNotes = OBS_NOTES.filter(n => n.id !== currentId && n.content.includes(`[[${note.title}]]`));
  const allLinked = [...new Set([...linkedNotes, ...backlinkedNotes])];

  const nodes = [
    { id: currentId, label: note.title.slice(0,8)+'…', main: true },
    ...allLinked.map(n => ({ id: n.id, label: n.title.slice(0,8)+'…', main: false }))
  ];

  const links = allLinked.map(n => ({ source: currentId, target: n.id }));

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(55))
    .force('charge', d3.forceManyBody().strength(-80))
    .force('center', d3.forceCenter(W/2, H/2))
    .stop();

  for (let i = 0; i < 60; i++) sim.tick();

  svg.selectAll('line').data(links).join('line')
    .attr('stroke', '#c8c0a8').attr('stroke-width', 1)
    .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x).attr('y2', d => d.target.y);

  const g = svg.selectAll('g').data(nodes).join('g')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .style('cursor', 'pointer')
    .on('click', (e, d) => { if (!d.main) obsOpen(d.id); });

  g.append('circle')
    .attr('r', d => d.main ? 10 : 6)
    .attr('fill', d => d.main ? '#0a1628' : '#fdfcfa')
    .attr('stroke', d => d.main ? '#b8952a' : '#0a1628')
    .attr('stroke-width', d => d.main ? 2 : 1.5);

  g.append('text')
    .attr('y', d => d.main ? -14 : -10)
    .attr('text-anchor', 'middle')
    .attr('font-size', '9px')
    .attr('fill', '#6a6860')
    .attr('font-family', 'Noto Sans KR, sans-serif')
    .text(d => d.label);
}

/* ════════════════════════════════════════
   D3 FORCE GRAPH (지식 그래프 페이지)
════════════════════════════════════════ */
let GRAPH_NODES = [];
let GRAPH_EDGES = [];

// 더미 데이터 (API fetch 실패 시 fallback)
const _GRAPH_NODES_FALLBACK = [
  { id:'linear', label:'선형대수',   color:'#0a1628', r:32, tag:'MATH',  desc:'벡터, 행렬, 고유값 분해',     links:['고유값','SVD','머신러닝','Attention'] },
  { id:'stats',  label:'확률·통계',  color:'#884400', r:24, tag:'STATS', desc:'베이즈, 분포, 추정',          links:['머신러닝','베이즈'] },
  { id:'ml',     label:'머신러닝',   color:'#2a5a2a', r:28, tag:'ML',    desc:'지도학습, 최적화, 평가',      links:['딥러닝','경사하강법'] },
  { id:'dl',     label:'딥러닝',    color:'#2a5a2a', r:22, tag:'DL',    desc:'신경망, 역전파, CNN/RNN',      links:['비전','NLP','Attention'] },
  { id:'attn',   label:'Attention', color:'#8b1a1a', r:20, tag:'DL',    desc:'Transformer의 핵심 메커니즘', links:['NLP'] },
  { id:'sgd',    label:'경사하강법', color:'#884400', r:16, tag:'OPT',   desc:'손실함수 최적화 알고리즘',     links:['딥러닝'] },
  { id:'eigen',  label:'고유값',    color:'#0a1628', r:16, tag:'MATH',  desc:'행렬 변환의 핵심 개념',       links:['SVD'] },
  { id:'svd',    label:'SVD',      color:'#0a1628', r:14, tag:'MATH',  desc:'특이값 분해',                  links:[] },
  { id:'bayes',  label:'베이즈',    color:'#884400', r:16, tag:'STATS', desc:'사전·사후 확률 업데이트',       links:[] },
  { id:'cv',     label:'비전',      color:'#884400', r:20, tag:'CV',    desc:'CNN 기반 이미지 인식',         links:[] },
  { id:'nlp',    label:'NLP',      color:'#884400', r:18, tag:'NLP',   desc:'언어 모델, 트랜스포머',         links:[] },
];
const _GRAPH_EDGES_FALLBACK = [
  ['linear','ml'],['linear','eigen'],['linear','svd'],['linear','attn'],
  ['stats','ml'],['stats','bayes'],
  ['ml','dl'],['ml','sgd'],
  ['dl','cv'],['dl','nlp'],['dl','attn'],
  ['eigen','svd'],['sgd','dl'],['attn','nlp'],
];

let d3Sim = null;
let d3Zoom = null;
let d3Svg  = null;
let graphInitialized = false;
let currentFilter = 'all';

async function drawGraph() {
  if (graphInitialized) { d3Sim && d3Sim.alpha(0.3).restart(); return; }
  graphInitialized = true;

  // API에서 그래프 데이터 로딩
  try {
    const res = await fetch('/api/v1/graph/');
    if (res.ok) {
      const data = await res.json();
      if (data.nodes && data.nodes.length > 0) {
        GRAPH_NODES = data.nodes;
        GRAPH_EDGES = data.edges;
      }
    }
  } catch (e) {
    console.warn('Graph fetch failed', e);
  }
  if (GRAPH_NODES.length === 0) {
    GRAPH_NODES = _GRAPH_NODES_FALLBACK;
    GRAPH_EDGES = _GRAPH_EDGES_FALLBACK;
  }

  const canvas  = document.getElementById('graphCanvas');
  const tooltip = document.getElementById('tooltip');

  const W = canvas.clientWidth  || 800;
  const H = canvas.clientHeight || 500;

  d3Svg = d3.select('#graphSvg')
    .attr('width', W).attr('height', H);

  d3Zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .on('zoom', e => g.attr('transform', e.transform));

  d3Svg.call(d3Zoom);

  const g = d3Svg.append('g').attr('class', 'graph-root');

  const nodes = GRAPH_NODES.map(d => ({ ...d }));
  const edges = GRAPH_EDGES.map(([s, t]) => ({
    source: nodes.find(n => n.id === s),
    target: nodes.find(n => n.id === t),
  }));

  // 링크
  const link = g.selectAll('.graph-link')
    .data(edges).join('line')
    .attr('class', 'graph-link');

  // 노드 그룹
  const node = g.selectAll('.graph-node')
    .data(nodes).join('g')
    .attr('class', 'graph-node')
    .call(d3.drag()
      .on('start', (e, d) => { if (!e.active) d3Sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end',   (e, d) => { if (!e.active) d3Sim.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  node.append('circle')
    .attr('r', d => d.r)
    .attr('fill', d => d.connected ? '#fdfcfa' : 'transparent')
    .attr('stroke', d => d.connected ? d.color : '#aaa')
    .attr('stroke-width', d => d.connected ? 2 : 1)
    .attr('stroke-dasharray', d => d.connected ? null : '4,2');

  node.append('text')
    .text(d => d.label)
    .attr('font-size', d => d.r > 22 ? 12 : 10)
    .attr('font-weight', '700')
    .attr('fill', d => d.connected ? d.color : '#aaa')
    .attr('font-family', 'Noto Sans KR, sans-serif')
    .attr('dominant-baseline', 'central')
    .attr('text-anchor', 'middle');

  // 호버
  node.on('mouseenter', function(e, d) {
    // 연결된 노드 강조
    const connectedIds = new Set([d.id]);
    edges.forEach(l => {
      if (l.source.id === d.id) connectedIds.add(l.target.id);
      if (l.target.id === d.id) connectedIds.add(l.source.id);
    });
    node.classed('dimmed', n => !connectedIds.has(n.id));
    link.classed('highlighted', l => l.source.id === d.id || l.target.id === d.id);

    // 툴팁
    document.getElementById('tt-tag').textContent   = d.tag;
    document.getElementById('tt-title').textContent = d.label;
    document.getElementById('tt-desc').textContent  = d.desc;

    const chips = d.links.map(l =>
      `<span class="tt-link-chip">${l}</span>`
    ).join('');
    document.getElementById('tt-links').innerHTML = chips;

    const rect = canvas.getBoundingClientRect();
    tooltip.style.left = (e.clientX - rect.left + 14) + 'px';
    tooltip.style.top  = (e.clientY - rect.top  - 40) + 'px';
    tooltip.classList.add('show');
  })
  .on('mouseleave', function() {
    node.classed('dimmed', false);
    link.classed('highlighted', false);
    tooltip.classList.remove('show');
  })
  .on('click', (e, d) => {
    const linked = OBS_NOTES.find(n =>
      n.title.toLowerCase().includes(d.label.toLowerCase()) ||
      (n.content || '').toLowerCase().includes(d.label.toLowerCase())
    );
    if (linked) {
      goto('mynotes');
      setTimeout(() => obsOpen(linked.id), 100);
    } else {
      const tt = document.getElementById('tooltip');
      const existing = tt.querySelector('.tt-no-note');
      if (!existing) {
        const msg = document.createElement('div');
        msg.className = 'tt-no-note';
        msg.style.cssText = 'font-size:11px;color:#884400;margin-top:4px;cursor:pointer';
        msg.textContent = '+ 새 노트 작성';
        msg.onclick = () => { goto('mynotes'); setTimeout(() => obsNewNote(), 100); };
        tt.appendChild(msg);
        setTimeout(() => msg.remove(), 2000);
      }
    }
  });

  // force simulation
  d3Sim = d3.forceSimulation(nodes)
    .force('link',   d3.forceLink(edges).id(d => d.id).distance(d => (d.source.r + d.target.r) * 2.2))
    .force('charge', d3.forceManyBody().strength(-280))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide().radius(d => d.r + 12))
    .on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
}

function filterGraph(tag, btn) {
  currentFilter = tag;
  document.querySelectorAll('.gf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (!d3Svg) return;
  d3Svg.selectAll('.graph-node').classed('dimmed',
    d => tag !== 'all' && d.tag !== tag
  );
}

function graphZoomIn()  { d3Svg && d3Svg.transition().call(d3Zoom.scaleBy, 1.4); }
function graphZoomOut() { d3Svg && d3Svg.transition().call(d3Zoom.scaleBy, 0.7); }
function graphReset()   {
  if (!d3Svg) return;
  const W = document.getElementById('graphCanvas').clientWidth;
  const H = document.getElementById('graphCanvas').clientHeight;
  d3Svg.transition().duration(500).call(
    d3Zoom.transform,
    d3.zoomIdentity.translate(W/2, H/2).scale(1).translate(-W/2, -H/2)
  );
}

async function generateGraphNodes() {
  const btn = document.getElementById('genGraphBtn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const res = await fetch('/api/v1/graph/generate', { method: 'POST' });
    const data = await res.json();
    // 그래프 재초기화
    graphInitialized = false;
    if (d3Svg) { d3Svg.selectAll('*').remove(); d3Svg = null; }
    await drawGraph();
    alert(data.message || `노드 생성 완료`);
  } catch (e) {
    alert('노드 생성 실패: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'AI';
  }
}

/* ════════════════════════════════════════
   NAVIGATION + EVENTS
════════════════════════════════════════ */
const SIDEBAR_PAGES = ['lecture','mynotes','graph'];
const NO_SIDEBAR    = ['home','about','curriculum','papers','blog'];
const ALL_PAGES     = ['home','about','curriculum','lecture','mynotes','papers','blog','graph'];

let BLOG_POSTS = [];

/* ────────────────────────────────────────
   CURRICULUM — 동적 렌더링
──────────────────────────────────────── */
const _CODE_TAG_COLOR = {
  'MATH': 't-navy', 'STAT': 't-gold', 'ML': 't-green',
  'DL': 't-gray', 'CV': 't-gray', 'NLP': 't-gray',
};
let _curriculumLoaded = false;

async function initCurriculum() {
  const grid = document.getElementById('curriculumGrid');
  try {
    const res = await fetch('/api/v1/curriculum/');
    if (res.ok) {
      const courses = await res.json();
      if (courses.length > 0) {
        _curriculumLoaded = true;
        _allCourses = courses; // 강의 페이지 과목 캐시 공유
        grid.innerHTML = courses.map(c => {
          const prefix = c.code.split('-')[0];
          const tagCls = _CODE_TAG_COLOR[prefix] || 't-gray';
          const pct = Math.round(c.progress_pct);
          const statusHtml = c.status === 'done'
            ? `<span class="s-done">✓ 완료</span>`
            : c.status === 'active'
              ? `<span class="s-active">● 진행 중</span>`
              : `<span class="s-todo">○ 예정</span>`;
          return `<div class="course-card" onclick="courseModalOpen('${c.id}')" style="cursor:pointer">
            <span class="course-tag ${tagCls}">${c.code}</span>
            <div class="course-title">${c.title}</div>
            <div class="course-source">${c.source}</div>
            <div class="course-bar"><div class="course-fill" style="width:${pct}%"></div></div>
            <div class="course-foot"><span class="course-pct">${pct > 0 ? pct+'% 완료' : '0%'}</span>${statusHtml}</div>
          </div>`;
        }).join('');
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

function _ytPlItemHtml(i, pl, metaText) {
  const reg = _registeredPlaylistIds.has(pl.playlist_id);
  return `
    <div class="yt-pl-row" onclick="ytTogglePl(${i})">
      <input type="checkbox" id="ytCb${i}" onclick="event.stopPropagation();ytTogglePl(${i})">
      ${pl.thumbnail_url
        ? `<img class="yt-pl-thumb" src="${pl.thumbnail_url}" alt="">`
        : `<div class="yt-pl-thumb"></div>`}
      <div class="yt-pl-info">
        <div class="yt-pl-name">
          ${_esc(pl.title)}
          ${reg ? '<span class="yt-pl-reg-badge">등록됨</span>' : ''}
        </div>
        <div class="yt-pl-meta">${metaText}</div>
      </div>
      <button class="yt-pl-expand-btn" id="ytExpBtn${i}" onclick="event.stopPropagation();ytExpandPl(${i})" title="영상 목록">▼</button>
    </div>
    <div class="yt-pl-videos" id="ytVideos${i}" style="display:none"></div>`;
}

function _ytUpdateStepDesc() {
  const desc = document.getElementById('ytStep1Desc');
  desc.textContent = `${_ytPlaylists.length}개 플레이리스트 · 가져올 항목을 선택하세요`;
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
      const header = document.createElement('div');
      header.className = 'yt-channel-header';
      header.innerHTML = `${icon} <strong>${_esc(ch.channel_title)}</strong>`
        + `<span class="yt-ch-count">${srcLabel} · 플리 ${ch.playlists.length}개</span>`;
      listEl.appendChild(header);
    }
    for (const pl of ch.playlists) {
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
  }
  return added;
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
    btn.textContent = '강의로 저장';
  }
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _fmtDur(sec) {
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}

/* ────────────────────────────────────────
   COURSE DETAIL MODAL
──────────────────────────────────────── */
let _cdCourseId = null;
let _cdEditing  = false;
let _cdOrigDesc = '';
let _cdOrigObj  = [];

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
      const done = lectures.filter(l => l.completed).length;
      document.getElementById('cdLecCount').textContent = `(${done}/${lectures.length})`;
      document.getElementById('cdLecList').innerHTML = lectures.map(l => `
        <div class="cd-lec-item${l.completed ? ' done' : ''}">
          <span class="cd-lec-num">${l.number}</span>
          <span class="cd-lec-check">${l.completed ? '✓' : '○'}</span>
          <span class="cd-lec-title">${_esc(l.title)}</span>
          ${l.youtube_url ? `<a href="${l.youtube_url}" target="_blank" class="cd-yt-link">▶</a>` : ''}
        </div>`).join('');
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

/* ────────────────────────────────────────
   LECTURE LIST — 동적 렌더링
──────────────────────────────────────── */
let _currentCourseId = null;
let _currentLectureId = null;
let _currentLectures = [];
let _allCourses = [];
let _pendingCourseId = null;
let _lectureAccordionBuilt = false;

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

  // 아코디언 헤더는 최초 1회만 빌드
  if (!_lectureAccordionBuilt) {
    const listEl = document.getElementById('lectureList');
    listEl.innerHTML =
      `<div class="ll-panel-ctrl"><button class="ll-collapse-btn" id="llCollapseBtn" onclick="toggleLecturePanel()" title="패널 접기">‹</button></div>` +
      _allCourses.map(c => `
        <div class="ll-course-row" data-course-id="${c.id}" onclick="toggleCourse('${c.id}')">
          <span class="ll-course-cat">${(c.category||'').toUpperCase()}</span>
          <span class="ll-course-name">${c.title}</span>
          <span class="ll-course-arrow">▶</span>
        </div>
        <div class="ll-course-lecs" id="lecs-${c.id}"></div>
      `).join('');
    _lectureAccordionBuilt = true;
  }

  const targetId = _pendingCourseId || _currentCourseId
    || (_allCourses.length > 0 ? _allCourses[0].id : null);
  _pendingCourseId = null;
  if (targetId) await openCourse(targetId);
}

async function toggleCourse(courseId) {
  const lecsEl = document.getElementById('lecs-' + courseId);
  if (!lecsEl) return;
  if (lecsEl.classList.contains('open')) {
    lecsEl.classList.remove('open');
    const row = document.querySelector(`.ll-course-row[data-course-id="${courseId}"]`);
    if (row) row.classList.remove('open');
  } else {
    await openCourse(courseId);
  }
}

async function openCourse(courseId) {
  // 다른 열린 섹션 닫기
  document.querySelectorAll('.ll-course-lecs.open').forEach(el => el.classList.remove('open'));
  document.querySelectorAll('.ll-course-row.open').forEach(el => el.classList.remove('open'));

  const row = document.querySelector(`.ll-course-row[data-course-id="${courseId}"]`);
  const lecsEl = document.getElementById('lecs-' + courseId);
  if (!row || !lecsEl) return;

  row.classList.add('open');
  lecsEl.classList.add('open');

  // 열린 과목으로 스크롤
  row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  if (!lecsEl.dataset.loaded) {
    await loadCourse(courseId);
  } else {
    _currentCourseId = courseId;
    // 이미 로드된 강의들로 _currentLectures 복원
    const items = lecsEl.querySelectorAll('.ll-item');
    if (items.length > 0 && _currentCourseId !== courseId) {
      // 첫 강의 로드
      const firstId = items[0].dataset.lectureId;
      if (firstId) loadLecture(firstId, items[0]);
    }
  }
}

let _savedLecC1 = null;

function toggleLecturePanel() {
  const layout = document.getElementById('lectureLayout');
  const list   = document.getElementById('lectureList');
  const btn    = document.getElementById('llCollapseBtn');
  if (!layout || !list) return;

  const collapsed = list.classList.contains('ll-collapsed');
  if (collapsed) {
    list.classList.remove('ll-collapsed');
    layout.style.setProperty('--lec-c1', _savedLecC1 || '200px');
    if (btn) btn.textContent = '‹';
    if (btn) btn.title = '패널 접기';
  } else {
    _savedLecC1 = getComputedStyle(layout).getPropertyValue('--lec-c1').trim() || '200px';
    layout.style.setProperty('--lec-c1', '28px');
    list.classList.add('ll-collapsed');
    if (btn) btn.textContent = '›';
    if (btn) btn.title = '패널 펼치기';
  }
}

async function loadCourse(courseId) {
  _currentCourseId = courseId;
  const course = _allCourses.find(c => c.id === courseId);
  const lecsEl = document.getElementById('lecs-' + courseId);
  if (!lecsEl) return;

  try {
    const lRes = await fetch(`/api/v1/curriculum/${courseId}/lectures`);
    if (!lRes.ok) throw new Error('lectures fetch failed');
    _currentLectures = await lRes.json();
    lecsEl.dataset.loaded = '1';

    lecsEl.innerHTML =
      (course ? `<div class="ll-section">${course.source}</div>` : '') +
      (_currentLectures.length === 0
        ? `<div class="ln-empty" style="padding:12px 14px">강의가 없습니다</div>`
        : _currentLectures.map((l, i) => {
            const hasvid = !!l.youtube_url;
            const unavail = l.is_available === false;
            const thumbSrc = l.thumbnail_url
              || (l.youtube_video_id ? `https://img.youtube.com/vi/${l.youtube_video_id}/mqdefault.jpg` : null);
            const thumb = thumbSrc
              ? `<img class="ll-thumb" src="${thumbSrc}" alt="" loading="lazy">`
              : `<div class="ll-thumb ll-thumb-ph">${hasvid ? '▶' : ''}</div>`;
            const dur = l.duration_sec ? `<span class="ll-dur">${_fmtDur(l.duration_sec)}</span>` : '';
            return `<div class="ll-item${l.completed?' done':''}${unavail?' unavail':''}" data-lecture-id="${l.id}" onclick="loadLecture('${l.id}',this)">
              ${thumb}
              <div class="ll-content">
                <div class="ll-num">Lec ${String(l.number).padStart(2,'0')}${unavail ? ' <span class="ll-unavail-badge">삭제됨</span>' : ''}</div>
                <div class="ll-name">${l.title}</div>
                <div class="ll-foot">${l.completed ? '<span class="ll-check">✓ 완료</span>' : ''}${dur}</div>
              </div>
            </div>`;
          }).join('')
      );

    if (_currentLectures.length > 0) loadLecture(_currentLectures[0].id);
    return;
  } catch (e) {
    console.warn('loadCourse failed', e);
    lecsEl.innerHTML = '<div class="ln-empty" style="padding:12px 14px">강의 목록을 불러올 수 없습니다</div>';
  }
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

let _hintHistory = [];
let _hintStreaming = false;
let _hintOpen = false;

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

function addLectureNote() {
  goto('mynotes');
  setTimeout(() => obsNewNote(_currentLectureId), 300);
}

function openNoteInEditor(noteId) {
  goto('mynotes');
  setTimeout(() => obsOpenNote(noteId), 300);
}

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
    if (sbList) {
      sbList.innerHTML = courses.map((c, i) => {
        const icon = { math:'📐', stats:'📊', ml:'🤖', dl:'🧠', cv:'👁', nlp:'💬' }[c.category] || '📚';
        const pct  = Math.round(c.progress_pct);
        const sid  = _SUBJECT_ID_MAP[c.category] || c.category;
        return `<div class="sb-item${i===0?' active':''}" id="si-${sid}"
          onclick="selectSubject('${sid}', '${c.id}')"
          >${icon} ${c.title.split(' (')[0]} <span class="sb-pct">${pct > 0 ? pct+'%' : '—'}</span></div>`;
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
  if (graphInitialized) {
    const canvas = document.getElementById('graphCanvas');
    d3Svg.attr('width', canvas.clientWidth).attr('height', canvas.clientHeight);
  }
});

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
