import { useState } from "react";
import { useLocation } from "wouter";
import { Menu, X, School, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Hero,
  ProblemSection,
  DualAudience,
  HowItWorks,
  BusinessValue,
  NotebookFeature,
  OnboardingFeatures,
  DemoWidget,
  Pricing,
  ContactForm,
} from "@/components/landing";

// --- Navbar ---
const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const links = [
    { label: "How it Works", href: "#journey" },
    { label: "For Schools", href: "#value" },
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <a href="#" className="flex items-center gap-2">
          <span className="font-display text-xl font-bold tracking-tight">
            Class<span className="text-primary">Mode</span>
          </span>
        </a>

        {/* Desktop */}
        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-full font-medium"
              onClick={() => setLocation("/login")}
            >
              <Users className="h-4 w-4" />
              Student
            </Button>
            <Button
              size="sm"
              className="gap-1.5 rounded-full bg-primary font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => setLocation("/login")}
            >
              <School className="h-4 w-4" />
              For Schools
            </Button>
          </div>
          <ThemeToggle />
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="space-y-3 border-b border-border bg-background px-6 pb-5 pt-2 md:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="block text-sm font-medium text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1 rounded-full text-sm"
              size="sm"
              onClick={() => { setOpen(false); setLocation("/login"); }}
            >
              Student
            </Button>
            <Button
              className="flex-1 rounded-full bg-primary text-sm text-primary-foreground hover:bg-primary/90"
              size="sm"
              onClick={() => { setOpen(false); setLocation("/login"); }}
            >
              For Schools
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

// --- Footer ---
const Footer = () => (
  <footer className="border-t border-border bg-card/30 py-14">
    <div className="container">
      <div className="mb-10 grid gap-8 text-sm sm:grid-cols-4">
        <div className="sm:col-span-2">
          <p className="mb-3 font-display text-xl font-bold">
            Class<span className="text-primary">Mode</span>
          </p>
          <p className="max-w-xs text-muted-foreground">
            The warm, friendly platform every school deserves. AI-powered. Human-centred.
          </p>
          <div className="mt-5 flex gap-3">
            <a
              href="#"
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Twitter / X
            </a>
            <a
              href="#"
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              LinkedIn
            </a>
          </div>
        </div>
        <div>
          <p className="mb-3 font-semibold text-foreground">Platform</p>
          <div className="space-y-2 text-muted-foreground">
            <a href="#journey" className="block transition-colors hover:text-foreground">
              How it Works
            </a>
            <a href="#features" className="block transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#pricing" className="block transition-colors hover:text-foreground">
              Pricing
            </a>
          </div>
        </div>
        <div>
          <p className="mb-3 font-semibold text-foreground">Company</p>
          <div className="space-y-2 text-muted-foreground">
            <a href="#contact" className="block transition-colors hover:text-foreground">
              Contact
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

      <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
        © 2026 ClassMode. All rights reserved. Built with 💛 for learners everywhere.
      </div>
    </div>
  </footer>
);

const LandingPage = () => (
  <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
    <Navbar />
    <main>
      <Hero />
      <ProblemSection />
      <DualAudience />
      <HowItWorks />
      <BusinessValue />
      <NotebookFeature />
      <OnboardingFeatures />
      <DemoWidget />
      <Pricing />
      <ContactForm />
    </main>
    <Footer />
  </div>
);

export default LandingPage;
