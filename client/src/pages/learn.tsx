import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Sparkles,
  BookOpen,
  Search,
  Construction,
  ArrowRight,
  PlayCircle,
  FlaskConical,
  FileText,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AiTutor from "@/pages/ai-tutor";
import StudyArenaPage from "@/pages/ai-classroom";

type Mode = "ask" | "practice" | "read";

const MODES: { id: Mode; label: string; blurb: string; icon: typeof Brain }[] = [
  { id: "ask", label: "Ask", blurb: "Chat with your AI tutor", icon: Brain },
  { id: "practice", label: "Practice", blurb: "Generate an interactive lesson", icon: Sparkles },
  { id: "read", label: "Read", blurb: "Curated notes & materials", icon: BookOpen },
];

function readModeFromUrl(): Mode {
  const m = new URLSearchParams(window.location.search).get("mode");
  return m === "practice" || m === "read" ? m : "ask";
}

interface Resource {
  id: number;
  title: string;
  description: string;
  type: string;
  subject: string | null;
  topic: string | null;
  url: string | null;
}

const RESOURCE_ICON: Record<string, typeof BookOpen> = {
  video: PlayCircle,
  lab: FlaskConical,
  textbook: FileText,
};

/** Read tab: real, topic-aware resources from /api/resources. */
function ReadResources({ topic }: { topic: string }) {
  const { data, isLoading } = useQuery<{ resources: Resource[] }>({
    queryKey: ["resources", topic],
    queryFn: async () => {
      const qs = topic ? `?topic=${encodeURIComponent(topic)}` : "";
      const res = await fetch(`/api/resources${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load resources");
      return res.json();
    },
  });

  const resources = data?.resources ?? [];

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
          <Construction className="h-8 w-8 text-accent" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            No materials yet{topic ? "" : ""}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {topic ? (
              <>
                Nothing curated for{" "}
                <span className="font-medium text-foreground">{topic}</span> yet — try the Ask or
                Practice tab, or pick another topic.
              </>
            ) : (
              "Enter a topic above to find curated notes, videos, and labs."
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {resources.map((r) => {
        const Icon = RESOURCE_ICON[r.type] ?? FileText;
        const card = (
          <div className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:border-accent/40 hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon className="h-5 w-5" />
              </span>
              <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {r.type}
              </span>
            </div>
            <div className="flex-1">
              <h4 className="font-display font-semibold text-foreground group-hover:text-accent">
                {r.title}
              </h4>
              {r.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
              )}
            </div>
            {r.url && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                Open <ExternalLink className="h-3 w-3" />
              </span>
            )}
          </div>
        );
        // Only linkify http(s) URLs — guards against javascript:/data: XSS.
        const safeUrl = r.url && /^https?:\/\//i.test(r.url) ? r.url : null;
        return safeUrl ? (
          <a key={r.id} href={safeUrl} target="_blank" rel="noreferrer">
            {card}
          </a>
        ) : (
          <div key={r.id}>{card}</div>
        );
      })}
    </div>
  );
}

/**
 * Topic-first learning hub. A student enters a topic once, then moves between
 * three modes around that same topic:
 *   - Ask      → AI Tutor (conversational RAG)
 *   - Practice → AI Classroom (generated interactive lesson)
 *   - Read     → Resources (stub until the Resources backend lands)
 *
 * The active mode is mirrored to the URL (`/learn?mode=practice`) so it is
 * shareable and survives a refresh. Embeds the existing Tutor and Classroom
 * pages rather than duplicating their logic.
 */
export default function LearnPage() {
  const [draft, setDraft] = useState("");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<Mode>(readModeFromUrl);

  const changeMode = (next: string) => {
    const m = next as Mode;
    setMode(m);
    // Mirror to the URL without pushing a new history entry per click.
    window.history.replaceState(null, "", `/learn?mode=${m}`);
  };

  const commitTopic = () => {
    const next = draft.trim();
    if (next) setTopic(next);
  };

  return (
    <div className="animate-fade-in-up space-y-10">
      {/* Header + topic input */}
      <div>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/10 bg-accent-soft px-3 py-1">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Learn</span>
        </div>
        <h1 className="mb-4 font-display text-4xl leading-tight text-foreground md:text-5xl">
          What do you want to learn{topic ? "" : " today"}?
        </h1>
        <p className="mb-7 max-w-2xl font-body text-lg leading-relaxed text-muted-foreground">
          Pick a topic once, then ask questions, generate an interactive lesson, or read up on it
          {topic ? "." : " — all in one place."}
        </p>

        <div className="relative max-w-2xl">
          <div className="absolute -inset-1 -z-10 rounded-2xl bg-accent/10 blur-2xl" />
          <div className="flex gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commitTopic()}
                placeholder="e.g. Electromagnetism, Photosynthesis, Trigonometry"
                className="h-12 border-0 bg-transparent pl-11 text-base shadow-none focus-visible:ring-0"
                aria-label="Topic"
              />
            </div>
            <Button
              onClick={commitTopic}
              className="h-12 gap-2 rounded-xl bg-accent px-6 font-semibold text-accent-foreground hover:bg-accent-hover"
            >
              Go <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {topic && (
          <p className="mt-4 text-sm text-muted-foreground">
            Learning about{" "}
            <span className="rounded-md bg-accent-soft px-2 py-0.5 font-semibold text-accent">
              {topic}
            </span>
          </p>
        )}
      </div>

      {/* Modes */}
      <Tabs value={mode} onValueChange={changeMode} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-3 bg-transparent p-0 sm:grid-cols-3">
          {MODES.map(({ id, label, blurb, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className={cn(
                "flex h-auto flex-col items-start gap-1 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-accent/40",
                "data-[state=active]:border-accent data-[state=active]:bg-accent-soft data-[state=active]:shadow-sm"
              )}
            >
              <span className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
                <Icon className="h-4 w-4 text-accent" />
                {label}
              </span>
              <span className="text-xs text-muted-foreground">{blurb}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-8 border-t border-border pt-8">
          <TabsContent value="ask" className="mt-0">
            <AiTutor initialTopic={topic} />
          </TabsContent>

          <TabsContent value="practice" className="mt-0">
            {/* Remount when the topic changes so the generator picks up the new topic. */}
            <StudyArenaPage key={topic} initialTopic={topic} />
          </TabsContent>

          <TabsContent value="read" className="mt-0">
            <ReadResources topic={topic} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
