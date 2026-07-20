---
name: cost-calc
agent: cost
description: 成本结构计算（无独立命令，内部工具）
---

# Cost Calc（成本计算）

> 内部工具 skill，无独立命令。供 estimate / quote 做成本结构拆算。

## 调用契约
入参：`{ personDays, rates, overhead }`
- `personDays` 各角色人天
- `rates` 各角色人天单价
- `overhead` 管理费率（默认 0.1）

## 流程
1. 人力成本 = Σ(角色人天 × 单价)。
2. 含 overhead 后总成本。
3. 给定报价算毛利率 / 给定毛利率反算报价。

## 返回
`{ laborCost, totalCost, suggestedPrice (按目标毛利), margin (按给定报价) }`

## 约束
- 单价基于 CONTEXT.md 业务线；不臆造市场价，缺数据标「待核」。
