import { useState, useEffect } from "react";

export const QUEST_STORAGE_KEY = "classmode:quest:v0";
const CONFETTI_FIRED_KEY = "classmode:quest:confettiFired";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface QuestProgress {
  completedIds: string[];
  panelDismissed: boolean;
  firstSeenAt: string;
}

function defaultProgress(): QuestProgress {
  return {
    completedIds: [],
    panelDismissed: false,
    firstSeenAt: new Date().toISOString(),
  };
}

export function readProgressFromStorage(): QuestProgress {
  try {
    const raw = localStorage.getItem(QUEST_STORAGE_KEY);
    if (!raw) return defaultProgress();
    return JSON.parse(raw) as QuestProgress;
  } catch {
    return defaultProgress();
  }
}

function writeProgress(progress: QuestProgress): void {
  localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(progress));
}

export function isExpired(progress: QuestProgress): boolean {
  if (!progress.firstSeenAt) return false;
  return Date.now() > new Date(progress.firstSeenAt).getTime() + SEVEN_DAYS_MS;
}

export function hasConfettiFired(): boolean {
  return localStorage.getItem(CONFETTI_FIRED_KEY) === "1";
}

export function markConfettiFired(): void {
  localStorage.setItem(CONFETTI_FIRED_KEY, "1");
}

export function markQuestComplete(questId: string): void {
  const progress = readProgressFromStorage();
  if (progress.completedIds.includes(questId)) return;
  progress.completedIds = [...progress.completedIds, questId];
  writeProgress(progress);
  window.dispatchEvent(new Event("quest-updated"));
}

export function setFirstSeenAt(iso: string): void {
  const progress = readProgressFromStorage();
  if (progress.firstSeenAt) return;
  progress.firstSeenAt = iso;
  writeProgress(progress);
}

export function setPanelDismissed(dismissed: boolean): void {
  const progress = readProgressFromStorage();
  progress.panelDismissed = dismissed;
  writeProgress(progress);
  window.dispatchEvent(new Event("quest-updated"));
}

export function useQuestProgress() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("quest-updated", handler);
    return () => window.removeEventListener("quest-updated", handler);
  }, []);

  const progress = readProgressFromStorage();
  const expired = isExpired(progress);

  return {
    progress,
    expired,
    markQuestComplete,
    setPanelDismissed,
  };
}
