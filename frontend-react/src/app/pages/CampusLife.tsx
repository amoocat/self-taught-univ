import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { ArrowRight } from "lucide-react";

export function CampusLife() {
  const essentials = [
    {
      title: "강의 수강",
      desc: "MIT, Stanford, 서울대 교수의 강의를 YouTube로. 렉쳐 노트와 함께 체계적으로.",
      link: "/academics",
      img: "https://images.unsplash.com/photo-1588072432836-e10032774350?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    },
    {
      title: "노트 & 논문",
      desc: "마크다운 에디터로 강의를 내 언어로 재구성. arXiv 최신 논문을 AI 주석과 함께.",
      link: "/notes",
      img: "https://images.unsplash.com/photo-1455390582262-044cdead277a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    },
    {
      title: "테크 블로그",
      desc: "Karpathy, Chip Huyen, 당근·토스·카카오 테크. 18개 채널의 최신 AI 동향.",
      link: "/research",
      img: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    },
    {
      title: "지식 그래프",
      desc: "선형대수 → Attention → Transformer → LLM. 내가 배운 개념이 어떻게 연결되는지.",
      link: "/knowledge-graph",
      img: "https://images.unsplash.com/photo-1545987796-200677ee1011?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    },
  ];

  const advantages = [
    {
      tag: "LECTURE LIBRARY",
      title: "세계 최고 강의실",
      desc: "MIT 18.06, Stanford CS229, CS231n, CS224n — 세계 최고 수준의 강의가 유튜브에 무료로 공개되어 있습니다. 수강료 없이, 원하는 속도로, 몇 번이든 반복해서.",
      cta: "커리큘럼 보기",
      link: "/course-catalog",
      img: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=900",
      reverse: false,
    },
    {
      tag: "RESEARCH ACCESS",
      title: "무제한 논문 아카이브",
      desc: "Transformer, GPT-3, ViT, Diffusion Model — 세상을 바꾼 AI 논문들이 arXiv에 무료로 공개되어 있습니다. AI 주석 기능으로 혼자서도 읽어낼 수 있습니다.",
      cta: "논문 아카이브",
      link: "/research",
      img: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=900",
      reverse: true,
    },
    {
      tag: "INDUSTRY CONNECTION",
      title: "현장의 언어를 배운다",
      desc: "Google, OpenAI, DeepMind의 연구 블로그와 당근·토스·카카오의 엔지니어링 블로그. 교과서 너머 실무에서 AI가 어떻게 살아 숨쉬는지 매일 팔로우합니다.",
      cta: "블로그 피드",
      link: "/research",
      img: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=900",
      reverse: false,
    },
    {
      tag: "AI LEARNING BOT",
      title: "나만의 튜터",
      desc: "막히는 개념은 AI 학습봇에게 질문하세요. 단계적 힌트로 스스로 생각하게 유도합니다. 테스트 모드로 정기적으로 이해도를 점검하고 취약점을 보완합니다.",
      cta: "학습봇 열기",
      link: "/academics",
      img: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=900",
      reverse: true,
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-primary/10 to-background py-6 border-b">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            Campus Life
          </h1>
          <p className="text-sm text-muted-foreground">Self-Taught University · My campus lives somewhere on the internet.</p>
        </div>
      </section>

      {/* Campus Life Essentials */}
      <section className="py-20 border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs tracking-widest text-muted-foreground mb-3" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            ESSENTIALS
          </div>
          <h2 className="text-4xl font-bold mb-12" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            Campus Life Essentials
          </h2>
          <div className="grid md:grid-cols-4 gap-0 border rounded overflow-hidden">
            {essentials.map((e, i) => (
              <Link
                key={e.title}
                to={e.link}
                className={`group flex flex-col hover:bg-muted/40 transition-colors ${i < essentials.length - 1 ? "border-r" : ""}`}
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={e.img} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-bold text-xl mb-3" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>{e.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-4">{e.desc}</p>
                  <span className="text-sm font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                    자세히 보기 <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Student Experience */}
      <section className="py-20 bg-muted/20 border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="text-xs tracking-widest text-muted-foreground mb-3" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                THE EXPERIENCE
              </div>
              <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
                나만의 학습 경험
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                STU의 학생은 단 한 명입니다. 그 한 명을 위해 설계된 커리큘럼, 도구, 환경.
                선형대수에서 시작해 LLM까지 — 모든 과목이 논리적으로 연결됩니다.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-8">
                렉쳐 노트로 강의를 정리하고, 내 노트로 진짜 이해를 기록하며, AI 학습봇으로 스스로를 테스트합니다.
                논문을 읽고, 테크 블로그로 현장의 언어를 배웁니다. 그리고 지식 그래프로 모든 개념이 어떻게 연결되는지 봅니다.
              </p>
              <Button asChild>
                <Link to="/academics">학습 시작하기 <ArrowRight className="w-4 h-4 ml-2" /></Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-square overflow-hidden rounded">
                <img
                  src="https://images.unsplash.com/photo-1587620962725-abab19836100?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600"
                  alt="코딩"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="aspect-square overflow-hidden rounded mt-8">
                <img
                  src="https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600"
                  alt="노트"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="aspect-square overflow-hidden rounded -mt-8">
                <img
                  src="https://images.unsplash.com/photo-1568667256549-094345857637?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600"
                  alt="독서"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="aspect-square overflow-hidden rounded">
                <img
                  src="https://images.unsplash.com/photo-1509228468518-180dd4864904?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600"
                  alt="수학"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Advantage Blocks (GT: "Our Atlanta Advantage" 패턴) */}
      <section className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 mb-4">
          <div className="text-xs tracking-widest text-muted-foreground mb-2" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            STU_ADVANTAGE
          </div>
          <h2 className="text-4xl font-bold" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            나만의 어드밴티지
          </h2>
        </div>
        {advantages.map((a) => (
          <div key={a.title} className={`border-t flex flex-col ${a.reverse ? "md:flex-row-reverse" : "md:flex-row"}`}>
            <div className="md:w-1/2 aspect-[16/9] md:aspect-auto overflow-hidden">
              <img src={a.img} alt={a.title} className="w-full h-full object-cover" />
            </div>
            <div className="md:w-1/2 flex items-center">
              <div className="p-10 md:p-16 max-w-lg">
                <div className="text-xs tracking-widest text-muted-foreground mb-4" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}>
                  {a.tag}
                </div>
                <h3 className="text-3xl font-bold mb-5" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>{a.title}</h3>
                <p className="text-muted-foreground leading-relaxed mb-6">{a.desc}</p>
                <Button variant="outline" asChild>
                  <Link to={a.link}>{a.cta} <ArrowRight className="w-4 h-4 ml-2" /></Link>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </section>

    </>
  );
}
