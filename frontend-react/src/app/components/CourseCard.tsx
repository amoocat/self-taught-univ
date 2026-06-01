import { Link } from "react-router";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface CourseCardProps {
  title: string;
  description: string;
  instructor: string;
  instructorAvatar?: string;
  category: string;
  level: string;
  students: number;
  rating: number;
  imageUrl: string;
  courseId?: string;
}

export function CourseCard({
  title,
  description,
  instructor,
  instructorAvatar,
  category,
  level,
  students,
  rating,
  imageUrl,
  courseId,
}: CourseCardProps) {
  const card = (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer">
      <div className="aspect-video w-full overflow-hidden bg-muted">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
      </div>
      <CardHeader>
        <div className="flex gap-2 mb-2">
          <Badge variant="secondary">{category}</Badge>
          <Badge variant="outline" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px" }}>
            {level}
          </Badge>
        </div>
        <CardTitle className="line-clamp-2">{title}</CardTitle>
        <CardDescription className="line-clamp-2">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={instructorAvatar} />
              <AvatarFallback>{instructor.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{instructor}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between text-sm text-muted-foreground">
        <span>⭐ {rating.toFixed(1)}</span>
        <span>{students.toLocaleString()} lectures</span>
      </CardFooter>
    </Card>
  );
  return courseId ? <Link to={`/course/${courseId}`}>{card}</Link> : card;
}
