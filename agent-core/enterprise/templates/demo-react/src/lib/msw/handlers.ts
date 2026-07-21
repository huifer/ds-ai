import { http, HttpResponse } from 'msw';

const scenarios = [
  { id: 'order-status', title: 'Order status', hint: 'Customer asks where is my order.' },
  { id: 'return-policy', title: 'Return policy', hint: 'Customer asks can I return this.' },
  { id: 'transfer', title: 'Transfer to human', hint: 'Customer requests a real person.' },
];

const chart = {
  bars: [
    { label: 'Auto-reply rate', value: '50%', note: 'target' },
    { label: 'P95 latency', value: '3s', note: 'target' },
    { label: 'CSAT', value: '4.5', note: 'out of 5' },
  ],
};

export const handlers = [
  http.get('/api/scenarios', () => HttpResponse.json({ scenarios })),
  http.get('/api/chart', () => HttpResponse.json(chart)),
];
