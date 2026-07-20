---
name: react-demo
agent: coding
description: |
  Auto-generated skill for coding agent.
  Demo / MVP / 内部工具代码生成。加载 react-design / component-library / react-vite 等 Skill。
---

# React Demo（React Demo 生成）

触发: `!demo new <alias> <industry> <一句话需求>`

## 1. 加载 Skill 顺序
read-foundation → react-design → component-library → react-vite → react-router → tailwind-v4 → shadcn-ui → tanstack-query → msw-mock → react-testing → zenbuild-design-tokens → react-demo(本 skill)

## 2. 输入
- alias: 项目短名(英文)
- industry: 行业(参考 agent-core/enterprise/industries/)
- requirement: 一句话需求

## 3. 模板选择
使用 agent-core/enterprise/templates/demo-react/

## 4. 生成
- package.json (vite + react + ts)
- src/App.tsx (路由 + 主题)
- src/pages/ (首页 + 详情 + 表单)
- src/components/ (用 @zenbuild/design)
- src/mocks/ (MSW handlers)
- tailwind.config.ts (从 tokens)
- README.md

## 5. 验证
- pnpm install
- pnpm build
- pnpm dev(可选)

## 6. 输出
data/business/demos/<alias>/
- 完整项目

## 7. 推送
发到 #项目管理 频道 + 预览链接。
