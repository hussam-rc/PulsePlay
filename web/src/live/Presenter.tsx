import { useEffect, useReducer, useRef, useState, ReactNode } from 'react';
import type { Controller } from './controllers';
import { StageView, HostBar } from './screens';
import { t } from '../i18n';

export function useController(c: Controller | null) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => (c ? c.subscribe(force) : undefined), [c]);
  return c;
}

/** Projector frame with host controls, keyboard shortcuts and full screen. Same for practice and live. */
export function Presenter({ c, joinUrl, practice, extra }: { c: Controller; joinUrl: string; practice?: boolean; extra?: ReactNode }) {
  useController(c);
  const ref = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(false);
  const [busy, setBusy] = useState(false);
  const v = c.view;
  const cmd = async (k: 'next' | 'pause' | 'resume') => { setBusy(true); try { await c.command(k); } finally { setBusy(false); } };
  const toggleFs = async () => { try { document.fullscreenElement ? await document.exitFullscreen() : await ref.current?.requestFullscreen(); } catch { /* not allowed here */ } };
  useEffect(() => { const f = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(document.activeElement?.tagName ?? '') || !c.view) return;
      if (ev.key === ' ' || ev.key === 'ArrowRight') { ev.preventDefault(); cmd('next'); }
      if (ev.key.toLowerCase() === 'p' && c.view.phase === 'answer') cmd(c.view.paused ? 'resume' : 'pause');
      if (ev.key.toLowerCase() === 'f') toggleFs();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  if (!v) return <div className="card p-10 text-center text-ink-soft" role="status">Connecting to the game…</div>;
  return (
    <div ref={ref} className={`bg-white border border-paper-line shadow-soft flex flex-col overflow-hidden ${fs ? 'min-h-screen' : 'rounded-3xl min-h-[540px]'}`} data-testid="stage">
      {c.error && <div className="bg-coral-50 text-coral-500 font-bold text-sm px-4 py-2" role="alert">⚠️ {c.error} {t('host.retrying')}</div>}
      <StageView v={v} off={c.offset} joinUrl={joinUrl} practice={practice} />
      <HostBar v={v} busy={busy} onCmd={cmd} onFs={toggleFs} extra={extra} />
    </div>
  );
}
