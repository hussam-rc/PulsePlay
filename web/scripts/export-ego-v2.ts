// Writes the Ego Check v2 draft as a game file for staged acceptance tests (local test environment only).
// Usage: npx tsx scripts/export-ego-v2.ts [en|de|fr|ar] [--no-score] > /tmp/ego-v2.json
import { egoCheckV2Draft, egoCheckV2For, LANGUAGE_PACKS } from '../src/experiences/drafts/egoCheckV2';
const lang = process.argv[2] ?? 'en', pack = LANGUAGE_PACKS.find(p => p.lang === lang);
const e = structuredClone(pack ? egoCheckV2For(pack) : egoCheckV2Draft);
if (process.argv.includes('--no-score')) e.scoring = { ...e.scoring, showScore: false };
process.stdout.write(JSON.stringify(e));
