// Side-by-side translation review sheet. Usage: npx tsx scripts/review-translations.ts > ../docs/EGO_BANK_TRANSLATIONS.md
import { BANK_EN, DIMENSIONS, INSIGHTS_EN, AUTHORED, POINTS } from '../src/experiences/drafts/egoCheckV2.en';
import { LANGUAGE_PACKS } from '../src/experiences/drafts/egoCheckV2';
import { TRANSLATION_STATUS } from '../src/experiences/drafts/translate';
const L = ['open', 'assertive', 'self-protective', 'ego-driven'];
const out = ['# Who is in Control? v2: translations for native review', '',
  'Generated from `web/src/experiences/drafts/egoCheckV2.{de,fr,ar}.ts`. Answer ids and points come from the English master, so translators only change wording.', '',
  '## Status', '', '| Language | Questions | Insights | Results | Longest prompt | Longest answer | Review status | Reviewer |', '|---|---:|---:|---:|---:|---:|---|---|'];
for (const p of LANGUAGE_PACKS) {
  const s = TRANSLATION_STATUS[p.lang]; const v = Object.values(p.bank);
  out.push(`| ${p.lang.toUpperCase()} | ${v.length}/60 | ${Object.keys(p.insights.themes).length}/6 | ${p.results.length}/4 | ${Math.max(...v.map(x => x[0].length))} | ${Math.max(...v.flatMap(x => x[1].map(o => o.length)))} | ${s.status} | ${s.reviewer ?? '–'} |`);
}
out.push('', 'Rule: a language is published only when it is complete **and** marked `reviewed` with a reviewer and date.', '');
for (const d of DIMENSIONS) {
  out.push(`## ${INSIGHTS_EN.themes[d].label}`, '');
  for (const q of BANK_EN.filter(x => x.dimension === d)) {
    out.push(`### ${q.id}`, '', '| | EN | DE | FR | AR |', '|---|---|---|---|---|',
      `| Situation | ${q.prompt} | ${LANGUAGE_PACKS.map(p => p.bank[q.id][0]).join(' | ')} |`);
    for (let l = 0; l < 4; l++) out.push(`| ${POINTS[q.id][l]} · ${L[l]} | ${q.options[AUTHORED[q.id].indexOf(l)].text} | ${LANGUAGE_PACKS.map(p => p.bank[q.id][1][l]).join(' | ')} |`);
    out.push('');
  }
}
console.log(out.join('\n'));
