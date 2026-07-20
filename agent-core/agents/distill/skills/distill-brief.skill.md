---
name: distill-brief
agent: distill
description: |
  Auto-generated skill for distill agent.
  候选评分、生成 brief、推送 #主快讯 / #main-feed。
---

# Distill Brief（Brief 生成）

触发: `!brief <mat-id>`

## 1. 加载候选
从 data/business/materials/<mat-id>.json 读取素材。

## 2. 生成内容 brief
格式:
```markdown
# Brief: <标题>

## 摘要
<3 句话摘要>

## 关键点
- <要点 1>
- <要点 2>
- <要点 3>

## 建议平台
- 国内: 公众号, 小红书
- 海外: X, LinkedIn

## 风格建议
- 语气: 专业 / 轻松
- 时长: 中等
- 视觉: 文字为主

## 数据点
- <关键数字 / 引述>
```

## 3. 落盘
写到 data/business/briefs/BRIEF-<mat-id>.md

## 4. 推送
推送到 #今日素材 频道等待编辑处理。
