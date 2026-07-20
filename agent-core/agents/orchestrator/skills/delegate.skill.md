---
name: delegate
agent: orchestrator
description: |
  Synthetic agent skill for orchestrator: delegate.
  Auto-generated.
---

# Delegate（任务委派）

## 1. 任务拆分
一个复杂任务 → 多个子任务

## 2. 子任务路由
每个子任务找到最合适的 agent

## 3. 串行 / 并行
- 有依赖: 串行
- 独立: 并行(用 Promise.all)

## 4. 汇总
把多个 agent 输出整合,给用户统一回复。

## 5. 错误处理
任一子任务失败 → 部分成功 + 失败明细
