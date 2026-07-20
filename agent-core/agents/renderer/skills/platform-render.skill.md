---
name: platform-render
agent: renderer
description: |
  Auto-generated skill for renderer agent.
  渲染 HTML / PDF / 截图，套品牌色与版式。
---

# Platform Render（平台渲染）

触发: `!render <rnd-id> --platform=wechat` 或 `!auto-render`

## 1. 读取 brief + 候选
- data/business/briefs/BRIEF-<id>.md
- data/business/materials/<mat-id>.json

## 2. 选择模板
按平台选择模板:
- wechat: 长文 + 头图
- xhs: 卡片式 + emoji
- x: 短推文 + thread
- linkedin: 长文 + bullets
- youtube: 视频脚本 + 时间轴
- newsletter: email 格式

## 3. 渲染产物
写到 data/business/renders/<rnd-id>/
- html (网页预览)
- png (主图截图)
- meta.json (元数据)

## 4. 推送
按 channel-map.mjs 的逻辑,推到对应 preview 频道:
- 国内 → preview-xxx
- 海外 → preview-yyy

## 5. 等待审批
publisher agent 需要审批(approval-publish-domestic)才能发布。
