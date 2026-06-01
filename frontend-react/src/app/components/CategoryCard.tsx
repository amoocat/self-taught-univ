import { Card, CardHeader, CardTitle } from "./ui/card";
import { LucideIcon } from "lucide-react";

interface CategoryCardProps {
  title: string;
  icon: LucideIcon;
  courseCount: number;
}

export function CategoryCard({ title, icon: Icon, courseCount }: CategoryCardProps) {
  return (
    <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer hover:border-primary">
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-lg">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{courseCount} courses</p>
        </div>
      </CardHeader>
    </Card>
  );
}
