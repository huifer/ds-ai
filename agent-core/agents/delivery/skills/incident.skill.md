---
name: incident
agent: delivery
description: 线上事件记录与响应
---

# Incident（线上事件）

触发：`!incident <事件描述>`（通配路由，任意 sub）

## 流程
1. 登记 `INC-YYYYMMDD-NN`。
2. 结构化记录：
   - **影响**（受影响客户 / 功能 / 持续时间 / 严重度 P0-P3）
   - **现象与时间线**
   - **根因**（初步 / 复盘结论）
   - **处置**（缓解 / 恢复动作）
   - **复盘**（改进项 / 责任人 / 截止）
3. P0/P1 触发紧急通知建议。

## 落盘
`data/business/accounts/<account-id>/incident/INC-YYYYMMDD-NN.md`（account 未知时暂存 `data/business/incidents/`）

## 回复
事件编号 + 严重度 + 当前状态 + 下一步；提示更新 runbook 防复发。
