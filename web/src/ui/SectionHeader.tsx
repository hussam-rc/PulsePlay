import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

/** One header pattern for Discover, Host, Play, Create and Workspace: what this place is for, and where to go next. */
export function SectionHeader({ icon, title, purpose, links = [], aside }: { icon: string; title: string; purpose: string; links?: { lead: string; label: string; to: string }[]; aside?: ReactNode }) {
  return (
    <header className="grid gap-2" data-testid="section-header">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold me-auto"><span aria-hidden>{icon}</span> {title}</h1>{aside}
      </div>
      <p className="text-lg text-ink-soft" data-testid="section-purpose">{purpose}</p>
      {links.length > 0 && <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">{links.map(l =>
        <span key={l.to}>{l.lead} <Link className="font-bold text-violet-700 underline" to={l.to}>{l.label}</Link></span>)}</p>}
    </header>
  );
}
