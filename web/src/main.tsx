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
import { Practice } from './pages/Practice';
import { Create } from './pages/Create';
import { Workspace } from './pages/Workspace';
import { HostLive } from './pages/HostLive';
import { JoinLive } from './pages/JoinLive';
import { Editor, Preview } from './pages/Editor';
import { Guide } from './pages/Guide';
import { consumeRedirect } from './live/auth';
import { Report } from './pages/Report';

// A returning sign-in link carries tokens in the URL fragment; turn them into a session before the router reads the hash.
const signinError = consumeRedirect();
if (signinError) try { sessionStorage.setItem('pp_signin_error', signinError); } catch { /* ignore */ }

document.documentElement.dir = dir();

const NAV = (): [string, string, string][] => [['/discover', '🔭', t('nav.discover')], ['/play', '📱', t('nav.play')], ['/create', '🛠️', t('nav.create')], ['/host', '🎤', t('nav.host')], ['/workspace', '🗂️', t('nav.workspace')]];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="print:hidden sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-paper-line">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-4 h-16">
          <Link to="/discover" className="flex items-center gap-2 font-extrabold text-lg shrink-0" aria-label="PulsePlay home">
            <span className="w-9 h-9 rounded-xl grid place-items-center text-white bg-gradient-to-br from-violet-600 to-teal-500" aria-hidden>◉</span>
            <span>Pulse<span className="text-violet-600">Play</span></span>
          </Link>
          <nav className="flex gap-1 overflow-x-auto ms-auto" aria-label="Main">
            {NAV().map(([to, ic, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold ${isActive ? 'bg-violet-50 text-violet-700' : 'text-ink-soft hover:text-ink'}`}>
                <span aria-hidden>{ic}</span><span className="hidden sm:inline">{label}</span><span className="sm:hidden sr-only">{label}</span>
              </NavLink>
            ))}
          </nav>
          <LangSwitch className="shrink-0" />
        </div>
      </header>
      <main className="flex-1">{children}</main>
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
        <Route path="/practice/:id" element={<Practice />} />
        <Route path="/host/:id" element={<HostLive />} />
        <Route path="/workspace/preview/:id" element={<Preview />} />
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
