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
