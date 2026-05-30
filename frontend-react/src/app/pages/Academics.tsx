import { Button } from "../components/ui/button";
import { CourseCard } from "../components/CourseCard";
import { CategoryCard } from "../components/CategoryCard";
import { Code, Palette, TrendingUp, Globe, Brain, BookOpen, GraduationCap, Users, Award, BookOpenCheck } from "lucide-react";
import { Link } from "react-router";

const allCourses = [
  {
    title: "Machine Learning and Computational Intelligence",
    description: "Explore the mathematical foundations of artificial intelligence and develop advanced computational systems",
    instructor: "Professor Sarah Chen, PhD",
    instructorAvatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100",
    category: "Computer Science",
    level: "Graduate",
    students: 45230,
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1518773553398-650c184e0bb3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    title: "Modern Web Architecture and Systems Design",
    description: "Advanced study of scalable web systems, distributed computing, and enterprise software architecture",
    instructor: "Professor Michael Johnson, PhD",
    instructorAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100",
    category: "Engineering",
    level: "Advanced",
    students: 38450,
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1724190168156-e93ba2bfd041?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    title: "Strategic Marketing in the Digital Economy",
    description: "Examine contemporary marketing frameworks and data-driven strategies for the modern enterprise",
    instructor: "Dr. Emma Rodriguez",
    instructorAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100",
    category: "Business",
    level: "Professional",
    students: 52100,
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1535644396010-e89b5bfafd15?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    title: "Artificial Intelligence: Theory and Applications",
    description: "A comprehensive introduction to AI methodologies, ethical considerations, and real-world implementations",
    instructor: "Professor James Park, PhD",
    instructorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100",
    category: "Technology",
    level: "Undergraduate",
    students: 67890,
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1710306973761-717ec384efd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    title: "Data Structures and Algorithms",
    description: "Master fundamental computer science concepts and problem-solving techniques",
    instructor: "Professor David Kim, PhD",
    instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
    category: "Computer Science",
    level: "Undergraduate",
    students: 78450,
    rating: 4.6,
    imageUrl: "https://images.unsplash.com/photo-1517512006864-7edc3b933137?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    title: "Quantum Computing Fundamentals",
    description: "Introduction to quantum mechanics, quantum algorithms, and quantum information theory",
    instructor: "Dr. Lisa Zhang, PhD",
    instructorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100",
    category: "Physics",
    level: "Graduate",
    students: 12340,
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
];

const departments = [
  { title: "Computer Science & Engineering", icon: Code, courseCount: 234 },
  { title: "Business & Management", icon: TrendingUp, courseCount: 189 },
  { title: "Arts & Design", icon: Palette, courseCount: 156 },
  { title: "Languages & Linguistics", icon: Globe, courseCount: 203 },
  { title: "Data Science & Analytics", icon: Brain, courseCount: 178 },
  { title: "Humanities & Social Sciences", icon: BookOpen, courseCount: 145 },
];

export function Academics() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-accent/30 to-background py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-block mb-6 px-4 py-2 bg-primary/10 rounded" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
              ACADEMIC_PROGRAMS.EXE
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
              Academic Excellence
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed mb-8">
              Discover world-class education across diverse fields of study.
              Our comprehensive academic programs prepare students to lead and innovate in their chosen fields.
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" className="h-12 px-8">
                Browse Programs
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8" asChild>
                <Link to="/course-catalog">Course Catalog</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="bg-muted/40 border-y py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="flex justify-center mb-3">
                <GraduationCap className="w-10 h-10 text-primary" />
              </div>
              <div className="text-3xl font-bold mb-1" style={{ fontFamily: "'VT323', monospace" }}>1,200+</div>
              <div className="text-sm text-muted-foreground">Courses Offered</div>
            </div>
            <div>
              <div className="flex justify-center mb-3">
                <Users className="w-10 h-10 text-primary" />
              </div>
              <div className="text-3xl font-bold mb-1" style={{ fontFamily: "'VT323', monospace" }}>850</div>
              <div className="text-sm text-muted-foreground">Faculty Members</div>
            </div>
            <div>
              <div className="flex justify-center mb-3">
                <BookOpenCheck className="w-10 h-10 text-primary" />
              </div>
              <div className="text-3xl font-bold mb-1" style={{ fontFamily: "'VT323', monospace" }}>65</div>
              <div className="text-sm text-muted-foreground">Degree Programs</div>
            </div>
            <div>
              <div className="flex justify-center mb-3">
                <Award className="w-10 h-10 text-primary" />
              </div>
              <div className="text-3xl font-bold mb-1" style={{ fontFamily: "'VT323', monospace" }}>98%</div>
              <div className="text-sm text-muted-foreground">Graduate Success</div>
            </div>
          </div>
        </div>
      </section>

      {/* Schools & Departments */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="mb-12 text-center">
          <div className="inline-block mb-4 px-4 py-2 bg-primary/10 rounded" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
            LOADING... DEPARTMENTS
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            Schools & Departments
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore our comprehensive academic divisions spanning the arts, sciences, and professional studies
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept, index) => (
            <CategoryCard key={index} {...dept} />
          ))}
        </div>
      </section>

      {/* Featured Courses */}
      <section className="bg-accent/20 py-20 border-y">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12 text-center">
            <div className="inline-block mb-4 px-4 py-2 bg-primary/10 rounded" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
              {'>>>'} POPULAR_COURSES
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
              Featured Courses
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover our most sought-after courses taught by world-renowned faculty
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allCourses.map((course, index) => (
              <CourseCard key={index} {...course} />
            ))}
          </div>
          <div className="mt-12 text-center">
            <Button size="lg" variant="outline">
              View All Courses →
            </Button>
          </div>
        </div>
      </section>

      {/* Academic Resources */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
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
            <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
              Academic Resources
            </h2>
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              Access state-of-the-art facilities, extensive library collections, and cutting-edge research labs.
              Our academic resources are designed to support your scholarly pursuits and research endeavors.
            </p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2.5" />
                <span className="text-muted-foreground">12 specialized research centers and institutes</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2.5" />
                <span className="text-muted-foreground">3 million+ volumes in university libraries</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2.5" />
                <span className="text-muted-foreground">Advanced computing and laboratory facilities</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2.5" />
                <span className="text-muted-foreground">24/7 academic support and tutoring services</span>
              </li>
            </ul>
            <Button className="w-fit">
              Explore Resources →
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            Ready to Begin Your Academic Journey?
          </h2>
          <p className="text-xl mb-10 opacity-95 leading-relaxed">
            Explore our programs, connect with faculty, and discover how EduPrime can help you achieve your academic goals.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" variant="secondary" className="h-12 px-8">
              Request Information
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
              Apply Now
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
