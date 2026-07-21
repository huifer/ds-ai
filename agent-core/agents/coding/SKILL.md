---
name: coding
description: |
  Use this skill when a Discord command is `!demo new` / `!mvp new` / `!demo refactor` / `!build run`.
  Generates React Demo / MVP / 内部工具的专属 Agent。
  Loads skills in fixed order: read-foundation -> react-design -> component-library
  -> react-vite -> react-router -> tailwind-v4 -> shadcn-ui -> tanstack-query -> msw-mock
  -> react-testing -> zenbuild-design-tokens -> react-demo -> pnpm-install -> codespace-build.
  Always uses `@zenbuild/design` design tokens and existing components.
  Never writes raw HTML. Never writes duplicate components. Never edits the demo template directly.
---

# 0. Entry

- 命令格式：`!demo new <alias> <industry> <一句话需求>` 或 `!mvp new ...`
- 输入：基础文件（PRD、行业资料、客户对话）+ 行业 + 业务说明
- 输出：可直接 `pnpm install && pnpm dev` 的 React 工程
- 拒绝：手写 HTML、跳过组件库、改 token

# 1. 加载 Skill 顺序

```text
read-foundation
  → react-design
  → component-library
  → react-vite
  → react-router
  → tailwind-v4
  → shadcn-ui
  → tanstack-query
  → msw-mock
  → react-testing
  → zenbuild-design-tokens
  → react-demo          ← 编排输出
  → pnpm-install
  → codespace-build
```

# 2. 决策表

| 用户输入 | 决策 | 模板 |
|---|---|---|
| `!demo new` | Demo（mock data，可直接跑） | `agent-core/enterprise/templates/demo-react/` |
| `!mvp new` | MVP（含 mock data 与最小后端） | `demo-react/` + 模拟路由层 |
| `!demo refactor` | 改造现有 Demo 风格 / 路由 | `react-design` Skill |
| `!build run` | 真实构建产物 | `pnpm install && pnpm build` + 上传 dist |

# 3. 通用输出

```text
data/business/projects/<alias>/
├── README.md
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── public/brand/{logo,og}.svg
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   ├── components/
│   ├── lib/{api,msw}
│   ├── data/fixtures/
│   ├── styles/tailwind.css
│   └── types.ts
├── tests/smoke.test.ts
└── .github/workflows/ci.yml
```

# 4. 硬性要求

- 强制使用 `@zenbuild/design` 的 token 与组件；
- 必须用 TypeScript；
- 必须用 Tailwind v4；
- 必须用 shadcn/ui 基础组件；
- 必须用 MSW + fixtures 提供 mock data；
- 必须含至少 1 条路由切换；
- 必须含 `tests/smoke.test.ts`；
- 必须有 `vite.config.ts` 与 `tsconfig.json`；
- 必须含 `README.md` 与 `.github/workflows/ci.yml`。

# 5. 失败回退

- 行业 PRD 模板缺失 → 用通用 `agent-core/enterprise/templates/prd-template.md` 兜底；
- 基础文件缺失 → 提示用户先调用 `solution-agent` 走 Stage 1；
- 行业未在 `agent-core/enterprise/industries/` 列表 → 使用通用 industries/generic 目录。

# 6. 通知与产物

- 完成后向 `#fde-客户交付` 推 `[demo ready] PRJ-2026-0001 · alias` 卡片，附截图、PDF、预览链接与按钮组；
- 同步向 `#项目管理` 推 Kanban 卡片，更新 stage 为 `demo`；
- 同步到 `data/business/projects/index.yaml` 的 stage 字段；
- 公开内容候选送 `#主快讯`。
