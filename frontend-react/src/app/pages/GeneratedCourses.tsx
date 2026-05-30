import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, BookOpen, Layers, Check, ChevronRight } from "lucide-react";
import type { GeneratedCourse, Module } from "../types/curriculum";

function buildCourses(videos: any[], playlists: any[]): GeneratedCourse[] {
  const courses: GeneratedCourse[] = [];

  playlists.forEach((p) => {
    const allTitles: string[] = [...(p.videos ?? [])];
    for (let i = allTitles.length; i < Math.min(p.count ?? 0, allTitles.length + 6); i++) {
      allTitles.push(`${p.title} — Lecture ${i + 1}`);
    }
    const CHUNK = 4;
    const modules: Module[] = [];
    for (let i = 0; i < allTitles.length; i += CHUNK) {
      modules.push({
        id: `mod-${i}`,
        title: `Module ${modules.length + 1}`,
        lectures: allTitles.slice(i, i + CHUNK).map((t, j) => ({
          id: `lec-${i}-${j}`, title: t, source: p.title, keywords: [],
        })),
      });
    }
    courses.push({ id: `gen-${p.id}`, title: p.title, sourceLabel: p.channel ?? "", modules });
  });

  if (videos.length > 0) {
    const CHUNK = 3;
    const modules: Module[] = [];
    for (let i = 0; i < videos.length; i += CHUNK) {
      modules.push({
        id: `mod-v${i}`,
        title: `Module ${modules.length + 1}`,
        lectures: videos.slice(i, i + CHUNK).map((v: any, j: number) => ({
          id: `lec-v${i}-${j}`, title: v.title, source: `${v.channel} · ${v.duration}`, keywords: [],
        })),
      });
    }
    courses.push({ id: "gen-liked", title: "Liked Videos Collection", sourceLabel: "YouTube 좋아요", modules });
  }

  return courses;
}

export function GeneratedCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<GeneratedCourse[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("pendingCurriculum");
    const { videos = [], playlists = [] } = raw ? JSON.parse(raw) : {};
    const t = setTimeout(() => {
      const built = buildCourses(videos, playlists);
      localStorage.setItem("generatedCourses", JSON.stringify(built));
      setCourses(built);
      setSelected(new Set(built.map((c) => c.id)));
      setLoading(false);
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const totalLectures = (c: GeneratedCourse) =>
    c.modules.reduce((s, m) => s + m.lectures.length, 0);

  const handleSaveAll = () => {
    const savedRaw = localStorage.getItem("myCourses");
    const existing: any[] = savedRaw ? JSON.parse(savedRaw) : [];
    const existingIds = new Set(existing.map((c: any) => c.id));
    const myCourses = [...existing];
    courses.filter((c) => selected.has(c.id)).forEach((c) => {
      if (existingIds.has(c.id)) return;
      myCourses.push({ id: c.id, title: c.title, instructor: c.sourceLabel, category: "Import", progress: 0 });
      const lectures = c.modules.flatMap((m, mi) =>
        m.lectures.map((l, li) => ({
          id: `${c.id}-${mi}-${li}`, title: l.title, description: l.source,
          duration: "—", videoUrl: "", completed: false, keywords: l.keywords,
        }))
      );
      localStorage.setItem(`lectures-${c.id}`, JSON.stringify(lectures));
    });
    localStorage.setItem("myCourses", JSON.stringify(myCourses));
    localStorage.removeItem("pendingCurriculum");
    navigate("/my-page");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-5">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-gray-300"
              style={{ animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }} />
          ))}
        </div>
        <p className="text-sm text-gray-400">코스 생성 중...</p>
        <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="border-b border-gray-100 px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/youtube-import" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={14} /> 다시 선택
          </Link>
          <h1 className="text-gray-800" style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 22 }}>
            생성된 코스
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{selected.size}개 선택됨</span>
          <button
            onClick={handleSaveAll}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Check size={14} /> 선택 코스 저장
          </button>
        </div>
      </div>

      <div className="flex-1 px-8 py-10">
        <p className="text-sm text-gray-400 mb-6">
          선택한 콘텐츠로 {courses.length}개 코스가 생성됐어요.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => {
            const sel = selected.has(c.id);
            return (
              <div
                key={c.id}
                className={`relative flex flex-col gap-4 p-5 rounded-2xl border transition-all cursor-pointer ${
                  sel ? "border-gray-300 bg-gray-50/60" : "border-gray-100 opacity-60"
                }`}
                onClick={() => toggle(c.id)}
              >
                <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  sel ? "border-gray-800 bg-gray-800" : "border-gray-300"
                }`}>
                  {sel && <Check size={11} className="text-white" strokeWidth={3} />}
                </div>
                <div className="flex items-start gap-3 pr-6">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <BookOpen size={16} className="text-indigo-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{c.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{c.sourceLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Layers size={11} /> {c.modules.length}개 모듈</span>
                  <span className="flex items-center gap-1"><BookOpen size={11} /> {totalLectures(c)}개 강의</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {c.modules.slice(0, 4).map((m) => (
                    <span key={m.id} className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">
                      {m.title}
                    </span>
                  ))}
                  {c.modules.length > 4 && (
                    <span className="text-xs text-gray-400">+{c.modules.length - 4}</span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/curriculum-preview?id=${c.id}`); }}
                  className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors mt-auto"
                >
                  커리큘럼 편집 <ChevronRight size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
