export type Boundary = { icon: string; text: string };

export const boundaries: Boundary[] = [
  { icon: '✅', text: 'In scope: landing page, scenario demo, chart view, settings page — all wired through TanStack Query.' },
  { icon: '✅', text: 'Mock API via MSW + fixtures; no real backend, safe to deploy as static site.' },
  { icon: '⚠️', text: 'Out of scope: auth, payments, multi-tenant state — these are demo-shape only.' },
  { icon: '⚠️', text: 'Tailwind v3 (template default). v4 migration lives in a separate branch.' },
];
