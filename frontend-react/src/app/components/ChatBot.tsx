import { useState, useRef, useEffect } from "react";
import { streamSSE } from "../../lib/api";
import { X, RotateCcw, Send, MessageSquare } from "lucide-react";

interface Msg { role: "user" | "ai"; text: string }

const SUBJECTS = ["선형대수학", "확률·통계", "머신러닝", "딥러닝", "컴퓨터 비전", "NLP"];

const CHIPS = {
  study: ["고유값이 뭔지 설명해줘", "경사하강법을 직관적으로 설명해줘", "Attention 메커니즘이 뭐야?", "역전파 수식 유도해줘"],
  test:  ["선형대수 문제 내줘", "확률 문제 내줘", "머신러닝 개념 테스트", "딥러닝 퀴즈"],
};

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"study" | "test">("study");
  const [subject, setSubject] = useState("선형대수학");
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "ai", text: "안녕하세요! 오늘 어떤 개념을 공부할까요?\n현재 **선형대수학 Lecture 03**까지 진행했어요." },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || streaming) return;
    setInput("");
    setMsgs(prev => [...prev, { role: "user", text: message }]);
    setStreaming(true);

    const history = msgs.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
    abortRef.current = new AbortController();

    setMsgs(prev => [...prev, { role: "ai", text: "" }]);
    try {
      await streamSSE(
        "/chat/stream",
        { mode, subject, message, history },
        (chunk) => setMsgs(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: "ai", text: next[next.length - 1].text + chunk };
          return next;
        }),
        abortRef.current.signal,
      );
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setMsgs(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: "ai", text: "⚠️ 응답 오류가 발생했습니다." };
          return next;
        });
      }
    } finally {
      setStreaming(false);
    }
  }

  function clear() {
    abortRef.current?.abort();
    setMsgs([{ role: "ai", text: "대화를 초기화했습니다. 무엇을 도와드릴까요?" }]);
    setStreaming(false);
  }

  function switchMode(m: "study" | "test") {
    setMode(m);
    setMsgs([{
      role: "ai",
      text: m === "study"
        ? "학습 모드입니다. 궁금한 개념을 질문해보세요!"
        : "테스트 모드입니다. 문제를 출제해드릴게요. 준비됐나요?",
    }]);
  }

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-6 py-3 rounded-full bg-primary text-primary-foreground shadow-xl hover:bg-primary/90 transition-all hover:scale-105 hover:shadow-2xl"
      >
        {open ? <X className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
        <span className="text-sm font-semibold tracking-wide">AI 학습봇</span>
        {!open && (
          <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">1</span>
        )}
      </button>

      {/* 챗봇 윈도우 */}
      {open && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[400px] flex flex-col rounded-xl border shadow-2xl bg-background overflow-hidden"
          style={{ height: 540 }}>

          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">★</span>
              <span className="font-semibold text-sm">AI 학습봇</span>
            </div>
            <div className="flex items-center gap-2">
              {/* 모드 탭 */}
              <div className="flex text-xs rounded overflow-hidden border border-primary-foreground/30">
                <button
                  onClick={() => switchMode("study")}
                  className={`px-3 py-1 transition-colors ${mode === "study" ? "bg-primary-foreground text-primary font-bold" : "hover:bg-primary-foreground/10"}`}
                >학습</button>
                <button
                  onClick={() => switchMode("test")}
                  className={`px-3 py-1 transition-colors ${mode === "test" ? "bg-primary-foreground text-primary font-bold" : "hover:bg-primary-foreground/10"}`}
                >테스트</button>
              </div>
              <button onClick={clear} className="opacity-60 hover:opacity-100"><RotateCcw className="w-4 h-4" /></button>
              <button onClick={() => setOpen(false)} className="opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
            </div>
          </div>

          {/* 컨텍스트 바 */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b flex-shrink-0">
            <span className="text-xs text-muted-foreground">과목</span>
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="text-xs bg-transparent font-medium text-foreground outline-none cursor-pointer"
            >
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "ai" && (
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold mr-2 flex-shrink-0 mt-0.5">AI</div>
                )}
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-muted rounded-bl-none"
                }`}>
                  {m.text}
                  {m.role === "ai" && m.text === "" && (
                    <span className="inline-block w-1.5 h-4 bg-foreground/40 animate-pulse ml-0.5" />
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* 추천 칩 */}
          <div className="px-3 pb-1 flex gap-1.5 flex-wrap flex-shrink-0">
            {CHIPS[mode].map(c => (
              <button
                key={c}
                onClick={() => send(c)}
                disabled={streaming}
                className="text-[11px] px-2.5 py-1 border rounded-full hover:bg-muted transition-colors disabled:opacity-40"
              >{c}</button>
            ))}
          </div>

          {/* 입력창 */}
          <div className="flex border-t flex-shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="질문을 입력하세요..."
              disabled={streaming}
              className="flex-1 px-4 py-3 text-sm bg-transparent outline-none disabled:opacity-50"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || streaming}
              className="px-4 text-primary hover:text-primary/80 disabled:opacity-30 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
