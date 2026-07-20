---
name: html-render
agent: renderer
description: |
  Auto-generated skill for renderer agent.
  渲染 HTML / PDF / 截图，套品牌色与版式。
---

# HTML Render（HTML 渲染）

## 1. 加载 token
从 agent-core/design/tokens.css 加载设计 token。

## 2. 套用模板
按 brand-voice-* 的风格选择:
- editorial (默认,白底大字)
- card (卡片式,适合社媒)
- minimal (极简,适合 newsletter)

## 3. 渲染
用 Playwright 渲染 HTML → PNG。

## 4. 输出
data/business/renders/<rnd-id>/
- card.html
- card.png
- card-mobile.png(可选)
