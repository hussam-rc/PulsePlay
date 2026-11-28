// Open answers (participants type their own words). Pure rules shared by the practice engine, the screens and tests.
// The server (pp.open_submit, pp._open_key, pp._open_flag) applies the same rules; it is the authority in live games.
import type { Activity } from './schema';

export type OpenActivity = Extract<Activity, { type: 'open' }>;
export type OpenStatus = 'pending' | 'shown' | 'hidden';
/** One answer as the host sees it. `key` groups identical answers; nobody, including the host, sees who wrote it. */
export type FlagReason = 'word' | 'markup';
export interface OpenItem { id: string; text: string; key: string; status: OpenStatus; flagged: boolean; reason?: FlagReason; at: number; shownAt?: number }
export interface CloudWord { key: string; text: string; count: number; first: number }

/** Invisible and control characters (incl. bidi overrides and zero-width) are removed; whitespace collapsed. */
export function cleanAnswer(raw: string): string {
  return raw.normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/**
 * Grouping key: identical answers count together regardless of upper/lower case, surrounding punctuation,
 * spacing or Arabic vowel marks. Different words are never merged: no translation, no synonyms, no stemming.
 */
export function answerKey(text: string): string {
  return cleanAnswer(text).toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')                 // Arabic tashkeel and tatweel
    .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '');          // leading/trailing punctuation and symbols
}

const wordCount = (s: string) => s.split(' ').filter(Boolean).length;
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|net|org|io|ch|de|fr|ly|me|app|xyz|info|biz|co|ru|cn)\b|@[a-z0-9_]{3,})/i;
export const looksLikeLink = (s: string) => LINK.test(s);

/**
 * Basic filter for clearly offensive words in the supported languages. Deliberately short and conservative:
 * it holds an answer back for the host to check; it never decides on its own what is acceptable.
 */
const BLOCK: string[] = [
  // en
  'fuck', 'fucking', 'shit', 'bitch', 'bastard', 'asshole', 'cunt', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard', 'rape',
  // de
  'scheisse', 'scheiße', 'arschloch', 'fotze', 'hure', 'wichser', 'schlampe', 'hurensohn', 'missgeburt', 'schwuchtel', 'spast', 'kanake',
  // fr
  'merde', 'putain', 'connard', 'connasse', 'salope', 'encule', 'enculé', 'pute', 'batard', 'bâtard', 'nique', 'bougnoule',
  // ar
  'شرموط', 'شرموطة', 'عاهرة', 'قحبة', 'منيوك', 'زب', 'كس', 'خول', 'يلعن', 'حقير', 'زبالة',
];
const BLOCKSET = new Set(BLOCK.map(w => w.normalize('NFC').toLowerCase()));
/** Leetspeak and repeated letters are folded so "sh1t" or "fuuuck" are still caught. */
const fold = (w: string) => w.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[ً-ٰٟـ]/g, '').replace(/[@4]/g, 'a').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/3/g, 'e').replace(/\$|5/g, 's')
  .replace(/(.)\1{2,}/g, '$1$1');
const BLOCKFOLD = new Set(BLOCK.map(fold));
export function isFlagged(text: string): boolean {
  const words = cleanAnswer(text).toLowerCase().split(/[^\p{L}\p{N}@$!|]+/u).filter(Boolean);
  return words.some(w => BLOCKSET.has(w) || BLOCKFOLD.has(fold(w)) || BLOCKFOLD.has(fold(w).replace(/(.)\1+/g, '$1')));
}

/** Code-like text (tags, entities, script URLs, template syntax). Same pattern as pp._open_markup: held for the host. */
const MARKUP = /(<[a-z/!?]|&#?[a-z0-9]+;|javascript:|data:[a-z]+\/|\{\{|\$\{|\]\()/i;
export const looksLikeMarkup = (s: string) => MARKUP.test(s);
/** Why an answer is held back for the host, if at all (mirrors pp._open_reason). */
export const flagReason = (text: string): FlagReason | undefined => (isFlagged(text) ? 'word' : looksLikeMarkup(text) ? 'markup' : undefined);

export type OpenError = 'empty' | 'too_long' | 'too_many_words' | 'link' | 'limit' | 'duplicate';
/** Checks one answer against the question's limits. Returns the cleaned text or why it cannot be sent. */
export function checkAnswer(a: OpenActivity, raw: string): { ok: true; text: string; flagged: boolean; reason?: FlagReason } | { ok: false; error: OpenError } {
  const text = cleanAnswer(raw);
  if (!text) return { ok: false, error: 'empty' };
  if ([...text].length > a.maxChars) return { ok: false, error: 'too_long' };
  if (a.maxWords && wordCount(text) > a.maxWords) return { ok: false, error: 'too_many_words' };
  if (looksLikeLink(text)) return { ok: false, error: 'link' };
  const reason = flagReason(text);
  return { ok: true, text, flagged: !!reason, reason };
}

/** Status a new answer gets: flagged answers always wait for the host, even when the game shows answers live. */
export const initialStatus = (a: OpenActivity, flagged: boolean): OpenStatus => (a.moderation === 'live' && !flagged ? 'shown' : 'pending');

/**
 * Word cloud data: shown answers grouped by key, the most frequent spelling is displayed.
 * Order is by first appearance, so existing words keep their place as new ones arrive (no jumping layout).
 */
export function cloud(items: Pick<OpenItem, 'text' | 'key' | 'status' | 'at'>[]): CloudWord[] {
  const m = new Map<string, { count: number; first: number; spellings: Map<string, number> }>();
  for (const it of items) {
    if (it.status !== 'shown' || !it.key) continue;
    const g = m.get(it.key) ?? { count: 0, first: it.at, spellings: new Map() };
    g.count++; g.first = Math.min(g.first, it.at); g.spellings.set(it.text, (g.spellings.get(it.text) ?? 0) + 1);
    m.set(it.key, g);
  }
  return [...m].map(([key, g]) => ({ key, count: g.count, first: g.first,
    text: [...g.spellings].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0][0] })).sort((x, y) => x.first - y.first); // stable: ties keep arrival order
}

/** Font size for a word: grows with the square root of its share, so one popular word cannot swamp the screen. */
export function cloudSize(count: number, max: number, minRem = 1.4, maxRem = 5.5): number {
  if (max <= 1) return (minRem + maxRem) / 2.6;
  return +(minRem + (maxRem - minRem) * Math.sqrt((count - 1) / (max - 1))).toFixed(2);
}

/** Defaults by display mode, used by Creator Studio when a creator adds a question. */
export const OPEN_DEFAULTS: Record<OpenActivity['display'], Pick<OpenActivity, 'maxChars' | 'maxWords' | 'maxResponses'>> = {
  cloud: { maxChars: 25, maxWords: 2, maxResponses: 3 },
  wall: { maxChars: 100, maxWords: undefined, maxResponses: 1 },
  list: { maxChars: 140, maxWords: undefined, maxResponses: 1 },
};
