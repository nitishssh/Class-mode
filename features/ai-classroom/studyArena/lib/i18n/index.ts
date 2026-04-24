import { defaultLocale, type Locale } from './types';
export { type Locale, defaultLocale } from './types';
import { commonEnUS } from './common';
import { stageEnUS } from './stage';
import { chatEnUS } from './chat';
import { generationEnUS } from './generation';
import { settingsEnUS } from './settings';

export const translations = {
  'en-US': {
    ...commonEnUS,
    ...stageEnUS,
    ...chatEnUS,
    ...generationEnUS,
    ...settingsEnUS,
  },
} as const;

export type TranslationKey = keyof (typeof translations)[typeof defaultLocale];

export function translate(_locale: Locale, key: string): string {
  const keys = key.split('.');
  let value: unknown = translations['en-US'];
  for (const k of keys) {
    value = (value as Record<string, unknown>)?.[k];
  }
  return (typeof value === 'string' ? value : undefined) ?? key;
}

export function getClientTranslation(key: string): string {
  return translate('en-US', key);
}
