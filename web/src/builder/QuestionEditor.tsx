// One question's editing card (moved from Builder.tsx for Creator Studio C4a; behaviour unchanged).
import { memo, useState } from 'react';
import type { Activity } from '../engine/schema';
import { tagLabel, type BalanceBy, type GroupCount } from './bankModel';
import { IconBtn, Num, Slider, Text, Toggle } from './fields';
import { ACTIVITY_LABEL, GameKind, KINDS, newActivity, nextOptionId } from './model';

/** Stable editing actions, keyed by question id, so unchanged questions never re-render while typing. */
export interface QuestionApi {
  patch: (id: string, f: (a: Activity) => void) => void;
  replace: (id: string, b: Activity) => void;
  move: (id: string, dir: -1 | 1) => void;
  dup: (id: string) => void;
  del: (id: string, n: number) => void;
  archive: (id: string, archived: boolean) => void;
  group: (id: string, name: string) => void;
  focus: (i: number) => void;
}
export interface BankGroups { by: BalanceBy; list: GroupCount[] }

/** The full editing card for one question. `nav` adds Previous / Done / Next for the compact list. */
export const QuestionEditor = memo(function QuestionEditor({ a, i, total, kind, bank, api, focused, nav }: {
  a: Activity; i: number; total: number; kind: GameKind; bank: BankGroups | null; api: QuestionApi; focused: boolean;
  nav?: { prev: (() => void) | null; next: (() => void) | null; done: () => void; pos: string } }) {
  const change = (f: (x: Activity) => void) => api.patch(a.id, f);
  const replace = (b: Activity) => api.replace(a.id, b);
  const onFocus = () => { if (!focused) api.focus(i); };
  const types = KINDS[kind].activity;
  const archived = a.active === false;
  const groupTag = bank ? a[bank.by === 'dimension' ? 'dimension' : 'category'] : undefined;
  const groupLabel = bank?.list.find(g => g.tag === groupTag)?.label ?? (groupTag ? tagLabel(groupTag) : '');
  return (
    <div id={`q-${i + 1}`} onFocusCapture={onFocus} onClick={onFocus} className={`rounded-2xl border p-4 grid gap-3 scroll-mt-4 ${archived ? 'bg-paper opacity-80' : ''} ${focused ? 'border-violet-500 ring-1 ring-violet-500' : 'border-paper-line'}`} data-testid="question" data-archived={archived || undefined}>
      {nav && <div className="flex items-center gap-2 -mx-4 -mt-4 mb-1 px-4 py-2 rounded-t-2xl bg-violet-50 sticky top-0 z-10" data-testid="q-nav">
        <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-sm" disabled={!nav.prev} onClick={() => nav.prev?.()} data-testid="q-prev" aria-label="Previous question">‹ Previous</button>
        <span className="text-sm font-bold text-ink-soft mx-auto tabular-nums" data-testid="q-pos">{nav.pos}</span>
        <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-sm" disabled={!nav.next} onClick={() => nav.next?.()} data-testid="q-next" aria-label="Next question">Next ›</button>
        <button type="button" className="btn-primary !min-h-[36px] !px-3 text-sm" onClick={nav.done} data-testid="q-done">Done</button></div>}
      <div className="flex flex-wrap items-center gap-2">
        <b className="me-auto">Question {i + 1}{archived && <span className="ms-2 rounded-full bg-sun-50 px-2 py-0.5 text-xs font-bold" data-testid="q-archived">Archived: not used in games</span>}</b>
        <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-sm" onClick={() => api.archive(a.id, !archived)} data-testid="q-archive">{archived ? '↩ Restore' : '🗄 Archive'}</button>
        {types.length > 1 && <select className="field !min-h-[36px] !w-auto !text-sm" aria-label={`Type of question ${i + 1}`} value={a.type} onChange={e => replace({ ...newActivity(e.target.value as Activity['type'], kind), id: a.id, prompt: a.prompt })}>{types.map(t => <option key={t} value={t}>{ACTIVITY_LABEL[t]}</option>)}</select>}
        <IconBtn label="Move up" disabled={i === 0} onClick={() => { api.move(a.id, -1); api.focus(i - 1); }}>↑</IconBtn>
        <IconBtn label="Move down" disabled={i === total - 1} onClick={() => { api.move(a.id, 1); api.focus(i + 1); }}>↓</IconBtn>
        <IconBtn label="Duplicate" onClick={() => api.dup(a.id)}>⧉</IconBtn>
        <IconBtn label="Delete" disabled={total === 1} onClick={() => api.del(a.id, i + 1)}>🗑</IconBtn>
      </div>
      {bank && <GroupField key={`${a.id}-${groupTag ?? ''}-${groupLabel}`} label={bank.by === 'dimension' ? 'Area' : 'Category'} value={groupLabel} options={bank.list.map(g => g.label)} onCommit={name => api.group(a.id, name)} id={a.id} />}
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
});

/** Group name with suggestions; saved when the field loses focus or on Enter, so typing is never interrupted. */
function GroupField({ label, value, options, onCommit, id }: { label: string; value: string; options: string[]; onCommit: (v: string) => void; id: string }) {
  const [v, setV] = useState(value);
  const commit = () => { if (v.trim() !== value) onCommit(v.trim()); };
  return <label className="grid gap-1 sm:max-w-xs"><span className="text-sm font-bold">{label}</span>
    <input className="field !min-h-[40px]" list={`groups-${id}`} value={v} maxLength={30} placeholder={`Type or pick a ${label.toLowerCase()}`} data-testid="q-group"
      onChange={e => setV(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
    <datalist id={`groups-${id}`}>{options.map(o => <option key={o} value={o} />)}</datalist></label>;
}
