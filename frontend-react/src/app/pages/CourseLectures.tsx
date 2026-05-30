import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  User,
  Award
} from "lucide-react";
import { api } from "../../lib/api";

interface Lecture {
  id: string;
  title: string;
  description: string;
  duration: string;
  duration_sec?: number;
  videoUrl: string;
  youtube_url?: string;
  completed: boolean;
  is_completed?: boolean;
  number?: number;
  module_name?: string;
  difficulty?: number;
  keywords: string[];
  tags?: string[];
}

interface Course {
  id: string;
  title: string;
  instructor: string;
  category: string;
  progress: number;
  description?: string;
}

function fmtDuration(sec?: number): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

export function CourseLectures() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    Promise.all([api.getCourse(courseId), api.getLectures(courseId)])
      .then(([c, lecs]: [any, any[]]) => {
        setCourse({
          id: c.id,
          title: c.title,
          instructor: "Self-Taught University",
          category: c.category,
          description: c.description ?? "",
          progress: 0,
        });
        setLectures(lecs.map((l: any) => ({
          id: l.id,
          title: l.title,
          description: l.subtitle ?? "",
          duration: fmtDuration(l.duration_sec),
          duration_sec: l.duration_sec,
          videoUrl: l.youtube_url ?? "",
          youtube_url: l.youtube_url,
          completed: l.is_completed ?? false,
          is_completed: l.is_completed,
          number: l.number,
          module_name: l.module_name,
          difficulty: l.difficulty,
          keywords: l.tags ?? [],
          tags: l.tags ?? [],
        })));
      })
      .catch(() => {
        // localStorage 폴백 (YouTube import 플로우)
        const savedCourses = localStorage.getItem("myCourses");
        if (savedCourses) {
          const courses = JSON.parse(savedCourses);
          const c = courses.find((c: any) => c.id === courseId);
          if (c) setCourse({ ...c, instructor: c.instructor ?? "Self-Taught University" });
        }
        const savedLectures = localStorage.getItem(`lectures-${courseId}`);
        if (savedLectures) {
          setLectures(JSON.parse(savedLectures).map((l: any) => ({
            ...l, completed: l.completed ?? false, keywords: l.keywords ?? [],
          })));
        }
      })
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">불러오는 중...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Course not found</h2>
          <Button onClick={() => navigate("/my-page")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Page
          </Button>
        </div>
      </div>
    );
  }

  const completedLectures = lectures.filter(l => l.completed || l.is_completed).length;
  const totalDurationSec = lectures.reduce((sum, l) => sum + (l.duration_sec ?? 0), 0);
  const hours = Math.floor(totalDurationSec / 3600);
  const minutes = Math.floor((totalDurationSec % 3600) / 60);
  const progressPct = lectures.length > 0 ? Math.round((completedLectures / lectures.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-gradient-to-b from-primary/10 to-background py-12 border-b">
        <div className="max-w-7xl mx-auto px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/my-page")}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Page
          </Button>

          <div className="grid md:grid-cols-[2fr_1fr] gap-8">
            <div>
              <div className="inline-block mb-4 px-4 py-2 bg-primary/10 rounded" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
                COURSE_CONTENT.EXE
              </div>
              <h1 className="text-4xl font-bold mb-4" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
                {course.title}
              </h1>
              <div className="flex items-center gap-4 text-muted-foreground mb-6">
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {course.instructor}
                </span>
                <Badge variant="secondary">{course.category}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-background/50 rounded-lg p-4 border">
                  <div className="text-2xl font-bold mb-1">{lectures.length}</div>
                  <div className="text-sm text-muted-foreground">Lectures</div>
                </div>
                <div className="bg-background/50 rounded-lg p-4 border">
                  <div className="text-2xl font-bold mb-1">
                    {hours}h {minutes}m
                  </div>
                  <div className="text-sm text-muted-foreground">Total Duration</div>
                </div>
                <div className="bg-background/50 rounded-lg p-4 border">
                  <div className="text-2xl font-bold mb-1">{completedLectures}/{lectures.length}</div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Your Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Overall Progress</span>
                    <span className="text-sm font-medium">{progressPct}%</span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                </div>
                <div className="pt-4 border-t">
                  <Button className="w-full" asChild>
                    <Link to={`/course/${course.id}/lecture/3`}>
                      <Play className="w-4 h-4 mr-2" />
                      Continue Learning
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Lecture List */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            Course Content
          </h2>
          <p className="text-muted-foreground">
            {lectures.length}개 강의 · 모듈별로 정리되어 있습니다
          </p>
        </div>

        {(() => {
          // module_name으로 그룹핑
          const groups: { moduleName: string; lectures: Lecture[] }[] = [];
          for (const lec of lectures) {
            const name = lec.module_name || "기타";
            const existing = groups.find(g => g.moduleName === name);
            if (existing) existing.lectures.push(lec);
            else groups.push({ moduleName: name, lectures: [lec] });
          }

          return (
            <div className="space-y-8">
              {groups.map((group, gi) => {
                const groupCompleted = group.lectures.filter(l => l.completed || l.is_completed).length;
                const groupPct = group.lectures.length > 0
                  ? Math.round((groupCompleted / group.lectures.length) * 100) : 0;
                return (
                  <div key={gi}>
                    {/* 모듈 헤더 */}
                    <div className="flex items-center gap-3 mb-3 pb-2 border-b">
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
                        {gi + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base">{group.moduleName}</h3>
                        <p className="text-xs text-muted-foreground">
                          {group.lectures.length}강 · {groupCompleted} 완료 ({groupPct}%)
                        </p>
                      </div>
                      <Progress value={groupPct} className="h-1.5 w-24 flex-shrink-0" />
                    </div>

                    {/* 강의 목록 */}
                    <div className="space-y-2 pl-4">
                      {group.lectures.map((lecture, idx) => (
                        <Card
                          key={lecture.id}
                          className="hover:shadow-md transition-all cursor-pointer group"
                          onClick={() => navigate(`/course/${course!.id}/lecture/${lecture.id}`)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <div className="flex-shrink-0 w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                                {lecture.completed || lecture.is_completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-primary" />
                                ) : (
                                  <span className="text-sm font-bold text-primary">
                                    {lecture.number ?? idx + 1}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                                  {lecture.title}
                                </h4>
                                {lecture.description && (
                                  <p className="text-xs text-muted-foreground truncate">{lecture.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                {lecture.duration !== "—" && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {lecture.duration}
                                  </span>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                                >
                                  <Play className="w-3 h-3 mr-1" />
                                  {lecture.completed || lecture.is_completed ? "복습" : "시작"}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </section>
    </div>
  );
}
