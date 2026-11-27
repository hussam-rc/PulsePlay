// No-code game builder. Edits a schema v1 draft through forms only; the checker speaks plain language.
import { ReactNode, useDeferredValue, useMemo, useRef, useState } from 'react';
import type { ResultBand } from '../engine/schema';
import { validateExperience } from '../engine/schema';
import { AiDraft } from './AiDraft';
import { BankPanel } from './BankPanel';
import { CsvPanel } from './CsvPanel';
import { balanceOf, groups, setArchived, setGroup } from './bankModel';
import { Num, Select, Slider, Text, Toggle } from './fields';
import { appendActivities, deleteActivity, duplicateActivity, moveActivity, patchActivity, problemIdsFrom, replaceActivity } from './listModel';
import { PhonePreview } from './PhonePreview';
import { ACTIVITY_LABEL, changeKind, Draft, GameKind, humanize, KINDS, kindOf, newActivity, newId, splitBands } from './model';
import type { BankGroups, QuestionApi } from './QuestionEditor';
import { QuestionList } from './QuestionList';
import { diffAgainstPublished, findDuplicates } from './qualityModel';
import type { Activity } from '../engine/schema';

const CATEGORIES: [Draft['category'], string][] = [['icebreaker', 'Icebreaker'], ['team-building', 'Team building'], ['reflection', 'Reflection'], ['workplace-culture', 'Workplace culture'],
  ['communication', 'Communication'], ['leadership', 'Leadership'], ['collaboration', 'Collaboration'], ['trivia', 'Trivia & quiz'], ['education', 'Education'], ['community', 'Community'],
  ['intercultural', 'Intercultural'], ['creative', 'Creative'], ['problem-solving', 'Problem solving'], ['fun', 'Just for fun']];
const EMOJIS = ['🧠', '🪞', '📊', '💬', '🎯', '🧩', '🚀', '🌍', '🤝', '💡', '🎲', '🏆', '🌱', '🔥', '❤️', '🎉'];
const LANGS: [Draft['languages'][number], string][] = [['en', 'English'], ['ar', 'Arabic'], ['de', 'German'], ['fr', 'French']];
const TONES: [ResultBand['tone'], string][] = [['great', '🟢 Great'], ['good', '🔵 Good'], ['watch', '🟡 Watch out'], ['grow', '🟠 Room to grow']];

export function Builder({ value, onChange, readOnly, storageKey, published }: { value: Draft; onChange: (d: Draft) => void; readOnly?: boolean; storageKey?: string;
  published?: { version: number; content: Draft } | null }) {
  const d = value;
  // Question edits go through a stable API that always applies to the latest draft and copies only the changed question,
  // so a 200-question bank stays responsive while typing. Checks run on a deferred copy of the draft.
  const latest = useRef({ d, onChange, readOnly }); latest.current = { d, onChange, readOnly };
  const [focus, setFocus] = useState(0);
  const api = useMemo<QuestionApi>(() => {
    const emit = (next: Draft) => { if (latest.current.readOnly) return; latest.current.d = next; latest.current.onChange(next); };
    const cur = () => latest.current.d;
    return {
      patch: (id, f) => emit(patchActivity(cur(), id, f)),
      replace: (id, b) => emit(replaceActivity(cur(), id, b)),
      move: (id, dir) => emit(moveActivity(cur(), id, dir)),
      dup: id => emit(duplicateActivity(cur(), id, newId())),
      del: (id, n) => { if (confirm(`Delete question ${n}?`)) emit(deleteActivity(cur(), id)); },
      archive: (id, v) => emit(setArchived(cur(), id, v)),
      group: (id, name) => emit(setGroup(cur(), id, balanceOf(cur()), name)),
      focus: i => setFocus(i),
    };
  }, []);
  const checked = useDeferredValue(d);
  const set = (f: (x: Draft) => void) => { if (readOnly) return; const x = structuredClone(d); f(x); onChange(x); };
  const kind = kindOf(d);
  const acts = d.rounds.flatMap(r => r.activities);
  const check = useMemo(() => validateExperience({ ...checked, status: 'published' }), [checked]);
  const problems = useMemo(() => humanize(check.errors, checked), [check, checked]);
  const warnings = useMemo(() => humanize(check.warnings, checked), [check, checked]);
  const checkedActs = useMemo(() => checked.rounds.flatMap(r => r.activities), [checked]);
  const problemIds = useMemo(() => problemIdsFrom(problems.map(p => p.anchor), checkedActs), [problems, checkedActs]);
  const dups = useMemo(() => findDuplicates(checkedActs), [checkedActs]);
  const pubActs = useMemo<Activity[] | null>(() => published ? published.content.rounds.flatMap(r => r.activities) : null, [published]);
  const diff = useMemo(() => diffAgainstPublished(checkedActs, pubActs, published?.version ?? 0), [checkedActs, pubActs, published?.version]);
  const num = (id?: string) => (id ? checkedActs.findIndex(a => a.id === id) + 1 : 0);
  // each pair of duplicates is reported once, at the earlier question
  const dupWarnings = useMemo(() => [...dups].flatMap(([id, l]) => l.filter(x => x.kind === 'answers' || num(x.with) > num(id)).map(x => ({
    where: `Question ${num(id)}`, anchor: `q-${num(id)}`,
    text: x.kind === 'answers' ? 'Two answers are the same.' : x.kind === 'same' ? `Same question as question ${num(x.with)}.` : `Very similar to question ${num(x.with)}.` }))), [dups, checkedActs]); // eslint-disable-line react-hooks/exhaustive-deps
  const scored = kind === 'quiz' || kind === 'score';
  // groups change rarely: keep the same object while the list of names and counts is unchanged, so question cards stay memoised
  const by = balanceOf(d), groupKey = by === 'dimension' ? 'dimension' as const : 'category' as const;
  const groupSig = JSON.stringify(groups(checked, by === 'random' ? 'category' : by));
  const bankGroups = useMemo<BankGroups | null>(() => (d.bank && by !== 'random' ? { by, list: JSON.parse(groupSig) } : null), [!!d.bank, by, groupSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const groupOptions = useMemo(() => (JSON.parse(groupSig) as { tag: string; label: string }[]).map(g => ({ tag: g.tag, label: g.label })), [groupSig]);
  const replaceDraft = (next: Draft) => { if (!readOnly) onChange(next); };
  const addActs = (add: ReturnType<typeof newActivity>[], keep?: Parameters<typeof appendActivities>[2]) => replaceDraft(appendActivities(d, add, keep));

  /** Scroll to a section or question; a collapsed question row opens when asked to. */
  const goTo = (anchor: string, open: boolean) => {
    const el = document.getElementById(anchor);
    if (open && el?.dataset.testid === 'q-row') { el.click(); return; }
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
          <QuestionList acts={acts} kind={kind} bank={bankGroups} groupOptions={groupOptions} groupKey={groupKey} problemIds={problemIds} dups={dups} diff={diff} api={api} focus={focus} storageKey={storageKey} />
          <CsvPanel d={d} apply={replaceDraft} readOnly={readOnly} />
          {!readOnly && <AiDraft kind={kind} language={d.languages[0] ?? 'en'} onAdd={add => addActs(add, x => !!(x.prompt.trim() || ('options' in x && x.options.some(o => o.text.trim()))))} />}
          {!readOnly && <div className="flex flex-wrap gap-2">{KINDS[kind].activity.map(t =>
            <button type="button" key={t} className="btn-ghost" onClick={() => addActs([newActivity(t, kind)])} data-testid={`add-${t}`}>+ Add {ACTIVITY_LABEL[t].split(' (')[0].toLowerCase()}</button>)}</div>}
        </Section>

        {/* ---------- question bank ---------- */}
        <Section id="bank" n={4} title="Question bank">
          <BankPanel d={d} set={replaceDraft} readOnly={readOnly} />
        </Section>

        {/* ---------- results ---------- */}
        {scored && <Section id="results" n={5} title="Results">
          <p className="text-sm text-ink-soft">{kind === 'quiz' ? 'Scores are the % of correct answers.' : 'Scores run from 0 (every answer worth 0) to 100 (every answer at its highest score).'} Every score from 0 to 100 needs exactly one result.</p>
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
        <Section id="ending" n={scored ? 6 : 5} title="Ending and privacy note">
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
      <PhonePreview acts={acts} index={focus} onIndex={i => { setFocus(i); goTo(`q-${i + 1}`, false); }} title={d.title} />
      <aside className="card p-4 grid gap-3" aria-live="polite" data-testid="checker">
        <b className="text-lg">{problems.length ? `✏️ ${problems.length} thing${problems.length === 1 ? '' : 's'} to fix` : '✅ Ready to publish'}</b>
        {problems.length === 0 && <p className="text-sm text-ink-soft">Everything checks out. Preview it with simulated players, then publish.</p>}
        <ul className="grid gap-2">{problems.map((p, i) => <li key={i}><a href={`#${p.anchor}`} onClick={e => { e.preventDefault(); goTo(p.anchor, true); }} className="block rounded-xl bg-coral-50 p-2 text-sm hover:underline"><b>{p.where}:</b> {p.text}</a></li>)}</ul>
        {warnings.length + dupWarnings.length > 0 && <><b className="text-sm">Worth a look</b><ul className="grid gap-2" data-testid="checker-warnings">{[...warnings, ...dupWarnings].slice(0, 30).map((p, i) => <li key={i}><a href={`#${p.anchor}`} onClick={e => { e.preventDefault(); goTo(p.anchor, true); }} className="block rounded-xl bg-sun-50 p-2 text-sm hover:underline"><b>{p.where}:</b> {p.text}</a></li>)}</ul>
          {warnings.length + dupWarnings.length > 30 && <p className="text-xs text-ink-soft">…and {warnings.length + dupWarnings.length - 30} more. Use the question filters to see them all.</p>}</>}
      </aside>
      </div>
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
