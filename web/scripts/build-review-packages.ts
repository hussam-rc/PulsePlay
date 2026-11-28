// Native-language review packages: one self-contained HTML file per language, opened offline in any browser.
// Usage: npx tsx scripts/build-review-packages.ts   ->  ../docs/review/ego-bank-review-{de,fr,ar}.html
// Reviewers compare EN and the translation, suggest edits, flag cultural ambiguity, approve per item and export their
// feedback as JSON/CSV. Nothing here publishes anything: approval in the file is input for the content owner.
import { mkdirSync, writeFileSync } from 'node:fs';
import { BANK_EN, AUTHORED, POINTS, DIMENSIONS, INSIGHTS_EN, RESULTS_EN } from '../src/experiences/drafts/egoCheckV2.en';
import { egoCheckV2Draft, LANGUAGE_PACKS } from '../src/experiences/drafts/egoCheckV2';
import { TRANSLATION_STATUS } from '../src/experiences/drafts/translate';

const NAMES = { de: 'German (Deutsch)', fr: 'French (Français)', ar: 'Arabic (العربية)' } as const;
const GUIDE = {
  de: 'Du-Form, Schweizer Schreibweise (ss statt ß). Antworten in der Ich-Form, kurz und natürlich gesprochen.',
  fr: 'Tutoiement. Réponses à la première personne, courtes et naturelles à l’oral.',
  ar: 'العربية الفصحى المبسطة، الإجابات بصيغة المتكلم، ونستخدم دائمًا كلمة «الأنا» (وليس «الغرور»).',
} as const;
const enAuthored = (q: typeof BANK_EN[number]) => {
  const t: string[] = []; q.options.forEach((o, k) => { t[AUTHORED[q.id][k]] = o.text; }); return t;
};

for (const pack of LANGUAGE_PACKS) {
  const lang = pack.lang;
  const items: unknown[] = [];
  // 1. Game texts
  for (const k of ['title', 'tagline', 'description', 'disclaimer'] as const)
    items.push({ id: `meta.${k}`, group: 'Game texts', kind: 'text', label: k, en: egoCheckV2Draft[k] ?? '', tr: pack.meta[k] ?? '' });
  // 2. Questions, by area
  for (const dim of DIMENSIONS) {
    const label = INSIGHTS_EN.themes[dim].label;
    for (const q of BANK_EN.filter(x => x.dimension === dim)) {
      const tr = pack.bank[q.id];
      items.push({ id: q.id, group: `Questions: ${label}`, kind: 'question', en: q.prompt, tr: tr[0],
        answers: enAuthored(q).map((en, pos) => ({ en, tr: tr[1][pos], points: POINTS[q.id][pos] })) });
    }
  }
  // 3. Personal feedback texts per area
  for (const dim of DIMENSIONS) {
    const en = INSIGHTS_EN.themes[dim], tr = pack.insights.themes[dim];
    for (const f of ['label', 'strength', 'growth', 'habit', 'challenge'] as const)
      items.push({ id: `insight.${dim}.${f}`, group: 'Feedback texts', kind: 'text', label: `${en.label}: ${f}`, en: en[f] ?? '', tr: tr?.[f] ?? '' });
  }
  for (const f of ['defaultHabit', 'defaultChallenge'] as const)
    items.push({ id: `insight.${f}`, group: 'Feedback texts', kind: 'text', label: f, en: INSIGHTS_EN[f] ?? '', tr: pack.insights[f] ?? '' });
  // 4. Result categories
  RESULTS_EN.forEach((b, i) => {
    for (const f of ['title', 'message', 'explanation', 'groupTitle', 'groupMessage'] as const)
      items.push({ id: `result.${i}.${f}`, group: 'Result categories', kind: 'text', label: `${b.emoji} ${b.min}–${b.max}: ${f}`, en: b[f] ?? '', tr: pack.results[i]?.[f] ?? '' });
  });

  const data = { lang, name: NAMES[lang], rtl: lang === 'ar', guide: GUIDE[lang], status: TRANSLATION_STATUS[lang].status, built: new Date().toISOString().slice(0, 10), items };
  mkdirSync('../docs/review', { recursive: true });
  writeFileSync(`../docs/review/ego-bank-review-${lang}.html`, page(data));
  console.log(lang, items.length, 'items');
}

function page(data: object): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Who is in Control? Translation review</title>
<style>
:root{--ink:#1d1b2f;--soft:#5d5a72;--line:#e6e1d6;--paper:#faf7f1;--card:#fff;--v:#5b3df5;--ok:#0e8370;--warn:#b26a00;--bad:#c2412d}
*{box-sizing:border-box}body{margin:0;font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Arabic",sans-serif;color:var(--ink);background:var(--paper)}
header{position:sticky;top:0;z-index:5;background:var(--card);border-bottom:1px solid var(--line);padding:12px 20px;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center}
header h1{font-size:17px;margin:0}.pill{font-size:12px;font-weight:700;border-radius:99px;padding:3px 10px;background:#efeafe;color:var(--v)}
.bar{flex:1;min-width:160px;height:8px;border-radius:9px;background:var(--line);overflow:hidden}.bar span{display:block;height:100%;background:var(--ok)}
main{max-width:1100px;margin:0 auto;padding:18px 20px 80px;display:grid;gap:14px}
.intro{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}.intro p{margin:6px 0}
.tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center}input,select,textarea{font:inherit;border:1px solid var(--line);border-radius:8px;padding:6px 8px;background:#fff;color:inherit}
button{font:inherit;font-weight:700;border:1px solid var(--line);background:#fff;border-radius:9px;padding:6px 12px;cursor:pointer}button.primary{background:var(--v);color:#fff;border-color:var(--v)}
h2{font-size:16px;margin:18px 0 0}.item{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;display:grid;gap:10px}
.item.approved{border-color:var(--ok);box-shadow:inset 4px 0 var(--ok)}.item.change{border-color:var(--warn);box-shadow:inset 4px 0 var(--warn)}.item.flagged .flag{background:#fff4e0}
.head{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.id{font-size:12px;color:var(--soft);font-family:ui-monospace,monospace}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px}.grid .h{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--soft)}
.prompt{font-weight:700}.ans{display:grid;grid-template-columns:96px 1fr 1fr;gap:4px 14px;align-items:start;border-top:1px dashed var(--line);padding-top:6px}
.tag{font-size:11px;font-weight:800;border-radius:6px;padding:2px 6px;text-align:center}.p0{background:#e2f5ef;color:var(--ok)}.p1{background:#e7efff;color:#2f5fd0}.p2{background:#fff1d6;color:var(--warn)}.p3{background:#fde4df;color:var(--bad)}
.rtl{direction:rtl;text-align:right}.edit{width:100%;min-height:34px;resize:vertical}.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.status button[aria-pressed=true].a{background:var(--ok);color:#fff;border-color:var(--ok)}.status button[aria-pressed=true].c{background:var(--warn);color:#fff;border-color:var(--warn)}
details summary{cursor:pointer;color:var(--v);font-weight:700;font-size:13px}.flag{border-radius:8px;padding:2px 6px}
.hidden{display:none}@media (max-width:760px){.grid,.ans{grid-template-columns:1fr}.ans .tag{justify-self:start}}
</style></head><body>
<header><h1>🪞 Who is in Control? · <span id="lname"></span></h1><span class="pill" id="status"></span>
<div class="bar" title="Reviewed"><span id="prog"></span></div><span id="count"></span>
<button class="primary" id="exportJson">Export feedback (JSON)</button><button id="exportCsv">Export CSV</button></header>
<main>
<section class="intro">
<p><b>Thank you for reviewing.</b> Compare each English original with the draft translation. For every item, choose <b>Approve</b> or <b>Needs change</b>; suggest better wording where needed; and tick <b>Cultural ambiguity</b> if a situation or answer could read differently in your culture (for example, more polite, more rude, or unusual at work).</p>
<p><b>Points stay fixed.</b> Each answer's points come from the English original and cannot be changed by the translation. Please check that your wording keeps the same <i>meaning and strength</i>: an answer worth 0 must sound as reasonable as in English, and one worth 3 as clearly self-centred. Feelings are never scored; only the reaction is.</p>
<p><b>Style:</b> <span id="guide"></span></p>
<p><b>Your progress is saved in this browser.</b> When you are done, click <b>Export feedback</b> and send the file back. Nothing is published from this file.</p>
<div class="tools"><label>Your name <input id="reviewer" placeholder="Reviewer name"></label>
<label>Show <select id="filter"><option value="all">All items</option><option value="todo">Not reviewed yet</option><option value="change">Needs change</option><option value="flag">Cultural ambiguity</option><option value="approved">Approved</option></select></label>
<label>Import earlier feedback <input type="file" id="importFile" accept="application/json"></label></div>
</section>
<div id="list"></div>
</main>
<script id="data" type="application/json">${json}</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent);
const KEY = 'pp-review-' + D.lang;
const LEVEL = ['0 · fine', '1 · mild', '2 · self-protective', '3 · ego-driven'];
let S = {}; try { S = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { S = {}; }
S.items = S.items || {};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} render(true); };
const st = id => S.items[id] || (S.items[id] = {});
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tdir = D.rtl ? ' class="rtl" dir="rtl"' : '';
document.getElementById('lname').textContent = D.name;
document.getElementById('status').textContent = 'Status: ' + D.status + ' · built ' + D.built;
document.getElementById('guide').textContent = D.guide;
const rv = document.getElementById('reviewer'); rv.value = S.reviewer || ''; rv.oninput = () => { S.reviewer = rv.value; save(); };

function itemHtml(it) {
  const s = st(it.id), sug = s.suggest || {};
  const edit = (key, val) => '<textarea class="edit' + (D.rtl ? ' rtl' : '') + '"' + (D.rtl ? ' dir="rtl"' : '') + ' data-k="' + key + '" placeholder="Suggested wording (leave empty if fine)">' + esc(val) + '</textarea>';
  let body;
  if (it.kind === 'question') {
    body = '<div class="grid"><div class="h">English original</div><div class="h">' + esc(D.name) + ' draft</div>' +
      '<div class="prompt">' + esc(it.en) + '</div><div class="prompt"' + (D.rtl ? ' dir="rtl" style="text-align:right"' : '') + '>' + esc(it.tr) + '</div></div>' +
      it.answers.map((a, i) => '<div class="ans"><span class="tag p' + a.points + '">' + LEVEL[a.points] + '</span><span>' + esc(a.en) + '</span><span' + tdir + '>' + esc(a.tr) + '</span></div>').join('') +
      '<details' + (Object.values(sug).some(Boolean) ? ' open' : '') + '><summary>Suggest edits</summary><div class="grid" style="margin-top:6px">' +
      '<div class="h">Question</div><div>' + edit('prompt', sug.prompt) + '</div>' +
      it.answers.map((a, i) => '<div class="h">Answer ' + (i + 1) + ' (' + LEVEL[a.points] + ')</div><div>' + edit('a' + i, sug['a' + i]) + '</div>').join('') + '</div></details>';
  } else {
    body = '<div class="grid"><div class="h">English original · ' + esc(it.label) + '</div><div class="h">' + esc(D.name) + ' draft</div><div>' + esc(it.en) + '</div><div' + tdir + '>' + esc(it.tr) + '</div></div>' +
      '<details' + (sug.text ? ' open' : '') + '><summary>Suggest an edit</summary>' + edit('text', sug.text) + '</details>';
  }
  return '<article class="item ' + (s.status === 'approved' ? 'approved' : s.status === 'change' ? 'change' : '') + (s.flag ? ' flagged' : '') + '" data-id="' + it.id + '">' +
    '<div class="head"><span class="id">' + esc(it.id) + '</span><span class="row status">' +
    '<button class="a" aria-pressed="' + (s.status === 'approved') + '" data-act="approved">✓ Approve</button>' +
    '<button class="c" aria-pressed="' + (s.status === 'change') + '" data-act="change">✎ Needs change</button></span></div>' + body +
    '<div class="row"><label class="flag"><input type="checkbox" data-act="flag"' + (s.flag ? ' checked' : '') + '> Cultural ambiguity</label>' +
    '<input data-k="comment" style="flex:1;min-width:200px" placeholder="Comment (why, or what is ambiguous)" value="' + esc(s.comment) + '"></div></article>';
}
function visible(it) {
  const s = S.items[it.id] || {}, f = document.getElementById('filter').value;
  return f === 'all' || (f === 'todo' && !s.status) || (f === 'change' && s.status === 'change') || (f === 'flag' && s.flag) || (f === 'approved' && s.status === 'approved');
}
function render(statsOnly) {
  const done = D.items.filter(it => (S.items[it.id] || {}).status).length;
  document.getElementById('prog').style.width = (100 * done / D.items.length) + '%';
  document.getElementById('count').textContent = done + ' / ' + D.items.length + ' reviewed · ' + D.items.filter(it => (S.items[it.id] || {}).status === 'approved').length + ' approved';
  if (statsOnly) return;
  let html = '', g = null;
  for (const it of D.items) { if (!visible(it)) continue; if (it.group !== g) { g = it.group; html += '<h2>' + esc(g) + '</h2>'; } html += itemHtml(it); }
  document.getElementById('list').innerHTML = html || '<p>Nothing to show for this filter.</p>';
}
document.getElementById('list').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const card = b.closest('.item'), s = st(card.dataset.id);
  s.status = s.status === b.dataset.act ? undefined : b.dataset.act; save();
  card.outerHTML = itemHtml(D.items.find(x => x.id === card.dataset.id));
});
document.getElementById('list').addEventListener('change', e => {
  if (e.target.dataset.act !== 'flag') return;
  const card = e.target.closest('.item'); st(card.dataset.id).flag = e.target.checked; card.classList.toggle('flagged', e.target.checked); save();
});
document.getElementById('list').addEventListener('input', e => {
  const k = e.target.dataset.k; if (!k) return;
  const s = st(e.target.closest('.item').dataset.id);
  if (k === 'comment') s.comment = e.target.value; else { s.suggest = s.suggest || {}; s.suggest[k] = e.target.value; }
  save();
});
document.getElementById('filter').onchange = () => render();
function rows() {
  return D.items.map(it => { const s = S.items[it.id] || {}; return { id: it.id, group: it.group, status: s.status || 'not reviewed', culturalAmbiguity: !!s.flag, comment: s.comment || '', suggestions: Object.fromEntries(Object.entries(s.suggest || {}).filter(([, v]) => v)) }; });
}
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
const stamp = () => new Date().toISOString().slice(0, 10);
document.getElementById('exportJson').onclick = () => download('ego-bank-review-' + D.lang + '-' + stamp() + '.json',
  JSON.stringify({ lang: D.lang, reviewer: S.reviewer || '', exported: new Date().toISOString(), packageBuilt: D.built, items: rows() }, null, 2), 'application/json');
document.getElementById('exportCsv').onclick = () => {
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  const lines = [['id', 'group', 'status', 'cultural_ambiguity', 'comment', 'suggestions'].join(',')].concat(rows().map(r => [r.id, r.group, r.status, r.culturalAmbiguity, r.comment, Object.entries(r.suggestions).map(([k, v]) => k + ': ' + v).join(' | ')].map(q).join(',')));
  download('ego-bank-review-' + D.lang + '-' + stamp() + '.csv', '\\ufeff' + lines.join('\\n'), 'text/csv');
};
document.getElementById('importFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { const j = JSON.parse(await f.text()); if (j.lang !== D.lang) throw new Error('This file is for ' + j.lang);
    S.reviewer = j.reviewer || S.reviewer; for (const r of j.items) S.items[r.id] = { status: r.status === 'not reviewed' ? undefined : r.status, flag: r.culturalAmbiguity, comment: r.comment, suggest: r.suggestions };
    rv.value = S.reviewer || ''; save(); render(); } catch (err) { document.getElementById('count').textContent = 'Import failed: ' + err.message; }
};
render();
</script></body></html>
`;
}
