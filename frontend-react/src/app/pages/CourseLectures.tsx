import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Play, CheckCircle2, Clock, Youtube } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { api } from "../../lib/api";

interface Lecture {
  id: string;
  title: string;
  subtitle?: string;
  number: number;
  duration: string;
  duration_sec?: number;
  youtube_url?: string;
  completed: boolean;
  module_name?: string;
  difficulty?: number;
}

interface Course {
  id: string;
  title: string;
  category: string;
  source: string;
  lecture_count: number;
  completed_count: number;
  progress_pct: number;
  description?: string;
}

const DEPTH_COLORS = [
  { dot: "#6366f1", bar: "#eef2ff", text: "#6366f1", border: "#c7d2fe" },
  { dot: "#6ee7b7", bar: "#f0fdf4", text: "#059669", border: "#bbf7d0" },
  { dot: "#f59e0b", bar: "#fffbeb", text: "#d97706", border: "#fde68a" },
  { dot: "#ef4444", bar: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  { dot: "#8b5cf6", bar: "#f5f3ff", text: "#7c3aed", border: "#ddd6fe" },
  { dot: "#0ea5e9", bar: "#f0f9ff", text: "#0284c7", border: "#bae6fd" },
  { dot: "#ec4899", bar: "#fdf2f8", text: "#db2777", border: "#fbcfe8" },
];
const getColor = (i: number) => DEPTH_COLORS[i % DEPTH_COLORS.length];

function fmtDuration(sec?: number): string {
  if (!sec) return "";
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
        setCourse(c);
        setLectures(lecs.map((l: any) => ({
          id: l.id,
          title: l.title,
          subtitle: l.subtitle,
          number: l.number,
          duration: fmtDuration(l.duration_sec),
          duration_sec: l.duration_sec,
          youtube_url: l.youtube_url,
          completed: l.completed ?? false,
          module_name: l.module_name,
          difficulty: l.difficulty,
        })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">불러오는 중...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">강좌를 찾을 수 없습니다</h2>
          <button onClick={() => navigate("/course-catalog")} className="text-sm text-primary underline">
            카탈로그로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // module_name 기준으로 그룹핑
  const groups: { name: string; lectures: Lecture[] }[] = [];
  for (const lec of lectures) {
    const name = lec.module_name || "기타";
    const existing = groups.find(g => g.name === name);
    if (existing) existing.lectures.push(lec);
    else groups.push({ name, lectures: [lec] });
  }

  const completedCount = lectures.filter(l => l.completed).length;
  const progressPct = lectures.length > 0 ? Math.round((completedCount / lectures.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <div className="border-b bg-background px-8 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> 카탈로그
          </button>
          <div>
            <h1 className="font-bold text-lg leading-tight" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
              {course.title}
            </h1>
            <p className="text-xs text-muted-foreground">{course.source}</p>
          </div>
          <Badge variant="secondary" className="text-xs">{course.category.toUpperCase()}</Badge>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-1">
              {completedCount} / {lectures.length}강 완료
            </p>
            <Progress value={progressPct} className="h-1.5 w-32" />
          </div>
        </div>
      </div>

      {/* 모듈 가로 스크롤 뷰 */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <div className="flex items-start gap-0 px-10 py-10" style={{ width: "max-content", minHeight: "100%" }}>
          {groups.length === 0 ? (
            <div className="text-sm text-muted-foreground py-20 px-10">
              강의가 없거나 모듈이 배정되지 않았습니다.
            </div>
          ) : groups.map((group, gi) => {
            const c = getColor(gi);
            const isLast = gi === groups.length - 1;
            const groupDone = group.lectures.filter(l => l.completed).length;
            const groupPct = group.lectures.length > 0
              ? Math.round((groupDone / group.lectures.length) * 100) : 0;

            return (
              <div key={gi} className="flex items-start">
                <div className="flex flex-col gap-3" style={{ width: 220 }}>
                  {/* 모듈 헤더 */}
                  <div className="flex flex-col gap-0.5 px-1">
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: c.text }}>
                      Module {gi + 1}
                    </span>
                    <span className="text-sm font-bold text-foreground">{group.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {group.lectures.length}강 · {groupDone} 완료
                    </span>
                    <Progress value={groupPct} className="h-1 mt-1" />
                  </div>

                  {/* 모듈 연결 도트 */}
                  <div className="px-1">
                    <div className="w-3 h-3 rounded-full border-2 border-background shadow-sm"
                      style={{ background: c.dot }} />
                  </div>

                  {/* 강의 카드 목록 */}
                  <div className="flex flex-col gap-2">
                    {group.lectures.map((lec, idx) => (
                      <div
                        key={lec.id}
                        onClick={() => navigate(`/course/${courseId}/lecture/${lec.id}`)}
                        className="group relative rounded-xl p-3 border cursor-pointer transition-all hover:shadow-md"
                        style={{ background: c.bar, borderColor: c.border }}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-xs mt-0.5 flex-shrink-0 font-medium w-5 text-center"
                            style={{ color: c.text }}>
                            {lec.completed
                              ? <CheckCircle2 size={12} className="inline" style={{ color: c.dot }} />
                              : idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 leading-snug line-clamp-3">
                              {lec.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {lec.duration && (
                                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                  <Clock size={9} />{lec.duration}
                                </span>
                              )}
                              {lec.youtube_url && (
                                <Youtube size={9} className="text-red-400 flex-shrink-0" />
                              )}
                            </div>
                          </div>
                          <Play
                            size={11}
                            className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: c.text }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 모듈 간 연결선 */}
                {!isLast && (
                  <div className="flex items-center self-start mt-[60px] mx-2 flex-shrink-0">
                    <div className="w-6 h-px bg-border" />
                    <div className="w-0 h-0" style={{
                      borderTop: "4px solid transparent",
                      borderBottom: "4px solid transparent",
                      borderLeft: "5px solid hsl(var(--border))",
                    }} />
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
