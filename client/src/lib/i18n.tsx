import React, { createContext, useContext, useState, useEffect } from "react";

// Translations dictionary for English. Translates keys back to their default English string if not found.
const translations: Record<string, Record<string, string>> = {
  en: {
    "sidebar.toggleMenu": "Toggle menu",
    "sidebar.classMode": "Class Mode",
    "sidebar.learningPlatform": "Learning Platform",
    "sidebar.shortLogo": "E",
    "sidebar.mainMenu": "Main Menu",
    "sidebar.soon": "Soon",
    "discussion.joinDiscussion": "Join Discussion",
    "discussion.skip": "Skip",
    "app.accessDenied": "Access Denied",
    "app.noPermission": "You do not have permission to view this page.",
    "app.goBack": "Go Back",
    "app.loading": "Loading...",
    "app.pendingTitle": "Account Pending Approval",
    "app.pendingDesc": "Your account is awaiting administrator approval. You will receive access once activated.",
    "app.signOut": "Sign Out",
    "app.suspendedTitle": "Account Suspended",
    "app.suspendedDesc": "Your account has been suspended. Please contact support for assistance.",
    "app.rejectedTitle": "Account Not Approved",
    "app.rejectedDesc": "Your registration was not approved. Please contact your school administrator.",
    "widget.unavailable": "Widget content unavailable",
    "auth.easierOrganized": "Make your learning easier and organized",
    "auth.classMode": "Class Mode",
    "auth.createAccount": "Create an account",
    "auth.resetPassword": "Reset Password",
    "auth.simplifyWorkflow": "Simplify your workflow and boost your productivity with",
    "auth.checkEmail": "Check your email",
    "auth.weDispatched": "We've dispatched a password reset link to your email.",
    "auth.backToLogin": "Back to login",
    "auth.forgotPassword": "Forgot Password?",
    "auth.role.owner": "Workspace Owner",
    "auth.role.teacher": "Teacher",
    "auth.role.principal": "Principal",
    "auth.role.schoolAdmin": "School Admin",
    "auth.role.parent": "Parent",
    "video.unavailable": "Video unavailable",
    "video.continue": "Continue",
    "verify.title": "Verify Your Email",
    "verify.dispatched": "We've dispatched a",
    "verify.didNotReceive": "didn't receive it?",
    "whiteboard.title": "Whiteboard",
    "classroom.scene": "Scene ",
    "classroom.overallProgress": "Overall Progress",
    "classroom.knowledgeCheck": "Knowledge Check",
    "classroom.explanation": "Explanation",
    "classroom.pbl": "Project-Based Learning",
    "classroom.projectTasks": "Project Tasks",
    "classroom.milestones": "Milestones",
    "classroom.previous": "Previous",
    "classroom.nextScene": "Next Scene",
    "classroom.aiClassroom": "AI Classroom",
    "classroom.initializing": "Initializing your interactive learning sanctuary...",
    "classroom.connecting": "Connecting to Study Arena Engine",
    "classroom.studyArena": "Study Arena",
    "classroom.interactiveExperiences": "Interactive multi-agent classroom experiences",
    "classroom.whatToMaster": "What would you like to master today?",
    "classroom.cancel": "Cancel",
    "classroom.viewAll": "View All",
    "classroom.noSessions": "No sessions yet",
    "classroom.historyAppear": "Your learning history will appear here once you start a classroom.",
    "study.shortLogo": "M",
    "study.channels": "Channels",
    "study.directMessages": "Direct Messages",
    "study.sharedFilesSoon": "Shared files view coming soon.",
    "study.welcomeTo": "Welcome to #",
    "study.welcomeDesc": "This is the start of the channel. Collaborate on assignments and share notes here.",
    "study.aliceSmith": "Alice Smith",
    "study.aliceMessage": "Hey everyone! Just dropped the notes for chapter 4 in the files tab. Let me know if you have questions.",
    "study.bobJones": "Bob Jones",
    "study.bobMessage": "Awesome, thanks Alice! I'll review them before our study session tomorrow.",
    "study.chapter4Pdf": "Chapter4_Notes.pdf",
    "landing.class": "Class ",
    "landing.mode": "Mode",
    "landing.getMyPlan": "Get My Plan",
    "landing.getStarted": "Get Started",
    "landing.tagline": "AI-powered personalised learning for every student.",
    "landing.quickLinks": "Quick Links",
    "landing.howItWorks": "How it Works",
    "landing.features": "Features",
    "landing.pricing": "Pricing",
    "landing.contact": "Contact",
    "landing.connect": "Connect",
    "landing.twitter": "Twitter / X",
    "landing.linkedin": "LinkedIn",
    "landing.instagram": "Instagram",
    "landing.email": "hello@classmode.com",
    "live.title": "Class Mode Live",
    "chat.tutorTitle": "Class Mode Tutor • ",
    "chat.activeLearning": "Active Learning Mode",
    "chat.aiInsights": "AI generated insights for faster learning",
  }
};

const translationsMap = new Map<string, Map<string, string>>();
Object.entries(translations).forEach(([loc, dict]) => {
  if (loc !== "__proto__" && loc !== "constructor" && loc !== "prototype") {
    const dictMap = new Map<string, string>();
    Object.entries(dict).forEach(([k, v]) => {
      if (k !== "__proto__" && k !== "constructor" && k !== "prototype") {
        dictMap.set(k, v);
      }
    });
    translationsMap.set(loc, dictMap);
  }
});

type I18nContextType = {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string, defaultValue: string) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("locale") || "en";
    }
    return "en";
  });

  useEffect(() => {
    localStorage.setItem("locale", locale);
  }, [locale]);

  const t = (key: string, defaultValue: string): string => {
    const localeMap = translationsMap.get(locale);
    if (localeMap) {
      const val = localeMap.get(key);
      if (typeof val === "string") {
        return val;
      }
    }
    return defaultValue;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}
