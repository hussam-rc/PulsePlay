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
