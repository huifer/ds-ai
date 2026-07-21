import { NavLink, Route, Routes } from 'react-router-dom';
import { Hero } from '@/components/Hero';
import { StatCard } from '@/components/StatCard';
import { Footer } from '@/components/Footer';
import { ScenarioRoute } from '@/routes/scenario';
import { ChartRoute } from '@/routes/chart';
import { SettingsRoute } from '@/routes/settings';
import { boundaries } from '@/data/fixtures/boundaries';
import { contactChannels } from '@/data/fixtures/contact';
import { stats } from '@/data/fixtures/stats';

export function App() {
  return (
    <div className="min-h-screen bg-surface text-brand-primary">
      <header className="bg-brand-primary text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <p className="text-xs uppercase tracking-widest text-cyan-200">Zenbuild</p>
          <Hero />
          <nav className="mt-6 flex flex-wrap gap-3 text-sm">
            {['/', '/scenario', '/chart', '/settings'].map((path) => (
              <NavLink
                key={path}
                to={path}
                end
                className={({ isActive }) =>
                  `rounded-full px-3 py-1 ${
                    isActive ? 'bg-cyan-400 text-slate-900' : 'border border-white/30'
                  }`
                }
              >
                {path === '/' ? 'Dashboard' : path.slice(1).replace(/^./, (c) => c.toUpperCase())}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <Routes>
          <Route
            path="/"
            element={
              <div className="grid md:grid-cols-3 gap-4">
                {stats.map((s) => (
                  <StatCard key={s.label} label={s.label} value={s.value} delta={s.delta} />
                ))}
              </div>
            }
          />
          <Route path="/scenario" element={<ScenarioRoute />} />
          <Route path="/chart" element={<ChartRoute />} />
          <Route path="/settings" element={<SettingsRoute />} />
        </Routes>

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-semibold font-serif">Demo Boundaries</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {boundaries.map((b) => (
              <li key={b.text} className="flex gap-2">
                <span>{b.icon}</span>
                <span>{b.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <Footer channels={contactChannels} />
    </div>
  );
}
