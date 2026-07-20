---
name: platform-overseas
agent: publisher
description: |
  Auto-generated skill for publisher agent.
  推送外平台与本地草稿；任何外发都需审批。
---

# Platform Overseas（海外平台发布）

## 1. 支持的平台
- X (Twitter)
- Product Hunt
- LinkedIn
- YouTube
- Newsletter (Substack / Beehiiv)

## 2. 实现方式
- X: 直接调用 API 发布(需 OAuth2)
- PH: 提交 maker 资料 + 排期
- LinkedIn: API 发布,工作流审批
- YouTube: 视频上传 + 元数据
- Newsletter: 通过 SMTP / 平台 API

## 3. 限制
- 重要客户案例需 anonymize
- 法务敏感内容需 legal review
- approval-publish-domestic / overseas 都需要
