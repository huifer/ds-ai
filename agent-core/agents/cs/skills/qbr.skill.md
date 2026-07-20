---
name: qbr
agent: cs
description: 季度业务回顾（QBR）
---

# QBR（季度业务回顾）

触发：`!cs qbr <account 或 PRJ-ID>`

## 流程
1. 读 health-report、delivery 里程碑、incident、finance 收款记录。
2. 生成 QBR：
   - **上季成果**（交付里程碑 / 业务指标达成）
   - **用量与服务数据**（活跃 / 工单 / SLA）
   - **价值实现**（对照合同承诺与 PRD 目标）
   - **问题与改进**
   - **下季计划**
   - **续费 / 增购建议**（关联 renewal-brief）

## 落盘
`data/business/accounts/<account-id>/cs/qbr-<YYYYQX>.md`

## 回复
QBR 摘要 + 续费建议；可直接作为与客户回顾会的材料。
