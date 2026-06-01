import { useState, useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}
import { useParams, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  ArrowLeft,
  Save,
  BookOpen,
  Video,
  ChevronRight,
  Clock,
  FileText,
  Maximize2,
  Minimize2,
  Pencil,
  Tag,
  CheckCircle2,
  Lightbulb,
  Send,
  X,
} from "lucide-react";
import { DrawingCanvas } from "../components/DrawingCanvas";
import { api, streamSSE } from "../../lib/api";

interface Note {
  id: string;
  title: string;
  course: string;
  content: string;
  date: string;
  category: string;
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
  instructor: string;
  category: string;
  progress: number;
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [savedNotes, setSavedNotes] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState("take-notes");
  const [savedDrawings, setSavedDrawings] = useState<string[]>([]);
  const [noteSaving, setNoteSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  // 힌트 패널
  const [hintOpen, setHintOpen] = useState(false);
  const [hintMsgs, setHintMsgs] = useState<{ role: "user"|"ai"; text: string }[]>([
    { role: "ai", text: "막히는 부분을 질문해보세요. 단계적인 힌트를 드릴게요!" },
  ]);
  const [hintInput, setHintInput] = useState("");
  const [hintStreaming, setHintStreaming] = useState(false);
  const hintAbortRef = useRef<AbortController | null>(null);
  const hintBottomRef = useRef<HTMLDivElement>(null);

  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const completingRef = useRef(false);

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

  useEffect(() => {
    if (!courseId || !lectureId) return;
    Promise.all([
      api.getCourse(courseId),
      api.getLecture(lectureId),
      api.getLectures(courseId),
    ]).then(([c, lec, lecs]: [any, any, any[]]) => {
      setCourse({
        id: c.id, title: c.title,
        instructor: "Self-Taught University",
        category: c.category, progress: 0,
      });
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
    }).catch(() => {
      // localStorage 폴백
      const savedCourses = localStorage.getItem("myCourses");
      if (savedCourses) {
        const courses = JSON.parse(savedCourses);
        const c = courses.find((x: any) => x.id === courseId);
        if (c) setCourse({ ...c, instructor: c.instructor ?? "Self-Taught University" });
      }
      const savedLectures = localStorage.getItem(`lectures-${courseId}`);
      if (savedLectures) {
        const lecs: Lecture[] = JSON.parse(savedLectures).map((l: any) => ({
          ...l, completed: l.completed ?? false, keywords: l.keywords ?? [],
          videoUrl: toEmbedUrl(l.videoUrl || l.youtube_url),
        }));
        setCourseLectures(lecs);
        const found = lecs.find(l => l.id === lectureId);
        if (found) { setCurrentLecture(found); setNoteTitle(`Notes: ${found.title}`); }
      }
    }).finally(() => setLoading(false));
  }, [courseId, lectureId]);

  useEffect(() => {
    // API 노트 불러오기
    api.getNotes().then((notes: any[]) => {
      const courseTitle = course?.title ?? "";
      setSavedNotes(notes.filter((n: any) => n.title.includes(courseTitle) || n.content_md?.includes(courseTitle)).map((n: any) => ({
        id: n.id, title: n.title, course: courseTitle,
        content: n.content_md ?? "", date: n.updated_at ?? n.created_at ?? "",
        category: "Lecture",
      })));
    }).catch(() => {
      // localStorage 폴백
      const data = localStorage.getItem("lectureNotes");
      if (data && course) {
        const notes = JSON.parse(data);
        setSavedNotes(notes.filter((n: Note) => n.course.includes(course.title)));
      }
    });
  }, [course]);

  const handleSaveNote = async () => {
    if (!noteTitle || !noteContent || !course) return;
    setNoteSaving(true);
    try {
      const created: any = await api.createNote({ title: noteTitle, content_md: noteContent });
      const note: Note = {
        id: created.id, title: noteTitle, course: course.title,
        content: noteContent, date: new Date().toISOString(), category: "Lecture",
      };
      setSavedNotes(prev => [note, ...prev]);
      setNoteContent("");
      setNoteTitle(`Notes: ${currentLecture?.title ?? ""}`);
    } catch {
      // localStorage 폴백
      const note: Note = {
        id: Date.now().toString(), title: noteTitle, course: course.title,
        content: noteContent, date: new Date().toISOString(), category: "Lecture",
      };
      const allNotes = localStorage.getItem("lectureNotes");
      const notes = allNotes ? JSON.parse(allNotes) : [];
      localStorage.setItem("lectureNotes", JSON.stringify([note, ...notes]));
      setSavedNotes(prev => [note, ...prev]);
      setNoteContent("");
    } finally {
      setNoteSaving(false);
    }
  };

  // ref로 최신 완료 함수 유지 — 플레이어 이벤트 클로저에서 stale 참조 방지
  const markCompleteRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    markCompleteRef.current = async () => {
      if (!courseId || !lectureId || completingRef.current) return;
      completingRef.current = true;
      setCompleting(true);
      try {
        await api.completeLecture(courseId, lectureId);
        setCurrentLecture(prev => prev ? { ...prev, completed: true, is_completed: true } : prev);
        setCourseLectures(prev => prev.map(l =>
          l.id === lectureId ? { ...l, completed: true } : l
        ));
        // 강의 키워드를 지식 그래프 노드로 등록
        api.addGraphFromLecture(lectureId).catch(() => {});
      } finally {
        setCompleting(false);
      }
    };
  }, [courseId, lectureId]);

  const handleMarkComplete = () => markCompleteRef.current();

  // YouTube IFrame Player API — 영상 종료 시 자동 완료
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

      // destroy()가 iframe을 제거하므로 매번 새 div를 생성
      container.innerHTML = "";
      const playerDiv = document.createElement("div");
      container.appendChild(playerDiv);

      playerRef.current = new window.YT.Player(playerDiv, {
        host: "https://www.youtube-nocookie.com",
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e: any) => {
            if (e.data === 0) markCompleteRef.current(); // ENDED
          },
        },
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

  const handleSaveDrawing = (dataUrl: string) => {
    setSavedDrawings((prev) => [dataUrl, ...prev]);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">불러오는 중...</p>
      </div>
    );
  }

  if (!course || !currentLecture) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">
            {!course ? "Course not found" : "Lecture not found"}
          </h2>
          <Button onClick={() => navigate("/my-page")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-40">
        <div className="max-w-[2000px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Lectures
              </Button>
              <div>
                <h1 className="font-bold text-lg">{course.title}</h1>
                <p className="text-sm text-muted-foreground">{course.instructor}</p>
              </div>
            </div>
            <Badge variant="secondary">{course.category}</Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[2000px] mx-auto">
        <div className={`grid ${isFullscreen ? 'grid-cols-1' : 'lg:grid-cols-[1fr_500px]'} gap-0`}>
          {/* Video and Lecture List Section */}
          <div className="flex flex-col">
            {/* Video Player */}
            <div className="bg-black aspect-video relative">
              <div ref={playerContainerRef} className="w-full h-full" />
            </div>

            {/* Current Lecture Info */}
            <div className="p-6 border-b">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{currentLecture.title}</h2>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {currentLecture.duration}
                    </span>
                    <Badge variant={currentLecture.completed ? "default" : "outline"}>
                      {currentLecture.completed ? "Completed" : "In Progress"}
                    </Badge>
                    {!currentLecture.completed && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                        onClick={handleMarkComplete}
                        disabled={completing}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {completing ? "저장 중..." : "완료로 표시"}
                      </Button>
                    )}
                  </div>
                  {currentLecture.keywords && currentLecture.keywords.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Tag className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                      <div className="flex flex-wrap gap-2">
                        {currentLecture.keywords.map((keyword, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Lecture List */}
            <div className="p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Video className="w-5 h-5" />
                Course Content
              </h3>
              <div className="space-y-2">
                {courseLectures.map((lecture, index) => (
                  <Card
                    key={lecture.id}
                    className={`cursor-pointer transition-all ${
                      currentLecture?.id === lecture.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => navigate(`/course/${courseId}/lecture/${lecture.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{lecture.title}</p>
                          <p className="text-sm text-muted-foreground">{lecture.duration}</p>
                        </div>
                        {lecture.completed ? (
                          <Badge variant="secondary" className="text-xs">
                            ✓
                          </Badge>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {!isFullscreen && (
            <div className="border-l bg-muted/30 flex flex-col h-screen sticky top-[73px]">
              <div className="p-6 border-b bg-background">
                <h3 className="font-bold flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Lecture Notes
                </h3>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="mx-6 mt-4">
                  <TabsTrigger value="take-notes">Text</TabsTrigger>
                  <TabsTrigger value="drawing">
                    <Pencil className="w-4 h-4 mr-1" />
                    Drawing
                  </TabsTrigger>
                  <TabsTrigger value="saved-notes">
                    Saved ({savedNotes.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="take-notes" className="flex-1 flex flex-col mt-0 p-6 space-y-4 overflow-y-auto">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Note Title</label>
                    <Input
                      placeholder="Enter note title..."
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 flex flex-col">
                    <label className="text-sm font-medium mb-2 block">Your Notes</label>
                    <Textarea
                      placeholder="Take notes while watching the lecture..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="flex-1 min-h-[400px] font-mono resize-none"
                    />
                  </div>
                  <Button
                    onClick={handleSaveNote}
                    className="w-full"
                    disabled={!noteTitle || !noteContent}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Note
                  </Button>
                </TabsContent>

                <TabsContent value="drawing" className="flex-1 mt-0 flex flex-col overflow-hidden">
                  <DrawingCanvas onSave={handleSaveDrawing} />
                </TabsContent>

                <TabsContent value="saved-notes" className="flex-1 mt-0 p-6 overflow-y-auto">
                  {savedNotes.length === 0 && savedDrawings.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No saved notes yet</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Start taking notes during lectures
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Text Notes */}
                      {savedNotes.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-3">Text Notes</h4>
                          <div className="space-y-4">
                            {savedNotes.map((note) => (
                              <Card key={note.id}>
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm">{note.title}</CardTitle>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(note.date).toLocaleDateString()}
                                  </p>
                                </CardHeader>
                                <CardContent>
                                  <p className="text-sm text-muted-foreground line-clamp-3">
                                    {note.content}
                                  </p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Drawings */}
                      {savedDrawings.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-3">Drawings</h4>
                          <div className="grid grid-cols-1 gap-4">
                            {savedDrawings.map((drawing, index) => (
                              <Card key={index}>
                                <CardContent className="p-4">
                                  <img
                                    src={drawing}
                                    alt={`Drawing ${index + 1}`}
                                    className="w-full rounded border"
                                  />
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* 힌트 패널 — 우측 슬라이드인 */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-background border-l shadow-xl z-40 flex flex-col transition-transform duration-300 ${hintOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground flex-shrink-0">
          <span className="flex items-center gap-2 font-semibold text-sm">
            <Lightbulb className="w-4 h-4" /> AI 힌트
          </span>
          <button onClick={() => setHintOpen(false)}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {hintMsgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user" ? "bg-primary text-primary-foreground rounded-br-none" : "bg-muted rounded-bl-none"
              }`}>
                {m.text}
                {m.role === "ai" && m.text === "" && <span className="inline-block w-1.5 h-4 bg-foreground/40 animate-pulse ml-0.5" />}
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
          <button onClick={sendHint} disabled={!hintInput.trim() || hintStreaming} className="px-3 text-primary disabled:opacity-30">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 힌트 토글 버튼 (우측 하단) */}
      {!hintOpen && currentLecture && (
        <button
          onClick={() => setHintOpen(true)}
          className="fixed bottom-24 right-6 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-colors text-sm font-medium"
        >
          <Lightbulb className="w-4 h-4" /> 힌트
        </button>
      )}
    </div>
  );
}
