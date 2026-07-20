---
name: platform-publish
agent: publisher
description: |
  Auto-generated skill for publisher agent.
  推送外平台与本地草稿；任何外发都需审批。
---

# Platform Publish（平台发布）

触发: `!publish <rnd-id> --platform=wechat` (需审批)

## 1. 读取 render 产物
从 data/business/renders/<rnd-id>/ 加载最终内容。

## 2. 检查审批
调用 approval.check('publish-domestic', {producer, objectId, summary})。
- 已批准 → 继续
- 需要审批 → 返回 NEED_APPROVAL,推到审批中心
- 已拒绝/过期 → 返回对应状态

## 3. 调用平台 API
按平台:
- wechat: 微信公众号 API (草稿箱)
- x: Twitter API v2
- linkedin: LinkedIn API
- 小红书/抖音: 通过内部草稿箱(不直接发布)

## 4. 记录
data/business/published/<pub-id>.json:
- 平台 + URL
- 发布时间
- 数据追踪 ID

## 5. 推送通知
发卡片到 publish-xxx 频道,附链接。
