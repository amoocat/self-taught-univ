import { BookOpen, TrendingUp, GraduationCap, Globe, FileText, PenLine } from "lucide-react";
import { Link } from "react-router";

const STATUS_CARDS = [
  { icon: BookOpen,      label: "개설 과목",        value: "6개 과목",   sub: "선형대수 · 확률통계 · ML · DL · CV · NLP" },
  { icon: TrendingUp,    label: "전체 진도율",       value: "23%",        sub: "선형대수학 42% 선도 중" },
  { icon: GraduationCap, label: "참고 기관",         value: "4개 대학",   sub: "MIT · Stanford · 서울대 · KAIST" },
  { icon: FileText,      label: "논문 아카이브",     value: "5편",        sub: "Transformer · GPT-3 · ViT · DDPM · Llama 2" },
  { icon: Globe,         label: "테크 블로그 소스",  value: "17개 채널",  sub: "Karpathy · Chip Huyen · Google · 당근 외" },
  { icon: PenLine,       label: "내 공부 노트",      value: "3편",        sub: "계속 업데이트 중" },
];

const VISION = [
  { num: "I",   title: "이론의 내면화",       desc: "MIT·Stanford 강의를 단순히 보는 것에 그치지 않고, 수식을 직접 유도하고 코드로 구현하며 진짜 이해를 추구합니다." },
  { num: "II",  title: "최신 논문 독해력",    desc: "저명한 AI 논문을 AI 주석의 도움을 받아 스스로 읽고 요약하는 능력을 기릅니다. Transformer에서 시작해 최신 연구까지." },
  { num: "III", title: "현장 언어 습득",      desc: "빅테크와 국내 선도 기업의 테크 블로그를 통해 실무에서 AI가 어떻게 적용되는지 꾸준히 팔로우합니다." },
  { num: "IV",  title: "개념 연결 사고",      desc: "지식 그래프를 통해 선형대수 → Attention → Transformer → LLM으로 이어지는 개념의 연결 구조를 명확히 이해합니다." },
  { num: "V",   title: "자기 주도 검증",      desc: "AI 학습봇의 테스트 모드를 통해 스스로 얼마나 이해했는지 정기적으로 점검하고 취약 개념을 보완합니다." },
];

export function Academics() {
  return (
    <>
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-accent/30 to-background py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-block mb-6 px-4 py-2 bg-primary/10 rounded" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
              STU_ABOUT.EXE
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
              STU 소개
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Self-Taught University · Founded 2025
            </p>
          </div>
        </div>
      </section>

      {/* 설립자 인사말 */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-[1fr_200px] gap-16 items-start">
          <div>
            <div className="text-xs tracking-wider text-muted-foreground mb-4" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              [ FOUNDER'S GREETINGS ]
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-snug" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
              "돈이 없어도, 학교가 없어도<br />
              지식은 스스로 만들어가는 것이다."
            </h2>
            <div className="w-16 h-0.5 bg-primary mb-8" />

            <div className="space-y-5 text-muted-foreground leading-relaxed text-[15px]">
              <p>안녕하십니까.</p>
              <p>
                저는 인공지능 대학원에 진학하고 싶었습니다. 그러나 현실의 벽은 높았습니다. 등록금, 입시, 그리고 시간.
                하지만 저는 생각했습니다. <strong className="text-foreground">배움은 제도 안에만 있는 것이 아니다</strong>라고.
              </p>
              <p>
                Self-Taught University는 그런 믿음에서 시작되었습니다. 서울대, KAIST, MIT, Stanford의 강의가 유튜브에 있고,
                세계 최고의 연구자들이 블로그에 글을 씁니다. 최신 논문은 arXiv에 무료로 올라옵니다.{" "}
                <strong className="text-foreground">재료는 이미 모두 인터넷에 있습니다.</strong>
              </p>
              <p>
                부족한 것은 체계였습니다. 어떤 순서로 공부할 것인가, 어떻게 내 것으로 만들 것인가, 내가 진짜 이해했는지
                어떻게 확인할 것인가. STU는 바로 그 체계를 위해 만들어졌습니다.
              </p>
              <p>
                렉쳐 노트로 강의를 정리하고, 내 노트로 진짜 이해를 기록하며, AI 학습봇으로 스스로를 테스트합니다.
                논문을 읽고, 테크 블로그로 현장의 언어를 배웁니다. 그리고 지식 그래프로 모든 개념이 어떻게 연결되는지 봅니다.
              </p>
              <p>
                이것이 <strong className="text-foreground">나만의 대학원</strong>입니다. 학위는 없지만, 지식은 진짜입니다.
              </p>
            </div>

            <div className="mt-10 pt-8 border-t">
              <div className="text-xs text-muted-foreground mb-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>Self-Taught University 설립자</div>
              <div className="text-2xl font-bold mt-2" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>나, 직접</div>
              <div className="text-sm text-muted-foreground mt-1">Founder · Rector · Student · Class of 2025–</div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 pt-4">
            <div className="w-40 h-40 rounded-full bg-muted border flex items-center justify-center text-5xl">
              🎓
            </div>
            <div className="text-center">
              <div className="font-bold text-sm">설립자</div>
              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Founder & Rector<br />
                Self-Taught University<br />
                Est. 2025
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STU 현황 */}
      <section className="bg-muted/40 border-y py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-10 text-center">
            <div className="inline-block mb-4 px-4 py-2 bg-primary/10 rounded" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
              LOADING... STU_STATUS
            </div>
            <h2 className="text-4xl font-bold" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>STU 현황</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {STATUS_CARDS.map(({ icon: Icon, label, value, sub }) => (
              <div key={label} className="bg-background rounded-xl border p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <div className="text-2xl font-bold mb-1" style={{ fontFamily: "'VT323', monospace" }}>{value}</div>
                <div className="text-xs text-muted-foreground">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 학습 비전 5대 목표 */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="mb-12 text-center">
          <div className="inline-block mb-4 px-4 py-2 bg-primary/10 rounded" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
            {'>>>'} VISION
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            학습 비전 — 5대 목표
          </h2>
        </div>
        <div className="space-y-6 max-w-3xl mx-auto">
          {VISION.map(({ num, title, desc }) => (
            <div key={num} className="flex gap-6 p-6 rounded-xl border bg-background hover:border-primary/40 transition-colors">
              <div className="text-3xl font-bold text-primary/30 shrink-0 w-10 text-center" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
                {num}
              </div>
              <div>
                <div className="font-bold text-lg mb-1" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>{title}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            커리큘럼 둘러보기
          </h2>
          <p className="text-xl mb-10 opacity-95 leading-relaxed">
            어떤 과목이 개설되어 있는지, 어디까지 공부했는지 확인해보세요.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/course-catalog"
              className="inline-flex items-center justify-center h-12 px-8 rounded-md bg-primary-foreground text-primary font-medium text-sm hover:bg-primary-foreground/90 transition-colors"
            >
              강좌 카탈로그
            </Link>
            <Link
              to="/my-page"
              className="inline-flex items-center justify-center h-12 px-8 rounded-md border border-primary-foreground text-primary-foreground font-medium text-sm hover:bg-primary-foreground hover:text-primary transition-colors"
            >
              내 학습 현황
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
