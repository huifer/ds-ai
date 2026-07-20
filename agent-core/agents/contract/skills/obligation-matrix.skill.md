---
name: obligation-matrix
agent: contract
description: 履约义务矩阵（无独立命令，内部提取）
---

# Obligation Matrix（履约义务矩阵）

> 内部 skill，无独立命令。签约后供 pm/delivery 跟踪履约义务。

## 调用契约
入参：`{ accountId 或 prjId }`（读 contract/summary.md）

## 流程
从合同摘要提取**履约义务矩阵**，每条：
- 义务内容
- 责任方（我方 / 客户 / 第三方）
- 触发条件
- 期限 / 节点
- 违约后果
- 关联交付物

## 落盘
`data/business/accounts/<account-id>/contract/obligations.yaml`

## 返回
义务清单，按责任方分组；移交 pm 纳入项目计划、delivery 纳入交付检查。
## 约束
义务涉及金额/客户只存 account 下。
