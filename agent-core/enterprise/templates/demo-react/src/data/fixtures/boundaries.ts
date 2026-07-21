export type Boundary = { icon: string; text: string };

export const boundaries: Boundary[] = [
  { icon: '✅', text: 'In scope: Feishu single chat, FAQ retrieval, order lookup, transfer to human.' },
  { icon: '✅', text: 'Single-tenant deployment, daily data purge after 7 days.' },
  { icon: '⚠️', text: 'Out of scope: WeChat, group chat, multi-language beyond EN/ZH, outbound calls.' },
  { icon: '⚠️', text: 'No real backend yet — this demo is fully driven by MSW + fixtures.' },
];
