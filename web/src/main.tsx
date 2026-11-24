import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, NavLink, Link, Navigate } from 'react-router-dom';
import './index.css';
import { t, dir, lang, onLang } from './i18n';
import { LangSwitch } from './ui/LangSwitch';
import { Discover } from './pages/Discover';
import { Detail } from './pages/Detail';
import { Play } from './pages/Play';
import { Solo } from './pages/Solo';
import { Host } from './pages/Host';
import { JoinLive } from './pages/JoinLive';
import { consumeRedirect } from './live/auth';

// Hosting, creating and reports load on demand, so a player joining from a phone downloads only what they need.
const lazyNamed = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  React.lazy(() => load().then(m => ({ default: m[name] })));
const Practice = lazyNamed(() => import('./pages/Practice'), 'Practice');
const Create = lazyNamed(() => import('./pages/Create'), 'Create');
const Workspace = lazyNamed(() => import('./pages/Workspace'), 'Workspace');
const HostLive = lazyNamed(() => import('./pages/HostLive'), 'HostLive');
const Editor = lazyNamed(() => import('./pages/Editor'), 'Editor');
const Preview = lazyNamed(() => import('./pages/Editor'), 'Preview');
const Guide = lazyNamed(() => import('./pages/Guide'), 'Guide');
const Report = lazyNamed(() => import('./pages/Report'), 'Report');
const Loading = () => <div className="min-h-[50vh] grid place-items-center text-ink-soft" role="status"><span className="anim-pulse text-3xl" aria-hidden>◉</span><span className="sr-only">Loading…</span></div>;

// A returning sign-in link carries tokens in the URL fragment; turn them into a session before the router reads the hash.
const signinError = consumeRedirect();
if (signinError) try { sessionStorage.setItem('pp_signin_error', signinError); } catch { /* ignore */ }

document.documentElement.dir = dir();

const NAV = (): [string, string, string, string][] => [['/discover', '🔭', t('nav.discover'), t('nav.discover')], ['/play', '📱', t('nav.play'), t('nav.play')], ['/host', '🎤', t('nav.host'), t('nav.host')], ['/create', '🛠️', t('nav.create'), t('nav.create')], ['/workspace', '🗂️', t('nav.workspace'), t('nav.ws')]];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="print:hidden sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-paper-line">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 flex items-center gap-2 sm:gap-4 h-16">
          <Link to="/discover" className="flex items-center gap-2 font-extrabold text-lg shrink-0" aria-label="PulsePlay home">
            <span className="w-9 h-9 rounded-xl grid place-items-center text-white bg-gradient-to-br from-violet-600 to-teal-500" aria-hidden>◉</span>
            <span>Pulse<span className="text-violet-600">Play</span></span>
          </Link>
          <nav className="hidden sm:flex gap-1 ms-auto min-w-0" aria-label="Main">
            {NAV().map(([to, ic, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold ${isActive ? 'bg-violet-50 text-violet-700' : 'text-ink-soft hover:text-ink'}`}>
                <span aria-hidden>{ic}</span><span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <span className="sm:hidden ms-auto" />
          <LangSwitch className="shrink-0" compact />
        </div>
      </header>
      <main className="flex-1 pb-20 sm:pb-0"><React.Suspense fallback={<Loading />}>{children}</React.Suspense></main>
      <nav className="sm:hidden print:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-paper-line grid grid-cols-5 pb-[env(safe-area-inset-bottom)]" aria-label="Main" data-testid="tabbar">
        {NAV().map(([to, ic, , short]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px] font-bold ${isActive ? 'text-violet-700' : 'text-ink-soft'}`}>
            <span className="text-xl leading-none" aria-hidden>{ic}</span><span className="truncate max-w-full px-1">{short}</span>
          </NavLink>
        ))}
      </nav>
      <footer className="print:hidden border-t border-paper-line text-sm text-ink-soft">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap gap-x-6 gap-y-2 justify-between">
          <span>PulsePlay · {t('tagline')}</span><span>{t('privacy.short')}</span>
        </div>
      </footer>
    </div>
  );
}

/** Re-renders everything (without remounting, so live rooms keep running) when the interface language changes. */
function App() {
  const [, setL] = React.useState(lang());
  React.useEffect(() => onLang(() => setL(lang())), []);
  return (
    <HashRouter>
      <Routes>
        <Route path="/practice/:id" element={<React.Suspense fallback={<Loading />}><Practice /></React.Suspense>} />
        <Route path="/host/:id" element={<React.Suspense fallback={<Loading />}><HostLive /></React.Suspense>} />
        <Route path="/workspace/preview/:id" element={<React.Suspense fallback={<Loading />}><Preview /></React.Suspense>} />
        <Route path="/j" element={<JoinLive />} />
        <Route path="/j/:code" element={<JoinLive />} />
        <Route path="*" element={<Shell><Routes>
          <Route path="/" element={<Navigate to="/discover" replace />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/x/:id" element={<Detail />} />
          <Route path="/guide/:id" element={<Guide />} />
          <Route path="/play" element={<Play />} />
          <Route path="/play/:id" element={<Solo />} />
          <Route path="/host" element={<Host />} />
          <Route path="/create" element={<Create />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="/workspace/edit/:id" element={<Editor />} />
          <Route path="/workspace/report/:id" element={<Report />} />
          <Route path="*" element={<Navigate to="/discover" replace />} />
        </Routes></Shell>} />
      </Routes>
    </HashRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
