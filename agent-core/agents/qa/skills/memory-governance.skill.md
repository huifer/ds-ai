---
name: memory-governance
agent: qa
description: |
  Auto-generated skill for qa agent.
  数据回收、内容复盘、Agent 心跳、记忆治理。
---

# Memory Governance（记忆治理）

## 1. 任务
- 清理低质量记忆(短文本 / 重复)
- 合并相似记忆
- 标记过期记忆(status=expired)

## 2. 触发
- 每周日 02:00 自动
- 手动: `!memory clean`

## 3. 输出
- 删除 N 条
- 合并 M 条
- 总释放空间: X KB
