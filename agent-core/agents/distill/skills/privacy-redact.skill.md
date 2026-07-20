---
name: privacy-redact
agent: distill
description: |
  Auto-generated skill for distill agent.
  候选评分、生成 brief、推送 #主快讯 / #main-feed。
---

# Privacy Redact（隐私脱敏）

触发: `!privacy check <cnt-id>` 或 distill 流水线自动

## 1. 检测项
- 客户名 / 项目名 / 人名
- 邮箱 / 电话 / 身份证号
- 银行账号 / 订单号
- 内部代号 / 项目代号
- API key / token

## 2. 替换规则
- 公司名 → [CLIENT-N]
- 人名 → [PERSON-N]
- 邮箱 → [EMAIL]
- 电话 → [PHONE]
- 数字串(≥6 位) → [NUM-N]

## 3. 落盘
- 原文: data/business/contents/<cnt-id>-raw.md
- 脱敏: data/business/contents/<cnt-id>-redacted.md

## 4. 标记
在 content meta.json 标记:
- privacy: 'redacted'
- redactionCount: N
- reviewRequired: bool
