---
name: cost-read
agent: chief
description: |
  Auto-generated skill for chief agent.
  战略协调、审批仲裁、跨 Agent 冲突处理。
---

# Cost Read（成本读取）

触发: `!cost`

## 1. 数据源
- data/token-usage/*.md - 每日用量报告
- AgentManager 的 tokenUsage 统计

## 2. 汇总维度
- 按 Agent 汇总(input/output/cache)
- 按时间(今日/本周/本月)
- 按 Skill 汇总

## 3. 输出
```
📊 Token 用量报告 (近 14 天)

Agent         Input     Output    Cache R   Total
sales         234,567   45,678    12,345    292,590
pm            123,456   23,456    8,901     155,813
chief         89,012    12,345    5,678     107,035

💰 估算成本 (USD): $12.45
```
