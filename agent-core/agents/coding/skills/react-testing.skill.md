---
name: react-testing
description: |
  Use this skill when writing unit or smoke tests for a React project.
  Always pair with `component-library` and `msw-mock`.
---

# 1. 工具

- vitest
- @testing-library/react
- @testing-library/jest-dom
- @testing-library/user-event

# 2. scripts/setup.ts

```ts
import '@testing-library/jest-dom/vitest';
```

# 3. tests/smoke.test.ts

```ts
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';

describe('App', () => {
  it('renders the brand', () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByText('Zenbuild')).toBeInTheDocument();
  });
});
```

# 4. 测试覆盖建议

- 路由切换：每条路由至少 1 个 smoke；
- 组件：每个新组件至少 1 个 snapshot 或 interaction test；
- Hook：每个自定义 hook 至少 1 个测试。

# 5. 失败回退

- jsdom 缺失 → `pnpm add -D jsdom`；
- MSW 集成 → `setupServer` + `beforeAll / afterEach`。
