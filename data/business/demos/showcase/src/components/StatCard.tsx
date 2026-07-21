type Props = {
  label: string;
  value: string;
  delta?: string;
};

export function StatCard({ label, value, delta }: Props) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 hover:shadow-md transition">
      <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
      {delta && <p className="text-xs text-slate-500 mt-1">{delta}</p>}
    </div>
  );
}
