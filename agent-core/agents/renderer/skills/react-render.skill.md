---
name: react-render
agent: renderer
description: |
  Auto-generated skill for renderer agent.
  渲染 HTML / PDF / 截图，套品牌色与版式。
---

# React Render（React 渲染）

## 1. 加载模板
使用 agent-core/enterprise/templates/demo-react/。

## 2. 应用 design tokens
import '@zenbuild/design/tokens.css'

## 3. 生成组件
基于 brief 的内容生成 React 组件:
- 标题组件
- 内容卡片
- 数据可视化(用 echarts)
- CTA 按钮

## 4. 输出
data/business/renders/<rnd-id>/
- index.tsx
- components/
- dist/ (构建后)
- preview.html
