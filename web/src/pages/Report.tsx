// Anonymous session report: totals and per-question splits (already suppressed below the privacy minimum). Print/PDF or CSV.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, Report as R, useAuth } from '../live/workspace';
import { Bar, Chip } from '../ui/bits';
import { SignIn } from './Workspace';

const csvCell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"` : s; };
export function toCsv(r: R): string {
  const rows: unknown[][] = [['Session', r.title], ['Ended', r.endedAt], ['Joined', r.joined], ['Completed', r.completed], ['Group average', r.average ?? ''], ['Group result', r.band ?? ''], [],
    ['Question', 'Answer', 'Correct', 'Votes', 'Share %', 'Answers counted', 'Note']];
  r.questions.forEach((q, i) => {
    if (!q.result) { rows.push([`${i + 1}. ${q.prompt}`, '', '', '', '', '', 'Not collected for this game type']); return; }
    if (q.result.suppressed) { rows.push([`${i + 1}. ${q.prompt}`, '', '', '', '', q.result.n, `Hidden: fewer than ${r.groupMinimum} answers`]); return; }
    q.options.forEach(o => { const c = q.result!.counts[o.id] ?? 0; rows.push([`${i + 1}. ${q.prompt}`, o.text, o.correct ? 'yes' : '', c, q.result!.n ? Math.round((100 * c) / q.result!.n) : 0, q.result!.n, '']); });
  });
  return '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}

export function Report() {
  const id = useParams().id ?? '';
  const auth = useAuth();
  const [r, setR] = useState<R | null | undefined>(undefined);
  useEffect(() => { if (auth) api.report(id).then(setR).catch(() => setR(null)); }, [id, auth?.userId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!auth) return <SignIn title="Sign in to see this report" />;
  if (r === undefined) return <p className="p-10 text-ink-soft">Loading…</p>;
  if (!r) return <div className="max-w-xl mx-auto p-10 grid gap-3"><p role="alert">This report does not exist or you do not have access to it.</p><Link className="btn-ghost" to="/workspace">Back to workspace</Link></div>;
  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(r)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${r.title.replace(/[^\w-]+/g, '-')}-${r.endedAt.slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <article className="max-w-4xl mx-auto px-4 py-8 grid gap-5 print:py-0" data-testid="report">
      <div className="flex flex-wrap gap-2 print:hidden"><Link to="/workspace" className="text-sm font-bold text-ink-soft me-auto self-center">← Workspace</Link>
        <button className="btn-ghost" onClick={() => window.print()}>🖨️ Print or save as PDF</button><button className="btn-primary" onClick={download} data-testid="csv">⬇ Download CSV</button></div>
      <header><p className="text-sm font-bold text-violet-700">SESSION REPORT · ANONYMOUS TOTALS</p><h1 className="text-3xl font-extrabold">{r.title}</h1>
        <p className="text-ink-soft">{new Date(r.endedAt).toLocaleString()}{r.version ? ` · version ${r.version}` : ''}</p></header>
      <div className="flex flex-wrap gap-2"><Chip tone="sky">{r.joined} joined</Chip><Chip tone="teal">{r.completed} completed</Chip>
        {r.average != null && <Chip>Group average {r.average}{r.scoring === 'correct' ? '% correct' : '/100'}</Chip>}{r.band && <Chip tone="sun">{r.band}</Chip>}</div>
      <section className="card p-5 grid gap-4 break-inside-avoid"><h2 className="text-xl font-extrabold">Questions</h2>
        {r.questions.map((q, i) => <div key={q.id} className="grid gap-2 break-inside-avoid" data-testid="report-q"><b dir="auto">{i + 1}. {q.prompt}</b>
          {!q.result ? <p className="text-sm text-ink-soft">Answers are private in this game type; only the group average is kept.</p>
            : q.result.suppressed ? <p className="text-sm text-ink-soft">Hidden: fewer than {r.groupMinimum} people answered.</p>
            : q.options.map(o => { const c = q.result!.counts[o.id] ?? 0, p = q.result!.n ? Math.round((100 * c) / q.result!.n) : 0;
              return <div key={o.id} className="grid grid-cols-[minmax(0,1fr)_4rem] gap-x-3 items-center text-sm"><span dir="auto">{o.text}{o.correct ? ' ✅' : ''}</span><span className="text-end tabular-nums">{c} · {p}%</span><div className="col-span-2"><Bar pct={p} tone={o.correct ? 'teal' : 'violet'} /></div></div>; })}
        </div>)}
      </section>
      <p className="text-xs text-ink-soft">No names, answers or personal results are stored. Splits are hidden when fewer than the privacy minimum answered.</p>
    </article>
  );
}
