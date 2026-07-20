---
name: case-study
agent: cs
description: 案例研究（无独立命令，营销素材前置）
---

# Case Study（案例研究）

> 内部 skill，无独立命令。由 marketing / content 流程需要客户案例时调用，依赖 knowledge-redact 先完成脱敏。

## 调用契约
入参：`{ accountId }`（须已脱敏）

## 流程
1. 读 `accounts/<account>/cs/case-redacted.md`（无则提示先 `!cs document` 脱敏）。
2. 撰写案例研究（全部基于脱敏内容）：
   - 背景与挑战
   - 方案（引用 PRD / 行业方案）
   - 实施与交付
   - 成果（量化，脱敏）
   - 客户证言（须客户授权，无则标「待授权」）

## 落盘
`agent-core/enterprise/case-studies/<slug>.md`（脱敏产物，可供公开内容引用）

## 约束（CONTEXT.md）
- 严禁使用未脱敏客户信息。
- 客户证言须有授权证据；未授权不得公开。
- 量化数据须可追溯，不得臆造。
