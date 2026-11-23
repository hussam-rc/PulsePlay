import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EXPERIENCES } from '../experiences';

// Live Ego Check runs on the existing, verified engine one level up (/PulsePlay/). Phase 1b moves live rooms into this app.
export const LEGACY_URL = (() => { try { return new URL('../', location.origin + location.pathname).href; } catch { return '../'; } })();

export function Play() {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();
  const join = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setErr('Room codes have 6 digits.');
    nav(`/j/${code}`);
  };
  return (
    <div className="max-w-xl mx-auto px-4 py-10 grid gap-8">
      <form onSubmit={join} className="card p-6 grid gap-4">
        <div className="text-center"><div className="text-5xl" aria-hidden>📱</div><h1 className="text-3xl font-extrabold mt-2">Join a live game</h1>
          <p className="text-ink-soft">Enter the code on the big screen, or scan its QR code.</p></div>
        <label className="grid gap-1.5 font-bold text-sm">Room code
          <input className="field text-center !text-3xl tracking-[.3em] font-extrabold" inputMode="numeric" maxLength={6} value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(''); }} placeholder="000000" aria-describedby="code-err" />
        </label>
        {err && <p id="code-err" className="text-coral-500 font-bold text-sm">{err}</p>}
        <button className="btn-primary">Join 🚗</button>
        <p className="text-xs text-ink-soft text-center">No account needed. You'll choose a nickname next.</p>
        <p className="text-xs text-ink-soft text-center">Joining a room from the classic Ego Check screen? <a className="underline" href={`${LEGACY_URL}#join-${code}`}>Use the classic join page</a>.</p>
      </form>
      <section className="grid gap-3">
        <h2 className="text-xl font-extrabold">Or play on your own</h2>
        {EXPERIENCES.filter(e => e.modes.includes('self')).map(e => (
          <Link key={e.id} to={`/play/${e.id}`} className="card p-4 flex items-center gap-4 hover:border-violet-500">
            <span className="text-3xl" aria-hidden>{e.emoji}</span><span><b className="block">{e.title}</b><span className="text-sm text-ink-soft">{e.tagline}</span></span><span className="ms-auto text-ink-soft" aria-hidden>→</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
