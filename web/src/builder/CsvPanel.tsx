// CSV template, export and import with a full preview (PulsePlay Creator Studio C4b). Nothing changes until "Import".
import { useMemo, useState } from 'react';
import { applyImport, MAX_FILE_BYTES, MAX_ROWS, parseCsv, planImport, toCsv, type ImportMode, type ParsedCsv } from './csvModel';
import { Draft, newId } from './model';

const download = (name: string, text: string) => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
const slug = (t: string) => t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'questions';

export function CsvPanel({ d, apply, readOnly }: { d: Draft; apply: (next: Draft) => void; readOnly?: boolean }) {
  const [sep, setSep] = useState<',' | ';'>(';');
  const [file, setFile] = useState<{ name: string; parsed: ParsedCsv } | null>(null);
  const [mode, setMode] = useState<ImportMode>('add');
  const [msg, setMsg] = useState('');
  const plan = useMemo(() => (file ? planImport(d, file.parsed, mode, () => newId()) : null), [file, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = d.rounds.flatMap(r => r.activities).length;
  const willAdd = plan ? plan.counts.new + plan.counts.update : 0;

  const pick = async (f: File | undefined) => {
    setMsg(''); if (!f) return;
    if (f.size > MAX_FILE_BYTES) { setFile(null); setMsg(`This file is ${(f.size / 1048576).toFixed(1)} MB; the limit is 1 MB.`); return; }
    setFile({ name: f.name, parsed: parseCsv(await f.text()) });
  };
  const confirm = () => {
    if (!plan || !willAdd) return;
    const next = applyImport(d, plan);
    if (JSON.stringify(next).length > 480 * 1024) { setMsg('After this import the game would be too large to save (limit about 500 KB). Import fewer questions.'); return; }
    apply(next); setMsg(`Imported: ${plan.counts.new} added, ${plan.counts.update} updated${plan.counts.error ? `, ${plan.counts.error} skipped because of errors` : ''}. Publish when you are ready; earlier published versions do not change.`); setFile(null);
  };

  return (
    <div className="rounded-2xl border border-paper-line p-3 grid gap-3" data-testid="csv">
      <div className="flex flex-wrap items-center gap-2">
        <b className="me-auto">📄 Spreadsheet (CSV)</b>
        <label className="text-sm flex items-center gap-1">Format
          <select className="field !min-h-[36px] !w-auto !text-sm" value={sep} onChange={e => setSep(e.target.value as ',' | ';')} data-testid="csv-sep" aria-label="CSV format">
            <option value=";">Excel (semicolon)</option><option value=",">Standard CSV (comma)</option></select></label>
        <button type="button" className="btn-ghost !min-h-[36px] text-sm" onClick={() => download('pulseplay-template.csv', toCsv(d, sep, true))} data-testid="csv-template">⬇ Template</button>
        <button type="button" className="btn-ghost !min-h-[36px] text-sm" onClick={() => download(`${slug(d.title)}.csv`, toCsv(d, sep))} data-testid="csv-export">⬇ Export {total} questions</button>
        {!readOnly && <label className="btn-primary !min-h-[36px] text-sm cursor-pointer">⬆ Import CSV
          <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} data-testid="csv-file" /></label>}
      </div>
      <p className="text-xs text-ink-soft">Edit questions in Excel or Google Sheets, then import them here. You see a preview first; nothing changes until you confirm. Up to {MAX_ROWS} questions per file.</p>
      {msg && <p className="text-sm font-bold rounded-xl bg-teal-50 p-2" role="status" data-testid="csv-msg">{msg}</p>}

      {file && plan && <section className="grid gap-3" aria-label="Import preview" data-testid="csv-preview">
        <div className="flex flex-wrap items-center gap-2"><b>Preview: {file.name}</b>
          <button type="button" className="btn-ghost !min-h-[36px] text-sm ms-auto" onClick={() => setFile(null)} data-testid="csv-cancel">Cancel</button></div>
        {plan.fileError ? <p className="rounded-xl bg-coral-50 p-3 text-sm" role="alert" data-testid="csv-file-error">{plan.fileError}</p> : <>
          <fieldset className="flex flex-wrap gap-3 text-sm"><legend className="font-bold mb-1">Questions with an id that already exists</legend>
            <label className="flex items-center gap-1"><input type="radio" name="csv-mode" checked={mode === 'add'} onChange={() => setMode('add')} data-testid="csv-mode-add" /> Add everything as new questions</label>
            <label className="flex items-center gap-1"><input type="radio" name="csv-mode" checked={mode === 'update'} onChange={() => setMode('update')} data-testid="csv-mode-update" /> Update the matching questions</label></fieldset>
          <p className="text-sm" data-testid="csv-summary"><b>{plan.counts.new}</b> new · <b>{plan.counts.update}</b> updated · <b className={plan.counts.error ? 'text-coral-500' : ''}>{plan.counts.error}</b> with errors (skipped) · {plan.counts.warnings} with warnings</p>
          {plan.unknownColumns.length > 0 && <p className="text-sm rounded-xl bg-sun-50 p-2">Ignored columns: {plan.unknownColumns.join(', ')}.</p>}
          <div className="max-h-[420px] overflow-auto rounded-xl border border-paper-line">
            <table className="w-full text-sm"><thead className="bg-paper sticky top-0"><tr><th className="text-start p-2">Line</th><th className="text-start p-2">Result</th><th className="text-start p-2">Question</th><th className="text-start p-2">Notes</th></tr></thead>
              <tbody>{plan.rows.map(r => <tr key={r.line} className="border-t border-paper-line align-top" data-testid="csv-row" data-status={r.status}>
                <td className="p-2 tabular-nums">{r.line}</td>
                <td className="p-2 whitespace-nowrap font-bold">{r.status === 'error' ? '✕ Error' : r.status === 'update' ? '↻ Update' : '＋ New'}</td>
                <td className="p-2" dir="auto">{r.prompt || <i className="text-ink-soft">(empty)</i>}<span className="block text-xs text-ink-soft">{r.answers} answers</span></td>
                <td className="p-2"><ul className="grid gap-0.5">{r.errors.map((e, k) => <li key={k} className="text-coral-500" data-testid="csv-error">{e}</li>)}
                  {r.warnings.map((w, k) => <li key={`w${k}`} className="text-ink-soft" data-testid="csv-warning">⚠ {w}</li>)}</ul></td></tr>)}</tbody></table>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" className="btn-primary" disabled={!willAdd} onClick={confirm} data-testid="csv-confirm">Import {willAdd} question{willAdd === 1 ? '' : 's'}</button>
            {plan.counts.error > 0 && <span className="text-sm text-ink-soft">Lines with errors are skipped. Fix them in your spreadsheet and import again.</span>}
          </div></>}
      </section>}
    </div>
  );
}
