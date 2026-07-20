---
name: route
agent: orchestrator
description: |
  Synthetic agent skill for orchestrator: route.
  Auto-generated.
---

# Route（路由）

## 1. 接收用户消息

## 2. 三层路由
- 频道映射(硬路由)
- 关键词匹配(软路由)
- 默认兜底

## 3. 决定 Agent
输出 { agentId, confidence, reason }

## 4. 移交
调用 session-pool.getOrCreate + agent.handleMessage
