// Interface strings. Content language is separate (Experience.languages).
// Only English exists today; Arabic/German/French are added in Phase 3 and never claimed before they are translated.
const en = {
  'nav.discover': 'Discover', 'nav.play': 'Play', 'nav.create': 'Create', 'nav.host': 'Host', 'nav.workspace': 'My Workspace',
  'tagline': 'Bring people together. One game at a time.',
  'privacy.short': 'Answers stay private. The room only sees anonymous group results.',
  'practice.banner': 'PRACTICE MODE · simulated players only. Nothing is saved.',
} as const;

export type Key = keyof typeof en;
export const LOCALES = { en: { dir: 'ltr' as const, label: 'English', strings: en } };
export type Locale = keyof typeof LOCALES;
let current: Locale = 'en';
export const t = (k: Key) => LOCALES[current].strings[k] ?? k;
export const dir = () => LOCALES[current].dir;
