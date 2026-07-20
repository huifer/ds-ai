---
name: bid-package
agent: bid
description: 标书组装（无独立命令，内部组装）
---

# Bid Package（标书组装）

> 内部 skill，无独立命令。由合规矩阵完成后组装标书结构，供 `!bid submit` 使用。

## 调用契约
入参：`{ prjId }`（聚合 tender-analysis + compliance-matrix + quote）

## 流程
组装标书章节：
1. 投标函 / 授权书
2. 公司资质与案例（ Founder Evidence Library 引证）
3. 技术方案（引用 PRD + 行业 demo-case）
4. 项目实施计划（引用 pm/plan）
5. 商务报价（引用 quote）
6. 服务与售后（引用 cs 承诺）

## 落盘
`data/business/accounts/<account-id>/bid/bid-package.md`

## 返回
标书大纲 + 各章节来源引用；提示 `!bid submit` 走审批门。
