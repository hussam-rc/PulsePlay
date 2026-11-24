// "Draft with AI": suggestions only. Nothing enters the game until the creator ticks it and presses Add.
import { useState } from 'react';
import type { Activity } from '../engine/schema';
import { callFunction } from '../live/controllers';
import { GameKind } from './model';

export function AiDraft({ kind, language, onAdd }: { kind: GameKind; language: string; onAdd: (a: Activity[]) => void }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(''); const [audience, setAudience] = useState(''); const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [items, setItems] = useState<{ a: Activity; on: boolean }[] | null>(null);
  const [note, setNote] = useState('');
  const run = async () => {
    setBusy(true); setErr(''); setItems(null); setNote('');
    try {
      const r = await callFunction<{ questions: Activity[]; dropped: number; quota: { hourLeft: number } }>('draft-questions', { topic, audience, kind, language, count });
      setItems(r.questions.map(a => ({ a, on: true })));
      setNote(`${r.questions.length} suggestion${r.questions.length === 1 ? '' : 's'}${r.dropped ? `, ${r.dropped} discarded by the checker` : ''}. ${r.quota.hourLeft} drafts left this hour.`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  if (!open) return <button type="button" className="btn-ghost justify-self-start" onClick={() => setOpen(true)} data-testid="ai-open">✨ Draft questions with AI</button>;
  return (
    <div className="rounded-2xl border-2 border-violet-100 bg-violet-50 p-4 grid gap-3" data-testid="ai-panel">
      <div className="flex items-center"><b className="me-auto">✨ Draft questions with AI</b><button type="button" className="text-sm font-bold text-ink-soft" onClick={() => setOpen(false)}>Close</button></div>
      <label className="grid gap-1"><span className="text-sm font-bold">Topic</span>
        <input className="field !min-h-[44px] !text-base" maxLength={200} value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. giving feedback in remote teams" data-testid="ai-topic" /></label>
      <div className="grid sm:grid-cols-[1fr_auto] gap-3">
        <label className="grid gap-1"><span className="text-sm font-bold">Audience (optional)</span>
          <input className="field !min-h-[44px] !text-base" maxLength={120} value={audience} onChange={e => setAudience(e.target.value)} placeholder="e.g. new developers from Egypt and Switzerland" /></label>
        <label className="grid gap-1"><span className="text-sm font-bold">How many</span>
          <select className="field !min-h-[44px] !text-base" value={count} onChange={e => setCount(+e.target.value)}>{[3, 5, 8, 10].map(n => <option key={n}>{n}</option>)}</select></label>
      </div>
      <div><button type="button" className="btn-primary" disabled={busy || topic.trim().length < 3} onClick={run} data-testid="ai-run">{busy ? 'Drafting…' : items ? 'Draft again' : 'Draft'}</button></div>
      <p className="text-xs text-ink-soft">Only the topic, audience, type and language are sent to the AI service (Anthropic). AI can be wrong: check every question and answer before you publish.</p>
      {err && <p className="text-coral-500 font-bold" role="alert">{err}</p>}
      {items && <>
        <p className="text-sm" role="status">{note}</p>
        <ul className="grid gap-2">{items.map((it, i) => <li key={it.a.id}><label className="flex gap-3 items-start rounded-xl bg-white p-3 cursor-pointer" data-testid="ai-item">
          <input type="checkbox" className="w-5 h-5 mt-1 accent-violet-600 shrink-0" checked={it.on} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, on: e.target.checked } : x))} />
          <span><b>{it.a.prompt}</b>{'options' in it.a && <span className="block text-sm text-ink-soft">{it.a.options.map(o => `${o.text}${'correct' in o && o.correct ? ' ✓' : ''}${'points' in o && kind === 'score' ? ` (${o.points})` : ''}`).join(' · ')}</span>}</span>
        </label></li>)}</ul>
        <div><button type="button" className="btn-primary" disabled={!items.some(x => x.on)} data-testid="ai-add"
          onClick={() => { onAdd(items.filter(x => x.on).map(x => x.a)); setItems(null); setOpen(false); setTopic(''); }}>Add {items.filter(x => x.on).length} to my game</button></div>
      </>}
    </div>
  );
}
