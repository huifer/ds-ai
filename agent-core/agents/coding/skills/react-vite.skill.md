---
name: react-vite
description: |
  Use this skill when scaffolding a new React project or upgrading an existing one.
  Always pairs with `react-router`, `tailwind-v4`, `shadcn-ui`, `tanstack-query`, `msw-mock`, `react-testing`.
---

# 1. 默认脚手架

```text
package.json
vite.config.ts
tsconfig.json
index.html
public/brand/{logo,og}.svg
src/main.tsx
src/App.tsx
src/styles/tailwind.css
```

# 2. 关键依赖

- vite
- @vitejs/plugin-react
- react / react-dom
- typescript
- tailwindcss v4
- @tanstack/react-query
- react-router-dom
- shadcn/ui
- msw
- vitest
- @testing-library/react

# 3. 脚本

- `pnpm dev` 启动本地开发
- `pnpm build` 构建产物
- `pnpm preview` 预览生产产物
- `pnpm test` 跑单测
- `pnpm typecheck` 类型检查
- `pnpm lint` 风格检查

# 4. MSW 启动

`src/main.tsx` 在 dev 与 preview 时 `await import('./lib/msw/browser')`，调用 `worker.start({ onUnhandledRequest: 'bypass' })`。

# 5. shadcn 初始化

```bash
pnpm dlx shadcn@latest init
```

`components.json` 默认：

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "tailwind.config.js", "css": "src/styles/tailwind.css", "baseColor": "slate" }
}
```

# 6. CI

`.github/workflows/ci.yml` 至少包含 `pnpm install && pnpm test && pnpm build`。
