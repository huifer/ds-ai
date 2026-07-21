export type Stat = { label: string; value: string; delta?: string };
export const stats: Stat[] = [
  { label: 'Target auto-reply rate', value: '50%', delta: 'vs 0% before' },
  { label: 'Target latency (P95)', value: '3s', delta: 'feishu webhook' },
  { label: 'Pilot scope', value: '1 site', delta: 'single tenant' },
];
