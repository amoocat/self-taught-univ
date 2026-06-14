import { useState, useEffect, useRef } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}
import { useParams, useNavigate } from "react-router";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  ArrowLeft, ArrowRight, Save, BookOpen, CheckCircle2, Clock,
  ChevronRight, Tag, Lightbulb, Send, X, Play,
} from "lucide-react";
import { api, streamSSE } from "../../lib/api";

interface Note {
  id: string;
  title: string;
  course: string;
  content: string;
  date: string;
}

interface Lecture {
  id: string;
  title: string;
  duration: string;
  duration_sec?: number;
  videoUrl: string;
  youtube_url?: string;
  completed: boolean;
  is_completed?: boolean;
  number?: number;
  module_name?: string;
  keywords: string[];
  tags?: string[];
}

interface Course {
  id: string;
  title: string;
  category: string;
  source: string;
}

function fmtDuration(sec?: number): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

function toEmbedUrl(url?: string): string {
  if (!url) return "";
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  if (!m) return url;
  return `https://www.youtube-nocookie.com/embed/${m[1]}`;
}

export function CourseLecture() {
  const { courseId, lectureId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [currentLecture, setCurrentLecture] = useState<Lecture | null>(null);
  const [courseLectures, setCourseLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);

  // 노트
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [savedNotes, setSavedNotes] = useState<Note[]>([]);
  const [noteSaving, setNoteSaving] = useState(false);

  // 완료
  const [completing, setCompleting] = useState(false);

  // 힌트 패널
  const [hintOpen, setHintOpen] = useState(false);
  const [hintMsgs, setHintMsgs] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "막히는 부분을 질문해보세요. 단계적인 힌트를 드릴게요!" },
  ]);
  const [hintInput, setHintInput] = useState("");
  const [hintStreaming, setHintStreaming] = useState(false);
  const hintAbortRef = useRef<AbortController | null>(null);
  const hintBottomRef = useRef<HTMLDivElement>(null);

  // 사이드바 모듈 접기/펼치기
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());

  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const completingRef = useRef(false);
  const activeLectureRef = useRef<HTMLDivElement>(null);

  // ── 데이터 로드 ──────────────────────────────────────────────
  useEffect(() => {
    if (!courseId || !lectureId) return;
    Promise.all([
      api.getCourse(courseId),
      api.getLecture(lectureId),
      api.getLectures(courseId),
    ]).then(([c, lec, lecs]: [any, any, any[]]) => {
      setCourse({ id: c.id, title: c.title, category: c.category, source: c.source ?? "" });
      const mapped = (l: any): Lecture => ({
        id: l.id, title: l.title,
        duration: fmtDuration(l.duration_sec), duration_sec: l.duration_sec,
        videoUrl: toEmbedUrl(l.youtube_url), youtube_url: l.youtube_url,
        completed: l.is_completed ?? false, is_completed: l.is_completed,
        number: l.number, module_name: l.module_name,
        keywords: l.tags ?? [], tags: l.tags ?? [],
      });
      setCurrentLecture(mapped(lec));
      setCourseLectures(lecs.map(mapped));
      setNoteTitle(`Notes: ${lec.title}`);
    }).catch(console.error).finally(() => setLoading(false));
  }, [courseId, lectureId]);

  // 노트 로드
  useEffect(() => {
    if (!course) return;
    api.getNotes().then((notes: any[]) => {
      setSavedNotes(notes
        .filter((n: any) => n.title.includes(course.title) || n.content_md?.includes(course.title))
        .map((n: any) => ({
          id: n.id, title: n.title, course: course.title,
          content: n.content_md ?? "", date: n.updated_at ?? n.created_at ?? "",
        })));
    }).catch(console.error);
  }, [course]);

  // 활성 강의 사이드바 스크롤
  useEffect(() => {
    setTimeout(() => activeLectureRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 100);
  }, [lectureId]);

  // ── 완료 처리 ────────────────────────────────────────────────
  const markCompleteRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    markCompleteRef.current = async () => {
      if (!courseId || !lectureId || completingRef.current) return;
      completingRef.current = true;
      setCompleting(true);
      try {
        await api.completeLecture(courseId, lectureId);
        setCurrentLecture(prev => prev ? { ...prev, completed: true } : prev);
        setCourseLectures(prev => prev.map(l => l.id === lectureId ? { ...l, completed: true } : l));
        api.addGraphFromLecture(lectureId).catch(() => {});
      } finally {
        setCompleting(false);
      }
    };
  }, [courseId, lectureId]);

  const handleMarkComplete = () => markCompleteRef.current();

  // ── YouTube IFrame API ───────────────────────────────────────
  useEffect(() => {
    const videoId = currentLecture?.youtube_url?.match(
      /(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/
    )?.[1];
    if (!videoId || currentLecture?.completed) return;
    completingRef.current = false;

    const initPlayer = () => {
      const container = playerContainerRef.current;
      if (!container) return;
      playerRef.current?.destroy?.();
      container.innerHTML = "";
      const div = document.createElement("div");
      container.appendChild(div);
      playerRef.current = new window.YT.Player(div, {
        host: "https://www.youtube-nocookie.com",
        videoId,
        width: "100%", height: "100%",
        playerVars: { rel: 0, modestbranding: 1 },
        events: { onStateChange: (e: any) => { if (e.data === 0) markCompleteRef.current(); } },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      if (!document.getElementById("yt-iframe-api")) {
        const tag = document.createElement("script");
        tag.id = "yt-iframe-api";
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = initPlayer;
    }
    return () => {
      playerRef.current?.destroy?.();
      playerRef.current = null;
      if (playerContainerRef.current) playerContainerRef.current.innerHTML = "";
    };
  }, [currentLecture?.id, currentLecture?.completed]);

  // ── 노트 저장 ────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!noteTitle || !noteContent || !course) return;
    setNoteSaving(true);
    try {
      const created: any = await api.createNote({ title: noteTitle, content_md: noteContent });
      setSavedNotes(prev => [{
        id: created.id, title: noteTitle, course: course.title,
        content: noteContent, date: new Date().toISOString(),
      }, ...prev]);
      setNoteContent("");
    } catch (e) {
      console.error(e);
    } finally {
      setNoteSaving(false);
    }
  };

  // ── AI 힌트 ──────────────────────────────────────────────────
  async function sendHint() {
    const message = hintInput.trim();
    if (!message || hintStreaming || !lectureId) return;
    setHintInput("");
    setHintMsgs(prev => [...prev, { role: "user", text: message }]);
    setHintStreaming(true);
    const history = hintMsgs.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
    hintAbortRef.current = new AbortController();
    setHintMsgs(prev => [...prev, { role: "ai", text: "" }]);
    try {
      await streamSSE(
        `/chat/lecture/${lectureId}/stream`,
        { mode: "study", subject: currentLecture?.title ?? "", message, history },
        (chunk) => setHintMsgs(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: "ai", text: next[next.length - 1].text + chunk };
          return next;
        }),
        hintAbortRef.current.signal,
      );
    } catch {
      setHintMsgs(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: "ai", text: "⚠️ 오류가 발생했습니다." };
        return next;
      });
    } finally {
      setHintStreaming(false);
      setTimeout(() => hintBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  // ── 모듈 그룹핑 ─────────────────────────────────────────────
  const groups: { name: string; lectures: Lecture[] }[] = [];
  for (const lec of courseLectures) {
    const name = lec.module_name || "기타";
    const g = groups.find(g => g.name === name);
    if (g) g.lectures.push(lec);
    else groups.push({ name, lectures: [lec] });
  }

  const completedCount = courseLectures.filter(l => l.completed).length;
  const progressPct = courseLectures.length > 0
    ? Math.round((completedCount / courseLectures.length) * 100) : 0;

  const currentIdx = courseLectures.findIndex(l => l.id === lectureId);
  const prevLecture = currentIdx > 0 ? courseLectures[currentIdx - 1] : null;
  const nextLecture = currentIdx < courseLectures.length - 1 ? courseLectures[currentIdx + 1] : null;

  const toggleModule = (name: string) =>
    setCollapsedModules(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  // ── 로딩 / 에러 ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">불러오는 중...</p>
      </div>
    );
  }
  if (!course || !currentLecture) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center">
        <div>
          <p className="text-lg font-bold mb-3">강의를 찾을 수 없습니다</p>
          <button onClick={() => navigate(-1)} className="text-sm text-primary underline">돌아가기</button>
        </div>
      </div>
    );
  }

  // ── 렌더 ────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">

      {/* ── TOP BAR ── */}
      <header className="h-[52px] flex-shrink-0 flex items-center gap-3 px-5 border-b bg-background">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
        >
          <ArrowLeft size={14} />
          강좌 목록
        </button>
        <div className="w-px h-5 bg-border" />
        <span className="text-sm font-semibold truncate flex-1">{course.title}</span>

        {/* 진행률 */}
        <div className="hidden md:flex items-center gap-2.5 flex-shrink-0">
          <span className="text-xs text-muted-foreground">진도</span>
          <div className="w-28 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-xs font-semibold">{progressPct}%</span>
          <span className="text-xs text-muted-foreground">· {completedCount} / {courseLectures.length}강</span>
        </div>
      </header>

      {/* ── MAIN ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="hidden md:flex w-[300px] flex-shrink-0 flex-col border-r bg-muted/20 overflow-hidden">
          {/* 사이드바 헤더 */}
          <div className="px-5 py-3.5 border-b flex-shrink-0">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-0.5">커리큘럼</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{completedCount}</span> / {courseLectures.length}강 완료
            </p>
          </div>

          {/* 모듈 목록 */}
          <div className="flex-1 overflow-y-auto py-2">
            {groups.map((group, gi) => {
              const isCollapsed = collapsedModules.has(group.name);
              const groupDone = group.lectures.filter(l => l.completed).length;
              return (
                <div key={gi}>
                  {/* 모듈 헤더 */}
                  <button
                    onClick={() => toggleModule(group.name)}
                    className="w-full flex items-center gap-2 px-5 py-2 hover:bg-muted/50 transition-colors text-left"
                  >
                    <ChevronRight
                      size={12}
                      className="text-muted-foreground transition-transform flex-shrink-0"
                      style={{ transform: isCollapsed ? "" : "rotate(90deg)" }}
                    />
                    <span className="text-xs font-semibold flex-1 truncate">{group.name}</span>
                    <span className="text-[10px] text-muted-foreground bg-background border rounded-full px-2 py-px flex-shrink-0">
                      {groupDone}/{group.lectures.length}
                    </span>
                  </button>

                  {/* 강의 목록 */}
                  {!isCollapsed && group.lectures.map((lec) => {
                    const isActive = lec.id === lectureId;
                    return (
                      <div
                        key={lec.id}
                        ref={isActive ? activeLectureRef : undefined}
                        onClick={() => navigate(`/course/${courseId}/lecture/${lec.id}`)}
                        className={`flex items-center gap-2.5 pl-9 pr-4 py-2.5 cursor-pointer transition-colors border-r-2 ${
                          isActive
                            ? "bg-accent border-foreground"
                            : "border-transparent hover:bg-muted/40"
                        }`}
                      >
                        {/* 아이콘 */}
                        <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 border ${
                          lec.completed
                            ? "bg-foreground border-foreground"
                            : isActive
                            ? "bg-foreground border-foreground"
                            : "bg-background border-border"
                        }`}>
                          {lec.completed ? (
                            <svg width="9" height="9" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          ) : isActive ? (
                            <svg width="7" height="7" fill="white" viewBox="0 0 24 24">
                              <polygon points="5,3 19,12 5,21" />
                            </svg>
                          ) : null}
                        </div>

                        {/* 제목 + 시간 */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-snug line-clamp-2 ${
                            lec.completed ? "text-muted-foreground/60" : isActive ? "font-semibold text-foreground" : "text-foreground/80"
                          }`}>
                            {lec.title}
                          </p>
                          {lec.duration && lec.duration !== "—" && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Clock size={9} />{lec.duration}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── PLAYER AREA ── */}
        <div className="flex-1 flex flex-col overflow-y-auto">

          {/* 비디오 */}
          <div className="bg-black w-full flex-shrink-0" style={{ maxHeight: "62vh", aspectRatio: "16/9" }}>
            <div ref={playerContainerRef} className="w-full h-full">
              {!currentLecture.youtube_url && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-zinc-950">
                  <div className="w-16 h-16 rounded-full bg-white/10 border border-white/30 flex items-center justify-center">
                    <Play size={24} className="text-white ml-1" />
                  </div>
                  <p className="text-sm text-white/50">YouTube URL이 없습니다</p>
                </div>
              )}
            </div>
          </div>

          {/* 이전 / 완료 / 다음 */}
          <div className="flex items-center justify-between px-7 py-3 border-b bg-muted/20 flex-shrink-0">
            <button
              disabled={!prevLecture}
              onClick={() => prevLecture && navigate(`/course/${courseId}/lecture/${prevLecture.id}`)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-md px-3 py-1.5 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft size={12} /> 이전 강의
            </button>

            {currentLecture.completed ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground border rounded-md px-3 py-1.5 bg-muted">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                완료됨
              </div>
            ) : (
              <button
                onClick={handleMarkComplete}
                disabled={completing}
                className="flex items-center gap-1.5 text-xs font-semibold text-background bg-foreground rounded-md px-4 py-1.5 hover:opacity-75 transition-opacity disabled:opacity-50"
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                {completing ? "저장 중..." : "완료로 표시"}
              </button>
            )}

            <button
              disabled={!nextLecture}
              onClick={() => nextLecture && navigate(`/course/${courseId}/lecture/${nextLecture.id}`)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-md px-3 py-1.5 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              다음 강의 <ArrowRight size={12} />
            </button>
          </div>

          {/* 강의 정보 */}
          <div className="px-7 py-5 border-b flex-shrink-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border">
                {course.category.toUpperCase()}
              </span>
              {currentLecture.module_name && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                  {currentLecture.module_name}
                </span>
              )}
              {currentLecture.duration && currentLecture.duration !== "—" && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock size={10} />{currentLecture.duration}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold leading-snug mb-3" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
              {currentLecture.title}
            </h2>
            {currentLecture.keywords.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag size={12} className="text-muted-foreground" />
                {currentLecture.keywords.map((kw, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 탭: 노트 | 강의 정보 */}
          <Tabs defaultValue="notes" className="flex-1 flex flex-col">
            <TabsList className="mx-7 mt-4 w-fit">
              <TabsTrigger value="notes" className="text-xs gap-1.5">
                <BookOpen size={12} /> 노트
              </TabsTrigger>
              <TabsTrigger value="about" className="text-xs gap-1.5">
                ℹ️ 강의 정보
              </TabsTrigger>
            </TabsList>

            {/* 노트 탭 */}
            <TabsContent value="notes" className="px-7 py-5 flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 작성 */}
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-3">새 노트 작성</p>
                  <Input
                    placeholder="제목"
                    value={noteTitle}
                    onChange={e => setNoteTitle(e.target.value)}
                    className="mb-2 h-8 text-sm"
                  />
                  <Textarea
                    placeholder="이 강의에서 배운 내용을 메모하세요..."
                    value={noteContent}
                    onChange={e => setNoteContent(e.target.value)}
                    className="min-h-[180px] text-sm font-mono resize-none"
                  />
                  <button
                    onClick={handleSaveNote}
                    disabled={!noteTitle || !noteContent || noteSaving}
                    className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-background bg-foreground rounded-md px-4 py-2 hover:opacity-75 transition-opacity disabled:opacity-40"
                  >
                    <Save size={12} />
                    {noteSaving ? "저장 중..." : "저장"}
                  </button>
                </div>

                {/* 저장된 노트 */}
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-3">
                    저장된 노트 ({savedNotes.length})
                  </p>
                  {savedNotes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">아직 저장된 노트가 없습니다.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                      {savedNotes.map(note => (
                        <div key={note.id} className="bg-muted/40 border rounded-lg p-3.5">
                          <p className="text-sm font-semibold mb-0.5">{note.title}</p>
                          <p className="text-[10px] text-muted-foreground mb-2">
                            {note.date ? new Date(note.date).toLocaleDateString("ko-KR") : ""}
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{note.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* 강의 정보 탭 */}
            <TabsContent value="about" className="px-7 py-5">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-4">강의 정보</p>
              <table className="text-sm w-full max-w-md">
                {[
                  ["강좌", course.title],
                  ["카테고리", course.category.toUpperCase()],
                  ["출처", course.source],
                  ["총 강의 수", `${courseLectures.length}강`],
                  ["완료", `${completedCount} / ${courseLectures.length}강 (${progressPct}%)`],
                ].map(([label, value]) => (
                  <tr key={label} className="border-b last:border-b-0">
                    <td className="py-2.5 pr-6 text-muted-foreground w-28">{label}</td>
                    <td className="py-2.5 font-medium">{value}</td>
                  </tr>
                ))}
              </table>
            </TabsContent>
          </Tabs>

          {/* 하단 여백 */}
          <div className="h-20" />
        </div>
      </div>

      {/* ── AI 힌트 패널 ── */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-background border-l shadow-xl z-50 flex flex-col transition-transform duration-300 ${hintOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 flex-shrink-0">
          <span className="flex items-center gap-2 font-semibold text-sm">
            <Lightbulb size={15} /> AI 힌트
          </span>
          <button onClick={() => setHintOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {hintMsgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-foreground text-background rounded-br-none"
                  : "bg-muted rounded-bl-none"
              }`}>
                {m.text}
                {m.role === "ai" && m.text === "" && (
                  <span className="inline-block w-1.5 h-4 bg-foreground/40 animate-pulse ml-0.5" />
                )}
              </div>
            </div>
          ))}
          <div ref={hintBottomRef} />
        </div>
        <div className="flex border-t flex-shrink-0">
          <input
            value={hintInput}
            onChange={e => setHintInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendHint()}
            placeholder="질문을 입력하세요..."
            disabled={hintStreaming}
            className="flex-1 px-3 py-3 text-sm bg-transparent outline-none disabled:opacity-50"
          />
          <button
            onClick={sendHint}
            disabled={!hintInput.trim() || hintStreaming}
            className="px-3 text-foreground disabled:opacity-30"
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      {/* ── AI 힌트 플로팅 버튼 ── */}
      {!hintOpen && (
        <button
          onClick={() => setHintOpen(true)}
          className="fixed bottom-6 right-7 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-foreground text-background shadow-lg hover:opacity-80 transition-all hover:-translate-y-0.5 text-sm font-semibold"
        >
          <Lightbulb size={14} /> AI 힌트
        </button>
      )}
    </div>
  );
}
