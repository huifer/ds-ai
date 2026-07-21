---
name: react-demo
description: |
  Use this skill when building or modifying a React demo for FDE.
  Loads `react-design`, `component-library`, `react-vite`, `react-router`, `tailwind-v4`, `shadcn-ui`, `tanstack-query`, `msw-mock`, `react-testing`, `zenbuild-design-tokens`.
  Always produces a runnable Vite + React + TS project that uses `@zenbuild/design` and follows the routes (Dashboard, Scenario, Chart, Settings) and the file layout in the `agent-core/enterprise/templates/demo-react/` template.
---

# 0. 输入

- 项目 alias（如 `client-alpha`）
- 行业（来自 `agent-core/enterprise/industries/` 之一或 generic）
- 一句话业务需求
- 行业资料（可空）
- 客户基础文件（PRD / 飞书 / 微信 / 邮件，可空）

# 1. 加载 Skill 顺序

```text
zenbuild-design-tokens
  → component-library
  → react-vite
  → react-router
  → tailwind-v4
  → shadcn-ui
  → tanstack-query
  → msw-mock
  → react-testing
  → react-design       ← 选页面与风格
```

# 2. 流程

1. 从 `agent-core/enterprise/industries/<industry>/demo-case.md` 读取典型场景与组件清单；
2. 从 `agent-core/enterprise/templates/demo-react/` 拷贝骨架；
3. 注入行业 routes、scenarios、chart 数据、boundaries 与 contact；
4. 用 `pnpm install` 验证依赖；
5. 用 `pnpm run typecheck` 验证 TypeScript；
6. 用 `pnpm test` 跑 smoke；
7. 打包 `dist/`；
8. 通知 `agent-core/agents/coding/` Agent。

# 3. 路由结构（默认）

```text
/             Dashboard   StatCard
/scenario     Scenarios   FormField + Button + BarChart
/chart        Charts      BarChart
/settings     Settings    FormField + Switch
```

# 4. 数据来源

- 默认 fixtures：`src/data/fixtures/<industry>.ts`；
- 默认 MSW handlers：`src/lib/msw/handlers.ts`；
- 颜色 token：CSS Variables，引用 `agent-core/design/tokens.css`；
- 字体：`Inter` + `Lora`。

# 5. 与正式研发共用

- 同一份 fixtures 接到真实 API；
- 同一份 routes 拆到 lazy load；
- 同一份 components 进入 `@zenbuild/design` 仓库。

# 6. 失败回退

- 缺 `demo-case.md` → 用 `industries/generic/demo-case.md`；
- 缺基础文件 → 提示 `solution-agent` 先走 Stage 1；
- 风格冲突 → 以 `@zenbuild/design` token 为准。

# 7. 交付物

- `data/business/projects/<alias>/` 完整 React 项目；
- 截图、PDF、preview 链接；
- 公开内容候选送 `#主快讯`。
