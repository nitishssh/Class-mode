import { useEffect, useState, type ComponentType } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ArrowRight, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

// ── Shared marketing chrome for the public audience subpages ────────────────
// The landing page's own Navbar uses in-page anchors (#features); from a
// subpage those must be prefixed with "/" so the browser returns to the
// landing route and then scrolls. Internal page links use wouter's <Link>.

const navLinks = [
  { label: "How it Works", href: "/#journey" },
  { label: "Features", href: "/#features" },
  { label: "For Schools", href: "/#for-schools" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Contact", href: "/#contact" },
];

// Routes of their own, so they use wouter's <Link> instead of a full page load.
const navPageLinks = [{ label: "Get the app", href: "/app" }];

export const MarketingNav = () => {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="font-heading text-xl font-bold tracking-tight">
          Class <span className="text-primary">Mode</span> ✨
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          {navPageLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <Button
            className="sketch-border sketch-shadow-yellow hover-tilt rounded-full bg-primary font-heading text-sm text-primary-foreground hover:bg-primary/90"
            size="sm"
            onClick={() => setLocation("/login")}
          >
            Get My Plan
          </Button>
          <ThemeToggle />
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-b border-border bg-background px-6 pb-4 md:hidden">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="block text-sm font-medium text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          {navPageLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block text-sm font-medium text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <Button
            className="sketch-border sketch-shadow-yellow w-full rounded-full bg-primary font-heading text-sm text-primary-foreground hover:bg-primary/90"
            size="sm"
            onClick={() => {
              setOpen(false);
              setLocation("/login");
            }}
          >
            Get Started
          </Button>
        </div>
      )}
    </nav>
  );
};

export const MarketingFooter = () => (
  <footer className="border-t border-border bg-card/30 py-12">
    <div className="container">
      <div className="mb-8 flex justify-center">
        <div className="flex gap-2">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-1 w-6 rounded-full bg-foreground/15" />
          ))}
        </div>
      </div>

      <div className="grid gap-8 text-sm sm:grid-cols-3">
        <div>
          <p className="mb-2 font-heading text-lg font-bold">
            Class <span className="text-primary">Mode</span> ✨
          </p>
          <p className="text-muted-foreground">
            AI-powered personalised learning for every student.
          </p>
        </div>
        <div>
          <p className="mb-2 font-heading font-bold">Explore</p>
          <div className="space-y-1 text-muted-foreground">
            <Link href="/for-parents" className="block transition-colors hover:text-foreground">
              For Parents
            </Link>
            <Link href="/for-schools" className="block transition-colors hover:text-foreground">
              For Principals &amp; Boards
            </Link>
            <Link href="/app" className="block transition-colors hover:text-foreground">
              Get the app
            </Link>
            <a href="/#features" className="block transition-colors hover:text-foreground">
              Features
            </a>
            <a href="/#pricing" className="block transition-colors hover:text-foreground">
              Pricing
            </a>
            <a href="/#contact" className="block transition-colors hover:text-foreground">
              Contact
            </a>
          </div>
        </div>
        <div>
          <p className="mb-2 font-heading font-bold">Connect</p>
          <div className="space-y-1 text-muted-foreground">
            <a href="#" className="block transition-colors hover:text-foreground">
              Twitter / X
            </a>
            <a href="#" className="block transition-colors hover:text-foreground">
              LinkedIn
            </a>
            <a href="#" className="block transition-colors hover:text-foreground">
              Instagram
            </a>
            <a
              href="mailto:hello@classmode.com"
              className="block transition-colors hover:text-foreground"
            >
              hello@classmode.com
            </a>
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        © 2026 Class Mode. All rights reserved. Built with 💛 for learners everywhere.
      </div>
    </div>
  </footer>
);

// ── Content model ───────────────────────────────────────────────────────────

export interface AudienceFeature {
  icon: LucideIcon;
  name: string;
  /** One-line, audience-framed value ("what this means for you"). */
  headline: string;
  /** Short supporting paragraph. */
  description: string;
  /** Concrete, audience-specific capabilities. */
  bullets: string[];
}

export interface AudienceOutcome {
  icon: LucideIcon;
  metric: string;
  label: string;
}

export interface AudiencePageProps {
  /** Small pill above the title, e.g. "For Parents". */
  eyebrow: string;
  title: string;
  titleAccent: string;
  intro: string;
  /** Link to the sibling audience page. */
  crosslink: { label: string; href: string };
  outcomes: AudienceOutcome[];
  featuresHeading: string;
  features: AudienceFeature[];
  ctaHeading: string;
  ctaSub: string;
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

export const AudiencePage: ComponentType<AudiencePageProps> = ({
  eyebrow,
  title,
  titleAccent,
  intro,
  crosslink,
  outcomes,
  featuresHeading,
  features,
  ctaHeading,
  ctaSub,
}) => {
  // Subpages are navigated to from anchors elsewhere; always start at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <MarketingNav />

      <main className="pt-16">
        {/* Hero */}
        <section className="relative overflow-hidden py-20 md:py-28">
          <div className="container relative z-10 max-w-4xl text-center">
            <motion.span
              {...fadeUp}
              className="sketch-border sketch-shadow mb-6 inline-block bg-card px-4 py-1.5 text-sm font-medium text-foreground"
            >
              {eyebrow}
            </motion.span>
            <motion.h1
              {...fadeUp}
              transition={{ delay: 0.05 }}
              className="text-4xl font-extrabold tracking-tight md:text-6xl"
            >
              {title} <span className="text-primary">{titleAccent}</span>
            </motion.h1>
            <motion.p
              {...fadeUp}
              transition={{ delay: 0.1 }}
              className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl"
            >
              {intro}
            </motion.p>
            <motion.div
              {...fadeUp}
              transition={{ delay: 0.15 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              <a
                href="/#contact"
                className="sketch-border sketch-shadow-yellow hover-tilt inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 font-heading text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                Book a walkthrough <ArrowRight size={16} />
              </a>
              <Link
                href={crosslink.href}
                className="sketch-border hover-tilt inline-flex items-center gap-2 rounded-full bg-card px-7 py-3 font-heading text-sm font-semibold text-foreground transition-all hover:bg-card/70"
              >
                {crosslink.label}
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Outcome strip */}
        <section className="border-y border-border bg-card/30">
          <div className="container grid gap-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
            {outcomes.map((o, i) => (
              <motion.div
                key={o.label}
                {...fadeUp}
                transition={{ delay: i * 0.08 }}
                className="flex flex-col items-center text-center"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <o.icon size={24} />
                </div>
                <p className="font-heading text-2xl font-black leading-tight">{o.metric}</p>
                <p className="mt-1 text-sm text-muted-foreground">{o.label}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Feature-by-feature breakdown */}
        <section className="py-20 md:py-24">
          <div className="container max-w-6xl">
            <motion.div {...fadeUp} className="mb-14 text-center">
              <h2 className="text-3xl font-extrabold md:text-4xl">{featuresHeading}</h2>
              <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
                Every part of Class Mode, explained in terms of what it does for you.
              </p>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-2">
              {features.map((f, i) => (
                <motion.article
                  key={f.name}
                  {...fadeUp}
                  transition={{ delay: (i % 2) * 0.08 }}
                  className="sketch-border sketch-shadow hover-tilt flex flex-col rounded-2xl bg-card p-7"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <f.icon size={22} />
                    </div>
                    <h3 className="font-heading text-xl font-bold">{f.name}</h3>
                  </div>
                  <p className="font-heading text-base font-semibold text-primary">{f.headline}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {f.description}
                  </p>
                  <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm">
                        <Check size={16} className="mt-0.5 shrink-0 text-primary" strokeWidth={3} />
                        <span className="text-foreground/90">{b}</span>
                      </li>
                    ))}
                  </ul>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-card/30 py-20">
          <div className="container flex max-w-2xl flex-col items-center gap-5 text-center">
            <motion.h2 {...fadeUp} className="text-3xl font-extrabold md:text-4xl">
              {ctaHeading}
            </motion.h2>
            <motion.p
              {...fadeUp}
              transition={{ delay: 0.05 }}
              className="text-lg text-muted-foreground"
            >
              {ctaSub}
            </motion.p>
            <motion.a
              {...fadeUp}
              transition={{ delay: 0.1 }}
              href="/#contact"
              className="sketch-border sketch-shadow-yellow hover-tilt inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 font-heading text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              Get in touch <ArrowRight size={16} />
            </motion.a>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
};
