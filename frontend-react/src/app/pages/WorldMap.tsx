import { useState, useEffect } from "react";
import { Link } from "react-router";
import { api } from "../../lib/api";
import { ArrowLeft, Lock } from "lucide-react";

// ─── 대륙 정의 ────────────────────────────────────────────────────────────────

interface Continent {
  id: string;
  label: string;
  category: string;
  emoji: string;
  color: string;
  glowColor: string;
  path: string;         // SVG path
  cx: number; cy: number; // 라벨 중심
  cities: string[];     // 핵심 개념 도시들
}

const CONTINENTS: Continent[] = [
  {
    id: "math",
    label: "수학 대륙",
    category: "MATH",
    emoji: "∑",
    color: "#1d4ed8",
    glowColor: "#3b82f6",
    path: "M 80 80 C 100 60, 160 55, 200 70 C 240 85, 260 110, 250 145 C 240 180, 200 195, 165 185 C 130 175, 90 160, 75 130 C 60 100, 60 100, 80 80 Z",
    cx: 165, cy: 125,
    cities: ["선형대수", "미적분", "고유값", "SVD", "행렬", "벡터공간"],
  },
  {
    id: "stats",
    label: "통계 대륙",
    category: "STATS",
    emoji: "σ",
    color: "#c2410c",
    glowColor: "#f97316",
    path: "M 60 230 C 80 210, 140 205, 175 220 C 210 235, 225 265, 210 295 C 195 325, 155 335, 120 325 C 85 315, 55 290, 50 260 C 45 230, 40 250, 60 230 Z",
    cx: 135, cy: 270,
    cities: ["베이즈", "분포", "가설검정", "회귀", "확률론"],
  },
  {
    id: "ml",
    label: "ML 대륙",
    category: "ML",
    emoji: "⚙",
    color: "#15803d",
    glowColor: "#22c55e",
    path: "M 300 100 C 340 75, 430 70, 480 90 C 530 110, 555 150, 545 195 C 535 240, 490 265, 445 260 C 400 255, 350 230, 320 195 C 290 160, 260 125, 300 100 Z",
    cx: 415, cy: 170,
    cities: ["지도학습", "비지도학습", "SVM", "트리", "앙상블", "경사하강법"],
  },
  {
    id: "dl",
    label: "딥러닝 대륙",
    category: "DL",
    emoji: "🧠",
    color: "#166534",
    glowColor: "#16a34a",
    path: "M 460 290 C 490 265, 560 260, 600 280 C 640 300, 655 340, 640 375 C 625 410, 580 425, 540 415 C 500 405, 460 380, 450 345 C 440 310, 430 315, 460 290 Z",
    cx: 550, cy: 345,
    cities: ["신경망", "역전파", "CNN", "RNN", "Attention", "Transformer"],
  },
  {
    id: "nlp",
    label: "NLP 대륙",
    category: "NLP",
    emoji: "💬",
    color: "#7e22ce",
    glowColor: "#a855f7",
    path: "M 650 120 C 680 95, 750 90, 790 110 C 830 130, 845 165, 830 200 C 815 235, 770 250, 730 240 C 690 230, 655 205, 645 170 C 635 135, 620 145, 650 120 Z",
    cx: 740, cy: 170,
    cities: ["토크나이저", "임베딩", "BERT", "GPT", "Seq2Seq"],
  },
  {
    id: "llm",
    label: "LLM 신대륙",
    category: "LLM",
    emoji: "✦",
    color: "#6b21a8",
    glowColor: "#9333ea",
    path: "M 560 450 C 595 425, 660 420, 700 440 C 740 460, 755 500, 735 535 C 715 570, 665 580, 625 565 C 585 550, 555 520, 550 485 C 545 450, 525 475, 560 450 Z",
    cx: 645, cy: 500,
    cities: ["프롬프트", "파인튜닝", "RAG", "에이전트", "RLHF"],
  },
  {
    id: "cv",
    label: "비전 대륙",
    category: "CV",
    emoji: "👁",
    color: "#be123c",
    glowColor: "#f43f5e",
    path: "M 160 380 C 185 355, 250 350, 285 370 C 320 390, 330 430, 310 460 C 290 490, 245 500, 210 488 C 175 476, 148 448, 145 415 C 142 382, 135 405, 160 380 Z",
    cx: 237, cy: 425,
    cities: ["CNN", "ViT", "객체검출", "세그멘테이션", "생성모델"],
  },
  {
    id: "opt",
    label: "최적화 섬",
    category: "OPT",
    emoji: "∇",
    color: "#a16207",
    glowColor: "#eab308",
    path: "M 390 370 C 405 355, 440 352, 460 365 C 480 378, 485 400, 472 418 C 459 436, 430 440, 410 430 C 390 420, 375 403, 378 385 C 381 367, 375 385, 390 370 Z",
    cx: 427, cy: 397,
    cities: ["Adam", "SGD", "학습률", "정규화"],
  },
];

// ─── City dot component ───────────────────────────────────────────────────────

function CityDot({ x, y, label, unlocked }: { x: number; y: number; label: string; unlocked: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <g>
      <circle
        cx={x} cy={y} r={hovered ? 5 : 3.5}
        fill={unlocked ? "#fff" : "#334155"}
        stroke={unlocked ? "#fbbf24" : "#475569"}
        strokeWidth={1.5}
        style={{ cursor: "pointer", transition: "r 0.15s" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered && (
        <text x={x} y={y - 8} textAnchor="middle" fontSize={9} fill="#fff"
          style={{ pointerEvents: "none", fontFamily: "monospace" }}>
          {label}
        </text>
      )}
    </g>
  );
}

// ─── Continent component ──────────────────────────────────────────────────────

function ContinentShape({
  continent, progress, selected, onClick,
}: {
  continent: Continent;
  progress: number; // 0~1
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const unlocked = progress > 0;
  const filterId = `glow-${continent.id}`;

  // 도시 위치를 path 중심 근처에 랜덤하게 고정 배치
  const cityPositions = continent.cities.map((_, i) => {
    const angle = (i / continent.cities.length) * Math.PI * 2;
    const r = 22 + (i % 2) * 12;
    return {
      x: continent.cx + Math.cos(angle) * r,
      y: continent.cy + Math.sin(angle) * r,
    };
  });

  return (
    <g
      style={{ cursor: "pointer" }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <defs>
        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feFlood floodColor={continent.glowColor} floodOpacity="0.5" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* 미개척: 안개 효과 */}
      {!unlocked && (
        <path d={continent.path} fill="#1e293b" stroke="#334155" strokeWidth={1.5}
          opacity={0.7} />
      )}

      {/* 개척됨: 컬러 */}
      {unlocked && (
        <path d={continent.path}
          fill={continent.color}
          fillOpacity={0.25 + progress * 0.5}
          stroke={continent.glowColor}
          strokeWidth={selected || hovered ? 2.5 : 1.5}
          filter={selected || hovered ? `url(#${filterId})` : undefined}
          style={{ transition: "all 0.2s" }}
        />
      )}

      {/* 도시 점들 */}
      {unlocked && continent.cities.map((city, i) => (
        <CityDot
          key={city}
          x={cityPositions[i].x}
          y={cityPositions[i].y}
          label={city}
          unlocked={i / continent.cities.length < progress}
        />
      ))}

      {/* 대륙 라벨 */}
      <text x={continent.cx} y={continent.cy - 8} textAnchor="middle"
        fontSize={unlocked ? 13 : 11} fontWeight="700"
        fill={unlocked ? "#fff" : "#475569"}
        style={{ fontFamily: "'Crimson Pro', Georgia, serif", pointerEvents: "none" }}>
        {continent.emoji} {continent.label}
      </text>
      {unlocked && (
        <text x={continent.cx} y={continent.cy + 8} textAnchor="middle"
          fontSize={9} fill="#94a3b8"
          style={{ fontFamily: "monospace", pointerEvents: "none" }}>
          {Math.round(progress * 100)}% 탐험
        </text>
      )}
      {!unlocked && (
        <text x={continent.cx} y={continent.cy + 8} textAnchor="middle"
          fontSize={9} fill="#475569"
          style={{ fontFamily: "monospace", pointerEvents: "none" }}>
          미개척
        </text>
      )}
    </g>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function WorldMap() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selected, setSelected] = useState<Continent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCourses().then((data: any[]) => setCourses(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 카테고리별 진도율 계산
  const progressByCategory: Record<string, number> = {};
  CONTINENTS.forEach(c => {
    const related = courses.filter(course =>
      course.category?.toUpperCase() === c.category
    );
    if (related.length === 0) { progressByCategory[c.category] = 0; return; }
    const avg = related.reduce((s: number, r: any) => s + (r.progress_pct ?? 0), 0) / related.length;
    progressByCategory[c.category] = avg / 100;
  });

  const selectedCont = selected ? CONTINENTS.find(c => c.id === selected.id) : null;
  const selectedProgress = selectedCont ? (progressByCategory[selectedCont.category] ?? 0) : 0;
  const selectedCourses = selectedCont
    ? courses.filter(c => c.category?.toUpperCase() === selectedCont.category)
    : [];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#060d1a" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Link to="/my-page"
            className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/80 transition-colors">
            <ArrowLeft size={14} /> My Page
          </Link>
          <div className="w-px h-4 bg-white/10" />
          <h1 className="text-white font-semibold" style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 20 }}>
            지식 세계 지도
          </h1>
        </div>
        <div className="text-xs text-white/30 font-mono">
          {CONTINENTS.filter(c => (progressByCategory[c.category] ?? 0) > 0).length} / {CONTINENTS.length} 대륙 탐험 중
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Map */}
        <div className="flex-1 relative overflow-hidden">
          {/* 배경 별빛 */}
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.15) 0%, transparent 100%), radial-gradient(1px 1px at 80% 60%, rgba(255,255,255,0.1) 0%, transparent 100%), radial-gradient(1px 1px at 50% 80%, rgba(255,255,255,0.08) 0%, transparent 100%)",
          }} />

          {/* 바다 격자 */}
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.06 }}>
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#3b82f6" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* 대륙 SVG */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 900 600" style={{ width: "100%", height: "100%", maxWidth: 1100, maxHeight: "85vh" }}>
              {CONTINENTS.map(cont => (
                <ContinentShape
                  key={cont.id}
                  continent={cont}
                  progress={progressByCategory[cont.category] ?? 0}
                  selected={selected?.id === cont.id}
                  onClick={() => setSelected(selected?.id === cont.id ? null : cont)}
                />
              ))}

              {/* 범례 */}
              <g transform="translate(20, 540)">
                <rect x="0" y="-12" width="180" height="20" rx="4" fill="rgba(0,0,0,0.5)" />
                <circle cx="12" cy="0" r="4" fill="#22c55e" opacity="0.6" />
                <text x="20" y="4" fontSize="9" fill="#94a3b8" fontFamily="monospace">탐험 완료</text>
                <circle cx="80" cy="0" r="4" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                <text x="88" y="4" fontSize="9" fill="#94a3b8" fontFamily="monospace">미개척</text>
              </g>
            </svg>
          </div>

          {/* 클릭 유도 메시지 */}
          {!selected && !loading && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center pointer-events-none">
              <p className="text-xs text-white/30 font-mono animate-pulse">대륙을 클릭해 탐험하세요</p>
            </div>
          )}
        </div>

        {/* 사이드 패널 */}
        {selected && selectedCont && (
          <div className="w-72 border-l border-white/10 flex flex-col"
            style={{ background: "rgba(10, 15, 30, 0.95)" }}>

            {/* 패널 헤더 */}
            <div className="p-5 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono"
                  style={{ color: selectedCont.glowColor }}>
                  {selectedCont.category} CONTINENT
                </span>
                <button onClick={() => setSelected(null)}
                  className="text-white/30 hover:text-white/70 text-lg leading-none">×</button>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1"
                style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
                {selectedCont.emoji} {selectedCont.label}
              </h2>

              {/* 진도 바 */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-white/40 mb-1">
                  <span>탐험도</span>
                  <span>{Math.round(selectedProgress * 100)}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${selectedProgress * 100}%`, background: selectedCont.glowColor }} />
                </div>
              </div>
            </div>

            {/* 도시(개념) 목록 */}
            <div className="p-4 border-b border-white/10">
              <div className="text-xs font-mono text-white/30 mb-3">핵심 개념 도시</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedCont.cities.map((city, i) => {
                  const unlocked = i / selectedCont.cities.length < selectedProgress;
                  return (
                    <span key={city}
                      className="text-xs px-2 py-0.5 rounded-full font-mono"
                      style={{
                        background: unlocked ? `${selectedCont.glowColor}22` : "rgba(255,255,255,0.04)",
                        color: unlocked ? selectedCont.glowColor : "#475569",
                        border: `1px solid ${unlocked ? selectedCont.glowColor + "44" : "#1e293b"}`,
                      }}>
                      {unlocked ? "◉" : "○"} {city}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* 관련 강좌 */}
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="text-xs font-mono text-white/30 mb-3">관련 강좌 ({selectedCourses.length})</div>
              {selectedCourses.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-white/20">
                  <Lock size={12} /> 아직 개설된 강좌가 없습니다
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedCourses.map((course: any) => (
                    <Link key={course.id} to={`/course/${course.id}`}
                      className="block p-3 rounded-lg border border-white/10 hover:border-white/20 transition-colors group"
                      style={{ background: "rgba(255,255,255,0.02)" }}>
                      <div className="text-sm text-white/80 font-medium group-hover:text-white transition-colors truncate">
                        {course.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full"
                            style={{ width: `${course.progress_pct ?? 0}%`, background: selectedCont.glowColor }} />
                        </div>
                        <span className="text-[10px] font-mono text-white/30">
                          {Math.round(course.progress_pct ?? 0)}%
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
