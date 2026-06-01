import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const HERO_IMAGES = [
  { src: "https://images.unsplash.com/photo-1562774053-701939374585?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920", label: "MIT" },
  { src: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920", label: "Stanford" },
  { src: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920", label: "KAIST" },
  { src: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920", label: "Seoul National" },
  { src: "https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920", label: "Princeton" },
];
import { Button } from "../components/ui/button";
import { Link } from "react-router";
import { GraduationCap, Users, Award, BookOpenCheck } from "lucide-react";
import { api } from "../../lib/api";

export function Home() {
  const [stats, setStats] = useState({ courses: 0, lectures: 0 });
  const [loading, setLoading] = useState(true);
  const [slide, setSlide] = useState(0);
  const SLIDE_COUNT = 3;
  const prevSlide = useCallback(() => setSlide(s => (s - 1 + SLIDE_COUNT) % SLIDE_COUNT), []);
  const nextSlide = useCallback(() => setSlide(s => (s + 1) % SLIDE_COUNT), []);

  // Hero 슬라이드쇼
  const [heroIdx, setHeroIdx] = useState(0);
  const heroTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    heroTimer.current = setInterval(() => setHeroIdx(i => (i + 1) % HERO_IMAGES.length), 4000);
    return () => { if (heroTimer.current) clearInterval(heroTimer.current); };
  }, []);

  useEffect(() => {
    api.getCourses().then((data: any[]) => {
      const totalLectures = data.reduce((s: number, c: any) => s + (c.lecture_count ?? 0), 0);
      setStats({ courses: data.length, lectures: totalLectures });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <>
      {/* Hero Section - Campus Slideshow */}
      <section className="relative h-[600px] overflow-hidden">
        {/* 슬라이드 이미지들 — 크로스페이드 */}
        {HERO_IMAGES.map((img, i) => (
          <div
            key={img.src}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === heroIdx ? 1 : 0 }}
          >
            <img src={img.src} alt={img.label} className="w-full h-full object-cover" />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/70" />

        {/* 텍스트 */}
        <div className="relative h-full max-w-7xl mx-auto px-6 flex items-end pb-20">
          <div className="max-w-3xl text-white">
            <div className="text-xs tracking-wider mb-4 opacity-90" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              EST. 1876
            </div>
            <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
              EduPrime University
            </h1>
            <p className="text-xl md:text-2xl mb-0 leading-relaxed opacity-95">
              A tradition of excellence in scholarship and education
            </p>
          </div>
        </div>

        {/* 인디케이터 dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {HERO_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setHeroIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === heroIdx ? "bg-white w-4" : "bg-white/40"}`}
            />
          ))}
        </div>

        {/* 현재 대학 라벨 */}
        <div className="absolute bottom-6 right-8 text-white/50 text-xs font-mono tracking-widest transition-opacity duration-500">
          {HERO_IMAGES[heroIdx].label}
        </div>
      </section>

      {/* Carousel: Welcome / Academic Excellence / Academic Resources */}
      <section className="border-b bg-gradient-to-b from-accent/20 to-background">
        <div className="relative overflow-hidden">
          {/* Track */}
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${slide * 100}%)` }}
          >
            {/* Slide 1 — Welcome */}
            <div className="min-w-full flex justify-center">
              <div className="flex flex-col items-center justify-center text-center px-8 py-16 max-w-3xl mx-auto">
                <h2 className="text-4xl md:text-5xl font-bold mb-8" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
                  Welcome to EduPrime
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                  For over a century and a half, EduPrime University has been dedicated to the pursuit of knowledge
                  and the education of future leaders, scholars, and citizens of the world.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed mb-12">
                  Our historic campus, nestled among classical architecture and verdant quadrangles,
                  provides an inspiring environment where intellectual curiosity flourishes and lifelong learning begins.
                </p>
                <div className="grid grid-cols-4 gap-8 w-full border-t pt-10">
                  {[
                    { icon: <GraduationCap className="w-8 h-8 text-primary" />, value: "1,200+", label: "Courses Offered" },
                    { icon: <Users className="w-8 h-8 text-primary" />, value: "850", label: "Faculty Members" },
                    { icon: <BookOpenCheck className="w-8 h-8 text-primary" />, value: "65", label: "Degree Programs" },
                    { icon: <Award className="w-8 h-8 text-primary" />, value: "98%", label: "Graduate Success" },
                  ].map(({ icon, value, label }) => (
                    <div key={label} className="text-center">
                      <div className="flex justify-center mb-2">{icon}</div>
                      <div className="text-3xl font-bold mb-1" style={{ fontFamily: "'VT323', monospace" }}>{value}</div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Slide 2 — Academic Excellence */}
            <div className="min-w-full flex justify-center">
              <div className="flex flex-col items-center justify-center text-center px-8 py-20 max-w-4xl mx-auto">
                <div className="inline-block mb-6 px-4 py-2 bg-primary/10 rounded" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
                  ACADEMIC_PROGRAMS.EXE
                </div>
                <h2 className="text-5xl md:text-6xl font-bold mb-6" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
                  Academic Excellence
                </h2>
                <p className="text-xl text-muted-foreground leading-relaxed mb-8">
                  Discover world-class education across diverse fields of study.
                  Our comprehensive academic programs prepare students to lead and innovate in their chosen fields.
                </p>
                <div className="flex gap-4 justify-center mb-12">
                  <Button size="lg" className="h-12 px-8" asChild>
                    <Link to="/course-catalog">Browse Programs</Link>
                  </Button>
                  <Button size="lg" variant="outline" className="h-12 px-8" asChild>
                    <Link to="/course-catalog">Course Catalog</Link>
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-8 w-full border-t pt-10">
                  {[
                    { value: loading ? "..." : stats.courses, label: "COURSES" },
                    { value: loading ? "..." : stats.lectures, label: "LECTURES" },
                    { value: "∞", label: "LEARNING" },
                    { value: "1:1", label: "RATIO" },
                  ].map(({ value, label }) => (
                    <div key={label} className="text-center">
                      <div className="text-4xl font-bold mb-1" style={{ fontFamily: "'VT323', monospace" }}>{value}</div>
                      <div className="text-xs text-muted-foreground tracking-wide" style={{ fontFamily: "'Press Start 2P', monospace" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Slide 3 — Academic Resources */}
            <div className="min-w-full flex justify-center">
              <div className="flex flex-col md:flex-row items-center gap-10 px-8 py-16 max-w-5xl mx-auto w-full">
                <div className="relative w-full md:w-1/2 aspect-video overflow-hidden rounded-xl bg-muted flex-shrink-0">
                  <img
                    src="https://images.unsplash.com/photo-1514513452089-17f8a9771ee8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
                    alt="Library"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col justify-center">
                  <div className="text-xs tracking-wider text-muted-foreground mb-4" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                    [ RESOURCES ]
                  </div>
                  <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
                    Academic Resources
                  </h2>
                  <p className="text-muted-foreground mb-5 leading-relaxed">
                    Access state-of-the-art facilities, extensive library collections, and cutting-edge research labs.
                  </p>
                  <ul className="space-y-2 mb-6">
                    {[
                      "12 specialized research centers and institutes",
                      "3 million+ volumes in university libraries",
                      "Advanced computing and laboratory facilities",
                      "24/7 academic support and tutoring services",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2" />
                        <span className="text-sm text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-fit" asChild>
                    <Link to="/course-catalog">Explore Resources →</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Arrows */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 border flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 border flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 py-4">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === slide ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/60"
              }`}
            />
          ))}
        </div>
      </section>

      {/* Campus Life Images */}
      <section className="bg-muted/30 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-8">
            <div className="inline-block px-4 py-2 bg-accent rounded" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
              LOADING... CAMPUS.EXE
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1587905069134-008460d7a636?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800"
                alt="Students in library"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                <h3 className="text-white font-bold text-lg mb-1">Academic Life</h3>
                <p className="text-white/90 text-sm">World-class libraries and research facilities</p>
              </div>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1582845512747-e42001c95638?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800"
                alt="Campus buildings"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                <h3 className="text-white font-bold text-lg mb-1">Historic Campus</h3>
                <p className="text-white/90 text-sm">Beautiful grounds steeped in tradition</p>
              </div>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1489875347897-49f64b51c1f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800"
                alt="University hall"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                <h3 className="text-white font-bold text-lg mb-1">Community</h3>
                <p className="text-white/90 text-sm">A vibrant community of scholars</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ready to Begin */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            Ready to Begin Your Academic Journey?
          </h2>
          <p className="text-xl mb-10 opacity-95 leading-relaxed">
            Explore our programs, connect with faculty, and discover how EduPrime can help you achieve your academic goals.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" variant="secondary" className="h-12 px-8" asChild>
              <Link to="/course-catalog">Browse Programs</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary" asChild>
              <Link to="/youtube-import">Add Your Courses</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
