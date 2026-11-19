import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

import type { UserRole } from '@/shared/authz';

export type AppRouteName = 'index' | 'lessons' | 'attendance' | 'people' | 'school' | 'admin';

export type AppTab = {
  route: AppRouteName;
  label: string;
  iosIcon: SFSymbol;
  androidIcon: AndroidSymbol;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Student',
  teacher: 'Teacher',
  parent: 'Parent',
  principal: 'Principal',
  school_admin: 'School Admin',
  admin: 'Platform Admin',
};

export const ROLE_HOME_COPY: Record<UserRole, { title: string; summary: string }> = {
  student: {
    title: 'Student Home',
    summary: 'Class updates, attendance, and assignments will appear here after auth is wired.',
  },
  teacher: {
    title: 'Teacher Home',
    summary: 'Classes, attendance shortcuts, and alert status will anchor the teacher workflow.',
  },
  parent: {
    title: 'Parent Home',
    summary: 'Child attendance, alerts, and fee status will be grouped by child.',
  },
  principal: {
    title: 'Principal Home',
    summary: 'Live school attendance and at-risk class signals will be summarized here.',
  },
  school_admin: {
    title: 'School Admin Home',
    summary: 'School operations, attendance health, and fee reminders will live here.',
  },
  admin: {
    title: 'Platform Admin Home',
    summary: 'Platform-level tenant health and support actions will be available here.',
  },
};

const HOME_TAB: AppTab = {
  route: 'index',
  label: 'Home',
  iosIcon: 'house',
  androidIcon: 'home',
};

const TABS_BY_ROLE: Record<UserRole, AppTab[]> = {
  student: [HOME_TAB, {
    route: 'lessons',
    label: 'Lessons',
    iosIcon: 'book.pages',
    androidIcon: 'menu_book',
  }],
  teacher: [
    HOME_TAB,
    // Home IS the marking surface (receipt card, D-4); this tab owns the
    // past — per-date review and corrections — so it's History, not
    // Attendance (D-11).
    {
      route: 'attendance',
      label: 'History',
      iosIcon: 'checkmark.circle',
      androidIcon: 'check_circle',
    },
  ],
  parent: [
    HOME_TAB,
    {
      route: 'people',
      label: 'Children',
      iosIcon: 'person.2',
      androidIcon: 'people',
    },
  ],
  principal: [
    HOME_TAB,
    {
      route: 'school',
      label: 'School',
      iosIcon: 'building.2',
      androidIcon: 'domain',
    },
  ],
  school_admin: [
    HOME_TAB,
    {
      route: 'school',
      label: 'School',
      iosIcon: 'building.2',
      androidIcon: 'domain',
    },
    {
      route: 'admin',
      label: 'Admin',
      iosIcon: 'slider.horizontal.3',
      androidIcon: 'admin_panel_settings',
    },
  ],
  admin: [
    HOME_TAB,
    {
      route: 'admin',
      label: 'Admin',
      iosIcon: 'slider.horizontal.3',
      androidIcon: 'admin_panel_settings',
    },
  ],
};

export function getTabsForRole(role: UserRole): AppTab[] {
  return TABS_BY_ROLE[role];
}
