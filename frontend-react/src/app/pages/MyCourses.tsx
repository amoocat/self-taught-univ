import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { api } from "../../lib/api";
import { Button } from "../components/ui/button";
import {
  ArrowLeft, Pencil, Trash2, RotateCcw, CheckSquare, Square,
  X, Save, Play, ChevronRight,
} from "lucide-react";

interface Course {
  id: string;
  title: string;
  category: string;
  source: string;
  progress: number;
  lectureCount: number;
  completedCount: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  ML: "bg-violet-50 text-violet-700 border-violet-200",
  DL: "bg-blue-50 text-blue-700 border-blue-200",
  NLP: "bg-cyan-50 text-cyan-700 border-cyan-200",
  CV: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MATH: "bg-amber-50 text-amber-700 border-amber-200",
  STAT: "bg-orange-50 text-orange-700 border-orange-200",
  LLM: "bg-pink-50 text-pink-700 border-pink-200",
  DATA: "bg-teal-50 text-teal-700 border-teal-200",
};
const catColor = (cat: string) =>
  CATEGORY_COLORS[cat.toUpperCase()] ?? "bg-muted text-muted-foreground border-border";

export function MyCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  // 편집 모드
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 삭제 보류 (편집 완료 시 일괄 반영)
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [committing, setCommitting] = useState(false);

  // 인라인 이름 수정
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({ title: "", category: "", source: "" });
  const [editSaving, setEditSaving] = useState(false);

  // 진도 초기화
  const [resetConfirmId, setResetConfirmId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // 강좌 삭제 확인
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const data: any[] = await api.getCourses({ enrolled: true });
      setCourses(data.map((c: any) => ({
        id: c.id,
        title: c.title,
        category: (c.category ?? "").toUpperCase(),
        source: c.source ?? "",
        progress: Math.round(c.progress_pct ?? 0),
        lectureCount: c.lecture_count ?? 0,
        completedCount: c.completed_count ?? 0,
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCourses(); }, []);

  // 화면에 보여줄 목록 (보류 삭제 제외)
  const filtered = courses.filter(c => !pendingDeletes.has(c.id));

  // 선택
  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelected(new Set(filtered.map(c => c.id)));
  const selectNone = () => setSelected(new Set());
  const exitEdit = () => { setEditMode(false); setSelected(new Set()); setEditingId(null); setDeleteConfirmId(null); setResetConfirmId(null); };

  // 삭제 보류 (API 호출 없이 화면에서만 제거)
  const handleBulkDelete = () => {
    if (!selected.size) return;
    setPendingDeletes(prev => new Set([...prev, ...selected]));
    exitEdit();
  };

  const handleDelete = (id: string) => {
    setPendingDeletes(prev => new Set([...prev, id]));
    setDeleteConfirmId(null);
  };

  // 편집 완료: 보류 삭제를 실제로 반영 후 이동
  const handleDone = async () => {
    if (pendingDeletes.size === 0) { navigate("/my-page"); return; }
    setCommitting(true);
    try {
      await api.bulkDeleteCourses([...pendingDeletes]);
      navigate("/my-page");
    } finally { setCommitting(false); }
  };

  // 인라인 수정
  const startEdit = (c: Course) => {
    setEditingId(c.id);
    setEditFields({ title: c.title, category: c.category, source: c.source });
  };
  const saveEdit = async (id: string) => {
    setEditSaving(true);
    try {
      await api.updateCourse(id, {
        title: editFields.title,
        category: editFields.category.toLowerCase(),
        source: editFields.source,
      });
      setCourses(prev => prev.map(c => c.id === id
        ? { ...c, title: editFields.title, category: editFields.category.toUpperCase(), source: editFields.source }
        : c));
      setEditingId(null);
    } finally { setEditSaving(false); }
  };

  // 진도 초기화
  const handleReset = async (id: string) => {
    setResetting(true);
    try {
      await api.resetCourseProgress(id);
      setCourses(prev => prev.map(c => c.id === id ? { ...c, progress: 0, completedCount: 0 } : c));
      setResetConfirmId(null);
    } finally { setResetting(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-muted-foreground">불러오는 중...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* 상단 바 */}
      <header className="sticky top-0 z-10 bg-background border-b px-6 py-3 flex items-center gap-4">
        <button onClick={handleDone}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> My Page
        </button>
        <div className="w-px h-5 bg-border" />
        <h1 className="font-bold text-base flex-1" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
          강좌 관리
        </h1>
        <span className="text-xs text-muted-foreground">{courses.length}개 강좌</span>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">

        {/* 툴바 */}
        <div className="flex items-center justify-end gap-3">
          {!editMode ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 shrink-0" onClick={() => setEditMode(true)}>
                <Pencil size={12} /> 편집 모드
              </Button>
              <Button size="sm" className="text-xs h-9 shrink-0" onClick={handleDone} disabled={committing}>
                {committing ? "적용 중..." : pendingDeletes.size > 0 ? `편집 완료 (${pendingDeletes.size}개 삭제)` : "편집 완료"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-muted transition-colors flex items-center gap-1"
                onClick={selected.size === filtered.length ? selectNone : selectAll}>
                {selected.size === filtered.length
                  ? <><Square size={12} /> 전체 해제</>
                  : <><CheckSquare size={12} /> 전체 선택</>}
              </button>
              <Button variant="destructive" size="sm" className="text-xs h-9 gap-1"
                disabled={!selected.size} onClick={handleBulkDelete}>
                <Trash2 size={12} />
                {selected.size > 0 ? `${selected.size}개 삭제` : "삭제"}
              </Button>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={exitEdit}>
                <X size={14} />
              </Button>
            </div>
          )}
        </div>

        {/* 편집 모드 안내 */}
        {editMode && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
            <Pencil size={11} />
            카드를 클릭해서 선택 · ✏️로 제목/카테고리 수정 · 🔄로 진도 초기화 · 🗑️로 삭제
            {selected.size > 0 && <span className="ml-auto font-semibold">{selected.size}개 선택됨</span>}
          </div>
        )}

        {/* 강좌 목록 */}
        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground text-sm">강좌가 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(course => {
              const isSelected = selected.has(course.id);
              const isEditing = editingId === course.id;
              const isResetConfirm = resetConfirmId === course.id;
              const isDeleteConfirm = deleteConfirmId === course.id;

              return (
                <div key={course.id} className={`rounded-xl border transition-all ${
                  isSelected ? "ring-2 ring-destructive border-destructive/30 bg-destructive/5"
                  : isEditing ? "ring-2 ring-primary/30 bg-primary/5"
                  : "bg-background hover:bg-muted/20"
                }`}>

                  {/* ── 인라인 편집 폼 ── */}
                  {isEditing ? (
                    <div className="px-5 py-4 space-y-3">
                      <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">강좌 수정</p>
                      <Input value={editFields.title} onChange={e => setEditFields(f => ({ ...f, title: e.target.value }))}
                        className="h-9 text-sm" placeholder="강좌 제목" />
                      <div className="flex gap-2">
                        <Input value={editFields.category} onChange={e => setEditFields(f => ({ ...f, category: e.target.value }))}
                          className="h-8 text-xs w-28" placeholder="카테고리 (ML, DL…)" />
                        <Input value={editFields.source} onChange={e => setEditFields(f => ({ ...f, source: e.target.value }))}
                          className="h-8 text-xs flex-1" placeholder="출처 (예: Coursera, YouTube)" />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => saveEdit(course.id)} disabled={editSaving}>
                          <Save size={11} />{editSaving ? "저장 중..." : "저장"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingId(null)}>취소</Button>
                      </div>
                    </div>
                  ) : (
                    /* ── 일반 행 ── */
                    <div className={`flex items-center gap-4 px-5 py-3.5 ${editMode ? "cursor-pointer" : "group"}`}
                      onClick={() => editMode && !isEditing && toggleSelect(course.id)}>

                      {/* 편집 모드 체크박스 */}
                      {editMode && (
                        <div className="flex-shrink-0">
                          {isSelected
                            ? <CheckSquare size={15} className="text-destructive" />
                            : <Square size={15} className="text-muted-foreground" />}
                        </div>
                      )}

                      {/* 카테고리 뱃지 */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${catColor(course.category)}`}>
                        {course.category || "기타"}
                      </span>

                      {/* 제목 + 출처 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{course.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{course.source}</p>
                      </div>

                      {/* 진행률 */}
                      <div className="hidden sm:flex flex-col gap-1 w-36 flex-shrink-0">
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-foreground/60 rounded-full transition-all"
                            style={{ width: `${course.progress}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {course.completedCount}/{course.lectureCount}강 · {course.progress}%
                        </p>
                      </div>

                      {/* 액션 */}
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {!editMode ? (
                          <>
                            {/* 수강 이동 */}
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2.5" asChild>
                              <Link to={`/course/${course.id}`}><Play size={10} /> 수강</Link>
                            </Button>

                            {/* 편집 */}
                            <button onClick={() => startEdit(course)}
                              className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                              title="제목·카테고리 수정">
                              <Pencil size={13} className="text-muted-foreground" />
                            </button>

                            {/* 진도 초기화 */}
                            {isResetConfirm ? (
                              <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-md px-2 py-1">
                                <span className="text-[10px] text-orange-700 font-medium">진도 초기화?</span>
                                <button className="text-[10px] text-orange-700 underline font-bold"
                                  onClick={() => handleReset(course.id)} disabled={resetting}>
                                  {resetting ? "..." : "확인"}
                                </button>
                                <button className="text-[10px] text-muted-foreground hover:text-foreground"
                                  onClick={() => setResetConfirmId(null)}>취소</button>
                              </div>
                            ) : (
                              <button onClick={() => setResetConfirmId(course.id)}
                                className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                                title="진도 초기화">
                                <RotateCcw size={13} className="text-muted-foreground" />
                              </button>
                            )}

                            {/* 삭제 */}
                            {isDeleteConfirm ? (
                              <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-md px-2 py-1">
                                <span className="text-[10px] text-red-700 font-medium">삭제?</span>
                                <button className="text-[10px] text-red-700 underline font-bold"
                                  onClick={() => handleDelete(course.id)}>확인</button>
                                <button className="text-[10px] text-muted-foreground"
                                  onClick={() => setDeleteConfirmId(null)}>취소</button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteConfirmId(course.id)}
                                className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                                title="강좌 삭제">
                                <Trash2 size={13} className="text-muted-foreground hover:text-destructive transition-colors" />
                              </button>
                            )}
                          </>
                        ) : (
                          /* 편집 모드: 수정 버튼만 노출 */
                          <button onClick={() => startEdit(course)}
                            className="p-1.5 rounded hover:bg-muted transition-colors" title="제목·카테고리 수정">
                            <Pencil size={13} className="text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 하단 링크 */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            전체 {courses.length}개 강좌 · 평균{" "}
            {courses.length > 0
              ? Math.round(courses.reduce((s, c) => s + c.progress, 0) / courses.length)
              : 0}% 완료
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs gap-1.5" asChild>
              <Link to="/youtube-import"><ChevronRight size={12} /> YouTube 임포트</Link>
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" asChild>
              <Link to="/course-catalog" state={{ from: "/my-courses" }}><ChevronRight size={12} /> 강좌 살펴보기</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
