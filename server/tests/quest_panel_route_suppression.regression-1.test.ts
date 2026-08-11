/**
 * Regression: ISSUE-001 — the onboarding quest panel made the attendance register unusable.
 * Found by /qa on 2026-08-11.
 * Report: .gstack/qa-reports/qa-report-localhost-2026-08-11.md
 *
 * The quest panel renders `fixed bottom-20 right-4 w-80` at z-72, so it physically
 * covered the controls it floated over. Measured in-browser with
 * document.elementFromPoint at each button's centre: 6 of 7 "Present" buttons on a
 * 1280x800 desktop returned the panel instead of the button. On a 375px phone the
 * panel occupies 370px of an 812px viewport and, being fixed, follows the scroll —
 * after scrolling to the bottom, 4 of 7 were still blocked.
 *
 * It renders only for role=teacher and only until the quests are done or 7 days
 * pass, so the one person guaranteed to hit it is a brand new teacher marking their
 * first register — the exact pilot-onboarding case, on the wedge workflow.
 *
 * This test lives in server/tests/ because that is the only path vitest collects
 * (`include: ["server/tests/**./*.test.ts"]`, environment: node). The repo has no
 * client test lane — see the P3 item in TODOS.md. The function under test is pure,
 * so it needs no DOM; the browser-level behaviour it guards was verified manually
 * and is recorded in the report above.
 *
 * Both directions are pinned. The allow path alone would not catch the regression
 * that matters: someone trimming the suppression list and silently re-covering the
 * register.
 */
import { describe, it, expect } from "vitest";
import { isQuestPanelSuppressed, QUEST_PANEL_SUPPRESSED_ROUTES } from "@/lib/quest-config";

describe("quest panel route suppression", () => {
  describe("routes where the panel must NOT render", () => {
    it("suppresses on the attendance register — the screen the bug made unusable", () => {
      expect(isQuestPanelSuppressed("/attendance")).toBe(true);
    });

    it("suppresses on the absentee call list — same dense tap targets", () => {
      expect(isQuestPanelSuppressed("/absentees")).toBe(true);
    });

    it("suppresses on nested paths under a suppressed route", () => {
      expect(isQuestPanelSuppressed("/attendance/10A")).toBe(true);
      expect(isQuestPanelSuppressed("/absentees/print")).toBe(true);
    });
  });

  describe("routes where the panel SHOULD still render", () => {
    it("does not suppress on the teacher dashboard — quests must stay reachable", () => {
      expect(isQuestPanelSuppressed("/teacher-dashboard")).toBe(false);
    });

    it("does not suppress on the root route", () => {
      expect(isQuestPanelSuppressed("/")).toBe(false);
    });

    it("does not suppress on unrelated routes", () => {
      expect(isQuestPanelSuppressed("/settings")).toBe(false);
      expect(isQuestPanelSuppressed("/create-test")).toBe(false);
    });
  });

  describe("prefix matching is bounded", () => {
    it("does not suppress on a route that merely starts with the same characters", () => {
      // "/attendance-report" is a different page; a naive startsWith without the
      // trailing-slash guard would wrongly suppress the panel there.
      expect(isQuestPanelSuppressed("/attendance-report")).toBe(false);
      expect(isQuestPanelSuppressed("/absenteeism")).toBe(false);
    });

    it("does not match a suppressed route appearing mid-path", () => {
      expect(isQuestPanelSuppressed("/reports/attendance")).toBe(false);
    });
  });

  describe("the suppression list itself", () => {
    it("still contains the attendance register", () => {
      // The load-bearing entry. If this is ever removed, the register goes back to
      // being covered for every new teacher on their first day.
      expect(QUEST_PANEL_SUPPRESSED_ROUTES).toContain("/attendance");
    });

    it("contains no duplicates and no trailing slashes", () => {
      const routes = [...QUEST_PANEL_SUPPRESSED_ROUTES];
      expect(new Set(routes).size).toBe(routes.length);
      routes.forEach((r) => {
        expect(r.startsWith("/")).toBe(true);
        expect(r.endsWith("/")).toBe(false);
      });
    });
  });
});
