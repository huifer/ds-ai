---
name: component-library
description: |
  Use this skill when a Demo or MVP needs UI components. Always pair with `zenbuild-design-tokens`.
  Components live in `agent-core/design/components/`. Each component has `index.ts` and a primary file.
  Do not write duplicate components inside Demo projects; import from `@zenbuild/design`.
---

# 1. 组件列表

| 组件 | 路径 | 用途 |
|---|---|---|
| Button | `components/button/` | 操作触发 |
| Card / StatCard | `components/card/` | 数据容器 |
| Table | `components/table/` | 列表 |
| FormField | `components/form/` | 表单输入 |
| Modal | `components/modal/` | 弹窗 |
| BarChart | `components/chart/` | 可视化 |
| Hero | `components/hero/` | 首屏 |
| Nav / Breadcrumb | `components/nav/`, `components/breadcrumb/` | 导航 |
| Toast / Tooltip | `components/toast/`, `components/tooltip/` | 反馈 |
| TableOfContents | `components/table-of-contents/` | 长文档导航 |

# 2. 决策

| 场景 | 组件 |
|---|---|
| 触发 | Button |
| 数据展示 | Card / StatCard / Table |
| 数据输入 | FormField |
| 反馈 | Toast / Modal / Tooltip |
| 导航 | Nav / Breadcrumb / TableOfContents |
| 可视化 | BarChart |

# 3. 规则

- 不允许在 Demo 项目中重新实现以上组件；
- 颜色与圆角全部从 `tokens.css` 引入；
- 组件 props 必须导出 `ComponentProps` 类型；
- Storybook 故事推荐但非强制。

# 4. 失败回退

- 缺组件 → 报告给 `chief-agent`；
- 组件接口不适配当前需求 → 改造组件本身并升级 `tokens.css`。
