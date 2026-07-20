---
name: health-report
agent: cs
description: 客户健康度评估
---

# Health Report（客户健康度）

触发：`!cs health <account 或 PRJ-ID>`

## 流程
1. 聚合客户信号（从 `accounts/<account>/` 下各产物 + incident + delivery 记录）。
2. 多维评分：
   - **采用度**（活跃 / 关键功能使用率）
   - **价值实现**（对照 PRD 目标 / 业务指标达成）
   - **工单与 incident**（频次 / P0P1）
   - **续费风险**（合同到期 / 联系人变化 / 用量下滑）
   - **满意度**（NPS / 反馈）
3. 综合定级 🟢健康 / 🟡关注 / 🔴风险。

## 落盘
`data/business/accounts/<account-id>/cs/health.md`

## 回复
```
💚 <account> 客户健康度：🟡关注
采用度 / 价值 / 工单 / 续费风险 分项
⚠️ 风险：用量下滑；建议：!cs qbr 安排回顾
```
