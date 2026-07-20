---
name: platform-domestic
agent: publisher
description: |
  Auto-generated skill for publisher agent.
  推送外平台与本地草稿；任何外发都需审批。
---

# Platform Domestic（国内平台发布）

## 1. 支持的平台
- 微信公众号
- 小红书
- 视频号
- 抖音

## 2. 实现方式
- 微信/视频号: 公众号 API 草稿箱,人工最终确认
- 小红书: 通过 wechat-helper 工具(自动草稿)
- 抖音: 通过字节开放平台(自动草稿)

## 3. 限制
- 不直接发外网,只入草稿箱
- 需要 approval-publish-domestic 审批
- 客户案例 / 数字 / 合同相关需二次审核
