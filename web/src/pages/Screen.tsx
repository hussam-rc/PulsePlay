// Projector window: the big screen only, for a second display. No host controls and no moderation are ever shown here.
// It reuses the host session saved in this browser (never a token in the URL); the host keeps controlling from the main window.
import { useEffect, useMemo, useRef, useState } from 'react';
import { LiveHost, savedHost } from '../live/controllers';
import { useController } from '../live/Presenter';
import { StageView } from '../live/screens';
import { joinUrlFor } from './HostLive';
import { t } from '../i18n';

export function Screen() {
  const saved = useMemo(() => savedHost(), []);
  const c = useMemo(() => (saved ? new LiveHost(saved.code, saved.token) : null), [saved]);
  useEffect(() => () => c?.stop(), [c]);
  useController(c);
  const ref = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(false);
  useEffect(() => { const f = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  if (!c) return <p className="p-10 text-center text-ink-soft" role="status" data-testid="screen-none">{t('oa.screen.none')}</p>;
  const v = c.view;
  return (
    <div ref={ref} className="min-h-screen bg-white flex flex-col relative" data-testid="screen">
      {!fs && <button className="btn-ghost absolute top-3 end-3 z-10 !min-h-[40px] text-sm" onClick={() => ref.current?.requestFullscreen().catch(() => {})} data-testid="screen-fs">{t('host.fs')}</button>}
      {!v ? <p className="m-auto text-ink-soft" role="status">{t('join.connecting')}</p>
        : v.ended ? <p className="m-auto text-2xl font-bold">{t('hl.roomEnded')}</p>
        : <StageView v={v} off={c.offset} joinUrl={joinUrlFor(v.code)} />}
    </div>
  );
}
