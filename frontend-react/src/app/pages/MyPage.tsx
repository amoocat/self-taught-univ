import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { Link, useLocation } from "react-router";
import { Button } from "../components/ui/button";
import { StudyHeatmap } from "../components/StudyHeatmap";
import { StudyTracker } from "../components/StudyTracker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { BookOpen, FileText, Calendar, Clock, GraduationCap, Plus, Edit, Trash2, Play, Star, TrendingUp, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

interface Course {
  id: string;
  title: string;
  instructor: string;
  category: string;
  progress: number;
}

interface Note {
  id: string;
  title: string;
  course: string;
  content: string;
  date: string;
  category: string;
}

const CATEGORY_ACCENTS: Record<string, { bar: string; badge: string; border: string }> = {};

const NOTE_CATEGORY_COLORS: Record<string, string> = {
  Lecture: "bg-primary/10 text-primary",
  Reading: "bg-muted text-muted-foreground",
  Assignment: "bg-primary/5 text-foreground",
  "Exam Prep": "bg-muted text-foreground",
};

function getCategoryAccent(category: string) {
  return CATEGORY_ACCENTS[category] ?? {
    bar: "from-primary/60 to-primary/80",
    badge: "bg-primary/10 text-primary border-primary/20",
    border: "border-l-primary/50",
  };
}

export function MyPage() {
  const location = useLocation();
  const syncStarted = (location.state as any)?.syncStarted === true;
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [myNotes, setMyNotes] = useState<Note[]>([]);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [newNote, setNewNote] = useState({
    title: "",
    course: "",
    content: "",
    category: "Lecture",
  });
  const [coursePage, setCoursePage] = useState(1);
  const [notePage, setNotePage] = useState(1);
  const PAGE_SIZE = 5;

  useEffect(() => {
    // API에서 강좌와 노트 로드
    api.getCourses().then((data: any[]) => {
      setMyCourses(data.map((c: any) => ({
        id: c.id,
        title: c.title,
        instructor: "Self-Taught University",
        category: c.category?.toUpperCase?.() ?? c.category,
        progress: Math.round(c.progress_pct ?? 0),
      })));
    }).catch(() => {
      const saved = localStorage.getItem("myCourses");
      if (saved) setMyCourses(JSON.parse(saved));
    });

    api.getNotes().then((data: any[]) => {
      setMyNotes(data.map((n: any) => ({
        id: n.id, title: n.title, course: "", content: n.content_md ?? "",
        date: n.updated_at ?? n.created_at ?? "", category: "Lecture",
        tags: n.tags ?? [],
      })));
    }).catch(() => {
      const saved = localStorage.getItem("lectureNotes");
      if (saved) setMyNotes(JSON.parse(saved));
    });
  }, []);

  const handleCreateNote = async () => {
    if (!newNote.title || !newNote.content) return;
    try {
      const created: any = await api.createNote({ title: newNote.title, content_md: newNote.content });
      const note: Note = {
        id: created.id, title: newNote.title, course: newNote.course,
        content: newNote.content, date: new Date().toISOString(), category: newNote.category,
      };
      setMyNotes(prev => [note, ...prev]);
    } catch {
      const note: Note = {
        id: Date.now().toString(), title: newNote.title, course: newNote.course,
        content: newNote.content, date: new Date().toISOString(), category: newNote.category,
      };
      const updated = [note, ...myNotes];
      setMyNotes(updated);
      localStorage.setItem("lectureNotes", JSON.stringify(updated));
    }
    setNewNote({ title: "", course: "", content: "", category: "Lecture" });
    setIsCreatingNote(false);
  };

  const handleDeleteNote = (id: string) => {
    const updatedNotes = myNotes.filter((note) => note.id !== id);
    setMyNotes(updatedNotes);
    localStorage.setItem("lectureNotes", JSON.stringify(updatedNotes));
  };

  const handleDeleteCourse = (id: string) => {
    const updatedCourses = myCourses.filter((course) => course.id !== id);
    setMyCourses(updatedCourses);
    localStorage.setItem("myCourses", JSON.stringify(updatedCourses));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const avgProgress =
    myCourses.length > 0
      ? Math.round(myCourses.reduce((sum, c) => sum + c.progress, 0) / myCourses.length)
      : 0;

  const totalCoursePages = Math.ceil(myCourses.length / PAGE_SIZE);
  const pagedCourses = myCourses.slice((coursePage - 1) * PAGE_SIZE, coursePage * PAGE_SIZE);

  const totalNotePages = Math.ceil(myNotes.length / PAGE_SIZE);
  const pagedNotes = myNotes.slice((notePage - 1) * PAGE_SIZE, notePage * PAGE_SIZE);

  const weeklyNotes = myNotes.filter((note) => {
    const noteDate = new Date(note.date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return noteDate > weekAgo;
  }).length;

  return (
    <div className="min-h-screen bg-background">
      {/* 동기화 시작 안내 배너 */}
      {syncStarted && (
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-3 text-center text-sm text-primary">
          ✓ 동기화가 시작됐습니다. 백그라운드에서 처리 중이며, 잠시 후 커리큘럼이 업데이트됩니다.
        </div>
      )}
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-primary/10 to-background py-6 border-b">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            My Page
          </h1>
          <p className="text-sm text-muted-foreground">Self-Taught University · Welcome back — here's your academic overview.</p>
        </div>
      </section>


      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-6 py-8 flex gap-8 items-start">

        {/* 학생 카드 */}
        <aside className="w-64 flex-shrink-0">
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <div className="bg-primary px-5 py-6 text-primary-foreground text-center">
              <div className="w-16 h-16 rounded-full bg-primary-foreground/10 border-2 border-primary-foreground/30 flex items-center justify-center mx-auto mb-3 text-3xl">
                🎓
              </div>
              <div className="font-bold text-lg leading-tight" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>나, 직접</div>
              <div className="text-xs opacity-70 mt-1 tracking-wide">Dept. of Artificial Intelligence</div>
            </div>
            <div className="bg-background divide-y text-sm">
              {[
                { label: "학번",       value: "STU-2025-0001" },
                { label: "전공",       value: "인공지능학과" },
                { label: "학기",       value: "2025년 1학기" },
                { label: "이수 학점",  value: `진행 중 (${myCourses.length}과목)` },
                { label: "전체 진도",  value: `${avgProgress}% 완료` },
                { label: "최근 활동",  value: "선형대수 Lec.03 학습" },
                { label: "AI 테스트 점수", value: "7 / 10 (지난 회차)" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-baseline px-4 py-2.5 gap-2">
                  <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
                  <span className="text-xs font-medium text-right">{value}</span>
                </div>
              ))}
            </div>
            <div className="p-3 bg-muted/30 border-t grid grid-cols-2 gap-2">
              <Link to="/knowledge-graph"
                className="flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-2 border rounded-lg hover:bg-muted transition-colors text-center">
                <span>⬡</span> 그래프
              </Link>
              <Link to="/world-map"
                className="flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-2 border rounded-lg hover:bg-muted transition-colors text-center">
                <span>🗺️</span> 세계지도
              </Link>
            </div>
          </div>
        </aside>

        {/* 오른쪽: 스터디 트래커 + 잔디 + 탭 */}
        <div className="flex-1 min-w-0 space-y-6">
          <StudyTracker />
          {/* 공부 잔디 (가로 전체 너비) */}
          <div className="border rounded-xl p-5 bg-background shadow-sm">
            <StudyHeatmap />
          </div>
          <Tabs defaultValue="courses" className="w-full">
          <TabsList className="mb-10">
            <TabsTrigger value="courses">My Courses</TabsTrigger>
            <TabsTrigger value="notes">Lecture Notes</TabsTrigger>
          </TabsList>

          {/* Courses Tab */}
          <TabsContent value="courses" className="space-y-6">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-3xl" style={{ fontFamily: "'Crimson Pro', serif" }}>My Courses</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Track your enrolled courses and progress
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link to="/course-catalog">Browse Courses</Link>
                </Button>
                <Button asChild>
                  <Link to="/add-course">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Course
                  </Link>
                </Button>
              </div>
            </div>

            {myCourses.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <GraduationCap className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">No courses yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Start learning by enrolling in your first course
                  </p>
                  <Button asChild>
                    <Link to="/course-catalog">Browse Course Catalog</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {pagedCourses.map((course) => {
                  const accent = getCategoryAccent(course.category);
                  return (
                    <div
                      key={course.id}
                      className="flex items-center gap-5 px-5 py-4 rounded-2xl bg-background border hover:bg-muted/30 transition-colors group"
                    >
                      {/* left color pill */}
                      <div
                        className={`w-1 self-stretch rounded-full bg-gradient-to-b ${accent.bar} shrink-0`}
                        style={{ minHeight: "2.5rem" }}
                      />

                      {/* title + meta */}
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full inline-block mb-1 ${accent.badge}`}>
                          {course.category}
                        </span>
                        <h3
                          className="leading-snug truncate"
                          style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.1rem", fontWeight: 600 }}
                        >
                          {course.title}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">{course.instructor}</p>
                      </div>

                      {/* progress track */}
                      <div className="hidden md:flex flex-col gap-1 w-52 shrink-0">
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${accent.bar} transition-all`}
                            style={{ width: `${course.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{course.progress}% complete</span>
                      </div>

                      {/* actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" asChild>
                          <Link to={`/course/${course.id}`} state={{ backLabel: "My Page" }}>
                            <Play className="w-3 h-3 mr-1.5" />
                            Continue
                          </Link>
                        </Button>
                        <button
                          className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Remove this course from your list?")) {
                              handleDeleteCourse(course.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalCoursePages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-sm text-muted-foreground">
                  {(coursePage - 1) * PAGE_SIZE + 1}–{Math.min(coursePage * PAGE_SIZE, myCourses.length)} / {myCourses.length}개
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={coursePage === 1}
                    onClick={() => setCoursePage((p) => p - 1)}
                  >
                    ←
                  </Button>
                  {Array.from({ length: totalCoursePages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={p === coursePage ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setCoursePage(p)}
                    >
                      {p}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={coursePage === totalCoursePages}
                    onClick={() => setCoursePage((p) => p + 1)}
                  >
                    →
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-6">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-3xl" style={{ fontFamily: "'Crimson Pro', serif" }}>Lecture Notes</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  All your notes in one place
                </p>
              </div>
              {!isCreatingNote && (
                <Button onClick={() => setIsCreatingNote(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Note
                </Button>
              )}
            </div>

            {isCreatingNote && (
              <Card className="mb-8 border-primary/20 shadow-sm">
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-lg" style={{ fontFamily: "'Crimson Pro', serif" }}>
                    Create New Note
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Title</label>
                      <Input
                        placeholder="Enter note title..."
                        value={newNote.title}
                        onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Course</label>
                      <Input
                        placeholder="e.g., CS101 - Introduction to Programming"
                        value={newNote.course}
                        onChange={(e) => setNewNote({ ...newNote, course: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <div className="flex gap-2 flex-wrap">
                      {["Lecture", "Reading", "Assignment", "Exam Prep"].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setNewNote({ ...newNote, category: cat })}
                          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                            newNote.category === cat
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-primary/40"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Content</label>
                    <Textarea
                      placeholder="Write your notes here..."
                      value={newNote.content}
                      onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                      className="min-h-[200px] font-mono"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleCreateNote}>Save Note</Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreatingNote(false);
                        setNewNote({ title: "", course: "", content: "", category: "Lecture" });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {myNotes.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">No notes yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Start taking notes to keep track of your learning
                  </p>
                  <Button onClick={() => setIsCreatingNote(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Note
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pagedNotes.map((note) => {
                  const catColor = NOTE_CATEGORY_COLORS[note.category] ?? "bg-muted text-muted-foreground";
                  const noteDate = new Date(note.date);
                  const month = noteDate.toLocaleDateString("en-US", { month: "short" });
                  const day = noteDate.getDate();
                  return (
                    <div
                      key={note.id}
                      className="flex gap-0 rounded-xl border bg-white overflow-hidden hover:shadow-sm transition-shadow group"
                    >
                      {/* date column */}
                      <div className="flex flex-col items-center justify-center px-5 py-4 bg-muted/40 border-r min-w-[64px] shrink-0">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">{month}</span>
                        <span className="text-2xl leading-none mt-0.5" style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 600 }}>
                          {day}
                        </span>
                      </div>

                      {/* content */}
                      <div className="flex-1 px-5 py-4 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium leading-snug">{note.title}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${catColor}`}>
                                {note.category}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">{note.course}</div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{note.content}</p>
                            {(note as any).tags?.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {(note as any).tags.map((t: string) => (
                                  <span key={t} className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">#{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to="/notes">
                                <Edit className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm("Delete this note?")) {
                                  handleDeleteNote(note.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalNotePages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-sm text-muted-foreground">
                  {(notePage - 1) * PAGE_SIZE + 1}–{Math.min(notePage * PAGE_SIZE, myNotes.length)} / {myNotes.length}개
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={notePage === 1}
                    onClick={() => setNotePage((p) => p - 1)}
                  >
                    ←
                  </Button>
                  {Array.from({ length: totalNotePages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={p === notePage ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setNotePage(p)}
                    >
                      {p}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={notePage === totalNotePages}
                    onClick={() => setNotePage((p) => p + 1)}
                  >
                    →
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
        </div>{/* end flex-1 */}
      </section>
    </div>
  );
}
