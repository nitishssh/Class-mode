import { useState } from "react";
import { useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTranslation } from "@/lib/i18n";
import {
  Hero,
  NotebookFeature,
  OnboardingFeatures,
  Turbulence,
  Journey,
  DemoWidget,
  Pricing,
  ContactForm,
  WhatSchoolGains,
} from "@/components/landing";

// --- Navbar ---
const Navbar = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const links = [
    { key: "landing.howItWorks", label: "How it Works", href: "#journey" },
    { key: "landing.features", label: "Features", href: "#features" },
    { key: "landing.forSchools", label: "For Schools", href: "#for-schools" },
    { key: "landing.pricing", label: "Pricing", href: "#pricing" },
    { key: "landing.contact", label: "Contact", href: "#contact" },
  ];

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <a href="#" className="font-heading text-xl font-bold tracking-tight">
          {t("landing.class", "Class ")}
          <span className="text-primary">{t("landing.mode", "Mode")}</span> ✨
        </a>

        {/* Desktop */}
        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(l.key, l.label)}
            </a>
          ))}
          <Button
            className="sketch-border sketch-shadow-yellow hover-tilt rounded-full bg-primary font-heading text-sm text-primary-foreground hover:bg-primary/90"
            size="sm"
            onClick={() => setLocation("/login")}
          >
            {t("landing.getMyPlan", "Get My Plan")}
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
              {t(l.key, l.label)}
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
            {t("landing.getStarted", "Get Started")}
          </Button>
        </div>
      )}
    </nav>
  );
};

// --- Footer ---
const Footer = () => {
  const { t } = useTranslation();
  return (
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
              {t("landing.class", "Class ")}
              <span className="text-primary">{t("landing.mode", "Mode")}</span> ✨
            </p>
            <p className="text-muted-foreground">
              {t("landing.tagline", "AI-powered personalised learning for every student.")}
            </p>
          </div>
          <div>
            <p className="mb-2 font-heading font-bold">{t("landing.quickLinks", "Quick Links")}</p>
            <div className="space-y-1 text-muted-foreground">
              <a href="#journey" className="block transition-colors hover:text-foreground">
                {t("landing.howItWorks", "How it Works")}
              </a>
              <a href="#features" className="block transition-colors hover:text-foreground">
                {t("landing.features", "Features")}
              </a>
              <a href="#for-schools" className="block transition-colors hover:text-foreground">
                {t("landing.forSchools", "For Schools")}
              </a>
              <a href="#pricing" className="block transition-colors hover:text-foreground">
                {t("landing.pricing", "Pricing")}
              </a>
              <a href="#contact" className="block transition-colors hover:text-foreground">
                {t("landing.contact", "Contact")}
              </a>
            </div>
          </div>
          <div>
            <p className="mb-2 font-heading font-bold">{t("landing.connect", "Connect")}</p>
            <div className="space-y-1 text-muted-foreground">
              <a href="#" className="block transition-colors hover:text-foreground">
                {t("landing.twitter", "Twitter / X")}
              </a>
              <a href="#" className="block transition-colors hover:text-foreground">
                {t("landing.linkedin", "LinkedIn")}
              </a>
              <a href="#" className="block transition-colors hover:text-foreground">
                {t("landing.instagram", "Instagram")}
              </a>
              <a
                href="mailto:hello@classmode.com"
                className="block transition-colors hover:text-foreground"
              >
                {t("landing.email", "hello@classmode.com")}
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          © 2026 {t("landing.class", "Class ")}
          {t("landing.mode", "Mode")}.{" "}
          {t("landing.copyright", "All rights reserved. Built with 💛 for learners everywhere.")}
        </div>
      </div>
    </footer>
  );
};

const LandingPage = () => (
  <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
    <Navbar />
    <main>
      <Hero />
      <Turbulence />
      <Journey />
      <NotebookFeature />
      <OnboardingFeatures />
      <WhatSchoolGains />
      <DemoWidget />
      <Pricing />
      <ContactForm />
    </main>
    <Footer />
  </div>
);

export default LandingPage;
