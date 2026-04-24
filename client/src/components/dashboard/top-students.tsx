import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface TopStudentProps {
  id: number;
  name: string;
  class: string;
  avatar?: string;
  score: number;
}

export function TopStudents() {
  const { data: students, isLoading } = useQuery<TopStudentProps[]>({
    queryKey: ["/api/top-students"],
    enabled: false, // Disabled for now until API endpoint is implemented
  });

  // Mock data for UI demonstration
  const mockStudents: TopStudentProps[] = [
    { id: 1, name: "Jatin Mehta", class: "10-A", score: 96 },
    { id: 2, name: "Priya Sharma", class: "10-B", score: 94 },
    { id: 3, name: "Akash Singh", class: "10-A", score: 91 },
  ];

  if (isLoading) {
    return <TopStudentsSkeleton />;
  }

  const displayStudents = students || mockStudents;

  return (
    <div className="space-y-4">
      {displayStudents.map((student) => (
        <div key={student.id} className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar>
              {student.avatar ? (
                <AvatarImage src={student.avatar} alt={student.name} />
              ) : (
                <AvatarFallback>{getInitials(student.name)}</AvatarFallback>
              )}
            </Avatar>
            <div>
              <div className="text-sm font-medium">{student.name}</div>
              <div className="text-xs text-muted-foreground">Class {student.class}</div>
            </div>
          </div>
          <div className="text-sm font-medium">{student.score}%</div>
        </div>
      ))}
    </div>
  );
}

function TopStudentsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div>
              <Skeleton className="mb-1 h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}
