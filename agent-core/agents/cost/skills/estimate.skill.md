---
name: estimate
agent: cost
description: 工时/成本/毛利估算（无独立命令，由 quote 流程调用）
---

# Cost Estimate（成本估算）

> 本 skill 无独立 `!` 命令，由 `quote/estimate` 在起草报价时调用。
> 对应业务链「估算报价」环节，cost agent 职责：工时、成本、毛利估算。

## 调用契约
入参：`{ prjId, scope }`（scope 来自 PRD 的功能范围）

## 流程
1. 读 `data/business/projects/<或 accounts/.../projects/<PRJ-ID>>/prd.md` 取功能范围。
2. 按功能拆解工时：设计 / 前端 / 后端 / AI / 测试 / 部署，给出人天估算与假设。
3. 按 CONTEXT.md 业务线（AI 应用 / AI Agent / 自动化工作流 / 软件系统）匹配人天单价。
4. 计算：总人天、成本、建议报价区间、毛利率。

## 落盘
`data/business/accounts/<account-id>/projects/<PRJ-ID>/cost/estimate.md`（account-id 从 index.yaml 的 PRJ 反查）。

## 返回（给 quote）
```json
{ "personDays": 45, "breakdown": {...}, "cost": 180000, "priceRange": [240000, 300000], "margin": 0.4 }
```
