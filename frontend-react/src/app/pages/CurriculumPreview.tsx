import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Pencil, Check, Youtube, Trash2, GripVertical } from "lucide-react";
import type { GeneratedCourse, Lecture, Module } from "../types/curriculum";

const DEPTH_LABELS = ["Intro", "Beginner", "Basic", "Intermediate", "Advanced", "Deep Dive", "Expert", "Mastery"];
const DEPTH_COLORS = [
  { dot: "#94a3b8", bar: "#f8fafc", text: "#64748b", border: "#e2e8f0" },
  { dot: "#6ee7b7", bar: "#f0fdf4", text: "#059669", border: "#bbf7d0" },
  { dot: "#6366f1", bar: "#eef2ff", text: "#6366f1", border: "#c7d2fe" },
  { dot: "#f59e0b", bar: "#fffbeb", text: "#d97706", border: "#fde68a" },
  { dot: "#ef4444", bar: "#fef2f2", text: "#dc2626", border: "#fecaca" },
];
const color = (i: number) => DEPTH_COLORS[Math.min(i, DEPTH_COLORS.length - 1)];

interface DragState { srcModId: string; srcIdx: number; }

function LectureCard({ lec, idx, modId, modColor, onTitleChange, onDelete, onDragStart, onDrop }: {
  lec: Lecture; idx: number; modId: string;
  modColor: typeof DEPTH_COLORS[0];
  onTitleChange: (t: string) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDrop(e); }}
      className="group relative rounded-xl p-3 border transition-all cursor-grab active:cursor-grabbing active:opacity-60"
      style={{ background: modColor.bar, borderColor: modColor.border }}
    >
      <div className="flex items-start gap-2">
        <GripVertical size={12} className="mt-0.5 shrink-0 text-gray-300 group-hover:text-gray-400" />
        <span className="text-xs mt-0.5 shrink-0 font-medium" style={{ color: modColor.text }}>{idx + 1}</span>
        <div className="flex-1 min-w-0">
          <input
            value={lec.title}
            onChange={(e) => onTitleChange(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full text-xs text-gray-700 bg-transparent focus:outline-none leading-relaxed"
          />
          {lec.source && (
            <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5 truncate">
              <Youtube size={9} className="text-red-400 shrink-0" />{lec.source}
            </p>
          )}
        </div>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all shrink-0"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

export function CurriculumPreview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get("id");
  const [courseTitle, setCourseTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("generatedCourses");
    if (!raw) { navigate("/generated-courses"); return; }
    const courses: GeneratedCourse[] = JSON.parse(raw);
    const course = courses.find((c) => c.id === courseId) ?? courses[0];
    if (!course) { navigate("/generated-courses"); return; }
    setCourseTitle(course.title);
    setModules(course.modules);
    setLoading(false);
  }, [courseId]);

  const totalLectures = modules.reduce((s, m) => s + m.lectures.length, 0);

  const updateModuleTitle = (modId: string, title: string) =>
    setModules((p) => p.map((m) => m.id === modId ? { ...m, title } : m));

  const updateLectureTitle = (modId: string, lecId: string, title: string) =>
    setModules((p) => p.map((m) => m.id !== modId ? m : {
      ...m, lectures: m.lectures.map((l) => l.id === lecId ? { ...l, title } : l),
    }));

  const deleteLecture = (modId: string, lecId: string) =>
    setModules((p) => p.map((m) => m.id !== modId ? m : {
      ...m, lectures: m.lectures.filter((l) => l.id !== lecId),
    }));

  const handleDragStart = (srcModId: string, srcIdx: number) => (e: React.DragEvent) => {
    dragRef.current = { srcModId, srcIdx };
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (dstModId: string, dstIdx: number) => () => {
    if (!dragRef.current) return;
    const { srcModId, srcIdx } = dragRef.current;
    dragRef.current = null;
    setModules((prev) => {
      let srcLecture: Lecture | null = null;
      const next = prev.map((m) => {
        if (m.id !== srcModId) return m;
        const lecs = [...m.lectures];
        [srcLecture] = lecs.splice(srcIdx, 1);
        return { ...m, lectures: lecs };
      });
      if (!srcLecture) return prev;
      return next.map((m) => {
        if (m.id !== dstModId) return m;
        const lecs = [...m.lectures];
        lecs.splice(dstIdx === -1 ? lecs.length : dstIdx, 0, srcLecture!);
        return { ...m, lectures: lecs };
      });
    });
  };

  const handleSave = () => {
    const savedRaw = localStorage.getItem("myCourses");
    const myCourses: any[] = savedRaw ? JSON.parse(savedRaw) : [];
    const courseEntry = { id: courseId, title: courseTitle, instructor: "YouTube", category: "Import", progress: 0 };
    const existingIdx = myCourses.findIndex((c: any) => c.id === courseId);
    if (existingIdx >= 0) myCourses[existingIdx] = courseEntry; else myCourses.push(courseEntry);
    localStorage.setItem("myCourses", JSON.stringify(myCourses));
    const lectures = modules.flatMap((m, mi) =>
      m.lectures.map((l, li) => ({
        id: `${courseId}-${mi}-${li}`, title: l.title, description: l.source,
        duration: "—", videoUrl: "", completed: false, keywords: l.keywords,
      }))
    );
    localStorage.setItem(`lectures-${courseId}`, JSON.stringify(lectures));
    navigate("/generated-courses");
  };

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-sm text-gray-400">불러오는 중...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="border-b border-gray-100 px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/generated-courses" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={14} /> 코스 목록
          </Link>
          <div className="flex items-center gap-2">
            {editingTitle ? (
              <input
                autoFocus
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
                className="text-gray-800 border-b border-gray-300 focus:outline-none bg-transparent"
                style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 22 }}
              />
            ) : (
              <h1
                className="text-gray-800 cursor-text"
                style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 22 }}
                onClick={() => setEditingTitle(true)}
              >{courseTitle}</h1>
            )}
            <button onClick={() => setEditingTitle(true)} className="text-gray-300 hover:text-gray-500 transition-colors">
              <Pencil size={13} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">{modules.length}개 모듈 · {totalLectures}개 강의</span>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            <Check size={14} /> 저장하기
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <div className="flex items-start gap-0 px-10 py-10" style={{ width: "max-content", minHeight: "100%" }}>
          {modules.map((mod, modIdx) => {
            const c = color(modIdx);
            const isLast = modIdx === modules.length - 1;
            return (
              <div key={mod.id} className="flex items-start">
                <div className="flex flex-col gap-3" style={{ width: 220 }}>
                  <div className="flex flex-col gap-0.5 px-1">
                    <span className="text-xs font-medium" style={{ color: c.text }}>
                      {DEPTH_LABELS[Math.min(modIdx, DEPTH_LABELS.length - 1)]}
                    </span>
                    <input
                      value={mod.title}
                      onChange={(e) => updateModuleTitle(mod.id, e.target.value)}
                      className="text-sm font-semibold text-gray-700 bg-transparent focus:outline-none border-b border-transparent focus:border-gray-300 w-full"
                    />
                  </div>
                  <div className="px-1">
                    <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ background: c.dot }} />
                  </div>
                  <div
                    className="flex flex-col gap-2"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleDrop(mod.id, -1)(); }}
                  >
                    {mod.lectures.map((lec, idx) => (
                      <LectureCard
                        key={lec.id} lec={lec} idx={idx} modId={mod.id} modColor={c}
                        onTitleChange={(t) => updateLectureTitle(mod.id, lec.id, t)}
                        onDelete={() => deleteLecture(mod.id, lec.id)}
                        onDragStart={handleDragStart(mod.id, idx)}
                        onDrop={handleDrop(mod.id, idx)}
                      />
                    ))}
                  </div>
                </div>
                {!isLast && (
                  <div className="flex items-center self-start mt-[52px] mx-2 shrink-0">
                    <div className="w-6 h-px bg-gray-200" />
                    <div className="w-0 h-0" style={{ borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "5px solid #d1d5db" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
