import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface BentoHeroCardProps {
  title: string;
  description: string;
  ctaText?: string;
  onCtaClick?: () => void;
  visual?: React.ReactNode;
}

export function BentoHeroCard({
  title,
  description,
  ctaText = "Open Tutor",
  onCtaClick,
  visual,
}: BentoHeroCardProps) {
  return (
    <div className="group relative w-full overflow-hidden rounded-2xl border border-border bg-card p-8 transition-all duration-500 hover:shadow-card md:p-12">
      {/* Subtle Texture Overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #CC7B5C 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 flex h-full flex-col-reverse items-center justify-between gap-12 md:flex-row">
        <div className="flex max-w-[520px] flex-col gap-10">
          <div className="space-y-5">
            <h1 className="font-display text-3xl leading-[1.1] tracking-tight text-foreground md:text-5xl">
              {title}
            </h1>
            <p className="font-body text-lg leading-relaxed text-muted-foreground">{description}</p>
          </div>

          <div>
            <Button
              onClick={onCtaClick}
              className="group/btn rounded-full bg-accent px-10 py-7 text-xs font-bold uppercase tracking-widest text-white shadow-soft transition-all duration-300 hover:bg-accent/90 active:scale-95"
            >
              <span className="flex items-center">
                {ctaText}
                <ArrowRight className="ml-3 h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1.5" />
              </span>
            </Button>
          </div>
        </div>

        {visual && (
          <div className="relative flex flex-shrink-0 items-center justify-center transition-transform duration-700 group-hover:-rotate-1 group-hover:scale-105">
            {/* Visual Background Glow */}
            <div className="absolute inset-0 scale-150 transform-gpu rounded-full bg-accent/5 blur-[100px]" />

            <div className="relative z-10 drop-shadow-xl">{visual}</div>
          </div>
        )}
      </div>
    </div>
  );
}
