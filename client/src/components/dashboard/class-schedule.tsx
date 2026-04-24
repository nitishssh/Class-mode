import { useQuery } from "@tanstack/react-query";
import { Calendar, ClipboardList, Clock, Users, Laptop } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

interface ClassSession {
  id: number;
  title: string;
  class: string;
  time: string;
  duration: string;
  students: number;
  isLiveClass: boolean;
}

interface ScheduleDay {
  day: string;
  date: string;
  sessions: ClassSession[];
}

export function ClassSchedule() {
  const { data: scheduleData, isLoading } = useQuery<ScheduleDay[]>({
    queryKey: ["/api/class-schedule"],
    enabled: false, // Disabled for now until API endpoint is implemented
  });

  // Mock data for UI demonstration
  const mockSchedule: ScheduleDay[] = [
    {
      day: "Today",
      date: new Date().toISOString().split("T")[0],
      sessions: [
        {
          id: 1,
          title: "Physics - Forces & Motion",
          class: "10-A",
          time: "09:00 AM",
          duration: "45m",
          students: 32,
          isLiveClass: false,
        },
        {
          id: 2,
          title: "Chemistry Lab Session",
          class: "11-B",
          time: "11:30 AM",
          duration: "60m",
          students: 28,
          isLiveClass: true,
        },
      ],
    },
    {
      day: "Tomorrow",
      date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      sessions: [
        {
          id: 3,
          title: "Mathematics - Algebra",
          class: "9-B",
          time: "10:15 AM",
          duration: "45m",
          students: 26,
          isLiveClass: false,
        },
        {
          id: 4,
          title: "Biology - Cellular Structure",
          class: "10-A",
          time: "02:00 PM",
          duration: "45m",
          students: 32,
          isLiveClass: false,
        },
      ],
    },
    {
      day: "Wednesday",
      date: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
      sessions: [
        {
          id: 5,
          title: "Computer Science - Algorithms",
          class: "11-A",
          time: "09:30 AM",
          duration: "60m",
          students: 24,
          isLiveClass: true,
        },
      ],
    },
  ];

  if (isLoading) {
    return <ScheduleSkeleton />;
  }

  const schedule = scheduleData || mockSchedule;

  return (
    <Card className="overflow-hidden border-border bg-card shadow-soft">
      <CardHeader className="border-b border-border bg-muted/50 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-accent" />
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Class Schedule
            </CardTitle>
          </div>
          <CardDescription className="mt-0 text-xs font-semibold text-accent/80">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs defaultValue="Today">
          <TabsList className="mb-6 grid grid-cols-3 rounded-xl bg-muted p-1">
            {schedule.map((day) => (
              <TabsTrigger
                key={day.day}
                value={day.day}
                className="rounded-lg text-xs font-bold uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:text-accent data-[state=active]:shadow-soft"
              >
                {day.day}
              </TabsTrigger>
            ))}
          </TabsList>

          {schedule.map((day) => (
            <TabsContent
              key={day.day}
              value={day.day}
              className="m-0 space-y-4 transition-all duration-300"
            >
              {day.sessions.length === 0 ? (
                <div className="py-8 text-center font-body italic text-muted-foreground">
                  No classes scheduled for this day
                </div>
              ) : (
                day.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all duration-300 hover:bg-muted/50 hover:shadow-soft"
                  >
                    <div
                      className={`shrink-0 rounded-xl p-3 shadow-soft transition-colors ${
                        session.isLiveClass
                          ? "bg-rose-50 text-rose-600 shadow-rose-100"
                          : "shadow-accent-100 bg-accent-soft text-accent"
                      }`}
                    >
                      {session.isLiveClass ? (
                        <Laptop className="h-5 w-5" />
                      ) : (
                        <ClipboardList className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-[15px] text-foreground transition-colors group-hover:text-accent">
                        {session.title}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        <span className="rounded-md bg-muted px-2 py-0.5">
                          Class {session.class}
                        </span>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{session.students} students</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="flex items-center justify-end gap-1.5 font-display text-sm text-accent">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{session.time}</span>
                      </div>
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {session.duration} session
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ScheduleSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="mb-6 h-10 w-full" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
