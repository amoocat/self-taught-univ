import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { CheckCircle, BookOpen, Brain, Wifi } from "lucide-react";

export function Admissions() {
  const steps = [
    {
      num: "01",
      title: "커리큘럼 탐색",
      desc: "개설 과목을 둘러보고 어떤 순서로 공부할지 계획을 세웁니다.",
      link: "/course-catalog",
      label: "Course Catalog →",
    },
    {
      num: "02",
      title: "첫 강의 수강",
      desc: "선형대수학 Lecture 01부터 시작합니다. 렉쳐 노트와 함께 시청하세요.",
      link: "/academics",
      label: "Academics →",
    },
    {
      num: "03",
      title: "노트 & 논문",
      desc: "배운 내용을 내 노트에 정리하고, 논문 아카이브로 깊이를 더합니다.",
      link: "/notes",
      label: "Lecture Notes →",
    },
    {
      num: "04",
      title: "자기 검증",
      desc: "지식 그래프로 개념 연결을 확인하고, 취약점을 파악합니다.",
      link: "/knowledge-graph",
      label: "Knowledge Graph →",
    },
  ];

  const requirements = [
    { icon: <Brain className="w-6 h-6" />, title: "배우고자 하는 의지", desc: "학력, 나이, 배경 무관. 스스로 배우겠다는 결심 하나로 충분합니다." },
    { icon: <Wifi className="w-6 h-6" />, title: "인터넷 접속 환경", desc: "YouTube, arXiv, GitHub에 접근 가능한 디바이스와 인터넷 연결." },
    { icon: <BookOpen className="w-6 h-6" />, title: "기초 수학 지식", desc: "미적분, 선형대수, 확률의 기초. 부족하면 커리큘럼이 함께 채워줍니다." },
  ];

  const subjects = [
    { code: "MATH", title: "선형대수학", desc: "MIT 18.06 기반" },
    { code: "STAT", title: "확률·통계", desc: "Stanford CS109 기반" },
    { code: "ML", title: "머신러닝", desc: "Stanford CS229 기반" },
    { code: "DL", title: "딥러닝", desc: "deeplearning.ai 기반" },
    { code: "CV", title: "컴퓨터 비전", desc: "Stanford CS231n 기반" },
    { code: "NLP", title: "자연어 처리", desc: "Stanford CS224n 기반" },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-primary/10 to-background py-6 border-b">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            Admissions
          </h1>
          <p className="text-sm text-muted-foreground">Self-Taught University · No tuition, no barriers — knowledge is yours to build.</p>
        </div>
      </section>

      {/* Tuition Banner */}
      <section className="bg-primary text-primary-foreground py-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-6 flex-wrap">
          <div>
            <div className="text-xs tracking-widest opacity-70 mb-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>TUITION</div>
            <div className="text-5xl font-bold" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>₩ 0</div>
            <div className="text-sm opacity-80 mt-1">완전 무료 · 평생 수강 가능</div>
          </div>
          <div className="flex gap-4">
            <Button size="lg" variant="secondary" className="h-12 px-8" asChild>
              <Link to="/course-catalog">과목 둘러보기</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary" asChild>
              <Link to="/academics">지금 시작하기</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="py-20 border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs tracking-widest text-muted-foreground mb-3" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            REQUIREMENTS
          </div>
          <h2 className="text-4xl font-bold mb-12" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            입학 자격
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {requirements.map((r) => (
              <div key={r.title} className="flex gap-5">
                <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center text-primary flex-shrink-0">
                  {r.icon}
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>{r.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20 bg-muted/20 border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs tracking-widest text-muted-foreground mb-3" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            HOW_TO_ENROLL.EXE
          </div>
          <h2 className="text-4xl font-bold mb-12" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            입학 절차
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div key={s.num} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-full w-full h-px bg-border z-0" style={{ width: "calc(100% - 2rem)" }} />
                )}
                <div className="relative z-10">
                  <div className="text-4xl font-bold text-primary/20 mb-4" style={{ fontFamily: "'VT323', monospace" }}>{s.num}</div>
                  <h3 className="font-bold text-lg mb-2" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>{s.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{s.desc}</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={s.link}>{s.label}</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subjects */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs tracking-widest text-muted-foreground mb-3" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            CURRICULUM
          </div>
          <h2 className="text-4xl font-bold mb-12" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            개설 과목
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {subjects.map((s) => (
              <div key={s.code} className="border rounded p-5 flex items-start gap-4 hover:border-primary transition-colors">
                <span className="text-xs font-bold px-2 py-1 bg-primary/10 text-primary rounded" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}>
                  {s.code}
                </span>
                <div>
                  <div className="font-bold mb-1" style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: "17px" }}>{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
                <CheckCircle className="w-4 h-4 text-primary ml-auto mt-1 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
