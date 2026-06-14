import { useState, useEffect } from "react";
import { Link } from "react-router";
import { api } from "../../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Search, ExternalLink, BookOpen, Rss } from "lucide-react";

interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  year: string;
  venue: string;        // 저널/컨퍼런스
  category: string;
  arxivId: string;
  url: string;
}

interface BlogPost {
  id: string;
  title: string;
  company: string;      // 회사명
  sourceType: string;   // personal / bigtech / korean / arxiv
  summary: string;
  date: string;
  category: string;
  keywords: string[];
  url: string;
}

const SOURCE_TYPE_LABEL: Record<string, string> = {
  personal: "개인 블로그",
  bigtech:  "빅테크",
  korean:   "국내 기업",
  arxiv:    "arXiv",
  blog:     "블로그",
  youtube:  "YouTube",
};

const SOURCE_TYPE_COLOR: Record<string, string> = {
  personal: "bg-rose-50 text-rose-600 border-rose-200",
  bigtech:  "bg-blue-50 text-blue-600 border-blue-200",
  korean:   "bg-emerald-50 text-emerald-600 border-emerald-200",
  arxiv:    "bg-violet-50 text-violet-600 border-violet-200",
  blog:     "bg-rose-50 text-rose-600 border-rose-200",
  youtube:  "bg-amber-50 text-amber-600 border-amber-200",
};

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;

  const getPages = (): (number | "...")[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (page > 3) pages.push("...");
    for (let p = Math.max(2, page - 1); p <= Math.min(total - 1, page + 1); p++) pages.push(p);
    if (page < total - 2) pages.push("...");
    pages.push(total);
    return pages;
  };

  const btnBase = "h-8 min-w-[2rem] px-2 text-sm rounded-md transition-colors";
  return (
    <div className="flex items-center justify-center gap-1 mt-8 pt-6 border-t">
      <button onClick={() => onChange(page - 1)} disabled={page === 1}
        className={`${btnBase} border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed px-3`}>
        ←
      </button>
      {getPages().map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="h-8 min-w-[2rem] flex items-center justify-center text-sm text-muted-foreground">…</span>
        ) : (
          <button key={p} onClick={() => onChange(p)}
            className={`${btnBase} ${p === page ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}>
            {p}
          </button>
        )
      )}
      <button onClick={() => onChange(page + 1)} disabled={page === total}
        className={`${btnBase} border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed px-3`}>
        →
      </button>
    </div>
  );
}

export function Research() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedCompany, setSelectedCompany] = useState("All");
  const [activeTab, setActiveTab] = useState("papers");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [paperPage, setPaperPage] = useState(1);
  const [blogPage, setBlogPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    api.getPapers().then((data: any[]) => setPapers(data.map((p: any, i: number) => {
      const rawAuthors = p.authors ?? "";
      const authors: string[] = typeof rawAuthors === "string"
        ? rawAuthors.split(",").map((a: string) => a.trim()).filter(Boolean)
        : rawAuthors;
      return {
        id: String(p.id ?? i),
        title: p.title,
        authors,
        abstract: p.abstract ?? "",
        year: p.year ? String(p.year) : "",
        venue: p.venue ?? "",
        category: p.category ?? "",
        arxivId: p.arxiv_id ?? "",
        url: p.arxiv_id ? `https://arxiv.org/abs/${p.arxiv_id}` : "#",
      };
    }))).catch(console.error);

    api.getFeed(200).then((data: any[]) => setBlogPosts(data.map((f: any, i: number) => ({
      id: String(f.id ?? i),
      title: f.title,
      company: f.source ?? "",
      sourceType: f.source_type ?? "blog",
      summary: f.summary ?? "",
      date: f.date ?? "",
      category: f.category ?? "",
      keywords: f.keywords ?? [],
      url: f.url ?? "#",
    })))).catch(console.error);
  }, []);

  const categories = ["All", ...Array.from(new Set(papers.map(p => p.venue).filter(Boolean)))];
  const companies  = ["All", ...Array.from(new Set(blogPosts.map(b => b.company).filter(Boolean)))];

  const filteredPapers = papers.filter((paper) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      paper.title.toLowerCase().includes(q) ||
      paper.authors.some(a => a.toLowerCase().includes(q)) ||
      paper.venue.toLowerCase().includes(q);
    const matchesCategory = selectedCategory === "All" || paper.venue === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredBlogs = blogPosts.filter((post) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      post.title.toLowerCase().includes(q) ||
      post.company.toLowerCase().includes(q) ||
      post.summary.toLowerCase().includes(q);
    const matchesCompany = selectedCompany === "All" || post.company === selectedCompany;
    return matchesSearch && matchesCompany;
  });

  // 페이지네이션
  const pagedPapers = filteredPapers.slice((paperPage - 1) * PAGE_SIZE, paperPage * PAGE_SIZE);
  const totalPaperPages = Math.ceil(filteredPapers.length / PAGE_SIZE);
  const pagedBlogs = filteredBlogs.slice((blogPage - 1) * PAGE_SIZE, blogPage * PAGE_SIZE);
  const totalBlogPages = Math.ceil(filteredBlogs.length / PAGE_SIZE);


  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/10 to-background py-6 border-b">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            Research & Innovation
          </h1>
          <p className="text-sm text-muted-foreground">
            Latest research papers and tech insights from leading companies and institutions.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-muted/30 py-2 border-b">
        <div className="max-w-2xl mx-auto px-6">
          <div className="grid grid-cols-4 gap-4">
            {[
              { value: papers.length, label: "Papers" },
              { value: blogPosts.length, label: "Blog Posts" },
              { value: new Set(blogPosts.map(b => b.company)).size, label: "Sources" },
              { value: new Set(blogPosts.map(b => b.sourceType)).size, label: "Types" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-bold" style={{ fontFamily: "'VT323', monospace" }}>{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main layout: sidebar + content */}
      <div className="max-w-7xl mx-auto px-6 py-12 flex gap-10 items-start">

        {/* Left sidebar */}
        <aside className="hidden md:flex flex-col w-44 flex-shrink-0 sticky top-[90px] gap-5">
          {/* Category */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Category
            </p>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Company — only for blogs tab */}
          {activeTab === "blogs" && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Company
              </p>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {companies.map(company => (
                  <option key={company} value={company}>{company}</option>
                ))}
              </select>
            </div>
          )}
        </aside>

        {/* Right content */}
        <div className="flex-1 min-w-0">
          {/* Search */}
          <div className="mb-8">
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                type="text"
                placeholder="Search papers, authors, companies..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPaperPage(1); setBlogPage(1); }}
                className="pl-12 h-12 text-base"
              />
            </div>
          </div>

          <Tabs
            defaultValue="papers"
            className="w-full"
            onValueChange={(val) => {
              setActiveTab(val);
              setSelectedCategory("All");
              setSelectedCompany("All");
              setPaperPage(1);
              setBlogPage(1);
            }}
          >
            <TabsList className="mb-8">
              <TabsTrigger value="papers">Research Papers</TabsTrigger>
              <TabsTrigger value="blogs">Tech Blogs</TabsTrigger>
            </TabsList>

            {/* Research Papers */}
            <TabsContent value="papers">
              <div className="space-y-3">
                {pagedPapers.map((paper) => (
                  <Link
                    key={paper.id}
                    to={`/research/paper/${paper.id}`}
                    state={{ paper }}
                    className="block border rounded-xl p-5 hover:border-primary/40 hover:bg-muted/20 transition-all group"
                  >
                    {/* 상단: 베뉴 + 연도 + 카테고리 */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {paper.venue && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                          {paper.venue}
                        </span>
                      )}
                      {paper.year && (
                        <span className="text-xs text-muted-foreground">{paper.year}</span>
                      )}
                      {paper.category && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                          {paper.category}
                        </span>
                      )}
                      {paper.arxivId && (
                        <span className="text-xs font-mono text-muted-foreground">arXiv:{paper.arxivId}</span>
                      )}
                    </div>

                    {/* 제목 */}
                    <h3 className="text-lg font-bold leading-snug mb-2 group-hover:text-primary transition-colors"
                      style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
                      {paper.title}
                    </h3>

                    {/* 저자 */}
                    <p className="text-sm text-muted-foreground mb-2">
                      <BookOpen className="inline w-3.5 h-3.5 mr-1 opacity-50" />
                      {paper.authors.slice(0, 4).join(", ")}
                      {paper.authors.length > 4 && <span> 외 {paper.authors.length - 4}명</span>}
                    </p>

                    {/* 초록 미리보기 */}
                    {paper.abstract && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {paper.abstract}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
              <Pagination page={paperPage} total={totalPaperPages} onChange={p => { setPaperPage(p); window.scrollTo(0,0); }} />
            </TabsContent>

            {/* Tech Blogs */}
            <TabsContent value="blogs">
              <div className="space-y-3">
                {pagedBlogs.map((post) => (
                  <Link
                    key={post.id}
                    to={`/research/blog/${post.id}`}
                    state={{ post }}
                    className="block border rounded-xl p-5 hover:border-primary/40 hover:bg-muted/20 transition-all group"
                  >
                    {/* 상단: 회사 + 타입 + 날짜 + 카테고리 */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {post.company && (
                        <span className="text-xs font-semibold text-foreground">{post.company}</span>
                      )}
                      {post.sourceType && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${SOURCE_TYPE_COLOR[post.sourceType] ?? "bg-muted text-muted-foreground border-border"}`}>
                          {SOURCE_TYPE_LABEL[post.sourceType] ?? post.sourceType}
                        </span>
                      )}
                      {post.category && post.category !== "etc" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                          {post.category.toUpperCase()}
                        </span>
                      )}
                      {post.date && (
                        <span className="text-xs text-muted-foreground ml-auto">{post.date}</span>
                      )}
                    </div>

                    {/* 제목 */}
                    <h3 className="text-lg font-bold leading-snug mb-2 group-hover:text-primary transition-colors"
                      style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
                      {post.title}
                    </h3>

                    {/* 요약 */}
                    {post.summary && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-2">
                        {post.summary}
                      </p>
                    )}

                    {/* 키워드 */}
                    {post.keywords.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {post.keywords.slice(0, 5).map(k => (
                          <span key={k} className="text-[10px] px-1.5 py-0.5 bg-primary/5 text-primary rounded">
                            #{k}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
              <Pagination page={blogPage} total={totalBlogPages} onChange={p => { setBlogPage(p); window.scrollTo(0,0); }} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* CTA */}
      <section className="bg-accent/20 py-16 border-t">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            Stay Informed
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Subscribe to our newsletter to receive weekly updates on the latest research and tech insights.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="h-12 px-8">
              Subscribe Now
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8">
              Browse Archive
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
