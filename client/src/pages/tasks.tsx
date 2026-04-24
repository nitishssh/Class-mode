import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, Calendar, MessageSquare, Paperclip, ChevronDown, Filter, Loader2, AlertCircle } from "lucide-react";
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
    { id: "backlog", label: "Backlog", icon: <div className="w-3 h-3 rounded-full border-2 border-dashed border-zinc-400" />, color: "text-zinc-300" },
    { id: "todo", label: "To Do", icon: <div className="w-3 h-3 rounded-full border-2 border-zinc-200" />, color: "text-zinc-100" },
    { id: "in-progress", label: "In Progress", icon: <div className="w-3 h-3 rounded-full border-2 border-amber-400 bg-amber-400/30" />, color: "text-amber-300" },
    { id: "review", label: "Review", icon: <div className="w-3 h-3 rounded-full border-2 border-blue-400 bg-blue-400/30" />, color: "text-blue-300" },
    { id: "done", label: "Done", icon: <div className="w-3 h-3 bg-indigo-400 rounded-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-zinc-900 rounded-full" /></div>, color: "text-indigo-300" }
];

const PRIORITY_ICONS: Record<TaskPriority, React.ReactNode> = {
    low: <div className="flex gap-0.5 mt-0.5"><div className="w-1.5 h-1.5 bg-zinc-400 rounded-sm" /><div className="w-1.5 h-1.5 bg-zinc-700 rounded-sm" /><div className="w-1.5 h-1.5 bg-zinc-700 rounded-sm" /></div>,
    medium: <div className="flex gap-0.5 mt-0.5"><div className="w-1.5 h-1.5 bg-amber-400 rounded-sm" /><div className="w-1.5 h-1.5 bg-amber-400 rounded-sm" /><div className="w-1.5 h-1.5 bg-zinc-700 rounded-sm" /></div>,
    high: <div className="flex gap-0.5 mt-0.5"><div className="w-1.5 h-1.5 bg-rose-400 rounded-sm" /><div className="w-1.5 h-1.5 bg-rose-400 rounded-sm" /><div className="w-1.5 h-1.5 bg-rose-400 rounded-sm" /></div>,
    urgent: <div className="w-4 h-4 rounded-sm bg-rose-500/30 flex items-center justify-center border border-rose-400/60"><div className="w-1 h-2 bg-rose-400 rounded-[1px]" /></div>,
};

export default function TasksPage() {
    const qc = useQueryClient();
    const [draggedTask, setDraggedTask] = useState<string | null>(null);

    // ── Fetch ──────────────────────────────────────────────────────────────
    const { data: tasks = [], isLoading, isError, error } = useQuery<Task[]>({
        queryKey: ["/api/tasks"],
    });



    // ── Status update (drag-and-drop) ──────────────────────────────────────
    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
            apiRequest("PATCH", `/api/tasks/${id}`, { status }).then(r => r.json()),
        onMutate: async ({ id, status }) => {
            await qc.cancelQueries({ queryKey: ["/api/tasks"] });
            const previous = qc.getQueryData<Task[]>(["/api/tasks"]);
            qc.setQueryData<Task[]>(["/api/tasks"], old =>
                (old ?? []).map(t => t.id === id ? { ...t, status } : t)
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
        mutationFn: (id: string) =>
            apiRequest("DELETE", `/api/tasks/${id}`),
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
            <div className="flex flex-col h-[calc(100vh-2rem)] bg-zinc-950 text-zinc-50 rounded-xl border border-zinc-800 shadow-2xl items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-sm text-zinc-300">Loading tasks…</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col h-[calc(100vh-2rem)] bg-zinc-950 text-zinc-50 rounded-xl border border-zinc-800 shadow-2xl items-center justify-center gap-3">
                <AlertCircle className="w-8 h-8 text-rose-400" />
                <p className="text-sm text-zinc-300">
                    {error instanceof Error ? error.message : "Failed to load tasks"}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30 overflow-hidden rounded-xl border border-zinc-800 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                        <div className="w-4 h-4 bg-indigo-400 rounded-sm" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight text-zinc-50 flex items-center gap-2">
                            Master Plan <ChevronDown className="w-4 h-4 text-zinc-400" />
                        </h1>
                        <p className="text-xs text-zinc-400 font-medium tracking-wide">STUDY TRACKER</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 hidden sm:flex">
                        <Filter className="w-4 h-4 mr-2" /> View
                    </Button>
                    <div className="w-px h-6 bg-zinc-700 mx-2 hidden sm:block" />
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                        <Plus className="w-4 h-4 mr-1.5" />
                        New Issue
                    </Button>
                </div>
            </div>

            {/* Board */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 hidden-scrollbar bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNCkiLz48L3N2Zz4=')]">
                <div className="flex h-full gap-6 w-max items-start">
                    {STATUSES.map(status => {
                        const columnTasks = tasks.filter(t => t.status === status.id);

                        return (
                            <div
                                key={status.id}
                                className="w-[320px] shrink-0 flex flex-col max-h-full"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, status.id)}
                            >
                                {/* Column Header */}
                                <div className="flex items-center justify-between pl-1 pr-2 mb-3">
                                    <div className="flex items-center gap-2">
                                        {status.icon}
                                        <span className={cn("text-sm font-medium tracking-wide", status.color)}>
                                            {status.label}
                                        </span>
                                        <span className="text-xs font-medium text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded-md border border-zinc-800">
                                            {columnTasks.length}
                                        </span>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200">
                                        <Plus className="w-3.5 h-3.5" />
                                    </Button>
                                </div>

                                {/* Task List */}
                                <div className="flex-1 overflow-y-auto hidden-scrollbar min-h-[100px] flex flex-col gap-2.5 pb-2">
                                    <AnimatePresence>
                                        {columnTasks.map(task => (
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
                                                    "bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all group",
                                                    draggedTask === task.id ? "opacity-40 border-indigo-500/50 scale-95" : "shadow-sm"
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <p className="text-sm font-medium text-zinc-100 leading-snug group-hover:text-zinc-50 transition-colors">
                                                        {task.title}
                                                    </p>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-5 w-5 rounded opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                                                        onClick={() => deleteMutation.mutate(task.id)}
                                                    >
                                                        <MoreHorizontal className="w-3 h-3" />
                                                    </Button>
                                                </div>

                                                <div className="flex flex-wrap gap-1.5 mb-3">
                                                    {task.tags.map(tag => (
                                                        <Badge key={tag} variant="outline" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-[10px] px-1.5 py-0 border-zinc-700 rounded">
                                                            {tag}
                                                        </Badge>
                                                    ))}
                                                </div>

                                                <div className="flex items-center justify-between mt-auto pt-1">
                                                    <div className="flex items-center gap-2.5 text-zinc-400">
                                                        <span className="text-[11px] font-semibold tracking-wider hover:text-indigo-400 transition-colors cursor-pointer">
                                                            {task.id}
                                                        </span>

                                                        {(task.comments > 0 || task.attachments > 0) && (
                                                            <div className="flex gap-2 items-center">
                                                                {task.comments > 0 && (
                                                                    <div className="flex items-center text-[10px] gap-0.5">
                                                                        <MessageSquare className="w-3 h-3" /> {task.comments}
                                                                    </div>
                                                                )}
                                                                {task.attachments > 0 && (
                                                                    <div className="flex items-center text-[10px] gap-0.5">
                                                                        <Paperclip className="w-3 h-3" /> {task.attachments}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {task.dueDate && (
                                                            <div className={cn("flex items-center text-[10px] gap-1", task.dueDate === "Today" ? "text-rose-400" : "text-amber-400/80")}>
                                                                <Calendar className="w-3 h-3" /> {task.dueDate}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {PRIORITY_ICONS[task.priority]}

                                                        {task.assignee ? (
                                                            <Avatar className="w-5 h-5 border border-zinc-700">
                                                                {task.assignee.avatar ? (
                                                                    <AvatarImage src={task.assignee.avatar} />
                                                                ) : null}
                                                                <AvatarFallback className="bg-indigo-900 text-indigo-200 text-[9px] uppercase">
                                                                    {task.assignee.name.substring(0, 2)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full border border-dashed border-zinc-600 flex items-center justify-center bg-zinc-800/20">
                                                                <Plus className="w-3 h-3 text-zinc-500" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    {/* Drop zone visual hint when empty */}
                                    {columnTasks.length === 0 && (
                                        <div className="h-24 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 flex items-center justify-center">
                                            <span className="text-xs text-zinc-500 font-medium tracking-wide">Drop issues here</span>
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
