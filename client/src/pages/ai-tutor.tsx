import { useState } from "react";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { BentoHeroCard } from "@/components/chat/bento-hero-card";
import { BentoSubjectCard } from "@/components/chat/bento-subject-card";
import { RagChatSheet } from "@/components/chat/rag-chat-sheet";
import { Sparkles, Rocket, Trophy, Code, GraduationCap } from "lucide-react";

export default function AiTutor() {
  const { currentUser } = useFirebaseAuth();
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [initialPrompt, setInitialPrompt] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Use real subjects from profile or fallback
  const userSubjects = currentUser?.profile?.subjects || [];

  const subjects =
    userSubjects.length > 0
      ? userSubjects.map((s) => ({
          id: s.toLowerCase(),
          name: s,
          description: `Your enrolled ${s} module.`,
          tag: "ENROLLED",
          progress: 0,
          icon: <GraduationCap className="h-16 w-16 text-accent" strokeWidth={1.5} />,
          isLocked: false,
        }))
      : [
          {
            id: "general",
            name: "General Study",
            description: "Ask anything about your curriculum.",
            tag: "GUEST",
            progress: 0,
            icon: <Sparkles className="h-16 w-16 text-accent" strokeWidth={1.5} />,
            isLocked: false,
          },
        ];

  const handleAction = (subjectName: string, action: "revise" | "practice" | "chat") => {
    setActiveSubject(subjectName);
    if (action === "chat") {
      setInitialPrompt("");
    } else if (action === "revise") {
      setInitialPrompt(
        `I want to revise the key concepts for ${subjectName}. Where should I start?`
      );
    } else if (action === "practice") {
      setInitialPrompt(`Give me a quick 3-question practice quiz for ${subjectName}.`);
    }
    setIsChatOpen(true);
  };

  return (
    <div className="animate-fade-in-up space-y-10">
      {/* Header Section */}
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/10 bg-accent-soft px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
              AI Intelligent Tutor
            </span>
          </div>
          <h1 className="mb-4 font-display text-4xl leading-tight text-foreground md:text-5xl">
            Welcome back, {currentUser?.profile?.displayName?.split(" ")[0] || "Scholar"}.
          </h1>
          <p className="max-w-2xl font-body text-lg leading-relaxed text-muted-foreground">
            Your personalized learning journey is evolving. Ask EduAI to clarify complex theories or
            generate practice paths tailored to your recent progress.
          </p>
        </div>
      </div>

      {/* Hero Section */}
      <section className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <BentoHeroCard
          title="Focus Session: Physics"
          description="You've mastered 65% of Advanced Mechanics. EduAI suggests focusing on Rotational Motion today to bridge the gap in your recent quiz performance."
          ctaText="Start Learning Session"
          visual={
            <div className="group relative">
              <div className="absolute inset-0 scale-75 rounded-full bg-accent/20 blur-3xl transition-transform duration-700 group-hover:scale-100" />
              <Rocket
                className="relative z-10 h-24 w-24 text-accent drop-shadow-sm transition-transform duration-500 group-hover:-translate-y-2"
                strokeWidth={1.5}
              />
            </div>
          }
          onCtaClick={() => handleAction("Physics", "chat")}
        />
      </section>

      {/* Subjects Section */}
      <section className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <GraduationCap className="h-4 w-4 text-accent" />
            Academic Curriculum
          </h2>
          <span className="rounded-md bg-muted/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
            {subjects.length} Active Modules
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {subjects.map((subject, index) => (
            <div
              key={subject.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${250 + index * 50}ms` }}
            >
              <BentoSubjectCard
                title={subject.name}
                description={subject.description}
                icon={subject.icon}
                tag={subject.tag}
                progressPercentage={subject.progress}
                isLocked={subject.isLocked}
                onAction={(action) => handleAction(subject.name, action)}
                className="h-full"
              />
            </div>
          ))}
        </div>
      </section>

      {/* RAG Chat Sheet Overlay */}
      {activeSubject && (
        <RagChatSheet
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          subjectName={activeSubject}
          initialPrompt={initialPrompt}
        />
      )}
    </div>
  );
}
