import { useState, useEffect } from "react";
import { Link } from "react-router";
import { api } from "../../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Search } from "lucide-react";

interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  date: string;
  category: string;
  url: string;
  citations: number;
}

interface BlogPost {
  id: string;
  title: string;
  company: string;
  author: string;
  excerpt: string;
  date: string;
  category: string;
  url: string;
  readTime: string;
}

export function Research() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedCompany, setSelectedCompany] = useState("All");
  const [activeTab, setActiveTab] = useState("papers");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);

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
        date: p.year ? String(p.year) : "",
        category: p.venue ?? "Research",
        url: p.arxiv_id ? `https://arxiv.org/abs/${p.arxiv_id}` : "#",
        citations: 0,
      };
    }))).catch(console.error);

    api.getFeed(50).then((data: any[]) => setBlogPosts(data.map((f: any, i: number) => ({
      id: String(f.id ?? i),
      title: f.title,
      company: f.source ?? f.source_name ?? "",
      author: "",
      excerpt: f.summary ?? "",
      date: f.date ?? "",
      category: f.category ?? f.source_type ?? "Tech",
      url: f.url ?? "#",
      readTime: "",
    })))).catch(console.error);
  }, []);

  const categories = ["All", ...Array.from(new Set(papers.map(p => p.category)))];
  const companies = ["All", ...Array.from(new Set(blogPosts.map(b => b.company)))];

  const filteredPapers = papers.filter((paper) => {
    const matchesSearch = searchQuery === "" ||
      paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      paper.authors.some(a => a.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === "All" || paper.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredBlogs = blogPosts.filter((post) => {
    const matchesSearch = searchQuery === "" ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || post.category === selectedCategory;
    const matchesCompany = selectedCompany === "All" || post.company === selectedCompany;
    return matchesSearch && matchesCategory && matchesCompany;
  });

  const SidebarItem = ({
    label,
    active,
    onClick,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`text-left px-3 py-1.5 rounded-md text-sm transition-colors w-full truncate ${
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {active && <span className="mr-1 text-primary">›</span>}
      {label}
    </button>
  );

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
              { value: 8, label: "Companies" },
              { value: "24/7", label: "Updated" },
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
        <aside className="hidden md:flex flex-col w-44 flex-shrink-0 sticky top-[90px] gap-6">
          {/* Category */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-3">
              Category
            </p>
            <nav className="flex flex-col gap-0.5">
              {categories.map(cat => (
                <SidebarItem
                  key={cat}
                  label={cat}
                  active={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                />
              ))}
            </nav>
          </div>

          {/* Company — only for blogs tab */}
          {activeTab === "blogs" && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-3">
                Company
              </p>
              <nav className="flex flex-col gap-0.5">
                {companies.map(company => (
                  <SidebarItem
                    key={company}
                    label={company}
                    active={selectedCompany === company}
                    onClick={() => setSelectedCompany(company)}
                  />
                ))}
              </nav>
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
                onChange={(e) => setSearchQuery(e.target.value)}
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
            }}
          >
            <TabsList className="mb-8">
              <TabsTrigger value="papers">Research Papers</TabsTrigger>
              <TabsTrigger value="blogs">Tech Blogs</TabsTrigger>
            </TabsList>

            {/* Research Papers */}
            <TabsContent value="papers">
              <div className="divide-y">
                {filteredPapers.map((paper, i) => {
                  const gradients = [
                    "from-pink-200 via-rose-100 to-pink-50",
                    "from-violet-200 via-purple-100 to-violet-50",
                    "from-lime-200 via-green-100 to-lime-50",
                    "from-sky-200 via-blue-100 to-sky-50",
                    "from-amber-200 via-yellow-100 to-amber-50",
                  ];
                  const grad = gradients[i % gradients.length];
                  return (
                    <div key={paper.id} className="flex gap-8 py-10">
                      <Link
                        to={`/research/paper/${paper.id}`}
                        state={{ paper }}
                        className={`hidden sm:block flex-shrink-0 w-56 aspect-[4/3] rounded-xl bg-gradient-to-br ${grad} hover:opacity-90 transition-opacity`}
                      />
                      <div className="flex flex-col justify-center gap-3">
                        <Link
                          to={`/research/paper/${paper.id}`}
                          state={{ paper }}
                          className="text-2xl font-bold leading-snug hover:underline"
                          style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
                        >
                          {paper.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {paper.authors.slice(0, 3).join(", ")}
                          {paper.authors.length > 3 && " 외"}
                          {paper.date && ` · ${paper.date}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Tech Blogs */}
            <TabsContent value="blogs">
              <div className="divide-y">
                {filteredBlogs.map((post, i) => {
                  const gradients = [
                    "from-sky-200 via-blue-100 to-sky-50",
                    "from-amber-200 via-yellow-100 to-amber-50",
                    "from-pink-200 via-rose-100 to-pink-50",
                    "from-lime-200 via-green-100 to-lime-50",
                    "from-violet-200 via-purple-100 to-violet-50",
                  ];
                  const grad = gradients[i % gradients.length];
                  return (
                    <div key={post.id} className="flex gap-8 py-10">
                      <div className={`hidden sm:block flex-shrink-0 w-56 aspect-[4/3] rounded-xl bg-gradient-to-br ${grad}`} />
                      <div className="flex flex-col justify-center gap-3">
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-2xl font-bold leading-snug hover:underline"
                          style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
                        >
                          {post.title}
                        </a>
                        <p className="text-sm text-muted-foreground">
                          {[post.company, post.date].filter(Boolean).join(" · ")}
                        </p>
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-fit px-4 py-1.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-80 transition-opacity"
                        >
                          Read more
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
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
