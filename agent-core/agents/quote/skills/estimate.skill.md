---
name: estimate
agent: quote
description: 起草报价单（调 cost 估算 → 生成报价版本）
---

# Quote Estimate（起草报价）

触发：`!quote draft <PRJ-ID>`

## 流程
1. 读 PRD（`accounts/<account>/projects/<PRJ>/prd.md`）取 scope。
2. 调用 **cost 估算**（`cost/estimate` skill）得到人天/成本/毛利。
3. 生成报价单 `QUOTE-<PRJ>-vN`（扫描 `accounts/<account>/quote/` 已有版本 +1）。
4. 内容：项目概述、范围、交付物、里程碑、报价明细（人天×单价）、付款条件、有效期。

## 落盘（敏感内容，只写 account 下）
`data/business/accounts/<account-id>/quote/QUOTE-<PRJ>-v1.md`

## 回复
```
💰 报价单 QUOTE-<PRJ>-v1
范围 / 总人天 / 报价 / 毛利率
下一步：!quote set <折扣> 调整折扣；!quote approve 提交 #审批中心 审批后外发
```
## 约束（CONTEXT.md）
- **禁止**脱开 #审批中心 直接外发；`!quote approve` 触发审批门（approval: quote-send）。
- 报价金额、客户信息只写 account 下，不进 index.yaml。
