// Question bank section of the builder: overview, how games pick questions, game lengths, groups and sample games.
import { useMemo, useState } from 'react';
import type { Draft } from './model';
import { BALANCE_LABEL, LENGTH_CHOICES, balanceOf, groups, overview, previewSelections, renameGroup, setBalance, setBankEnabled,
  setDefaultLength, toggleLength, type BalanceBy } from './bankModel';

export function BankPanel({ d, set, readOnly }: { d: Draft; set: (next: Draft) => void; readOnly?: boolean }) {
  const on = !!d.bank, by = balanceOf(d);
  const ov = useMemo(() => overview(d), [d]);
  const gs = useMemo(() => (by === 'random' ? [] : groups(d, by)), [d, by]);
  const [n, setN] = useState<number | null>(null);
  const [seed, setSeed] = useState(1);
  const playable = ov.lengths.filter(l => l.available);
  const sampleN = n != null && playable.some(l => l.n === n) ? n : (d.bank?.defaultLength ?? playable[0]?.n ?? null);
  const samples = useMemo(() => (on && sampleN ? previewSelections(d, sampleN, 3, seed) : []), [d, on, sampleN, seed]);
  const [renaming, setRenaming] = useState<{ tag: string; name: string } | null>(null);
  const groupWord = by === 'dimension' ? 'area' : 'category';

  return (
    <div className="grid gap-4" data-testid="bank">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="bank-overview">
        <Stat label="Questions" value={ov.total} />
        <Stat label="In use" value={ov.active} tone="teal" />
        <Stat label="Archived" value={ov.archived} tone="sun" />
        <Stat label={on && by !== 'random' ? (by === 'dimension' ? 'Areas' : 'Categories') : 'Per game'} value={on && by !== 'random' ? gs.length : (on ? (d.bank!.defaultLength ?? '–') : ov.active)} />
      </div>

      <label className="flex gap-3 items-start rounded-2xl border border-paper-line p-3 cursor-pointer">
        <input type="checkbox" className="w-5 h-5 mt-0.5 accent-violet-600" checked={on} disabled={readOnly} data-testid="bank-toggle"
          onChange={e => set(setBankEnabled(d, e.target.checked))} />
        <span><b>Use these questions as a question bank</b>
          <span className="block text-sm text-ink-soft">{on ? 'Each game picks a selection, so repeat players see different questions. Hosts choose the length.' : 'Off: every game plays all questions in this order (as before).'}</span></span>
      </label>

      {on && <>
        <fieldset className="grid gap-2"><legend className="text-sm font-bold mb-1">How should each game pick its questions?</legend>
          <div className="grid sm:grid-cols-3 gap-2" role="radiogroup">
            {(['random', 'category', 'dimension'] as BalanceBy[]).map(b => <button type="button" key={b} role="radio" aria-checked={by === b} data-testid={`balance-${b}`} disabled={readOnly}
              onClick={() => set(setBalance(d, b))}
              className={`text-start rounded-2xl p-3 border-2 ${by === b ? 'border-violet-500 bg-violet-50' : 'border-paper-line bg-white hover:border-violet-100'}`}>
              <b className="block">{BALANCE_LABEL[b].title}</b><span className="text-sm text-ink-soft">{BALANCE_LABEL[b].blurb}</span></button>)}
          </div>
          {ov.withoutGroup > 0 && <p className="text-sm rounded-xl bg-sun-50 p-2" data-testid="bank-nogroup">{ov.withoutGroup} question{ov.withoutGroup === 1 ? ' has' : 's have'} no {groupWord} yet. Give each question a {groupWord} below, otherwise they are mixed as one extra group.</p>}
        </fieldset>

        <fieldset className="grid gap-2"><legend className="text-sm font-bold mb-1">Game lengths hosts can choose</legend>
          <div className="flex flex-wrap gap-2">
            {LENGTH_CHOICES.map(c => { const sel = d.bank!.lengths.includes(c), ok = c <= ov.active;
              return <label key={c} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${sel ? 'border-violet-500 bg-violet-50' : 'border-paper-line'}`}>
                <input type="checkbox" className="w-4 h-4 accent-violet-600" checked={sel} disabled={readOnly || (sel && d.bank!.lengths.length === 1) || (!sel && d.bank!.lengths.length >= 5)}
                  onChange={() => set(toggleLength(d, c))} data-testid={`len-${c}`} />
                <span><b>{c}</b> questions{!ok && <span className="block text-xs font-bold text-ink-soft">needs {c - ov.active} more</span>}</span></label>; })}
          </div>
          <div className="flex flex-wrap gap-2 items-center"><span className="text-sm font-bold">Suggested length</span>
            {d.bank!.lengths.map(c => <button type="button" key={c} disabled={readOnly} aria-pressed={d.bank!.defaultLength === c} data-testid={`deflen-${c}`}
              onClick={() => set(setDefaultLength(d, c))} className={`rounded-full px-3 py-1 text-sm font-bold border ${d.bank!.defaultLength === c ? 'bg-violet-600 text-white border-violet-600' : 'border-paper-line'}`}>{c}</button>)}</div>
          <ul className="text-sm text-ink-soft grid gap-0.5" data-testid="bank-lengths">{ov.lengths.map(l => <li key={l.n}>{l.available ? '✓' : '✕'} {l.n} questions · about {l.minutes} min{!l.available && ' · not enough questions in use yet'}</li>)}</ul>
        </fieldset>

        {by !== 'random' && <div className="grid gap-2" data-testid="bank-groups"><span className="text-sm font-bold">{by === 'dimension' ? 'Areas' : 'Categories'} (set per question below)</span>
          {gs.length === 0 && <p className="text-sm text-ink-soft">None yet. Type a {groupWord} name on any question.</p>}
          <ul className="grid gap-1">{gs.map(g => <li key={g.tag} className="flex flex-wrap items-center gap-2 rounded-xl bg-paper px-3 py-2">
            {renaming?.tag === g.tag
              ? <><input className="field !min-h-[36px] flex-1" value={renaming.name} aria-label={`New name for ${g.label}`} autoFocus onChange={e => setRenaming({ ...renaming, name: e.target.value })} />
                <button type="button" className="btn-ghost !min-h-[36px] text-sm" onClick={() => { set(renameGroup(d, by, g.tag, renaming.name)); setRenaming(null); }}>Save</button>
                <button type="button" className="btn-ghost !min-h-[36px] text-sm" onClick={() => setRenaming(null)}>Cancel</button></>
              : <><b className="me-auto">{g.label}</b><span className="text-sm text-ink-soft">{g.active} in use{g.archived ? ` · ${g.archived} archived` : ''}</span>
                {!readOnly && <button type="button" className="btn-ghost !min-h-[32px] !px-2 text-sm" onClick={() => setRenaming({ tag: g.tag, name: g.label })} data-testid={`rename-${g.tag}`}>Rename</button>}</>}
          </li>)}</ul></div>}

        {ov.scored && ov.maxPoints.length > 0 && <p className="text-sm text-ink-soft" data-testid="bank-scoring">Scoring: {ov.maxPoints.filter(p => p === Math.max(...ov.maxPoints)).length} questions go up to {Math.max(...ov.maxPoints)} points
          {ov.maxPoints.some(p => p < Math.max(...ov.maxPoints)) ? (k => `, ${k} ${k === 1 ? 'has' : 'have'} a lower top score`)(ov.maxPoints.filter(p => p < Math.max(...ov.maxPoints)).length) : ''}. A player's score is always out of the highest points possible for the questions in their game, so every game length is fair.</p>}

        <div className="grid gap-2"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold me-auto">Preview: three example games</span>
          {playable.map(l => <button type="button" key={l.n} aria-pressed={sampleN === l.n} onClick={() => setN(l.n)} data-testid={`sample-len-${l.n}`}
            className={`rounded-full px-3 py-1 text-sm font-bold border ${sampleN === l.n ? 'bg-sky-500 text-white border-sky-500' : 'border-paper-line'}`}>{l.n}</button>)}
          {samples.length > 0 && <button type="button" className="btn-ghost !min-h-[32px] text-sm" onClick={() => setSeed(s => s + 1)} data-testid="sample-shuffle">🔀 Shuffle</button>}</div>
          {!samples.length && <p className="text-sm text-ink-soft">Add more questions in use to preview a game.</p>}
          <div className="grid md:grid-cols-3 gap-2">{samples.map((s, i) => <div key={i} className="rounded-2xl border border-paper-line p-3 grid gap-2 content-start" data-testid="sample">
            <b>Game {i + 1} · about {s.minutes} min</b>
            {Object.keys(s.groups).length > 0 && <div className="flex flex-wrap gap-1">{Object.entries(s.groups).map(([g, c]) => <span key={g} className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold">{g} {c}</span>)}</div>}
            <ol className="list-decimal ps-5 text-sm grid gap-0.5">{s.questions.map(q => <li key={q.id} dir="auto">{q.prompt || <i className="text-ink-soft">(empty question)</i>}</li>)}</ol></div>)}</div>
        </div>
      </>}
      <p className="text-xs text-ink-soft">Published versions never change. Publishing again creates a new version; rooms already played keep the exact questions they used.</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'teal' | 'sun' }) {
  return <div className={`rounded-2xl p-3 ${tone === 'teal' ? 'bg-teal-50' : tone === 'sun' ? 'bg-sun-50' : 'bg-paper'}`}>
    <div className="text-2xl font-extrabold tabular-nums">{value}</div><div className="text-xs font-bold text-ink-soft">{label}</div></div>;
}
