import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../lib/api";
import { Link } from "react-router";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  NodeProps,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";

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

const CATEGORY_COLOR: Record<string, string> = {
  lecture: "#6366f1",
  concept: "#0ea5e9",
  default: "#94a3b8",
};

function getDotColor(cat: string) {
  return CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.default;
}

// ─── Force layout ─────────────────────────────────────────────────────────────

function runForceLayout(
  nodeIds: string[],
  edges: { source: string; target: string }[]
): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  const n = nodeIds.length;
  nodeIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / n;
    const r = 220;
    pos[id] = {
      x: 500 + r * Math.cos(angle) + (Math.random() - 0.5) * 30,
      y: 380 + r * Math.sin(angle) + (Math.random() - 0.5) * 30,
    };
  });

  const vel: Record<string, { vx: number; vy: number }> = {};
  nodeIds.forEach((id) => (vel[id] = { vx: 0, vy: 0 }));

  for (let iter = 0; iter < 300; iter++) {
    const f: Record<string, { fx: number; fy: number }> = {};
    nodeIds.forEach((id) => (f[id] = { fx: 0, fy: 0 }));

    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = nodeIds[i], b = nodeIds[j];
        const dx = pos[a].x - pos[b].x, dy = pos[a].y - pos[b].y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const mag = 6000 / (d * d);
        f[a].fx += (dx / d) * mag; f[a].fy += (dy / d) * mag;
        f[b].fx -= (dx / d) * mag; f[b].fy -= (dy / d) * mag;
      }
    }

    edges.forEach(({ source, target }) => {
      if (!pos[source] || !pos[target]) return;
      const dx = pos[target].x - pos[source].x, dy = pos[target].y - pos[source].y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const mag = 0.06 * (d - 120);
      f[source].fx += (dx / d) * mag; f[source].fy += (dy / d) * mag;
      f[target].fx -= (dx / d) * mag; f[target].fy -= (dy / d) * mag;
    });

    nodeIds.forEach((id) => {
      f[id].fx += (500 - pos[id].x) * 0.006;
      f[id].fy += (380 - pos[id].y) * 0.006;
    });

    nodeIds.forEach((id) => {
      vel[id].vx = (vel[id].vx + f[id].fx) * 0.82;
      vel[id].vy = (vel[id].vy + f[id].fy) * 0.82;
      pos[id].x += vel[id].vx;
      pos[id].y += vel[id].vy;
    });
  }

  return pos;
}

// ─── Node renderer ────────────────────────────────────────────────────────────

function DotNode({ data }: NodeProps) {
  const color = getDotColor(data.category);
  const r = data.r as number;
  const center = { opacity: 0, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  return (
    <div style={{ position: "relative", width: r * 2, height: r * 2, userSelect: "none" }}>
      <Handle type="target" position={Position.Left} style={center} />
      <Handle type="source" position={Position.Right} style={center} />
      <div style={{ width: r * 2, height: r * 2, borderRadius: "50%", background: color, opacity: 0.85 }} />
      <span style={{
        position: "absolute",
        top: r * 2 + 5,
        left: "50%",
        transform: "translateX(-50%)",
        fontSize: 11,
        color: "#374151",
        fontWeight: 500,
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}>
        {data.label}
      </span>
    </div>
  );
}

const NODE_TYPES = { dot: DotNode };

// ─── Inner graph ──────────────────────────────────────────────────────────────

function GraphInner({ kgData }: { kgData: KnowledgeGraphData }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const { fitView } = useReactFlow();
  const built = useRef(false);

  const build = useCallback(() => {
    const { nodes: kgNodes, edges: kgEdges } = kgData;
    if (kgNodes.length === 0) { setNodes([]); setEdges([]); return; }

    const allEdges = [...kgEdges];
    const groups: Record<string, string[]> = {};
    kgNodes.forEach((n) => { const k = n.addedFrom ?? "__"; (groups[k] ??= []).push(n.id); });
    Object.values(groups).forEach((g) => {
      for (let i = 0; i < g.length - 1; i++) {
        const dup = allEdges.some(
          (e) => (e.source === g[i] && e.target === g[i + 1]) || (e.source === g[i + 1] && e.target === g[i])
        );
        if (!dup) allEdges.push({ source: g[i], target: g[i + 1] });
      }
    });

    const positions = runForceLayout(kgNodes.map((n) => n.id), allEdges);

    const degree: Record<string, number> = {};
    allEdges.forEach(({ source, target }) => {
      degree[source] = (degree[source] ?? 0) + 1;
      degree[target] = (degree[target] ?? 0) + 1;
    });

    setNodes(
      kgNodes.map((n) => ({
        id: n.id,
        type: "dot",
        position: positions[n.id] ?? { x: 400, y: 300 },
        draggable: false,
        selectable: false,
        data: { label: n.label, category: n.category, r: 5 + Math.min((degree[n.id] ?? 0) * 1.5, 8) },
      }))
    );

    setEdges(
      allEdges.map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        type: "straight",
        style: { stroke: "#d1d5db", strokeWidth: 0.8 },
      }))
    );

    setTimeout(() => fitView({ padding: 0.18, duration: 500 }), 80);
  }, [kgData, setNodes, setEdges, fitView]);

  useEffect(() => {
    if (!built.current) { build(); built.current = true; }
  }, [build]);

  useEffect(() => {
    built.current = false;
    build();
    built.current = true;
  }, [kgData.nodes.length]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      nodeTypes={NODE_TYPES}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      zoomOnScroll={false}
      panOnScroll={false}
      fitView
      minZoom={0.2}
      maxZoom={4}
      proOptions={{ hideAttribution: true }}
      style={{ background: "#ffffff" }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
      <Controls
        showInteractive={false}
        style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 1px 4px #0001" }}
      />
    </ReactFlow>
  );
}

// ─── Lecture sidebar ──────────────────────────────────────────────────────────

function LectureSidebar({ kgData }: { kgData: KnowledgeGraphData }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Group nodes by lecture
  const lectures = Object.entries(
    kgData.nodes.reduce<Record<string, KGNode[]>>((acc, n) => {
      const key = n.addedFrom ?? "기타";
      (acc[key] ??= []).push(n);
      return acc;
    }, {})
  );

  // Auto-expand first lecture
  useEffect(() => {
    if (lectures.length > 0) {
      setExpanded({ [lectures[0][0]]: true });
    }
  }, [kgData.nodes.length]);

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="w-64 border-l border-gray-100 flex flex-col bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Lectures</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {lectures.length === 0 ? (
          <p className="text-xs text-gray-400 px-4 py-6 text-center">No lectures yet</p>
        ) : (
          lectures.map(([lectureName, nodes]) => (
            <div key={lectureName} className="border-b border-gray-50">
              <button
                onClick={() => toggle(lectureName)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
              >
                <span className="text-xs font-medium text-gray-600 truncate pr-2">{lectureName}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-gray-400">{nodes.length}</span>
                  {expanded[lectureName]
                    ? <ChevronDown size={12} className="text-gray-400" />
                    : <ChevronRight size={12} className="text-gray-400" />
                  }
                </div>
              </button>
              {expanded[lectureName] && (
                <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                  {nodes.map((n) => (
                    <span
                      key={n.id}
                      style={{ background: getDotColor(n.category) + "18", color: getDotColor(n.category), borderColor: getDotColor(n.category) + "44" }}
                      className="text-xs px-2 py-0.5 rounded-full border"
                    >
                      {n.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function KnowledgeGraph() {
  const [kgData, setKgData] = useState<KnowledgeGraphData>({ nodes: [], edges: [] });

  useEffect(() => {
    api.getGraph().then((data: any) => {
      // 백엔드 graph_nodes / graph_edges 형식 정규화
      const nodes: KGNode[] = (data.nodes ?? data.graph_nodes ?? []).map((n: any) => ({
        id: String(n.id ?? n.node_id),
        label: n.name ?? n.label ?? "",
        category: n.category ?? "concept",
        addedFrom: n.lecture_title ?? n.source_lecture ?? n.addedFrom,
        addedDate: n.created_at ?? new Date().toISOString(),
      }));
      const edges = (data.edges ?? data.graph_edges ?? []).map((e: any) => ({
        source: String(e.source_id ?? e.source),
        target: String(e.target_id ?? e.target),
      }));
      if (nodes.length > 0) { setKgData({ nodes, edges }); return; }
      // API 데이터 없으면 localStorage 확인
      const raw = localStorage.getItem("knowledgeGraph");
      if (raw) setKgData(JSON.parse(raw));
    }).catch(() => {
      const raw = localStorage.getItem("knowledgeGraph");
      if (raw) setKgData(JSON.parse(raw));
    });
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/my-page" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={14} /> My Page
          </Link>
          <h1 className="text-gray-800" style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 21 }}>
            Knowledge Graph
          </h1>
        </div>
        <span className="text-xs text-gray-400">
          {kgData.nodes.length} keywords · {new Set(kgData.nodes.map((n) => n.addedFrom).filter(Boolean)).size} lectures
        </span>
      </div>

      {/* Body: graph + sidebar */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 53px)" }}>
        <div className="flex-1">
          <ReactFlowProvider>
            <GraphInner kgData={kgData} />
          </ReactFlowProvider>
        </div>
        <LectureSidebar kgData={kgData} />
      </div>
    </div>
  );
}
