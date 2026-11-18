/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Semantic status tokens carry attendance meaning (present/absent/pending
// sync/warning) and must stay sunlight-legible: every text-grade color keeps
// ≥4.5:1 contrast against its mode's background. Screens must use these
// tokens — no inline hex in screen files.
export const Colors = {
  light: {
    text: '#24201E',
    background: '#FDFAF5',
    backgroundElement: '#F5F0E8',
    backgroundSelected: '#E8E4DC',
    textSecondary: '#5C5C5C',
    success: '#177239',
    danger: '#B3261E',
    warning: '#7A4F01',
    pending: '#5C5C5C',
    accent: '#F0A500',
    onAccent: '#24201E',
    student: '#A95136',
    hairline: '#D6D0C7',
  },
  dark: {
    text: '#F5F0E8',
    background: '#1C1917',
    backgroundElement: '#24201E',
    backgroundSelected: '#3C3836',
    textSecondary: '#C8C3BB',
    success: '#4ADE80',
    danger: '#F87171',
    warning: '#FBBF24',
    pending: '#C8C3BB',
    accent: '#F0A500',
    onAccent: '#24201E',
    student: '#E29A80',
    hairline: '#4A4543',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
