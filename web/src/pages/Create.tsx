import { useState } from 'react';
import { validateExperience } from '../engine/schema';
import { egoCheck } from '../experiences/egoCheck';

/** Phase 2 brings the visual builder. Today: a working validator that creators and the builder will share. */
export function Create() {
  const [src, setSrc] = useState(() => JSON.stringify({ ...egoCheck, id: 'my-copy', title: 'My copy of Ego Check', status: 'draft' }, null, 2));
  const [out, setOut] = useState<ReturnType<typeof validateExperience> | null>(null);
  const run = () => { try { setOut(validateExperience(JSON.parse(src))); } catch (e) { setOut({ ok: false, errors: ['Not valid JSON: ' + (e as Error).message], warnings: [] }); } };
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 grid gap-6">
      <header><h1 className="text-4xl font-extrabold">🛠️ Create Studio</h1>
        <p className="text-ink-soft text-lg mt-2">The no-code builder (wizard, drag-and-drop activities, results builder, simulated test) ships in Phase 2. It will save into the same experience format you can check below.</p></header>
      <section className="card p-5 grid gap-3">
        <h2 className="text-xl font-extrabold">Experience checker</h2>
        <p className="text-ink-soft">Paste or edit an experience. The checker validates structure, scoring rules and that result ranges cover 0–100 with no gaps or overlaps.</p>
        <label className="sr-only" htmlFor="src">Experience JSON</label>
        <textarea id="src" className="field font-mono !text-sm py-3 h-80" value={src} onChange={e => setSrc(e.target.value)} spellCheck={false} />
        <div><button className="btn-primary" onClick={run}>Check experience</button></div>
        {out && (
          <div className={`rounded-2xl p-4 ${out.ok ? 'bg-teal-50' : 'bg-coral-50'}`} aria-live="polite">
            <b>{out.ok ? '✅ Ready to publish' : `❌ ${out.errors.length} problem${out.errors.length === 1 ? '' : 's'} to fix`}</b>
            {out.errors.length > 0 && <ul className="list-disc ps-5 mt-2">{out.errors.map((x, i) => <li key={i}>{x}</li>)}</ul>}
            {out.warnings.length > 0 && <><b className="block mt-2">Warnings</b><ul className="list-disc ps-5">{out.warnings.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
          </div>
        )}
      </section>
    </div>
  );
}
