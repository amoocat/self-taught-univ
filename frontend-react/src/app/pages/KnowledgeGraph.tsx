import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../lib/api";
import { Link } from "react-router";
import ReactFlow, {
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  NodeProps,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  MiniMap,
  EdgeProps,
  getBezierPath,
} from "reactflow";
import "reactflow/dist/style.css";
import { ArrowLeft, Sparkles, Loader2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KGNode {
  id: string;
  label: string;
  category: string;
  addedFrom?: string;
  addedDate: string;
}

interface KnowledgeGraphData {
  nodes: KGNode[];
  edges: { source: string; target: string }[];
}

// ─── Category palette ─────────────────────────────────────────────────────────

const CAT: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  MATH:    { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6" },
  STATS:   { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa", dot: "#f97316" },
  STAT:    { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa", dot: "#f97316" },
  ML:      { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", dot: "#22c55e" },
  DL:      { bg: "#f0fdf4", text: "#166534", border: "#86efac", dot: "#16a34a" },
  NLP:     { bg: "#fdf4ff", text: "#7e22ce", border: "#e9d5ff", dot: "#a855f7" },
  LLM:     { bg: "#fdf4ff", text: "#6b21a8", border: "#d8b4fe", dot: "#9333ea" },
  CV:      { bg: "#fff1f2", text: "#be123c", border: "#fecdd3", dot: "#f43f5e" },
  OPT:     { bg: "#fefce8", text: "#a16207", border: "#fef08a", dot: "#eab308" },
  default: { bg: "#f8fafc", text: "#475569", border: "#e2e8f0", dot: "#94a3b8" },
};

function getCat(cat: string) {
  return CAT[cat?.toUpperCase()] ?? CAT.default;
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

const FALLBACK_NODES: KGNode[] = [
  { id: "linear",  label: "선형대수",    category: "MATH",  addedFrom: "수학 기초",   addedDate: "2025-01-01" },
  { id: "stats",   label: "확률·통계",   category: "STATS", addedFrom: "수학 기초",   addedDate: "2025-01-01" },
  { id: "ml",      label: "머신러닝",    category: "ML",    addedFrom: "ML 기초",     addedDate: "2025-01-01" },
  { id: "dl",      label: "딥러닝",      category: "DL",    addedFrom: "딥러닝 기초", addedDate: "2025-01-01" },
  { id: "attn",    label: "Attention",   category: "DL",    addedFrom: "딥러닝 기초", addedDate: "2025-01-01" },
  { id: "sgd",     label: "경사하강법",  category: "OPT",   addedFrom: "ML 기초",     addedDate: "2025-01-01" },
  { id: "eigen",   label: "고유값",      category: "MATH",  addedFrom: "수학 기초",   addedDate: "2025-01-01" },
  { id: "svd",     label: "SVD",         category: "MATH",  addedFrom: "수학 기초",   addedDate: "2025-01-01" },
  { id: "bayes",   label: "베이즈",      category: "STATS", addedFrom: "수학 기초",   addedDate: "2025-01-01" },
  { id: "cv",      label: "컴퓨터 비전", category: "CV",    addedFrom: "응용 분야",   addedDate: "2025-01-01" },
  { id: "nlp",     label: "NLP",         category: "NLP",   addedFrom: "응용 분야",   addedDate: "2025-01-01" },
  { id: "transf",  label: "Transformer", category: "DL",    addedFrom: "딥러닝 기초", addedDate: "2025-01-01" },
  { id: "llm",     label: "LLM",         category: "LLM",   addedFrom: "응용 분야",   addedDate: "2025-01-01" },
];

const FALLBACK_EDGES: { source: string; target: string }[] = [
  { source: "linear", target: "ml"     }, { source: "linear", target: "eigen"  },
  { source: "linear", target: "svd"    }, { source: "linear", target: "attn"   },
  { source: "stats",  target: "ml"     }, { source: "stats",  target: "bayes"  },
  { source: "ml",     target: "dl"     }, { source: "ml",     target: "sgd"    },
  { source: "dl",     target: "cv"     }, { source: "dl",     target: "nlp"    },
  { source: "dl",     target: "attn"   }, { source: "eigen",  target: "svd"    },
  { source: "sgd",    target: "dl"     }, { source: "attn",   target: "transf" },
  { source: "transf", target: "nlp"    }, { source: "transf", target: "llm"    },
  { source: "nlp",    target: "llm"    },
];

// ─── Force layout ─────────────────────────────────────────────────────────────

function runForceLayout(
  nodeIds: string[],
  edges: { source: string; target: string }[]
): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  const n = nodeIds.length;
  nodeIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / n;
    const r = Math.max(200, n * 28);
    pos[id] = {
      x: 600 + r * Math.cos(angle) + (Math.random() - 0.5) * 40,
      y: 400 + r * Math.sin(angle) + (Math.random() - 0.5) * 40,
    };
  });

  const vel: Record<string, { vx: number; vy: number }> = {};
  nodeIds.forEach((id) => (vel[id] = { vx: 0, vy: 0 }));

  for (let iter = 0; iter < 400; iter++) {
    const f: Record<string, { fx: number; fy: number }> = {};
    nodeIds.forEach((id) => (f[id] = { fx: 0, fy: 0 }));

    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = nodeIds[i], b = nodeIds[j];
        const dx = pos[a].x - pos[b].x, dy = pos[a].y - pos[b].y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const mag = 9000 / (d * d);
        f[a].fx += (dx / d) * mag; f[a].fy += (dy / d) * mag;
        f[b].fx -= (dx / d) * mag; f[b].fy -= (dy / d) * mag;
      }
    }

    edges.forEach(({ source, target }) => {
      if (!pos[source] || !pos[target]) return;
      const dx = pos[target].x - pos[source].x, dy = pos[target].y - pos[source].y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const rest = 140;
      const mag = 0.04 * (d - rest);
      f[source].fx += (dx / d) * mag; f[source].fy += (dy / d) * mag;
      f[target].fx -= (dx / d) * mag; f[target].fy -= (dy / d) * mag;
    });

    nodeIds.forEach((id) => {
      f[id].fx += (600 - pos[id].x) * 0.004;
      f[id].fy += (400 - pos[id].y) * 0.004;
      vel[id].vx = (vel[id].vx + f[id].fx) * 0.80;
      vel[id].vy = (vel[id].vy + f[id].fy) * 0.80;
      pos[id].x += vel[id].vx;
      pos[id].y += vel[id].vy;
    });
  }

  return pos;
}

// ─── Custom edge ──────────────────────────────────────────────────────────────

function FloatingEdge({ id, sourceX, sourceY, targetX, targetY, selected }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, curvature: 0.25 });
  return (
    <path
      id={id}
      d={path}
      fill="none"
      stroke={selected ? "#6366f1" : "#cbd5e1"}
      strokeWidth={selected ? 2 : 1}
      strokeOpacity={selected ? 1 : 0.6}
    />
  );
}

// ─── Node renderer ────────────────────────────────────────────────────────────

function ConceptNode({ data, selected }: NodeProps) {
  const c = getCat(data.category);
  const center = { opacity: 0, top: "50%", left: "50%", transform: "translate(-50%,-50%)" };

  return (
    <div style={{
      background: "#fff",
      border: `1.5px solid ${selected ? c.dot : c.border}`,
      borderRadius: 10,
      padding: "6px 12px",
      minWidth: 80,
      maxWidth: 140,
      boxShadow: selected
        ? `0 0 0 3px ${c.dot}33, 0 4px 16px ${c.dot}22`
        : "0 1px 4px rgba(0,0,0,0.07)",
      cursor: "grab",
      userSelect: "none",
      transition: "box-shadow 0.15s, border-color 0.15s",
    }}>
      <Handle type="target" position={Position.Left} style={center} />
      <Handle type="source" position={Position.Right} style={center} />

      {/* Category chip */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        marginBottom: 3,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: c.dot, flexShrink: 0,
        }} />
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
          color: c.text, fontFamily: "monospace", textTransform: "uppercase",
        }}>
          {data.category}
        </span>
      </div>

      {/* Label */}
      <div style={{
        fontSize: 12, fontWeight: 600, color: "#1e293b",
        lineHeight: 1.3, whiteSpace: "nowrap",
        overflow: "hidden", textOverflow: "ellipsis",
        maxWidth: 116,
      }}>
        {data.label}
      </div>
    </div>
  );
}

const NODE_TYPES = { concept: ConceptNode };
const EDGE_TYPES = { floating: FloatingEdge };

// ─── Inner graph ──────────────────────────────────────────────────────────────

function GraphInner({ kgData, selectedCat, onNodeSelect }: {
  kgData: KnowledgeGraphData;
  selectedCat: string;
  onNodeSelect: (node: KGNode | null) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const built = useRef(false);

  const handleNodeClick = useCallback((_: any, node: any) => {
    const kg = kgData.nodes.find(n => n.id === node.id) ?? null;
    onNodeSelect(kg);
  }, [kgData.nodes, onNodeSelect]);

  const build = useCallback(() => {
    const { nodes: kgNodes, edges: kgEdges } = kgData;
    if (kgNodes.length === 0) { setNodes([]); setEdges([]); return; }

    const allEdges = [...kgEdges];
    const groups: Record<string, string[]> = {};
    kgNodes.forEach((n) => { const k = n.addedFrom ?? "__"; (groups[k] ??= []).push(n.id); });
    Object.values(groups).forEach((g) => {
      for (let i = 0; i < g.length - 1; i++) {
        if (!allEdges.some(e =>
          (e.source === g[i] && e.target === g[i + 1]) ||
          (e.source === g[i + 1] && e.target === g[i])
        )) allEdges.push({ source: g[i], target: g[i + 1] });
      }
    });

    const positions = runForceLayout(kgNodes.map((n) => n.id), allEdges);
    const degree: Record<string, number> = {};
    allEdges.forEach(({ source, target }) => {
      degree[source] = (degree[source] ?? 0) + 1;
      degree[target] = (degree[target] ?? 0) + 1;
    });

    setNodes(kgNodes.map((n) => ({
      id: n.id,
      type: "concept",
      position: positions[n.id] ?? { x: 400, y: 300 },
      draggable: true,
      hidden: selectedCat !== "ALL" && n.category.toUpperCase() !== selectedCat,
      data: { label: n.label, category: n.category.toUpperCase(), degree: degree[n.id] ?? 0 },
    })));

    setEdges(allEdges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      type: "floating",
    })));

    setTimeout(() => fitView({ padding: 0.15, duration: 600 }), 100);
  }, [kgData, setNodes, setEdges, fitView, selectedCat]);

  useEffect(() => { if (!built.current) { build(); built.current = true; } }, [build]);
  useEffect(() => { built.current = false; build(); built.current = true; }, [kgData.nodes.length]);

  // selectedCat 변경 시 hidden 업데이트
  useEffect(() => {
    setNodes(prev => prev.map(n => ({
      ...n,
      hidden: selectedCat !== "ALL" && n.data.category !== selectedCat,
    })));
  }, [selectedCat, setNodes]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={() => onNodeSelect(null)}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        fitView
        minZoom={0.2}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        style={{ background: "#f8fafc" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#e2e8f0" />
        <MiniMap
          nodeColor={(n) => getCat(n.data?.category).dot}
          maskColor="rgba(248,250,252,0.7)"
          style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}
          pannable zoomable
        />
      </ReactFlow>

      {/* 커스텀 줌 버튼 */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 z-10">
        <button onClick={() => zoomIn()} className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 shadow-sm transition-colors">
          <ZoomIn size={14} className="text-gray-500" />
        </button>
        <button onClick={() => zoomOut()} className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 shadow-sm transition-colors">
          <ZoomOut size={14} className="text-gray-500" />
        </button>
        <button onClick={() => fitView({ padding: 0.15, duration: 500 })} className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 shadow-sm transition-colors">
          <Maximize2 size={13} className="text-gray-500" />
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const CATS = ["ALL", "MATH", "STATS", "ML", "DL", "NLP", "LLM", "CV", "OPT"];

export function KnowledgeGraph() {
  const [kgData, setKgData] = useState<KnowledgeGraphData>({ nodes: [], edges: [] });
  const [generating, setGenerating] = useState(false);
  const [selectedCat, setSelectedCat] = useState("ALL");
  const [selectedNode, setSelectedNode] = useState<KGNode | null>(null);

  const loadGraph = useCallback(async () => {
    try {
      const data: any = await api.getGraph();
      const nodes: KGNode[] = (data.nodes ?? data.graph_nodes ?? []).map((n: any) => ({
        id: String(n.id ?? n.node_id),
        label: n.name ?? n.label ?? "",
        category: (n.tag ?? n.category ?? "ML").toUpperCase(),
        addedFrom: n.lecture_title ?? n.source_lecture ?? n.addedFrom,
        addedDate: n.created_at ?? new Date().toISOString(),
      }));
      const edges = (data.edges ?? data.graph_edges ?? []).map((e: any) => ({
        source: String(Array.isArray(e) ? e[0] : (e.source_id ?? e.source)),
        target: String(Array.isArray(e) ? e[1] : (e.target_id ?? e.target)),
      }));
      if (nodes.length > 0) { setKgData({ nodes, edges }); return; }
    } catch { /* fall through */ }
    const raw = localStorage.getItem("knowledgeGraph");
    if (raw) { const p = JSON.parse(raw); if (p.nodes?.length > 0) { setKgData(p); return; } }
    setKgData({ nodes: FALLBACK_NODES, edges: FALLBACK_EDGES });
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  async function generate() {
    setGenerating(true);
    try { await api.generateGraph(); await loadGraph(); }
    catch { alert("노드 생성 실패"); }
    finally { setGenerating(false); }
  }

  const catCounts: Record<string, number> = {};
  kgData.nodes.forEach(n => {
    const c = n.category.toUpperCase();
    catCounts[c] = (catCounts[c] ?? 0) + 1;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">

      {/* ── Header ── */}
      <div className="bg-white border-b px-6 py-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/my-page" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={14} /> My Page
          </Link>
          <div className="w-px h-4 bg-gray-200" />
          <h1 className="font-semibold text-gray-800" style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 20 }}>
            Knowledge Graph
          </h1>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {kgData.nodes.length} nodes
          </span>
        </div>

        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {generating ? "생성 중..." : "AI 노드 생성"}
        </button>
      </div>

      {/* ── Category filter bar ── */}
      <div className="bg-white border-b px-6 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0">
        {CATS.map(cat => {
          const c = getCat(cat);
          const count = cat === "ALL" ? kgData.nodes.length : (catCounts[cat] ?? 0);
          const active = selectedCat === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              style={active && cat !== "ALL" ? {
                background: c.bg, color: c.text, borderColor: c.border,
              } : {}}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all whitespace-nowrap font-medium
                ${active ? "shadow-sm" : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"}
                ${active && cat === "ALL" ? "bg-gray-900 text-white border-gray-900" : ""}
              `}
            >
              {cat !== "ALL" && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? c.dot : "#cbd5e1", flexShrink: 0 }} />
              )}
              {cat}
              {count > 0 && <span className={`ml-0.5 ${active && cat !== "ALL" ? "" : "text-gray-400"}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Graph + Node Panel ── */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1">
          <ReactFlowProvider>
            <GraphInner kgData={kgData} selectedCat={selectedCat} onNodeSelect={setSelectedNode} />
          </ReactFlowProvider>
        </div>

        {/* 노드 상세 패널 */}
        {selectedNode && (() => {
          const c = getCat(selectedNode.category);
          const connectedNodes = kgData.edges
            .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
            .map(e => e.source === selectedNode.id ? e.target : e.source)
            .map(id => kgData.nodes.find(n => n.id === id))
            .filter(Boolean) as KGNode[];

          return (
            <div className="w-64 bg-white border-l flex flex-col shrink-0">
              {/* 패널 헤더 */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Node Detail</span>
                <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto space-y-4">
                {/* 카테고리 배지 + 라벨 */}
                <div>
                  <span style={{ background: c.bg, color: c.text, borderColor: c.border }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full border mb-2">
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot }} />
                    {selectedNode.category}
                  </span>
                  <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
                    {selectedNode.label}
                  </h2>
                </div>

                {/* 출처 */}
                {selectedNode.addedFrom && (
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">출처</div>
                    <div className="text-sm text-gray-600">{selectedNode.addedFrom}</div>
                  </div>
                )}

                {/* 연결된 노드 */}
                {connectedNodes.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      연결된 개념 ({connectedNodes.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {connectedNodes.map(n => {
                        const nc = getCat(n.category);
                        return (
                          <button key={n.id} onClick={() => setSelectedNode(n)}
                            style={{ background: nc.bg, color: nc.text, borderColor: nc.border }}
                            className="text-xs px-2 py-0.5 rounded-full border hover:opacity-80 transition-opacity">
                            {n.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 추가된 날짜 */}
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">추가일</div>
                  <div className="text-xs text-gray-400">
                    {new Date(selectedNode.addedDate).toLocaleDateString("ko-KR")}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

    </div>
  );
}
