import { useState, useRef, useEffect } from "react";
import { Outlet, Link, useNavigate } from "react-router";
import { Search, X } from "lucide-react";
import { ChatBot } from "../components/ChatBot";
import { api } from "../../lib/api";

interface SearchResult { type: string; id: string; title: string; subtitle?: string; category?: string; course_id?: string; preview?: string; arxiv_id?: string }

function NavSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try { const data: any = await api.search(q); setResults(data.results ?? []); }
      catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function go(r: SearchResult) {
    setOpen(false); setQ(""); setResults([]);
    if (r.type === "lecture" && r.course_id) navigate(`/course/${r.course_id}/lecture/${r.id}`);
    else if (r.type === "note") navigate("/notes");
    else if (r.type === "paper") navigate("/research");
  }

  const TYPE_LABEL: Record<string, string> = { lecture: "강의", note: "노트", paper: "논문" };

  return (
    <div className="relative">
      <button onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 border rounded-md hover:border-foreground/30">
        <Search className="w-3.5 h-3.5" />
        <span className="hidden md:inline w-32 text-left">검색...</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => { setOpen(false); setQ(""); setResults([]); }} />
          <div className="absolute right-0 top-0 z-50 w-80 bg-background border rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
                placeholder="강의, 노트, 논문 검색..."
                className="flex-1 text-sm outline-none bg-transparent" />
              {q && <button onClick={() => setQ("")}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
            </div>
            {(results.length > 0 || loading) && (
              <div className="max-h-80 overflow-y-auto py-1">
                {loading && <div className="px-4 py-3 text-xs text-muted-foreground">검색 중...</div>}
                {results.map(r => (
                  <button key={r.id} onClick={() => go(r)}
                    className="w-full px-4 py-2.5 flex items-start gap-3 hover:bg-muted text-left transition-colors">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary/10 text-primary rounded mt-0.5 flex-shrink-0">
                      {TYPE_LABEL[r.type] ?? r.type}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.title}</div>
                      {(r.subtitle || r.preview) && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{r.subtitle ?? r.preview}</div>
                      )}
                    </div>
                  </button>
                ))}
                {!loading && results.length === 0 && q && (
                  <div className="px-4 py-3 text-xs text-muted-foreground">결과 없음</div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function Root() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-sm flex items-center justify-center">
              <span className="text-primary-foreground text-base" style={{ fontFamily: "'Press Start 2P', monospace" }}>E</span>
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="font-bold text-xl tracking-tight">EDUPRIME</span>
              <span className="text-xs text-muted-foreground tracking-widest">UNIVERSITY</span>
            </div>
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/academics" className="text-sm hover:text-primary transition-colors">Academics</Link>
            <Link to="/course-catalog" className="text-sm hover:text-primary transition-colors">Course Catalog</Link>
            <Link to="/admissions" className="text-sm hover:text-primary transition-colors">Admissions</Link>
            <Link to="/research" className="text-sm hover:text-primary transition-colors">Research</Link>
            <Link to="/campus-life" className="text-sm hover:text-primary transition-colors">Campus Life</Link>
            <Link to="/my-page" className="text-sm hover:text-primary transition-colors">My Page</Link>
            <NavSearch />
          </div>
        </div>
      </nav>

      <Outlet />
      <ChatBot />

      {/* Footer */}
      <footer className="border-t py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary rounded-sm flex items-center justify-center">
                  <span className="text-primary-foreground text-sm" style={{ fontFamily: "'Press Start 2P', monospace" }}>E</span>
                </div>
                <div className="flex flex-col -space-y-1">
                  <span className="font-bold text-lg tracking-tight">EDUPRIME</span>
                  <span className="text-xs text-muted-foreground tracking-widest">UNIVERSITY</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                1876 Academic Way<br/>
                Cambridge, MA 02138<br/>
                United States
              </p>
              <p className="text-sm text-muted-foreground">
                Phone: +1 (617) 555-1000
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-4">Academics</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/academics" className="hover:text-foreground">Programs</Link></li>
                <li><a href="#" className="hover:text-foreground">Departments</a></li>
                <li><a href="#" className="hover:text-foreground">Research</a></li>
                <li><a href="#" className="hover:text-foreground">Libraries</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Admissions</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Undergraduate</a></li>
                <li><a href="#" className="hover:text-foreground">Graduate</a></li>
                <li><a href="#" className="hover:text-foreground">International</a></li>
                <li><a href="#" className="hover:text-foreground">Financial Aid</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">About</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Leadership</a></li>
                <li><a href="#" className="hover:text-foreground">History</a></li>
                <li><a href="#" className="hover:text-foreground">News & Events</a></li>
                <li><a href="#" className="hover:text-foreground">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-sm text-muted-foreground">
                © 2026 EduPrime University. All rights reserved. <span className="text-xs opacity-70" style={{ fontFamily: "'Press Start 2P', monospace" }}>v2.0</span>
              </div>
              <div className="flex gap-6 text-sm text-muted-foreground">
                <a href="#" className="hover:text-foreground">Privacy Policy</a>
                <a href="#" className="hover:text-foreground">Terms of Use</a>
                <a href="#" className="hover:text-foreground">Accessibility</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
