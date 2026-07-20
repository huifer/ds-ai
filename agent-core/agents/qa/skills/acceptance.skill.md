---
name: acceptance
agent: qa
description: 验收测试（对照合同交付物与 PRD 验收标准）
---

# Acceptance（验收测试）

触发：`!qa accept <PRJ-ID>`

## 前置
- PRD 验收标准（`accounts/<account>/projects/<PRJ>/prd.md`）
- 合同交付物（`accounts/<account>/contract/summary.md`）
- 测试计划（`accounts/<account>/projects/<PRJ>/qa/test-plan.md`，先 `!qa plan`）

## 流程
1. 逐项核对**验收标准**与**交付物**：
   - ✅ 通过 / 🟡 有条件通过（列遗留项）/ ❌ 不通过（列缺陷）
2. 汇总验收结论，关联未关闭缺陷（`!qa defect`）。
3. 给出是否可进入交付/上线建议。

## 落盘
`data/business/accounts/<account-id>/projects/<PRJ-ID>/qa/acceptance.md`

## 回复
验收结论（通过率 / 遗留项 / 风险）；供 delivery 与客户验收会使用。
