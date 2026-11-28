// Builds a language version of the v2 bank from the English master. Translators supply the four answers in the master's
// authored order; option ids and points are copied from the master, so a translation can never change an answer's score.
import type { Experience } from '../../engine/schema';
import { BANK_EN, AUTHORED } from './egoCheckV2.en';

export type Lang = 'de' | 'fr' | 'ar';
/** id -> [prompt, [four answers in the master's authored order: open, assertive, self-protective, ego]] */
export type BankText = Record<string, [string, [string, string, string, string]]>;
export interface LanguagePack {
  lang: Lang;
  bank: BankText;
  insights: NonNullable<Experience['insights']>;
  results: NonNullable<Experience['results']>;
  meta: Pick<Experience, 'title' | 'tagline' | 'description' | 'disclaimer'>;
}

export function buildBank(pack: LanguagePack) {
  return BANK_EN.map(q => {
    const tr = pack.bank[q.id];
    if (!tr) throw new Error(`${pack.lang}: missing ${q.id}`);
    return { ...q, prompt: tr[0], options: q.options.map((o, k) => ({ ...o, text: tr[1][AUTHORED[q.id][k]] })) };
  });
}

/** Review status per language. Nothing is published until a language is complete AND native-reviewed. */
export const TRANSLATION_STATUS: Record<Lang, { status: 'draft' | 'in-review' | 'reviewed'; reviewer?: string; date?: string; notes: string }> = {
  de: { status: 'draft', notes: 'Drafted from the reviewed EN master (du-form, Swiss spelling). Needs a native reviewer.' },
  fr: { status: 'draft', notes: 'Drafted from the reviewed EN master (tu-form). Needs a native reviewer.' },
  ar: { status: 'draft', notes: 'Drafted from the reviewed EN master (MSA, first-person answers, الأنا). Needs a native reviewer.' },
};
