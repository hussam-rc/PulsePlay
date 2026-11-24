import { describe, it, expect } from 'vitest';
import { LOCALES, Key } from '../src/i18n';

const en = LOCALES.en.strings;
const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
describe('interface translations', () => {
  for (const [l, loc] of Object.entries(LOCALES)) {
    it(`${l}: every string exists, is not empty and keeps its placeholders`, () => {
      for (const k of Object.keys(en) as Key[]) {
        expect(loc.strings[k], `${l}.${k}`).toBeTruthy();
        expect(vars(loc.strings[k]), `${l}.${k}`).toBe(vars(en[k]));
      }
    });
  }
  it('Arabic renders right-to-left', () => { expect(LOCALES.ar.dir).toBe('rtl'); });
  it('German uses Swiss spelling (no ß)', () => { expect(Object.values(LOCALES.de.strings).join(' ')).not.toContain('ß'); });
});

describe('Would You Rather reaction lines', () => {
  it('match the actual split', async () => {
    const { reaction } = await import('../src/live/screens');
    expect(reaction({ a: 1, b: 5 }, 6)).toContain('Strong opinions');     // 17 / 83
    expect(reaction({ a: 3, b: 3 }, 6)).toContain('split');               // 50 / 50
    expect(reaction({ a: 3, b: 2 }, 5)).toContain('split');               // 60 / 40
    expect(reaction({ a: 7, b: 3 }, 10)).toContain('Interesting');        // 70 / 30
    expect(reaction({ a: 10, b: 0 }, 10)).toContain('Who saw that coming'); // 100 / 0
  });
});

describe('copy polish', () => {
  it('no doubled punctuation in any language', () => {
    for (const [l, loc] of Object.entries(LOCALES))
      for (const [k, v] of Object.entries(loc.strings)) expect(/(?<!\.)\.\.(?!\.)|\s[.,]/.test(v), `${l}.${k}: ${v}`).toBe(false);
  });
});
