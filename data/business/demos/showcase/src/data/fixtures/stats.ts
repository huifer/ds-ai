export type Stat = { label: string; value: string; delta?: string };
export const stats: Stat[] = [
  { label: 'Time to first page', value: '< 1 day', delta: 'vs 2-week bootstrap' },
  { label: 'Bundle size (gzipped)', value: '~ 120 KB', delta: 'vite + react 18' },
  { label: 'Mock coverage', value: '100%', delta: 'MSW + fixtures' },
];
