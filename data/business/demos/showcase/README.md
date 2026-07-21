# Showcase Demo · SaaS

**alias:** showcase
**industry:** saas
**requirement:** 展示首页（landing page demo for a SaaS product）

基于 `@zenbuild/fde-demo` 模板生成，可直接 build / preview。

## Run

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # tsc -b && vite build
pnpm preview    # http://localhost:4173
```

## Routes

- `/` Dashboard / Landing
- `/scenario` Scenarios + mock responses (MSW)
- `/chart` Pilot KPIs
- `/settings` Mock configuration

## 已定制

- `src/App.tsx` Hero 文案改为 SaaS 展示首页
- `src/data/fixtures/stats.ts` 改为 SaaS 指标（首屏时长 / 包体积 / mock 覆盖率）
- `src/data/fixtures/boundaries.ts` 调整为 SaaS 范围说明
- `package.json` name → `showcase-demo`

## Promote to production

1. 移除 `src/lib/msw/handlers.ts`。
2. 设置 `VITE_API_BASE`。
3. 把 `src/lib/api.ts` 从 MSW 切到真实 fetch。

## Design tokens

- Primary `#0F172A`
- Accent `#22D3EE`
- Highlight `#FACC15`
- Surface `#F8FAFC`

见 `tailwind.config.js`。
