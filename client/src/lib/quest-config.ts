/**
 * Routes where the expanded quest panel must never render.
 *
 * The panel is `fixed bottom-20 right-4 w-80` at z-72, so on these screens it
 * physically covers the controls it floats over — `document.elementFromPoint`
 * at a button's centre returns the panel, not the button. On the attendance
 * register that made 6 of 7 status buttons unclickable at 1280x800, and on a
 * 375px phone the panel occupies 370px of an 812px viewport and follows the
 * scroll, so a teacher could not complete the register at all without
 * dismissing it first. Found by /qa on 2026-08-11.
 *
 * On these routes QuestButton renders the collapsed launcher instead, so the
 * quests stay one tap away rather than being hidden.
 */
export const QUEST_PANEL_SUPPRESSED_ROUTES = ["/attendance", "/absentees"] as const;

/** Pathname-only match (wouter's useLocation never includes the query string). */
export function isQuestPanelSuppressed(pathname: string): boolean {
  return QUEST_PANEL_SUPPRESSED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export interface Quest {
  id: string;
  emoji: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaPath: string;
  xpReward: number; // v0: unused; v1: sent to PATCH /api/auth/me/quests for XP calculation
}

export const QUESTS: Quest[] = [
  {
    id: "quest:create-test",
    emoji: "📝",
    title: "Create your first test",
    description: "Build a test with MCQs, short answers, and more",
    ctaLabel: "Create a test",
    ctaPath: "/create-test",
    xpReward: 50,
  },
  {
    id: "quest:create-class",
    emoji: "🏫",
    title: "Set up a class",
    description: "Create a class and add your students",
    ctaLabel: "Create a class",
    ctaPath: "/onboarding/teacher",
    xpReward: 50,
  },
  {
    id: "quest:invite-student",
    emoji: "🎓",
    title: "Invite your first student",
    description: "Send an invite link so a student can join your class",
    ctaLabel: "Send an invite",
    ctaPath: "/onboarding/invite-students",
    xpReward: 50,
  },
];
