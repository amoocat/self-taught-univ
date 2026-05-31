import { useState, useEffect } from "react";
import { api } from "../../lib/api";

interface DayData { date: string; count: number }

const LEVELS = [
  "bg-gray-100",
  "bg-emerald-200",
  "bg-emerald-400",
  "bg-emerald-600",
  "bg-emerald-800",
];

function getLevel(count: number) {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function buildGrid(): { date: string; count: number }[] {
  const today = new Date();
  const cells: { date: string; count: number }[] = [];
  // 53주치 (371일), 오늘 기준 과거로
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ date: key, count: 0 });
  }
  return cells;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["Mon","","Wed","","Fri","",""];

export function StudyHeatmap() {
  const [grid, setGrid] = useState<{ date: string; count: number }[]>(buildGrid());
  const [total, setTotal] = useState(0);
  const [tooltip, setTooltip] = useState<{ date: string; count: number; x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getHeatmap().then((data: any) => {
      const map: Record<string, number> = {};
      let t = 0;
      for (const { date, count } of (data.heatmap ?? [])) {
        map[date] = count;
        t += count;
      }
      setTotal(t);
      setGrid(prev => prev.map(cell => ({ ...cell, count: map[cell.date] ?? 0 })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // 53열(주) × 7행(요일) 그리드로 변환
  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < grid.length; i += 7) {
    weeks.push(grid.slice(i, i + 7));
  }

  // 월 라벨 위치 계산
  const monthLabels: { label: string; col: number }[] = [];
  weeks.forEach((week, wi) => {
    const firstDay = week[0]?.date;
    if (!firstDay) return;
    const d = new Date(firstDay);
    if (d.getDate() <= 7) {
      monthLabels.push({ label: MONTHS[d.getMonth()], col: wi });
    }
  });

  if (loading) {
    return <div className="h-28 bg-muted/30 rounded animate-pulse" />;
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">공부 기록</span>
        <span className="text-xs text-muted-foreground">{total}개 강의 완료 · 최근 1년</span>
      </div>

      <div className="overflow-x-auto">
        <div style={{ display: "flex", gap: 2, flexDirection: "column", minWidth: "fit-content" }}>
          {/* 월 라벨 */}
          <div style={{ display: "flex", gap: 2, marginLeft: 28 }}>
            {weeks.map((_, wi) => {
              const label = monthLabels.find(m => m.col === wi);
              return (
                <div key={wi} style={{ width: 11, fontSize: 9, color: "#94a3b8", flexShrink: 0 }}>
                  {label?.label ?? ""}
                </div>
              );
            })}
          </div>

          {/* 요일 라벨 + 셀 */}
          <div style={{ display: "flex", gap: 0 }}>
            {/* 요일 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: 4 }}>
              {DAYS.map((d, i) => (
                <div key={i} style={{ width: 24, height: 11, fontSize: 9, color: "#94a3b8", display: "flex", alignItems: "center" }}>
                  {d}
                </div>
              ))}
            </div>

            {/* 주(열) */}
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: 2 }}>
                {week.map((cell) => (
                  <div
                    key={cell.date}
                    className={`rounded-sm transition-opacity hover:opacity-80 cursor-pointer ${LEVELS[getLevel(cell.count)]}`}
                    style={{ width: 11, height: 11, flexShrink: 0 }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({ ...cell, x: rect.left, y: rect.top });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-1.5 mt-2 justify-end">
        <span className="text-[10px] text-muted-foreground">Less</span>
        {LEVELS.map((cls, i) => (
          <div key={i} className={`w-2.5 h-2.5 rounded-sm ${cls}`} />
        ))}
        <span className="text-[10px] text-muted-foreground">More</span>
      </div>

      {/* 툴팁 */}
      {tooltip && (
        <div
          className="fixed z-50 bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 32 }}
        >
          {tooltip.count > 0
            ? `${tooltip.date} — ${tooltip.count}개 완료`
            : `${tooltip.date} — 학습 없음`}
        </div>
      )}
    </div>
  );
}
