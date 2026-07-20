---
name: follow-up
agent: sales
description: |
  Auto-generated skill for sales agent.
  线索、资格判断、跟进。
---

# Follow Up（跟进）

触发: `!follow-up <lead-id>`

## 1. 读取 lead
从 data/business/leads/<lead-id>.json:
- 公司 / 联系人 / 来源 / 需求
- 最近沟通记录
- 阶段

## 2. 生成跟进计划
按阶段:
- new: 24h 内首次联系
- qualified: 3 天内发 proposal 草稿
- proposal: 7 天内未回复则提醒
- negotiation: 每 2 天更新
- closed: 7 天后做 case study

## 3. 生成消息
- 中文: 简短,确认问题 + 时间
- 英文: 类似,但更正式

## 4. 推送
写跟进日志到 lead 记录,发提醒到 #销售线索 频道。
