---
name: risk-register
agent: contract
description: 合同风险登记（付款/SLA/IP/终止）
---

# Contract Risk Register（合同风险登记）

触发：`!contract risk <PRJ-ID 或 contract>`

## 前置
`accounts/<account>/contract/summary.md` 已存在（先 `!contract new`）。

## 流程
从合同摘要识别风险并登记，维度：
- **付款风险**（账期长 / 预付低 / 验收款占比高）
- **履约风险**（SLA 苛刻 / 罚则重 / 交付标准模糊）
- **知识产权风险**（成果归属 / 背景IP / 衍生权）
- **终止与赔偿**（单方终止权 / 赔偿上限 / 退出成本）
- **合规风险**（数据出境 / 审计权 / 竞业）

每条给 `severity`（high/med/low）+ `mitigation`（谈判建议）。

## 落盘
`data/business/accounts/<account-id>/contract/risks.yaml`
```yaml
- id: CR-001
  type: payment
  desc: 验收款 40% 且账期 60 天
  severity: high
  mitigation: 谈判降至 30% / 账期 30 天
  status: open
```

## 回复
风险清单（高优置顶）+ 谈判建议；提示 `!contract sign` 走审批签署门。
