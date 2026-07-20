---
name: discount
agent: quote
description: 报价折扣调整（生成新版本）
---

# Quote Discount（折扣调整）

触发：`!quote set <折扣>`（如 `!quote set 0.9` 或 `!quote set 减2万`）

## 流程
1. 找最新报价单 `accounts/<account>/quote/QUOTE-<PRJ>-vN.md`。
2. 应用折扣（百分比或绝对额），算新报价与毛利率。
3. 生成 `v(N+1)`，记录折扣理由。
4. 若折扣后毛利率低于阈值（如 25%），标 ⚠️ 警告并建议走特批。

## 落盘
`accounts/<account>/quote/QUOTE-<PRJ>-v(N+1).md`

## 回复
新报价 / 毛利率 / 折扣理由；提示 `!quote approve` 提交审批。
