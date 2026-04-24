import { useState } from "react";
import { useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Hero,
  NotebookFeature,
  OnboardingFeatures,
  Turbulence,
  Journey,
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
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <a href="#" className="font-heading text-xl font-bold tracking-tight">
          Edu<span className="text-primary">AI</span> ✨
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
          <Button
            className="sketch-border sketch-shadow-yellow hover-tilt rounded-full bg-primary font-heading text-sm text-primary-foreground hover:bg-primary/90"
            size="sm"
            onClick={() => setLocation("/login")}
          >
            Get My Plan
          </Button>
          <ThemeToggle />
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="space-y-3 border-b border-border bg-background px-6 pb-4 md:hidden">
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

// --- Footer ---
const Footer = () => (
  <footer className="border-t border-border bg-card/30 py-12">
    <div className="container">
      {/* Footer Divider */}
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
            Edu<span className="text-primary">AI</span> ✨
          </p>
          <p className="text-muted-foreground">
            AI-powered personalised learning for every student.
          </p>
        </div>
        <div>
          <p className="mb-2 font-heading font-bold">Quick Links</p>
          <div className="space-y-1 text-muted-foreground">
            <a href="#journey" className="block transition-colors hover:text-foreground">
              How it Works
            </a>
            <a href="#features" className="block transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#pricing" className="block transition-colors hover:text-foreground">
              Pricing
            </a>
            <a href="#contact" className="block transition-colors hover:text-foreground">
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
              href="mailto:hello@eduai.com"
              className="block transition-colors hover:text-foreground"
            >
              hello@eduai.com
            </a>
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        © 2026 EduAI. All rights reserved. Built with 💛 for learners everywhere.
      </div>
    </div>
  </footer>
);

const LandingPage = () => (
  <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
    <Navbar />
    <main>
      <Hero />
      <Turbulence />
      <Journey />
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
