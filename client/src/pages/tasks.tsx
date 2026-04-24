import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Plus,
  MoreHorizontal,
  Calendar,
  MessageSquare,
  Paperclip,
  ChevronDown,
  Filter,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

type TaskStatus = "backlog" | "todo" | "in-progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: { name: string; avatar?: string };
  tags: string[];
  dueDate?: string;
  comments: number;
  attachments: number;
}

const STATUSES: { id: TaskStatus; label: string; icon: React.ReactNode; color: string }[] = [
  {
    id: "backlog",
    label: "Backlog",
    icon: <div className="h-3 w-3 rounded-full border-2 border-dashed border-zinc-400" />,
    color: "text-zinc-300",
  },
  {
    id: "todo",
    label: "To Do",
    icon: <div className="h-3 w-3 rounded-full border-2 border-zinc-200" />,
    color: "text-zinc-100",
  },
  {
    id: "in-progress",
    label: "In Progress",
    icon: <div className="h-3 w-3 rounded-full border-2 border-amber-400 bg-amber-400/30" />,
    color: "text-amber-300",
  },
  {
    id: "review",
    label: "Review",
    icon: <div className="h-3 w-3 rounded-full border-2 border-blue-400 bg-blue-400/30" />,
    color: "text-blue-300",
  },
  {
    id: "done",
    label: "Done",
    icon: (
      <div className="flex h-3 w-3 items-center justify-center rounded-full bg-indigo-400">
        <div className="h-1.5 w-1.5 rounded-full bg-zinc-900" />
      </div>
    ),
    color: "text-indigo-300",
  },
];

const PRIORITY_ICONS: Record<TaskPriority, React.ReactNode> = {
  low: (
    <div className="mt-0.5 flex gap-0.5">
      <div className="h-1.5 w-1.5 rounded-sm bg-zinc-400" />
      <div className="h-1.5 w-1.5 rounded-sm bg-zinc-700" />
      <div className="h-1.5 w-1.5 rounded-sm bg-zinc-700" />
    </div>
  ),
  medium: (
    <div className="mt-0.5 flex gap-0.5">
      <div className="h-1.5 w-1.5 rounded-sm bg-amber-400" />
      <div className="h-1.5 w-1.5 rounded-sm bg-amber-400" />
      <div className="h-1.5 w-1.5 rounded-sm bg-zinc-700" />
    </div>
  ),
  high: (
    <div className="mt-0.5 flex gap-0.5">
      <div className="h-1.5 w-1.5 rounded-sm bg-rose-400" />
      <div className="h-1.5 w-1.5 rounded-sm bg-rose-400" />
      <div className="h-1.5 w-1.5 rounded-sm bg-rose-400" />
    </div>
  ),
  urgent: (
    <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-rose-400/60 bg-rose-500/30">
      <div className="h-2 w-1 rounded-[1px] bg-rose-400" />
    </div>
  ),
};

export default function TasksPage() {
  const qc = useQueryClient();
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────
  const {
    data: tasks = [],
    isLoading,
    isError,
    error,
  } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  // ── Status update (drag-and-drop) ──────────────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      apiRequest("PATCH", `/api/tasks/${id}`, { status }).then((r) => r.json()),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["/api/tasks"] });
      const previous = qc.getQueryData<Task[]>(["/api/tasks"]);
      qc.setQueryData<Task[]>(["/api/tasks"], (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, status } : t))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["/api/tasks"], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  // ── Delete ─────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/tasks/${id}`),
    onSettled: () => qc.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  // ── Drag handlers ──────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTask(id);
    e.dataTransfer.setData("taskId", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) {
      updateStatusMutation.mutate({ id: taskId, status: newStatus });
    }
    setDraggedTask(null);
  };

  // ── Loading / error states ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-2rem)] flex-col items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-50 shadow-2xl">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="text-sm text-zinc-300">Loading tasks…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[calc(100vh-2rem)] flex-col items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-50 shadow-2xl">
        <AlertCircle className="h-8 w-8 text-rose-400" />
        <p className="text-sm text-zinc-300">
          {error instanceof Error ? error.message : "Failed to load tasks"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 font-sans text-zinc-50 shadow-2xl selection:bg-indigo-500/30">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/40 bg-indigo-500/20">
            <div className="h-4 w-4 rounded-sm bg-indigo-400" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-50">
              Master Plan <ChevronDown className="h-4 w-4 text-zinc-400" />
            </h1>
            <p className="text-xs font-medium tracking-wide text-zinc-400">STUDY TRACKER</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="hidden border border-transparent text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-50 sm:flex"
          >
            <Filter className="mr-2 h-4 w-4" /> View
          </Button>
          <div className="mx-2 hidden h-6 w-px bg-zinc-700 sm:block" />
          <Button
            size="sm"
            className="border border-indigo-500/50 bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:bg-indigo-500"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New Issue
          </Button>
        </div>
      </div>

      {/* Board */}
      <div className="hidden-scrollbar flex-1 overflow-x-auto overflow-y-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNCkiLz48L3N2Zz4=')] p-6">
        <div className="flex h-full w-max items-start gap-6">
          {STATUSES.map((status) => {
            const columnTasks = tasks.filter((t) => t.status === status.id);

            return (
              <div
                key={status.id}
                className="flex max-h-full w-[320px] shrink-0 flex-col"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status.id)}
              >
                {/* Column Header */}
                <div className="mb-3 flex items-center justify-between pl-1 pr-2">
                  <div className="flex items-center gap-2">
                    {status.icon}
                    <span className={cn("text-sm font-medium tracking-wide", status.color)}>
                      {status.label}
                    </span>
                    <span className="rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-xs font-medium text-zinc-400">
                      {columnTasks.length}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Task List */}
                <div className="hidden-scrollbar flex min-h-[100px] flex-1 flex-col gap-2.5 overflow-y-auto pb-2">
                  <AnimatePresence>
                    {columnTasks.map((task) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        key={task.id}
                        draggable
                        onDragStart={(e: any) => handleDragStart(e, task.id)}
                        onDragEnd={() => setDraggedTask(null)}
                        className={cn(
                          "group cursor-grab rounded-lg border border-zinc-800 bg-zinc-900 p-3 transition-all hover:border-zinc-700 hover:bg-zinc-800 active:cursor-grabbing",
                          draggedTask === task.id
                            ? "scale-95 border-indigo-500/50 opacity-40"
                            : "shadow-sm"
                        )}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug text-zinc-100 transition-colors group-hover:text-zinc-50">
                            {task.title}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="-mr-1 -mt-1 h-5 w-5 rounded text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-700 hover:text-zinc-200 group-hover:opacity-100"
                            onClick={() => deleteMutation.mutate(task.id)}
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {task.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="rounded border-zinc-700 bg-zinc-800 px-1.5 py-0 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>

                        <div className="mt-auto flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2.5 text-zinc-400">
                            <span className="cursor-pointer text-[11px] font-semibold tracking-wider transition-colors hover:text-indigo-400">
                              {task.id}
                            </span>

                            {(task.comments > 0 || task.attachments > 0) && (
                              <div className="flex items-center gap-2">
                                {task.comments > 0 && (
                                  <div className="flex items-center gap-0.5 text-[10px]">
                                    <MessageSquare className="h-3 w-3" /> {task.comments}
                                  </div>
                                )}
                                {task.attachments > 0 && (
                                  <div className="flex items-center gap-0.5 text-[10px]">
                                    <Paperclip className="h-3 w-3" /> {task.attachments}
                                  </div>
                                )}
                              </div>
                            )}

                            {task.dueDate && (
                              <div
                                className={cn(
                                  "flex items-center gap-1 text-[10px]",
                                  task.dueDate === "Today" ? "text-rose-400" : "text-amber-400/80"
                                )}
                              >
                                <Calendar className="h-3 w-3" /> {task.dueDate}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {PRIORITY_ICONS[task.priority]}

                            {task.assignee ? (
                              <Avatar className="h-5 w-5 border border-zinc-700">
                                {task.assignee.avatar ? (
                                  <AvatarImage src={task.assignee.avatar} />
                                ) : null}
                                <AvatarFallback className="bg-indigo-900 text-[9px] uppercase text-indigo-200">
                                  {task.assignee.name.substring(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-zinc-600 bg-zinc-800/20">
                                <Plus className="h-3 w-3 text-zinc-500" />
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Drop zone visual hint when empty */}
                  {columnTasks.length === 0 && (
                    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30">
                      <span className="text-xs font-medium tracking-wide text-zinc-500">
                        Drop issues here
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
