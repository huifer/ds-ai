import { useState } from 'react';

export function SettingsRoute() {
  const [tenant, setTenant] = useState('acme');
  return (
    <section className="space-y-4">
      <h2 className="serif text-3xl font-semibold">Settings</h2>
      <p className="text-sm text-slate-500">
        Mock configuration. No backend write; values are kept in local state.
      </p>
      <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-3 max-w-md">
        <label className="block text-sm font-medium">Tenant alias</label>
        <input
          value={tenant}
          onChange={(e) => setTenant(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <button
          type="button"
          className="rounded-lg bg-brand-accent text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-cyan-300"
        >
          Save (mock)
        </button>
      </div>
    </section>
  );
}
