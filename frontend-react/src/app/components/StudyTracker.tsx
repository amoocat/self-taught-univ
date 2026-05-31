import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { Flame, Trophy, BookOpen, Clock, Zap, Target, CheckCircle2, TrendingUp } from "lucide-react";

interface Stats {
  streak: number;
  longest_streak: number;
  total_lectures: number;
  total_minutes: number;
  this_week: number;
  today: number;
  recent: { lecture_title: string; course_title: string; completed_at: string; duration_sec: number }[];
}

// 주간 목표 (하드코딩, 나중에 설정 가능하게)
const WEEKLY_GOAL = 5;

function fmtTime(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

// 원형 진도 링
function RingProgress({ value, max, size = 64, color = "#22c55e", label }: {
  value: number; max: number; size?: number; color?: string; label: string;
}) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / Math.max(max, 1), 1);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
          strokeWidth={6} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          fontSize={size * 0.22} fontWeight="700" fill="#1e293b"
          style={{ transform: "rotate(90deg)", transformOrigin: `${size/2}px ${size/2}px` }}>
          {value}
        </text>
      </svg>
      <span className="text-[10px] text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
}

export function StudyTracker() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStudyStats().then((data: any) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-48 bg-muted/30 rounded-xl animate-pulse" />;
  }

  if (!stats) return null;

  const weeklyPct = Math.min((stats.this_week / WEEKLY_GOAL) * 100, 100);

  return (
    <div className="space-y-4">

      {/* ── 상단: 핵심 지표 4개 ── */}
      <div className="grid grid-cols-4 gap-3">

        {/* 연속 학습일 — 강조 */}
        <div className="col-span-1 rounded-xl border bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100 p-4 flex flex-col items-center justify-center gap-1">
          <Flame className="w-6 h-6 text-orange-500" />
          <div className="text-3xl font-bold text-orange-600" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            {stats.streak}
          </div>
          <div className="text-xs text-orange-500 font-medium text-center">연속 학습일</div>
          {stats.streak > 0 && (
            <div className="text-[10px] text-orange-400">계속 유지 중!</div>
          )}
        </div>

        {/* 최장 연속 */}
        <div className="rounded-xl border bg-card p-4 flex flex-col items-center justify-center gap-1">
          <Trophy className="w-5 h-5 text-amber-500" />
          <div className="text-2xl font-bold" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            {stats.longest_streak}
          </div>
          <div className="text-[11px] text-muted-foreground text-center">최장 연속</div>
        </div>

        {/* 총 완료 강의 */}
        <div className="rounded-xl border bg-card p-4 flex flex-col items-center justify-center gap-1">
          <BookOpen className="w-5 h-5 text-primary" />
          <div className="text-2xl font-bold" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            {stats.total_lectures}
          </div>
          <div className="text-[11px] text-muted-foreground text-center">총 완료 강의</div>
        </div>

        {/* 총 학습 시간 */}
        <div className="rounded-xl border bg-card p-4 flex flex-col items-center justify-center gap-1">
          <Clock className="w-5 h-5 text-blue-500" />
          <div className="text-2xl font-bold" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            {stats.total_minutes >= 60 ? `${Math.floor(stats.total_minutes / 60)}h` : `${stats.total_minutes}m`}
          </div>
          <div className="text-[11px] text-muted-foreground text-center">총 학습 시간</div>
        </div>
      </div>

      {/* ── 하단: 주간 목표 + 최근 활동 ── */}
      <div className="grid grid-cols-5 gap-3">

        {/* 주간 목표 */}
        <div className="col-span-2 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">주간 목표</span>
          </div>

          <div className="flex items-center justify-around">
            <RingProgress
              value={stats.this_week}
              max={WEEKLY_GOAL}
              size={72}
              color={weeklyPct >= 100 ? "#22c55e" : "#6366f1"}
              label="이번 주"
            />
            <div className="space-y-3 flex-1 ml-4">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>이번 주</span>
                  <span className="font-medium text-foreground">{stats.this_week} / {WEEKLY_GOAL}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${weeklyPct}%`, background: weeklyPct >= 100 ? "#22c55e" : "#6366f1" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>오늘</span>
                  <span className="font-medium text-foreground">{stats.today}개</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min((stats.today / 3) * 100, 100)}%` }} />
                </div>
              </div>
              {weeklyPct >= 100 && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  이번 주 목표 달성!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 최근 활동 */}
        <div className="col-span-3 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">최근 학습</span>
          </div>

          {stats.recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
              <Zap className="w-6 h-6 mb-1 opacity-30" />
              <span className="text-xs">아직 완료한 강의가 없어요</span>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recent.map((r, i) => (
                <div key={i} className="flex items-start gap-3 py-1.5 border-b border-muted/60 last:border-0">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{r.lecture_title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{r.course_title}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10px] text-muted-foreground">{fmtDate(r.completed_at)}</div>
                    {r.duration_sec > 0 && (
                      <div className="text-[10px] text-muted-foreground">{fmtTime(Math.round(r.duration_sec / 60))}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
