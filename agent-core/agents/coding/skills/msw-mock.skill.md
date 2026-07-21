---
name: msw-mock
description: |
  Use this skill when a React project needs a mock backend in development.
  Always pair with `tanstack-query` and `component-library` (Toast).
---

# 1. 安装

```bash
pnpm add -D msw
pnpm dlx msw init public/ --save
```

# 2. handlers.ts

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/scenarios', () => HttpResponse.json({ scenarios: [...] })),
  http.post('/api/save', () => HttpResponse.json({ ok: true })),
];
```

# 3. browser.ts

```ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
export const worker = setupWorker(...handlers);
```

# 4. main.tsx 启动

```ts
if (import.meta.env.DEV) {
  const { worker } = await import('./lib/msw/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}
```

# 5. 注意

- 真实后端接入时删除该 import；
- 接口路径在 `agent-core/enterprise/industries/<industry>/api-routes.md` 中维护；
- Zod schema 写在 `src/lib/types.ts`。

# 6. 失败回退

- worker 启动失败 → 控制台打印但不阻塞 UI；
- 接口未拦截 → `onUnhandledRequest: 'bypass'`，避免开发期崩溃。
