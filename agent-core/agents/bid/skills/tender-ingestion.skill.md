---
name: tender-ingestion
agent: bid
description: 招标文件解析（需求/资质/截止/评分）
---

# Tender Ingestion（招标解析）

触发：`!bid start <招标文件路径或粘贴文本>`

## 流程
1. 读取/解析招标文件，抽取结构化字段：
   - 项目背景与目标
   - **资质要求**（注册资本/资质证书/案例/团队）
   - **技术要求**（功能 / 性能 / 安全 / 集成）
   - **商务要求**（报价上限 / 付款 / 履约期）
   - **关键时间**（答疑 / 投标 / 开标截止）
   - **评分标准**（技术分 / 商务分 / 价格分权重）
2. 标注我方**短板/不满足项**。

## 落盘（敏感，只写 account 下）
`data/business/accounts/<account-id>/bid/tender-analysis.md`

## 回复
```
📑 招标解析 · <项目名>
资质/技术/商务要求摘要；截止 YYYY-MM-DD；评分 权重
⚠️ 不满足项：...
下一步：!bid compliance 生成合规矩阵
```
## 约束
招标原文、客户信息只存 account 下，不进 index.yaml。
