---
name: metrics-fetch
agent: qa
description: |
  Auto-generated skill for qa agent.
  数据回收、内容复盘、Agent 心跳、记忆治理。
---

# Metrics Fetch（指标抓取）

## 1. 来源
- Discord: 消息数 / 活跃用户 / 频道活跃度
- Pi Agent: token 消耗 / session 数 / 错误数
- 业务系统: 客户数 / 项目数 / 收入

## 2. 抓取频率
每 6 小时一次,写入 data/metrics/。

## 3. 输出格式
JSON: {timestamp, metrics: {agent_id: {calls, errors, tokens, ...}}}
