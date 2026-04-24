import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Hash,
  MessageSquare,
  Search,
  Bell,
  Settings,
  KanbanSquare,
  Users,
  FileText,
  Plus,
  ChevronDown,
  Paperclip,
  Smile,
  Send,
} from "lucide-react";
import { useFirebaseAuth as useAuth } from "@/contexts/firebase-auth-context";
import TasksPage from "./tasks";
import { cn } from "@/lib/utils";

type ViewMode = "chat" | "board" | "files";
type Channel = { id: string; name: string; type: "public" | "private" };
type User = { id: string; name: string; avatar?: string; status: "online" | "offline" };

const CHANNELS: Channel[] = [
  { id: "c1", name: "calculus-101", type: "public" },
  { id: "c2", name: "physics-mechanics", type: "public" },
  { id: "c3", name: "project-group-b", type: "private" },
];

const DIRECT_MESSAGES: User[] = [
  { id: "u1", name: "Alice Smith", avatar: "https://i.pravatar.cc/150?u=alice", status: "online" },
  { id: "u2", name: "Bob Jones", avatar: "https://i.pravatar.cc/150?u=bob", status: "offline" },
  { id: "u3", name: "Mr. Davis (Teacher)", status: "online" },
];

export default function StudyArenaPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const user = currentUser?.user;

  const [activeView, setActiveView] = useState<ViewMode>("chat");
  const [activeChannel, setActiveChannel] = useState<string>("c1");

  return (
    <div className="flex h-[calc(100vh-2rem)] overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] font-sans text-zinc-100 shadow-2xl">
      {/* 1. Left Sidebar (Channels & Navigation) */}
      <div className="flex w-64 flex-shrink-0 flex-col border-r border-white/5 bg-[#0e0e0e]">
        {/* Workspace Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-[#111111] px-4">
          <div className="flex cursor-pointer items-center gap-2 text-[15px] font-semibold tracking-tight text-zinc-100 transition-colors hover:text-white">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-500/20 text-xs font-bold text-indigo-400">
              M
            </div>
            Master Plan <ChevronDown className="h-4 w-4 text-zinc-500" />
          </div>
        </div>

        {/* Global Nav Elements */}
        <div className="p-3">
          <Button
            variant="ghost"
            className="h-8 w-full justify-start px-2 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            <Search className="mr-2 h-4 w-4" /> Search...
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-6 px-3 pb-4">
            {/* Core Views */}
            <div className="space-y-0.5">
              <Button
                variant="ghost"
                className={cn(
                  "h-8 w-full justify-start px-2 text-sm font-medium transition-colors",
                  activeView === "board"
                    ? "bg-indigo-500/10 text-indigo-400"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                )}
                onClick={() => setActiveView("board")}
              >
                <KanbanSquare className="mr-2 h-4 w-4" /> Board
              </Button>
              <Button
                variant="ghost"
                className={cn(
                  "h-8 w-full justify-start px-2 text-sm font-medium transition-colors",
                  activeView === "files"
                    ? "bg-indigo-500/10 text-indigo-400"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                )}
                onClick={() => setActiveView("files")}
              >
                <FileText className="mr-2 h-4 w-4" /> Files
              </Button>
            </div>

            {/* Channels */}
            <div>
              <div className="group mb-1 flex cursor-pointer items-center justify-between px-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-300">
                  Channels
                </span>
                <Plus className="h-3.5 w-3.5 text-zinc-500 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100" />
              </div>
              <div className="space-y-0.5">
                {CHANNELS.map((channel) => (
                  <Button
                    key={channel.id}
                    variant="ghost"
                    className={cn(
                      "h-8 w-full justify-start px-2 text-sm font-medium transition-colors",
                      activeView === "chat" && activeChannel === channel.id
                        ? "bg-white/10 text-white"
                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                    )}
                    onClick={() => {
                      setActiveView("chat");
                      setActiveChannel(channel.id);
                    }}
                  >
                    <Hash className="mr-1.5 h-4 w-4 opacity-60" /> {channel.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Direct Messages */}
            <div>
              <div className="group mb-1 flex cursor-pointer items-center justify-between px-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-300">
                  Direct Messages
                </span>
                <Plus className="h-3.5 w-3.5 text-zinc-500 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100" />
              </div>
              <div className="space-y-0.5">
                {DIRECT_MESSAGES.map((dm) => (
                  <Button
                    key={dm.id}
                    variant="ghost"
                    className={cn(
                      "h-8 w-full justify-start px-2 text-sm font-medium transition-colors",
                      activeView === "chat" && activeChannel === dm.id
                        ? "bg-white/10 text-white"
                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                    )}
                    onClick={() => {
                      setActiveView("chat");
                      setActiveChannel(dm.id);
                    }}
                  >
                    <div className="relative mr-2 flex h-4 w-4 items-center justify-center">
                      {dm.avatar ? (
                        <img src={dm.avatar} alt={dm.name} className="h-4 w-4 rounded-sm" />
                      ) : (
                        <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-zinc-800 text-[8px] uppercase">
                          {dm.name.substring(0, 2)}
                        </div>
                      )}
                      {dm.status === "online" && (
                        <div className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border border-[#0e0e0e] bg-emerald-500" />
                      )}
                    </div>
                    <span className="truncate">{dm.name}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* User Footer */}
        <div className="flex shrink-0 cursor-pointer items-center justify-between border-t border-white/5 bg-[#0e0e0e] p-3 transition-colors hover:bg-white/5">
          <div className="flex items-center gap-2 overflow-hidden">
            <Avatar className="h-7 w-7 rounded border border-white/10">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback className="rounded bg-indigo-600 text-[10px] text-white">
                {user?.displayName?.substring(0, 2).toUpperCase() || "ME"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-white">
                {user?.displayName || "Student"}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online
              </span>
            </div>
          </div>
          <Settings className="h-4 w-4 text-zinc-500" />
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="relative flex min-w-0 flex-1 flex-col bg-[#0a0a0a]">
        {activeView === "board" && (
          <div className="absolute inset-0 z-10 overflow-hidden rounded-xl bg-[#0a0a0a]">
            <TasksPage />
          </div>
        )}

        {/* Chat / Default View */}
        <div className={cn("flex h-full flex-1 flex-col", activeView === "board" && "hidden")}>
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-[#0a0a0a]/80 px-6 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 font-semibold text-zinc-100">
                {CHANNELS.find((c) => c.id === activeChannel) ? (
                  <Hash className="h-4 w-4 text-zinc-500" />
                ) : null}
                {CHANNELS.find((c) => c.id === activeChannel)?.name ||
                  DIRECT_MESSAGES.find((m) => m.id === activeChannel)?.name ||
                  "General"}
              </span>
            </div>
            <div className="flex items-center gap-4 text-zinc-400">
              <Users className="h-4 w-4 cursor-pointer transition-colors hover:text-zinc-200" />
              <Settings className="h-4 w-4 cursor-pointer transition-colors hover:text-zinc-200" />
            </div>
          </div>

          {activeView === "files" ? (
            <div className="flex flex-1 flex-col items-center justify-center text-zinc-500">
              <FileText className="mb-4 h-12 w-12 opacity-50" />
              <p>Shared files view coming soon.</p>
            </div>
          ) : (
            <>
              {/* Messages Area */}
              <ScrollArea className="flex-1 p-6">
                <div className="mx-auto flex max-w-4xl flex-col gap-6">
                  {/* Mock Intro */}
                  <div className="mb-4 flex flex-col items-center justify-center border-b border-white/5 py-10">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                      <Hash className="h-8 w-8 text-zinc-400" />
                    </div>
                    <h2 className="mb-2 text-xl font-medium text-white">
                      Welcome to #
                      {CHANNELS.find((c) => c.id === activeChannel)?.name || "the channel"}
                    </h2>
                    <p className="max-w-md text-center text-sm text-zinc-500">
                      This is the start of the channel. Collaborate on assignments and share notes
                      here.
                    </p>
                  </div>

                  {/* Mock Messages */}
                  <div className="group flex gap-4">
                    <Avatar className="h-9 w-9 shrink-0 rounded border border-white/10 bg-[#151515]">
                      <AvatarImage src="https://i.pravatar.cc/150?u=alice" />
                      <AvatarFallback>AL</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <div className="mb-1 flex items-baseline gap-2">
                        <span className="text-[15px] font-medium text-zinc-100">Alice Smith</span>
                        <span className="text-xs text-zinc-500">10:42 AM</span>
                      </div>
                      <p className="text-[15px] leading-relaxed text-zinc-300">
                        Hey everyone! Just dropped the notes for chapter 4 in the files tab. Let me
                        know if you have questions.
                      </p>
                    </div>
                  </div>

                  <div className="group mt-2 flex gap-4">
                    <Avatar className="h-9 w-9 shrink-0 rounded border border-white/10 bg-[#151515]">
                      <AvatarImage src="https://i.pravatar.cc/150?u=bob" />
                      <AvatarFallback>BO</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <div className="mb-1 flex items-baseline gap-2">
                        <span className="text-[15px] font-medium text-zinc-100">Bob Jones</span>
                        <span className="text-xs text-zinc-500">10:45 AM</span>
                      </div>
                      <p className="text-[15px] leading-relaxed text-zinc-300">
                        Awesome, thanks Alice! I'll review them before our study session tomorrow.
                      </p>

                      {/* Embedded File Mock */}
                      <div className="group/file mt-3 flex w-72 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#151515] p-3 transition-colors hover:bg-[#1a1a1a]">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 transition-colors group-hover/file:bg-red-500/20">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate text-sm font-medium text-zinc-200">
                            Chapter4_Notes.pdf
                          </span>
                          <span className="text-xs text-zinc-500">2.4 MB PDF</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="mx-auto w-full max-w-4xl shrink-0 p-4">
                <div className="relative flex flex-col rounded-xl border border-white/10 bg-[#111111] shadow-sm transition-all focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50">
                  <textarea
                    placeholder="Message the group..."
                    className="max-h-32 min-h-[44px] w-full resize-none bg-transparent p-3 text-[15px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-500"
                    rows={1}
                  />
                  <div className="flex items-center justify-between rounded-b-xl border-t border-white/5 bg-[#151515]/50 p-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded bg-transparent text-zinc-400 hover:bg-white/10"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded bg-transparent text-zinc-400 hover:bg-white/10"
                      >
                        <Smile className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 rounded-md bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-500"
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" /> Send
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
