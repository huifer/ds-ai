type Channel = { label: string; href: string };

type Props = {
  channels: Channel[];
};

export function Footer({ channels }: Props) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-brand-primary text-white">
      <div className="max-w-6xl mx-auto px-6 py-8 grid sm:grid-cols-2 gap-4">
        <div>
          <h2 className="serif text-2xl font-semibold">Contact</h2>
          <p className="text-sm text-cyan-100 mt-2">
            Demo delivered by Zenbuild ·{' '}
            <a className="underline" href="https://github.com/huifer">
              huifer
            </a>
          </p>
        </div>
        <div className="grid gap-2 text-sm">
          {channels.map((c) => (
            <a
              key={c.label}
              href={c.href}
              className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-3 border border-white/20"
            >
              {c.label}
            </a>
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-slate-400 py-6">
        © {year} · Zenbuild · Local data only · No backend
      </p>
    </footer>
  );
}
