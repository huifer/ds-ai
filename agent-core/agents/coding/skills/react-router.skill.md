---
name: react-router
description: |
  Use this skill when designing routes for a React project.
  Always pair with `component-library` (Nav / Breadcrumb / TableOfContents).
---

# 1. 路由决策表

| 行业 | 路由 |
|---|---|
| AI Agent | `/` `/scenario` `/settings` |
| SaaS | `/` `/pricing` `/settings` |
| Data Analytics | `/` `/chart` `/settings` |
| Cross-border E-commerce | `/` `/orders` `/shipments` `/settings` |
| Internal Tools | `/` `/tasks` `/approvals` `/settings` |
| Generic | `/` `/scenario` `/chart` `/settings` |

# 2. 嵌套

- 一级路由放在 `src/routes/`，文件名 kebab-case；
- 二级路由使用 `useParams` + `NavLink`；
- 详情页使用 `/<group>/<id>` 形式。

# 3. 守卫

- `auth-required` 用于需要登录的内部工具；
- `permission-required` 用于按角色限制；
- `redirect` 在权限不足时跳转。

# 4. 失败回退

- 路由过多 → 折叠到两级；
- 路由过少 → 至少 Dashboard + Settings。
