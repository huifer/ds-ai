import { useQuery } from '@tanstack/react-query';

export function ChartRoute() {
  const { data } = useQuery({
    queryKey: ['chart'],
    queryFn: () => fetch('/api/chart').then((r) => r.json()),
  });

  return (
    <section className="space-y-4">
      <h2 className="serif text-3xl font-semibold">Pilot KPIs</h2>
      <p className="text-sm text-slate-500">Mock values rendered from MSW handlers.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {(data?.bars ?? []).map(
          (b: { label: string; value: string; note?: string }) => (
            <div key={b.label} className="rounded-lg bg-cyan-50 p-3 border border-cyan-200">
              <p className="text-xs text-cyan-700">{b.label}</p>
              <p className="text-2xl font-bold mt-1">{b.value}</p>
              <p className="text-xs text-cyan-600 mt-1">{b.note}</p>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
