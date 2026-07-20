---
name: status-read
agent: chief
description: |
  Auto-generated skill for chief agent.
  战略协调、审批仲裁、跨 Agent 冲突处理。
---

# Status Read（状态读取）

触发: `!state` 或 `!state <agent-id>`

## 1. 数据源
- AgentManager.getStatus() 返回所有 agent 的运行状态
- data/sessions/ 目录的活跃 session 数
- data/agent-runtime/memory/ 目录的写入量

## 2. 输出格式
```
Agent         State    Last Run           Sessions  Errors
sales         idle     2024-01-15 14:23   12        0
pm            running  now                5         0
chief         idle     2024-01-15 13:50   3         1 (timeout)
```

## 3. 单 Agent 详情
`!state sales` 输出:
- 当前活跃 session 数
- 最近 5 次运行的状态
- Token 累计消耗
- Memory scope 写入量
- 最近一次错误详情
