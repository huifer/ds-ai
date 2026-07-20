---
name: status
agent: orchestrator
description: |
  Synthetic agent skill for orchestrator: status.
  Auto-generated.
---

# Status（状态查询）

## 1. 数据源
- 各 agent 的最近运行时间
- session-pool 的活跃 session
- memory-scope 的写入量
- 最近错误

## 2. 输出
```
## Agent 状态

| Agent | State | Last Run | Sessions | Errors |
|-------|-------|----------|----------|--------|
| sales | idle  | 2m ago   | 3        | 0      |
| ... |
```
