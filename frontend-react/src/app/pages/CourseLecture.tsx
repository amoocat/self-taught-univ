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
  CheckCircle2
} from "lucide-react";
import { DrawingCanvas } from "../components/DrawingCanvas";
import { api } from "../../lib/api";

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
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const completingRef = useRef(false);

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
    </div>
  );
}
