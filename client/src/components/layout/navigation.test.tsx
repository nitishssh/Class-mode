// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";

const state = vi.hoisted(() => ({
  location: "/teacher-dashboard",
  role: "teacher",
}));

vi.mock("wouter", () => ({
  useLocation: () => [state.location, vi.fn()],
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/contexts/firebase-auth-context", () => ({
  useFirebaseAuth: () => ({
    currentUser: {
      profile: {
        displayName: "Maya Sharma",
        role: state.role,
      },
    },
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock("@/components/workspace/workspace-switcher", () => ({
  WorkspaceSwitcher: () => <div>Demo School</div>,
}));

vi.mock("@/components/ui/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

describe("teacher navigation", () => {
  beforeEach(() => {
    state.location = "/teacher-dashboard";
    state.role = "teacher";
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  });

  it("shows the primary teaching workflow and collapses secondary sections", () => {
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: /Overview/i })).toHaveAttribute(
      "href",
      "/teacher-dashboard"
    );
    expect(screen.getByRole("link", { name: /^Tests$/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /^Grading$/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /AI Classroom/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /Live Classes/i })).toBeVisible();
    expect(screen.queryByRole("link", { name: /My Students/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Students" }));

    expect(screen.getByRole("link", { name: /My Students/i })).toHaveAttribute(
      "href",
      "/my-students"
    );
    expect(screen.getByRole("link", { name: /Directory/i })).toHaveAttribute(
      "href",
      "/student-directory"
    );
  });

  it("uses only valid teacher routes in mobile navigation", () => {
    render(<MobileNav />);

    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/teacher-dashboard",
      "/create-test",
      "/grading",
      "/my-students",
      "/messages",
    ]);
    expect(hrefs).not.toContain("/profile");
    expect(hrefs).not.toContain("/dashboard");
  });
});
