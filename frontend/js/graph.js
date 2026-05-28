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
