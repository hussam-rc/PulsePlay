// Content-quality metrics for the Who is in Control? bank. Usage: npx tsx scripts/quality-ego-bank.ts [path-to-bank.ts]
// Measures giveaways (answer patterns that reveal the scoring), feelings that would be scored, repetition and length.
import { pathToFileURL } from 'node:url';
const path = process.argv[2] ?? '../src/experiences/drafts/egoCheckV2.en.ts';
const { BANK_EN } = await import(path.startsWith('/') ? pathToFileURL(path).href : path);
type Q = { id: string; prompt: string; dimension: string; options: { id: string; text: string; points: number }[] };
const bank = BANK_EN as Q[];
const lvl = (q: Q, p: number) => q.options.find(o => o.points === p)!.text;
const first = (s: string) => s.split(/[\s,;:]/)[0].toLowerCase();
const pct = (n: number, d: number) => `${Math.round((100 * n) / d)}%`;
const startsAsk = [0, 1, 2, 3].map(p => bank.filter(q => first(lvl(q, p)) === 'ask').length);
const FEEL = /\b(feel|feels|felt|upset|hurt|annoyed|disappointed|irritated|sting)\b/i;
const feltScored = bank.filter(q => [2, 3].some(p => FEEL.test(lvl(q, p))) ).map(q => q.id);
const texts = bank.flatMap(q => q.options.map(o => o.text.toLowerCase()));
const dupes = [...new Set(texts.filter((t, i) => texts.indexOf(t) !== i))];
const stems = bank.map(q => q.prompt.toLowerCase().split(' ').slice(0, 3).join(' '));
const dupStems = [...new Set(stems.filter((s, i) => stems.indexOf(s) !== i))];
// Most common opening word per level: a strong tell if one word dominates a level.
const topWord = (p: number) => { const m: Record<string, number> = {}; bank.forEach(q => { const w = first(lvl(q, p)); m[w] = (m[w] ?? 0) + 1; }); const [w, n] = Object.entries(m).sort((a, b) => b[1] - a[1])[0]; return `${w} ${pct(n, bank.length)}`; };
const avgLen = (p: number) => Math.round(bank.reduce((s, q) => s + lvl(q, p).length, 0) / bank.length);
console.log(JSON.stringify({
  questions: bank.length,
  answersStartingWithAsk_byLevel_0to3: startsAsk,
  mostCommonOpeningWord_byLevel: [0, 1, 2, 3].map(topWord),
  averageAnswerLength_byLevel: [0, 1, 2, 3].map(avgLen),
  feelingsInScoredAnswers: feltScored,
  duplicateAnswerTexts: dupes,
  repeatedPromptOpenings: dupStems,
  maxPrompt: Math.max(...bank.map(q => q.prompt.length)), maxAnswer: Math.max(...bank.flatMap(q => q.options.map(o => o.text.length))),
}, null, 1));
