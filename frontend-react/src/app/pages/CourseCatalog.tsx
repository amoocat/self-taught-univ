import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Search, Filter, BookOpen } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { api } from "../../lib/api";

// 카테고리별 커버 이미지
const CATEGORY_IMAGES: Record<string, string> = {
  llm:      "https://images.unsplash.com/photo-1710306973761-717ec384efd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  ml:       "https://images.unsplash.com/photo-1518773553398-650c184e0bb3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  dl:       "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  cv:       "https://images.unsplash.com/photo-1527430253228-e93688616381?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  nlp:      "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  rl:       "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  math:     "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  stat:     "https://images.unsplash.com/photo-1543286386-713bdd548da4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  data:     "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  mlops:    "https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  actuary:  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  ie:       "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
};
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800";

// 카테고리 레이블
const CATEGORY_LABELS: Record<string, string> = {
  llm: "LLM", ml: "Machine Learning", dl: "Deep Learning",
  cv: "Computer Vision", nlp: "NLP", rl: "Reinforcement Learning",
  math: "Mathematics", stat: "Statistics", data: "Data Engineering",
  mlops: "MLOps", actuary: "Actuarial Science", ie: "Industrial Engineering",
  applied_ml: "Applied ML", distributed_ml: "Distributed ML",
  llm_efficiency: "LLM Efficiency", pytorch: "PyTorch",
  ml_systems: "ML Systems", audio_speech: "Audio & Speech AI",
  gnn: "Graph Neural Networks", causal_inference: "Causal Inference",
  object_detection: "Object Detection", cv_3d: "3D Vision",
  llm_eval: "LLM Evaluation", llm_security: "LLM Security",
  model_based_rl: "Model-Based RL", ai_systems: "AI Systems",
  optimization: "Optimization",
};

// 강의 수 기반 레벨 분류
function getLevel(count: number): string {
  if (count >= 150) return "Advanced";
  if (count >= 80)  return "Graduate";
  if (count >= 30)  return "Intermediate";
  return "Undergraduate";
}

interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  category: string;
  categoryLabel: string;
  level: string;
  lectureCount: number;
  imageUrl: string;
  source: string;
}

export function CourseCatalog() {
  const navigate = useNavigate();
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedLevel, setSelectedLevel] = useState("All");

  useEffect(() => {
    api.getCourses().then((data: any[]) => {
      // 강의 수 0개인 강좌는 숨김
      const mapped: Course[] = data
        .filter((c: any) => (c.lecture_count ?? 0) > 0)
        .map((c: any) => ({
          id: c.id,
          title: c.title,
          description: c.source || c.description || `${c.lecture_count ?? 0}개 강의`,
          instructor: "Self-Taught University",
          category: c.category,
          categoryLabel: CATEGORY_LABELS[c.category] ?? c.category?.toUpperCase(),
          level: getLevel(c.lecture_count ?? 0),
          lectureCount: c.lecture_count ?? 0,
          imageUrl: CATEGORY_IMAGES[c.category] ?? DEFAULT_IMAGE,
          source: c.source ?? "",
        }));
      setAllCourses(mapped);
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, []);

  const categories = ["All", ...Array.from(new Set(allCourses.map(c => c.categoryLabel))).sort()];
  const levels = ["All", "Undergraduate", "Intermediate", "Graduate", "Advanced"];

  const handleViewCourse = (courseId: string) => {
    navigate(`/course/${courseId}`);
  };

  const filteredCourses = allCourses.filter((course) => {
    const matchesSearch =
      searchQuery === "" ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.source.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "All" || course.categoryLabel === selectedCategory;

    const matchesLevel =
      selectedLevel === "All" || course.level === selectedLevel;

    return matchesSearch && matchesCategory && matchesLevel;
  });

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-primary/10 to-background py-6 border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
              Course Catalog
            </h1>
            <p className="text-sm text-muted-foreground">
              Browse our complete collection of courses.
            </p>
          </div>
        </div>
      </section>

      {/* Main Layout: 좌측 필터 + 우측 그리드 */}
      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8 items-start">

        {/* 좌측 사이드바 - 검색 & 필터 (sticky) */}
        <aside className="w-56 flex-shrink-0 sticky top-[73px] space-y-5">
          {/* Search */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">검색</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="강좌, 소스..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Category</p>
            <div className="flex flex-col gap-1">
              {loading ? (
                <div className="h-5 w-full bg-muted animate-pulse rounded" />
              ) : categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`text-left text-sm px-2 py-1 rounded transition-colors ${
                    selectedCategory === category
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Level Filter */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Level</p>
            <div className="flex flex-col gap-1">
              {levels.map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedLevel(level)}
                  className={`text-left text-sm px-2 py-1 rounded transition-colors ${
                    selectedLevel === level
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Filters */}
          {(searchQuery || selectedCategory !== "All" || selectedLevel !== "All") && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => { setSearchQuery(""); setSelectedCategory("All"); setSelectedLevel("All"); }}
            >
              필터 초기화
            </Button>
          )}
        </aside>

        {/* 우측 강좌 그리드 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{filteredCourses.length}</span>개 강좌
              {selectedCategory !== "All" && ` · ${selectedCategory}`}
              {selectedLevel !== "All" && ` · ${selectedLevel}`}
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-72 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : filteredCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredCourses.map((course) => (
                <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer" onClick={() => handleViewCourse(course.id)}>
                  <div className="aspect-video w-full overflow-hidden bg-muted">
                    <img
                      src={course.imageUrl}
                      alt={course.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex gap-2 mb-1">
                      <Badge variant="secondary">{course.categoryLabel}</Badge>
                      <Badge variant="outline" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px" }}>
                        {course.level}
                      </Badge>
                    </div>
                    <CardTitle className="line-clamp-2 text-base">{course.title}</CardTitle>
                    <CardDescription className="line-clamp-1 text-xs">{course.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button className="w-full h-8 text-sm" onClick={(e) => { e.stopPropagation(); handleViewCourse(course.id); }}>
                      강의 보기
                    </Button>
                  </CardContent>
                  <CardFooter className="flex justify-between text-xs text-muted-foreground pt-0">
                    <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {course.lectureCount}강</span>
                    <span>{course.source ? course.source.slice(0, 25) : ""}</span>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-xl font-bold mb-2">강좌를 찾을 수 없습니다</h3>
              <p className="text-muted-foreground mb-6 text-sm">필터 조건을 변경해보세요</p>
              <Button size="sm" onClick={() => { setSearchQuery(""); setSelectedCategory("All"); setSelectedLevel("All"); }}>
                필터 초기화
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* CTA Section */}
      <section className="bg-accent/20 py-16 border-t">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            원하는 강좌가 없으신가요?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            YouTube 플레이리스트를 가져오면 GPT가 자동으로 커리큘럼에 배정합니다.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="h-12 px-8" onClick={() => navigate("/youtube-import")}>
              YouTube에서 가져오기
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8" onClick={() => navigate("/academics")}>
              전체 커리큘럼 보기
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
