---
name: invoice-request
agent: finance
description: 开票申请（需 invoice-approval 审批门）
---

# Invoice Request（开票申请）

触发：`!invoice request <account 或 PRJ-ID> [金额/明细...]`

## ⚠️ 审批门
本命令配置 `approval: invoice-approval`，必须先在 #审批中心 `!approve` 通过后才会生成正式开票申请。未授权返回 `NEED_APPROVAL`。

## 流程（授权后执行）
1. 读合同（`accounts/<account>/contract/summary.md`）取付款条件 / 金额 / 开票节点。
2. 读项目里程碑 / 交付验收状态，确认开票节点达成。
3. 生成开票申请：
   - 抬头 / 税号 / 开票金额 / 税率 / 明细
   - 账期与收款账户
   - 关联合同 / 项目 / 里程碑
4. 生成 `INV-YYYYMMDD-NN`。

## 落盘（敏感，只存 account 下）
`data/business/accounts/<account-id>/finance/invoice/INV-YYYYMMDD-NN.md`

## 回复
开票申请摘要（编号 / 金额 / 账期）；提示 `!invoice remind` 跟踪回款。
## 约束
开票金额、税号、账户信息严禁进 index.yaml；只存 account 下。
