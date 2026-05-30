import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";

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

const GRADIENTS = [
  "from-sky-200 via-blue-100 to-violet-100",
  "from-amber-200 via-yellow-100 to-lime-100",
  "from-pink-200 via-rose-100 to-sky-100",
  "from-lime-200 via-green-100 to-sky-100",
  "from-violet-200 via-purple-100 to-pink-100",
];

function hashIndex(id: string, len: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return h % len;
}

export function BlogDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const post: BlogPost | undefined = (location.state as any)?.post;

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">블로그 정보를 불러올 수 없습니다.</p>
          <button
            onClick={() => navigate("/research")}
            className="text-sm underline text-primary"
          >
            Research 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const grad = GRADIENTS[hashIndex(post.id, GRADIENTS.length)];
  const excerptParagraphs = post.excerpt
    ? post.excerpt.split(/\n+/).filter(Boolean)
    : ["내용 정보가 없습니다."];

  return (
    <div className="min-h-screen bg-background">
      {/* Back button */}
      <div className="max-w-2xl mx-auto px-6 pt-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Research
        </button>
      </div>

      <article className="max-w-2xl mx-auto px-6 py-10">
        {/* Date */}
        {post.date && (
          <p className="text-center text-sm text-muted-foreground mb-6">
            {post.date}
          </p>
        )}

        {/* Title */}
        <h1
          className="text-4xl md:text-5xl font-bold leading-tight text-center mb-6"
          style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
        >
          {post.title}
        </h1>

        {/* Company / Author */}
        <p className="text-center text-sm text-muted-foreground mb-10">
          {[post.company, post.author].filter(Boolean).join(" · ")}
        </p>

        {/* Hero gradient placeholder */}
        <div className={`w-full aspect-[16/7] rounded-2xl bg-gradient-to-br ${grad} mb-14`} />

        {/* Summary */}
        <section className="space-y-4">
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
          >
            Summary
          </h2>
          {excerptParagraphs.map((para, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">
              {para}
            </p>
          ))}
        </section>

        {/* Category */}
        {post.category && (
          <section className="mt-10 space-y-2">
            <h2
              className="text-xl font-bold"
              style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
            >
              Category
            </h2>
            <p className="text-sm text-muted-foreground">{post.category}</p>
          </section>
        )}

        {/* Author / company bio card */}
        <div className="mt-14 rounded-xl bg-muted/40 border p-6">
          <p
            className="text-lg font-bold mb-1"
            style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
          >
            {post.company || post.author || "Unknown"}
          </p>
          {post.author && post.author !== post.company && (
            <p className="text-xs text-muted-foreground">{post.author}</p>
          )}
          {post.category && (
            <p className="text-xs text-muted-foreground mt-1">{post.category}</p>
          )}
        </div>

        {/* Read original post */}
        {post.url && post.url !== "#" && (
          <div className="mt-10 flex justify-center">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-80 transition-opacity"
            >
              Read Original Post
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </article>
    </div>
  );
}
