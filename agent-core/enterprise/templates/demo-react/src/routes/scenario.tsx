import { useQuery } from '@tanstack/react-query';
import { Hero } from '@/components/Hero';
import { stats } from '@/data/fixtures/stats';
import { project } from '@/data/fixtures/project';

export function ScenarioRoute() {
  const { data } = useQuery({
    queryKey: ['scenarios', project.id],
    queryFn: () => fetch('/api/scenarios').then((r) => r.json()),
  });

  return (
    <section className="space-y-4">
      <Hero
        title="Scenarios"
        tagline="Tap a scenario to see the mock response."
        badge="MSW"
      />
      <div className="grid md:grid-cols-2 gap-4">
        <ul className="space-y-2">
          {(data?.scenarios ?? []).map((s: { id: string; title: string; hint: string }) => (
            <li key={s.id} className="rounded-xl border border-slate-200 px-4 py-3">
              <p className="font-semibold">{s.title}</p>
              <p className="text-xs text-slate-500 mt-1">{s.hint}</p>
            </li>
          ))}
        </ul>
        <pre className="bg-surface rounded-xl p-4 text-xs whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
      <p className="text-xs text-slate-500">stats: {stats.length} entries loaded from fixtures</p>
    </section>
  );
}
