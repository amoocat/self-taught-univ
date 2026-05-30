import { Button } from "../components/ui/button";
import { CourseCard } from "../components/CourseCard";
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

    </>
  );
}
