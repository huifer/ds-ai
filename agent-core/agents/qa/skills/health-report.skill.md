---
name: health-report
agent: qa
description: |
  Auto-generated skill for qa agent.
  数据回收、内容复盘、Agent 心跳、记忆治理。
---

# Health Report（系统健康报告）

## 1. 数据源
- AgentManager.getStatus()
- session-pool.list()
- log 错误率
- token 消耗速率

## 2. 指标
- Agent uptime
- 错误率
- 平均响应时间
- Memory scope 增长率

## 3. 输出
每 6 小时生成,发到 #agent-状态。
