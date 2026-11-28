import type { Activity } from '../engine/schema';

/** What players will see on their phone for one question. Updates as the creator types; shows nothing secret (no points or correct answers). */
export function PhonePreview({ acts, index, onIndex, title }: { acts: Activity[]; index: number; onIndex: (i: number) => void; title: string }) {
  const i = Math.min(Math.max(index, 0), Math.max(acts.length - 1, 0)), a = acts[i];
  return (
    <section className="card p-4 grid gap-3 justify-items-center" aria-label="Phone preview" data-testid="phone-preview">
      <div className="flex items-center justify-between w-full">
        <b>📱 Phone preview</b>
        {acts.length > 1 && <span className="flex items-center gap-1 text-sm font-bold">
          <button type="button" className="rounded-lg px-2 py-1 hover:bg-paper disabled:opacity-30" disabled={i === 0} onClick={() => onIndex(i - 1)} aria-label="Previous question">‹</button>
          <span className="tabular-nums" data-testid="preview-index">{i + 1}/{acts.length}</span>
          <button type="button" className="rounded-lg px-2 py-1 hover:bg-paper disabled:opacity-30" disabled={i === acts.length - 1} onClick={() => onIndex(i + 1)} aria-label="Next question">›</button>
        </span>}
      </div>
      <div className="w-[230px] rounded-[1.8rem] border-[5px] border-ink bg-paper p-3 grid gap-2.5 min-h-[300px] content-start" aria-hidden>
        <div className="mx-auto h-1 w-12 rounded-full bg-ink/20" />
        <p className="text-[11px] font-bold text-ink-soft truncate" dir="auto">{title || 'Your game'} · {i + 1}/{acts.length || 1}</p>
        {!a ? <p className="text-sm text-ink-soft">Add a question to see it here.</p> : <>
          <p className="font-extrabold leading-snug" dir="auto" data-testid="preview-prompt">{a.prompt.trim() || <span className="text-ink-soft font-bold">Your question…</span>}</p>
          {'options' in a && a.options.map((o, j) => (
            <div key={o.id} className="flex items-center gap-2 rounded-xl bg-white border border-paper-line px-2.5 py-2 text-sm font-bold" dir="auto">
              <span className="w-5 h-5 shrink-0 rounded-md bg-violet-50 text-violet-700 grid place-items-center text-[11px]">{'ABCDEF'[j]}</span>
              <span className="min-w-0">{'emoji' in o && o.emoji ? `${o.emoji} ` : ''}{o.text.trim() || <span className="text-ink-soft">Answer {j + 1}</span>}</span>
            </div>))}
          {a.type === 'open' && <div className="grid gap-1.5" data-testid="preview-open">
            <div className="rounded-xl bg-white border border-paper-line px-2.5 py-2 text-sm text-ink-soft" dir="auto">{a.placeholder || 'Type your answer'}</div>
            <div className="flex justify-between text-[10px] text-ink-soft"><span>0/{a.maxChars}{a.maxWords ? ` · ${a.maxWords === 1 ? 'one word' : `up to ${a.maxWords} words`}` : ''}</span><span className="rounded-md bg-violet-600 text-white px-2 py-0.5 font-bold">Send</span></div>
            <p className="text-[10px] text-ink-soft">🔒 Anonymous{a.maxResponses > 1 ? ` · ${a.maxResponses} answers each` : ''}</p></div>}
          {a.type === 'reflection' && <p className="rounded-xl bg-white border border-paper-line p-3 text-sm text-ink-soft">🤔 Players think about this privately. Nothing is collected.</p>}
          {a.type === 'scale' && <div className="grid gap-1">
            <div className="flex justify-between gap-1">{Array.from({ length: a.max - a.min + 1 }, (_, k) => <span key={k} className="flex-1 rounded-lg bg-white border border-paper-line py-2 text-center text-sm font-bold">{a.min + k}</span>)}</div>
            <div className="flex justify-between text-[10px] text-ink-soft" dir="auto"><span>{a.minLabel}</span><span>{a.maxLabel}</span></div>
          </div>}
        </>}
      </div>
      <p className="text-xs text-ink-soft text-center">Players never see points or the correct answer before the reveal.</p>
    </section>
  );
}
