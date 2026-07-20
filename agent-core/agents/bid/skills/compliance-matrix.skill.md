---
name: compliance-matrix
agent: bid
description: 合规矩阵（逐条应答招标要求）
---

# Compliance Matrix（合规矩阵）

触发：`!bid compliance <PRJ-ID 或 tender>`

## 前置
`accounts/<account>/bid/tender-analysis.md` 已存在（先 `!bid start`）。

## 流程
1. 读 tender-analysis 的逐条要求。
2. 对照我方能力逐条应答：`✅ 满足` / `🟡 部分`（给方案）/ `❌ 偏离`（给替代）。
3. 统计应答率，列出偏离项与缓解策略。

## 落盘
`data/business/accounts/<account-id>/bid/compliance-matrix.md`

## 回复
```
✅ 合规矩阵 · 应答 N 条
满足 X / 部分 Y / 偏离 Z
偏离项：... → 缓解：...
下一步：组装标书；!bid submit 提交 #审批中心 审批
```
## 约束
`!bid submit` 触发审批门（approval: bid-submit），未经审批不得提交。
