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
