---
name: reminder
agent: finance
description: 应收提醒与催收
---

# Reminder（应收提醒）

触发：`!invoice remind <account 或 INV-ID>`

## 流程
1. 扫描 `accounts/<account>/finance/invoice/INV-*.md`。
2. 按账期与今天比对，分类：
   - **未到期**（临近提醒）
   - **到期未付**（逾期天数）
   - **长期逾期**（高风险）
3. 生成催收动作建议（温和提醒 → 正式催款 → 升级），关联客户成功（cs）防流失。

## 落盘
`data/business/accounts/<account-id>/finance/reminder-<YYYYMMDD>.md`

## 回复
```
应收状态 · <account>
未到期 N / 逾期 N（合计 ¥...）
[逾期 15d] INV-... → 建议：正式催款 + cs 介入
```
## 约束
金额信息只存 account 下。
