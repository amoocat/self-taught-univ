import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, ExternalLink, Sparkles, Send, Loader2 } from "lucide-react";
import { api, streamSSE } from "../../lib/api";

interface Annotation { id: string; keyword: string; explanation: string }
interface Paper {
  id: string; title: string; authors: string[]; abstract: string;
  date: string; category: string; url: string; citations: number;
}

const GRADIENTS = [
  "from-pink-200 via-rose-100 to-sky-100",
  "from-violet-200 via-purple-100 to-pink-100",
  "from-lime-200 via-green-100 to-sky-100",
  "from-sky-200 via-blue-100 to-violet-100",
  "from-amber-200 via-yellow-100 to-lime-100",
];

function hashIndex(id: string, len: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return h % len;
}

export function PaperDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { paperId } = useParams();
  const paper: Paper | undefined = (location.state as any)?.paper;

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotating, setAnnotating] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<{ role: "user"|"ai"; text: string }[]>([
    { role: "ai", text: "이 논문에 대해 궁금한 점을 질문해보세요!" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  async function generateAnnotations() {
    if (!paperId || annotating) return;
    setAnnotating(true);
    try {
      const data = await api.annotatePaper(paperId);
      setAnnotations(data as Annotation[]);
    } catch {
      alert("주석 생성에 실패했습니다.");
    } finally {
      setAnnotating(false);
    }
  }

  async function sendChat() {
    const message = chatInput.trim();
    if (!message || chatStreaming || !paperId) return;
    setChatInput("");
    setChatMsgs(prev => [...prev, { role: "user", text: message }]);
    setChatStreaming(true);
    const history = chatMsgs.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
    abortRef.current = new AbortController();
    setChatMsgs(prev => [...prev, { role: "ai", text: "" }]);
    try {
      await streamSSE(
        `/chat/paper/${paperId}/stream`,
        { mode: "study", subject: paper?.title ?? "", message, history },
        (chunk) => setChatMsgs(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: "ai", text: next[next.length - 1].text + chunk };
          return next;
        }),
        abortRef.current.signal,
      );
    } catch {
      setChatMsgs(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: "ai", text: "⚠️ 오류가 발생했습니다." };
        return next;
      });
    } finally {
      setChatStreaming(false);
    }
  }

  if (!paper) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">논문 정보를 불러올 수 없습니다.</p>
          <button onClick={() => navigate("/research")} className="text-sm underline text-primary">
            Research 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const grad = GRADIENTS[hashIndex(paper.id, GRADIENTS.length)];
  const abstractParagraphs = paper.abstract
    ? paper.abstract.split(/\n+/).filter(Boolean)
    : ["초록 정보가 없습니다."];

  return (
    <div className="min-h-screen bg-background flex gap-0">

      {/* 메인 논문 뷰 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 pt-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Research
          </button>
        </div>

        <article className="max-w-2xl mx-auto px-6 py-10">
          {paper.date && (
            <p className="text-center text-sm text-muted-foreground mb-6">{paper.date}</p>
          )}
          <h1 className="text-4xl md:text-5xl font-bold leading-tight text-center mb-6"
            style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            {paper.title}
          </h1>
          {paper.authors.length > 0 && (
            <p className="text-center text-sm text-muted-foreground mb-10">
              {paper.authors.join(", ")}
            </p>
          )}
          <div className={`w-full aspect-[16/7] rounded-2xl bg-gradient-to-br ${grad} mb-14`} />

          {/* Abstract */}
          <section className="space-y-4 mb-10">
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>Abstract</h2>
            {abstractParagraphs.map((para, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground">{para}</p>
            ))}
          </section>

          {/* Venue */}
          {paper.category && (
            <section className="mb-10 space-y-2">
              <h2 className="text-xl font-bold" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>Venue</h2>
              <p className="text-sm text-muted-foreground">{paper.category}</p>
            </section>
          )}

          {/* Read full paper */}
          {paper.url && paper.url !== "#" && (
            <div className="flex justify-center">
              <a href={paper.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-80 transition-opacity">
                Read Full Paper <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </article>
      </div>

      {/* 우측 패널: 주석 + 챗 */}
      <div className="w-80 border-l flex flex-col sticky top-0 h-screen overflow-hidden flex-shrink-0">

        {/* 주석 패널 */}
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 flex-shrink-0">
            <span className="text-sm font-semibold">AI 키워드 주석</span>
            <button
              onClick={generateAnnotations}
              disabled={annotating}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {annotating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {annotating ? "생성 중..." : "주석 생성"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {annotations.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                주석 생성 버튼을 눌러<br />핵심 키워드 해설을 확인하세요.
              </div>
            ) : (
              annotations.map((a) => (
                <div key={a.id} className="border rounded-lg p-3 bg-background hover:border-primary/40 transition-colors">
                  <div className="text-xs font-bold text-primary mb-1 uppercase tracking-wide">{a.keyword}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{a.explanation}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 논문 Q&A 챗 */}
        <div className="flex flex-col border-t" style={{ height: 280 }}>
          <div className="px-4 py-2.5 border-b bg-muted/30 flex-shrink-0">
            <span className="text-sm font-semibold">논문 Q&A</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
            {chatMsgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  {m.text}
                  {m.role === "ai" && m.text === "" && <span className="inline-block w-1 h-3 bg-foreground/40 animate-pulse ml-0.5" />}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="flex border-t flex-shrink-0">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendChat()}
              placeholder="논문에 대해 질문하세요..."
              disabled={chatStreaming}
              className="flex-1 px-3 py-2.5 text-xs bg-transparent outline-none disabled:opacity-50"
            />
            <button onClick={sendChat} disabled={!chatInput.trim() || chatStreaming} className="px-3 text-primary disabled:opacity-30">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
