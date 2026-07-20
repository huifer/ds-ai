---
name: poc-plan
agent: delivery
description: POC 计划（目标/范围/验证点/时间线）
---

# POC Plan（POC 计划）

触发：`!poc start <PRJ-ID>`

## 流程
1. 读 PRD（`accounts/<account>/projects/<PRJ>/prd.md`）+ 项目计划。
2. 规划 POC：
   - **目标**：验证什么核心假设 / 关键技术可行性
   - **范围**：纳入 / 明确排除的功能
   - **技术验证点**（参考 CONTEXT.md FDE Stage 2/3：React Demo + 算法预研）
   - **时间线**与里程碑（POC 通常 1-3 周）
   - **成功标准**（可量化）
   - **资源**（人 / 环境 / 数据）
3. 标注与正式交付的差异（POC 用 MSW mock，不接真实后端）。

## 落盘
`data/business/accounts/<account-id>/projects/<PRJ-ID>/delivery/poc-plan.md`

## 回复
POC 计划摘要；提示 POC 完成后 `!poc deploy`（需 prod-deploy 审批）或回到 `!build stage` 推进。
## 约束（CONTEXT.md）
POC/Demo 阶段**禁止**接入真实后端。
