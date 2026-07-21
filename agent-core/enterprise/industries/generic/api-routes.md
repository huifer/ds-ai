# API Routes · generic

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/scenarios', () => HttpResponse.json({ scenarios: [] })),
  http.get('/api/chart', () => HttpResponse.json({ bars: [] })),
];
```
