import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Search, Filter, Check } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";

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
  {
    title: "Financial Analysis and Investment Strategy",
    description: "Learn advanced financial modeling, portfolio management, and investment decision-making",
    instructor: "Professor Robert Chen, CFA",
    instructorAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100",
    category: "Business",
    level: "Graduate",
    students: 34560,
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    title: "Digital Product Design",
    description: "Master user experience design, prototyping, and modern interface development",
    instructor: "Dr. Anna Martinez",
    instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
    category: "Design",
    level: "Professional",
    students: 45670,
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1561070791-2526d30994b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    title: "Cloud Infrastructure and DevOps",
    description: "Build and manage scalable cloud systems with modern DevOps practices and tools",
    instructor: "Professor Marcus Lee, PhD",
    instructorAvatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100",
    category: "Engineering",
    level: "Advanced",
    students: 29340,
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    title: "Constitutional Law and Civil Liberties",
    description: "Examine the foundations of constitutional law and contemporary civil rights issues",
    instructor: "Professor Jennifer Williams, JD",
    instructorAvatar: "https://images.unsplash.com/photo-1573496799652-408c2ac9fe98?w=100",
    category: "Law",
    level: "Graduate",
    students: 23450,
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    title: "Organic Chemistry",
    description: "Study the structure, properties, and reactions of organic compounds and materials",
    instructor: "Dr. Thomas Anderson, PhD",
    instructorAvatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=100",
    category: "Chemistry",
    level: "Undergraduate",
    students: 56780,
    rating: 4.5,
    imageUrl: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    title: "Modern European History",
    description: "Explore major political, social, and cultural developments in Europe from 1789 to present",
    instructor: "Professor Catherine Brown, PhD",
    instructorAvatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100",
    category: "History",
    level: "Undergraduate",
    students: 41230,
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
];

const categories = [
  "All",
  "Computer Science",
  "Engineering",
  "Business",
  "Technology",
  "Physics",
  "Design",
  "Law",
  "Chemistry",
  "History",
];

const levels = ["All", "Undergraduate", "Graduate", "Advanced", "Professional"];

export function CourseCatalog() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedLevel, setSelectedLevel] = useState("All");
  const [enrolledCourses, setEnrolledCourses] = useState<string[]>([]);

  useEffect(() => {
    const savedCourses = localStorage.getItem("myCourses");
    if (savedCourses) {
      const courses = JSON.parse(savedCourses);
      setEnrolledCourses(courses.map((c: any) => c.title));
    }
  }, []);

  const handleEnroll = (course: typeof allCourses[0]) => {
    const savedCourses = localStorage.getItem("myCourses");
    const courses = savedCourses ? JSON.parse(savedCourses) : [];

    const isEnrolled = courses.some((c: any) => c.title === course.title);
    if (isEnrolled) {
      navigate("/my-page");
      return;
    }

    const newCourse = {
      id: Date.now().toString(),
      title: course.title,
      instructor: course.instructor,
      category: course.category,
      progress: 0,
    };

    const updatedCourses = [...courses, newCourse];
    localStorage.setItem("myCourses", JSON.stringify(updatedCourses));
    setEnrolledCourses([...enrolledCourses, course.title]);
  };

  const filteredCourses = allCourses.filter((course) => {
    const matchesSearch =
      searchQuery === "" ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.instructor.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "All" || course.category === selectedCategory;

    const matchesLevel =
      selectedLevel === "All" || course.level === selectedLevel;

    return matchesSearch && matchesCategory && matchesLevel;
  });

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-primary/10 to-background py-20 border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-block mb-6 px-4 py-2 bg-primary/10 rounded" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
              CATALOG_SEARCH.EXE
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
              Course Catalog
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed mb-8">
              Browse our complete collection of courses. Find the perfect program to advance your education and career.
            </p>
          </div>
        </div>
      </section>

      {/* Search and Filter Section */}
      <section className="bg-muted/30 py-8 border-b sticky top-[73px] z-40 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
        <div className="max-w-7xl mx-auto px-6">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                type="text"
                placeholder="Search courses, instructors, or topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 text-base"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Category:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>
          </div>

          {/* Level Filter */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Level:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {levels.map((level) => (
                <Badge
                  key={level}
                  variant={selectedLevel === level ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => setSelectedLevel(level)}
                >
                  {level}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {filteredCourses.length} {filteredCourses.length === 1 ? "Course" : "Courses"} Found
              </h2>
              <p className="text-muted-foreground">
                {selectedCategory !== "All" && `${selectedCategory} • `}
                {selectedLevel !== "All" && `${selectedLevel} Level`}
              </p>
            </div>
            {(searchQuery || selectedCategory !== "All" || selectedLevel !== "All") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                  setSelectedLevel("All");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course, index) => {
              const isEnrolled = enrolledCourses.includes(course.title);
              return (
                <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
                  <div className="aspect-video w-full overflow-hidden bg-muted">
                    <img
                      src={course.imageUrl}
                      alt={course.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <CardHeader>
                    <div className="flex gap-2 mb-2">
                      <Badge variant="secondary">{course.category}</Badge>
                      <Badge variant="outline" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px" }}>
                        {course.level}
                      </Badge>
                    </div>
                    <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={course.instructorAvatar} />
                          <AvatarFallback>{course.instructor.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground">{course.instructor}</span>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      variant={isEnrolled ? "outline" : "default"}
                      onClick={() => handleEnroll(course)}
                    >
                      {isEnrolled ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Enrolled
                        </>
                      ) : (
                        "Enroll Now"
                      )}
                    </Button>
                  </CardContent>
                  <CardFooter className="flex justify-between text-sm text-muted-foreground">
                    <span>⭐ {course.rating.toFixed(1)}</span>
                    <span>{course.students.toLocaleString()} students</span>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold mb-2">No courses found</h3>
            <p className="text-muted-foreground mb-6">
              Try adjusting your filters or search query
            </p>
            <Button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
                setSelectedLevel("All");
              }}
            >
              Reset Filters
            </Button>
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="bg-accent/20 py-16 border-t">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            Can't Find What You're Looking For?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Our academic advisors are here to help you find the perfect program for your goals.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="h-12 px-8">
              Contact an Advisor
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8">
              View All Programs
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
