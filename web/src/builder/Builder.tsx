// No-code game builder. Edits a schema v1 draft through forms only; the checker speaks plain language.
import { ReactNode, useMemo, useState } from 'react';
import type { Activity, ResultBand } from '../engine/schema';
import { validateExperience } from '../engine/schema';
import { AiDraft } from './AiDraft';
import { PhonePreview } from './PhonePreview';
import { ACTIVITY_LABEL, changeKind, Draft, GameKind, humanize, KINDS, kindOf, newActivity, newId, nextOptionId, splitBands } from './model';

const CATEGORIES: [Draft['category'], string][] = [['icebreaker', 'Icebreaker'], ['team-building', 'Team building'], ['reflection', 'Reflection'], ['workplace-culture', 'Workplace culture'],
  ['communication', 'Communication'], ['leadership', 'Leadership'], ['collaboration', 'Collaboration'], ['trivia', 'Trivia & quiz'], ['education', 'Education'], ['community', 'Community'],
  ['intercultural', 'Intercultural'], ['creative', 'Creative'], ['problem-solving', 'Problem solving'], ['fun', 'Just for fun']];
const EMOJIS = ['🧠', '🪞', '📊', '💬', '🎯', '🧩', '🚀', '🌍', '🤝', '💡', '🎲', '🏆', '🌱', '🔥', '❤️', '🎉'];
const LANGS: [Draft['languages'][number], string][] = [['en', 'English'], ['ar', 'Arabic'], ['de', 'German'], ['fr', 'French']];
const TONES: [ResultBand['tone'], string][] = [['great', '🟢 Great'], ['good', '🔵 Good'], ['watch', '🟡 Watch out'], ['grow', '🟠 Room to grow']];

export function Builder({ value, onChange, readOnly }: { value: Draft; onChange: (d: Draft) => void; readOnly?: boolean }) {
  const d = value;
  const set = (f: (x: Draft) => void) => { if (readOnly) return; const x = structuredClone(d); f(x); onChange(x); };
  const kind = kindOf(d);
  const acts = d.rounds.flatMap(r => r.activities);
  const setActs = (f: (a: Activity[]) => Activity[]) => set(x => { x.rounds = [{ ...x.rounds[0], id: x.rounds[0]?.id ?? 'main', activities: f(x.rounds.flatMap(r => r.activities)) }]; });
  const check = useMemo(() => validateExperience({ ...d, status: 'published' }), [d]);
  const problems = useMemo(() => humanize(check.errors, d), [check, d]);
  const warnings = useMemo(() => humanize(check.warnings, d), [check, d]);
  const scored = kind === 'quiz' || kind === 'score';
  const [focus, setFocus] = useState(0);

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">
      <fieldset disabled={readOnly} className="grid gap-5 min-w-0">
        {/* ---------- basics ---------- */}
        <Section id="basics" n={1} title="Basics">
          <div className="grid sm:grid-cols-[auto_1fr] gap-4 items-start">
            <div className="grid gap-1"><span className="text-sm font-bold">Icon</span>
              <div className="grid grid-cols-4 gap-1 w-44" role="radiogroup" aria-label="Icon">{EMOJIS.map(e => <button type="button" key={e} role="radio" aria-checked={d.emoji === e} onClick={() => set(x => { x.emoji = e; })} className={`text-2xl rounded-xl h-10 ${d.emoji === e ? 'bg-violet-100 ring-2 ring-violet-500' : 'hover:bg-paper'}`}>{e}</button>)}</div></div>
            <div className="grid gap-3">
              <Text label="Game name" value={d.title} max={60} onChange={v => set(x => { x.title = v; })} testid="b-title" />
              <Text label="Short tagline" hint="One line that makes people curious." value={d.tagline} max={120} onChange={v => set(x => { x.tagline = v; })} />
            </div>
          </div>
          <Text label="Description" area value={d.description} max={600} onChange={v => set(x => { x.description = v; })} />
          <div className="grid sm:grid-cols-3 gap-3">
            <Select label="Category" value={d.category} options={CATEGORIES} onChange={v => set(x => { x.category = v; })} />
            <Num label="Duration (minutes)" value={d.durationMin} min={1} max={180} onChange={v => set(x => { x.durationMin = v; })} />
            <Select label="Suitable for" value={d.ageRating} options={[['all', 'Everyone'], ['12+', '12+'], ['16+', '16+'], ['adults', 'Adults']]} onChange={v => set(x => { x.ageRating = v; })} />
            <Num label="Players from" value={d.players.min} min={1} max={500} onChange={v => set(x => { x.players.min = v; })} />
            <Num label="Players up to" value={d.players.max} min={1} max={500} onChange={v => set(x => { x.players.max = v; })} />
            <div className="grid gap-1"><span className="text-sm font-bold">Languages</span><div className="flex flex-wrap gap-2">{LANGS.map(([l, name]) =>
              <label key={l} className="flex items-center gap-1 text-sm"><input type="checkbox" className="w-4 h-4 accent-violet-600" checked={d.languages.includes(l)} onChange={e => set(x => { x.languages = e.target.checked ? [...x.languages, l] : x.languages.filter(y => y !== l); })} />{name}</label>)}</div></div>
          </div>
        </Section>

        {/* ---------- type ---------- */}
        <Section id="type" n={2} title="Type of game">
          <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Type of game">
            {(Object.keys(KINDS) as GameKind[]).map(k => <button type="button" key={k} role="radio" aria-checked={kind === k} data-testid={`kind-${k}`}
              onClick={() => { if (k !== kind && (readOnly || confirm(`Switch to ${KINDS[k].label}? Your questions and answers stay; scoring changes.`))) onChange(changeKind(d, k)); }}
              className={`text-left rounded-2xl p-4 border-2 ${kind === k ? 'border-violet-500 bg-violet-50' : 'border-paper-line bg-white hover:border-violet-100'}`}>
              <div className="text-lg font-extrabold">{KINDS[k].emoji} {KINDS[k].label}</div><div className="text-sm text-ink-soft mt-1">{KINDS[k].blurb}</div></button>)}
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mt-2">
            <Slider label="Reading time" unit="s" value={d.defaultTiming.readSec} min={0} max={30} onChange={v => set(x => { x.defaultTiming.readSec = v; })} />
            <Slider label="Answer time" unit="s" value={d.defaultTiming.answerSec} min={3} max={120} onChange={v => set(x => { x.defaultTiming.answerSec = v; })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {scored && <Toggle label="Show each player their private result" checked={d.privacy.individualResults} onChange={v => set(x => { x.privacy.individualResults = v; })} />}
            <Num label="Show group results only from (players)" hint="Protects anonymity in small groups." value={d.privacy.groupMinimum} min={3} max={50} onChange={v => set(x => { x.privacy.groupMinimum = v; })} />
          </div>
        </Section>

        {/* ---------- questions ---------- */}
        <Section id="questions" n={3} title={`Questions (${acts.length})`}>
          {acts.map((a, i) => <Question key={a.id} a={a} i={i} total={acts.length} kind={kind} onFocus={() => setFocus(i)} focused={i === focus}
            change={f => setActs(xs => xs.map(y => { if (y.id !== a.id) return y; const c = structuredClone(y); f(c); return c; }))}
            replace={b => setActs(xs => xs.map(y => y.id === a.id ? b : y))}
            move={dir => { setActs(xs => { const c = [...xs]; const j = i + dir; [c[i], c[j]] = [c[j], c[i]]; return c; }); setFocus(i + dir); }}
            dup={() => setActs(xs => { const c = [...xs]; c.splice(i + 1, 0, { ...structuredClone(a), id: newId() }); return c; })}
            del={() => { if (confirm(`Delete question ${i + 1}?`)) setActs(xs => xs.filter(y => y.id !== a.id)); }} />)}
          {!readOnly && <AiDraft kind={kind} language={d.languages[0] ?? 'en'} onAdd={add => setActs(xs => [...xs.filter(x => x.prompt.trim() || ('options' in x && x.options.some(o => o.text.trim()))), ...add])} />}
          {!readOnly && <div className="flex flex-wrap gap-2">{KINDS[kind].activity.map(t =>
            <button type="button" key={t} className="btn-ghost" onClick={() => setActs(xs => [...xs, newActivity(t, kind)])} data-testid={`add-${t}`}>+ Add {ACTIVITY_LABEL[t].split(' (')[0].toLowerCase()}</button>)}</div>}
        </Section>

        {/* ---------- results ---------- */}
        {scored && <Section id="results" n={4} title="Results">
          <p className="text-sm text-ink-soft">{kind === 'quiz' ? 'Scores are the % of correct answers.' : 'Scores run from 0 (every answer worth 0) to 100 (every answer worth 3).'} Every score from 0 to 100 needs exactly one result.</p>
          <Coverage bands={d.results ?? []} />
          {!readOnly && <div className="flex flex-wrap gap-2 items-center"><span className="text-sm font-bold">Split 0–100 evenly into</span>
            {[2, 3, 4, 5].map(c => <button type="button" key={c} className="btn-ghost !min-h-[36px] !px-3 text-sm" onClick={() => set(x => { x.results = splitBands(x.results ?? [], c, kind); })} data-testid={`split-${c}`}>{c} results</button>)}</div>}
          {[...(d.results ?? [])].map((b, i) => <div key={i} className="rounded-2xl border border-paper-line p-4 grid gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <Text label="Icon" value={b.emoji} max={8} onChange={v => set(x => { x.results![i].emoji = v; })} narrow />
              <Num label="From score" value={b.min} min={0} max={100} onChange={v => set(x => { x.results![i].min = v; })} />
              <Num label="To score" value={b.max} min={0} max={100} onChange={v => set(x => { x.results![i].max = v; })} />
              <Select label="Colour" value={b.tone} options={TONES} onChange={v => set(x => { x.results![i].tone = v; })} />
              {!readOnly && (d.results?.length ?? 0) > 1 && <button type="button" className="btn-ghost !min-h-[40px] text-sm ms-auto" onClick={() => set(x => { x.results!.splice(i, 1); })}>Remove</button>}
            </div>
            <Text label="Result title" value={b.title} max={80} onChange={v => set(x => { x.results![i].title = v; })} />
            <Text label="Message to the player" value={b.message} max={200} onChange={v => set(x => { x.results![i].message = v; })} />
            <Text label="Why they got it" area value={b.explanation} max={400} onChange={v => set(x => { x.results![i].explanation = v; })} />
          </div>)}
        </Section>}

        {/* ---------- ending ---------- */}
        <Section id="ending" n={scored ? 5 : 4} title="Ending and privacy note">
          <Text label="Closing message" value={d.closing?.message ?? ''} max={200} onChange={v => set(x => { x.closing = { questions: x.closing?.questions ?? [], message: v }; })} />
          <div className="grid gap-2"><span className="text-sm font-bold">Discussion questions at the end (up to 5)</span>
            {(d.closing?.questions ?? []).map((q, i) => <div key={i} className="flex gap-2">
              <input className="field !min-h-[44px] flex-1" value={q} maxLength={140} aria-label={`Discussion question ${i + 1}`} onChange={e => set(x => { x.closing!.questions[i] = e.target.value; })} />
              {!readOnly && <button type="button" className="btn-ghost !min-h-[44px] !px-3" aria-label="Remove" onClick={() => set(x => { x.closing!.questions.splice(i, 1); })}>✕</button>}</div>)}
            {!readOnly && (d.closing?.questions.length ?? 0) < 5 && <button type="button" className="btn-ghost justify-self-start !min-h-[40px] text-sm" onClick={() => set(x => { x.closing = { message: x.closing?.message ?? 'Thanks for playing!', questions: [...(x.closing?.questions ?? []), ''] }; })}>+ Add discussion question</button>}
          </div>
          <Text label="Privacy note shown to players" area value={d.disclaimer} max={240} onChange={v => set(x => { x.disclaimer = v; })} />
          <Text label="Made by" value={d.creator} max={80} onChange={v => set(x => { x.creator = v; })} />
        </Section>
      </fieldset>

      {/* ---------- checker ---------- */}
      <div className="grid gap-4 lg:sticky lg:top-4">
      <PhonePreview acts={acts} index={focus} onIndex={i => { setFocus(i); document.getElementById(`q-${i + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} title={d.title} />
      <aside className="card p-4 grid gap-3" aria-live="polite" data-testid="checker">
        <b className="text-lg">{problems.length ? `✏️ ${problems.length} thing${problems.length === 1 ? '' : 's'} to fix` : '✅ Ready to publish'}</b>
        {problems.length === 0 && <p className="text-sm text-ink-soft">Everything checks out. Preview it with simulated players, then publish.</p>}
        <ul className="grid gap-2">{problems.map((p, i) => <li key={i}><a href={`#${p.anchor}`} onClick={e => { e.preventDefault(); document.getElementById(p.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="block rounded-xl bg-coral-50 p-2 text-sm hover:underline"><b>{p.where}:</b> {p.text}</a></li>)}</ul>
        {warnings.length > 0 && <><b className="text-sm">Worth a look</b><ul className="grid gap-2">{warnings.map((p, i) => <li key={i} className="rounded-xl bg-sun-50 p-2 text-sm"><b>{p.where}:</b> {p.text}</li>)}</ul></>}
      </aside>
      </div>
    </div>
  );
}

function Question({ a, i, total, kind, change, replace, move, dup, del, onFocus, focused }: { a: Activity; i: number; total: number; kind: GameKind; change: (f: (a: Activity) => void) => void; replace: (a: Activity) => void; move: (d: number) => void; dup: () => void; del: () => void; onFocus: () => void; focused: boolean }) {
  const types = KINDS[kind].activity;
  return (
    <div id={`q-${i + 1}`} onFocusCapture={onFocus} onClick={onFocus} className={`rounded-2xl border p-4 grid gap-3 scroll-mt-4 ${focused ? 'border-violet-500 ring-1 ring-violet-500' : 'border-paper-line'}`} data-testid="question">
      <div className="flex flex-wrap items-center gap-2">
        <b className="me-auto">Question {i + 1}</b>
        {types.length > 1 && <select className="field !min-h-[36px] !w-auto !text-sm" aria-label={`Type of question ${i + 1}`} value={a.type} onChange={e => replace({ ...newActivity(e.target.value as Activity['type'], kind), id: a.id, prompt: a.prompt })}>{types.map(t => <option key={t} value={t}>{ACTIVITY_LABEL[t]}</option>)}</select>}
        <IconBtn label="Move up" disabled={i === 0} onClick={() => move(-1)}>↑</IconBtn>
        <IconBtn label="Move down" disabled={i === total - 1} onClick={() => move(1)}>↓</IconBtn>
        <IconBtn label="Duplicate" onClick={dup}>⧉</IconBtn>
        <IconBtn label="Delete" disabled={total === 1} onClick={del}>🗑</IconBtn>
      </div>
      <Text label={a.type === 'reflection' ? 'Prompt for people to think or talk about' : 'Question'} area value={a.prompt} max={220} onChange={v => change(x => { x.prompt = v; })} testid="q-prompt" />
      {(a.type === 'choice' || a.type === 'poll') && <div className="grid gap-2">
        <span className="text-sm font-bold">{kind === 'quiz' ? 'Answers (mark the correct one)' : kind === 'score' ? 'Answers and their score (0 = most open, 3 = most defensive)' : 'Answers'}</span>
        {a.options.map((o, j) => <div key={o.id} className="flex gap-2 items-center">
          {a.type === 'choice' && kind === 'quiz' && <input type="radio" name={`c-${a.id}`} className="w-5 h-5 accent-teal-600 shrink-0" aria-label={`Answer ${j + 1} is correct`} checked={'correct' in o && !!o.correct}
            onChange={() => change(x => { if (x.type === 'choice') x.options.forEach(p => { p.correct = p.id === o.id; }); })} />}
          <input className="field !min-h-[44px] flex-1 min-w-0" value={o.text} maxLength={140} placeholder={`Answer ${j + 1}`} aria-label={`Answer ${j + 1}`} data-testid="q-option"
            onChange={e => change(x => { if ('options' in x) x.options[j].text = e.target.value; })} />
          {a.type === 'choice' && kind === 'score' && <select className="field !min-h-[44px] !w-20 !text-base" aria-label={`Score of answer ${j + 1}`} value={'points' in o ? o.points ?? 0 : 0}
            onChange={e => change(x => { if (x.type === 'choice') x.options[j].points = +e.target.value; })}>{[0, 1, 2, 3].map(p => <option key={p} value={p}>{p}</option>)}</select>}
          {a.options.length > 2 && <IconBtn label={`Remove answer ${j + 1}`} onClick={() => change(x => { if ('options' in x) x.options.splice(j, 1); })}>✕</IconBtn>}
        </div>)}
        {a.options.length < 6 && <button type="button" className="btn-ghost justify-self-start !min-h-[36px] text-sm" data-testid="q-add-option"
          onClick={() => change(x => { if (x.type === 'choice') x.options.push({ id: nextOptionId(x.options), text: '', ...(kind === 'quiz' ? { correct: false } : { points: 0 }) }); else if (x.type === 'poll') x.options.push({ id: nextOptionId(x.options), text: '' }); })}>+ Add answer</button>}
      </div>}
      {a.type === 'choice' && kind === 'quiz' && <Text label="Explanation shown after the answer (optional)" area value={a.explanation ?? ''} max={400} onChange={v => change(x => { if (x.type === 'choice') x.explanation = v || undefined; })} />}
      {a.type === 'scale' && <div className="grid sm:grid-cols-3 gap-3">
        <Num label="Scale up to" value={a.max} min={3} max={10} onChange={v => change(x => { if (x.type === 'scale') x.max = v; })} />
        <Text label="Label at 1" value={a.minLabel} max={40} onChange={v => change(x => { if (x.type === 'scale') x.minLabel = v; })} />
        <Text label={`Label at ${a.max}`} value={a.maxLabel} max={40} onChange={v => change(x => { if (x.type === 'scale') x.maxLabel = v; })} />
      </div>}
      {a.type !== 'reflection' && <Toggle label="Own timing for this question" checked={!!a.timing} onChange={v => change(x => { x.timing = v ? { readSec: 3, answerSec: 20 } : undefined; })} />}
      {a.timing && <div className="grid sm:grid-cols-2 gap-4">
        <Slider label="Reading time" unit="s" value={a.timing.readSec} min={0} max={30} onChange={v => change(x => { x.timing!.readSec = v; })} />
        <Slider label="Answer time" unit="s" value={a.timing.answerSec} min={3} max={120} onChange={v => change(x => { x.timing!.answerSec = v; })} />
      </div>}
    </div>
  );
}

function Coverage({ bands }: { bands: ResultBand[] }) {
  const cells = Array.from({ length: 101 }, (_, s) => bands.filter(b => s >= b.min && s <= b.max).length);
  return <div aria-hidden="true"><div className="flex h-3 rounded-full overflow-hidden">{cells.map((c, s) => <span key={s} className={`flex-1 ${c === 1 ? 'bg-teal-500' : c === 0 ? 'bg-paper-line' : 'bg-coral-500'}`} />)}</div>
    <div className="flex justify-between text-xs text-ink-soft mt-1"><span>0</span><span>Green: covered · grey: missing · red: overlap</span><span>100</span></div></div>;
}

// ---------- small controls ----------
function Section({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return <section id={id} className="card p-5 grid gap-4 scroll-mt-4"><h2 className="text-xl font-extrabold"><span className="text-violet-600 me-2">{n}</span>{title}</h2>{children}</section>;
}
function Text({ label, hint, value, onChange, max, area, narrow, testid }: { label: string; hint?: string; value: string; onChange: (v: string) => void; max: number; area?: boolean; narrow?: boolean; testid?: string }) {
  const [id] = useState(() => newId('f'));
  const p = { id, value, maxLength: max, onChange: (e: { target: { value: string } }) => onChange(e.target.value), 'data-testid': testid };
  return <label htmlFor={id} className={`grid gap-1 ${narrow ? 'w-20' : ''}`}><span className="text-sm font-bold">{label}</span>
    {area ? <textarea {...p} rows={2} className="field py-2 !text-base" /> : <input {...p} className="field !min-h-[44px] !text-base" />}
    {hint && <span className="text-xs text-ink-soft">{hint}</span>}{!narrow && value.length > max * 0.8 && <span className="text-xs text-ink-soft">{value.length}/{max}</span>}</label>;
}
function Num({ label, hint, value, onChange, min, max }: { label: string; hint?: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  const [id] = useState(() => newId('f'));
  return <label htmlFor={id} className="grid gap-1"><span className="text-sm font-bold">{label}</span>
    <input id={id} type="number" inputMode="numeric" min={min} max={max} value={Number.isFinite(value) ? value : ''} onChange={e => onChange(Math.round(+e.target.value))} className="field !min-h-[44px] !text-base w-28" />
    {hint && <span className="text-xs text-ink-soft">{hint}</span>}</label>;
}
function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const [id] = useState(() => newId('f'));
  return <label htmlFor={id} className="grid gap-1"><span className="text-sm font-bold">{label}</span>
    <select id={id} value={value} onChange={e => onChange(e.target.value as T)} className="field !min-h-[44px] !text-base">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}
function Slider({ label, unit, value, min, max, onChange }: { label: string; unit: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const [id] = useState(() => newId('f'));
  return <label htmlFor={id} className="grid gap-1"><span className="text-sm font-bold">{label}: {value}{unit}</span>
    <input id={id} type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)} className="accent-violet-600" /></label>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 font-bold text-sm"><input type="checkbox" className="w-5 h-5 accent-violet-600" checked={checked} onChange={e => onChange(e.target.checked)} />{label}</label>;
}
function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="w-9 h-9 rounded-lg border border-paper-line bg-white disabled:opacity-30 hover:bg-paper">{children}</button>;
}
