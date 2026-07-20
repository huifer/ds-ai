---
name: weekly-report
agent: pm
description: 项目周报
---

# Weekly Report（项目周报）

触发：`!pm weekly <PRJ-ID>`

## 流程
1. 读项目 `plan.md`、`raid.yaml`、`prd.md`，及 `data/business/projects/<PRJ-ID>/weekly/` 历史。
2. 生成本周周报：
   - **本周进展**（对照 plan 里程碑）
   - **下周计划**
   - **风险与阻塞**（引用 RAID）
   - **指标**（阶段完成度 / 任务完成率）
3. 落盘 `data/business/projects/<PRJ-ID>/weekly/<YYYY-WW>.md`（YYYY-WW 为 ISO 周）。

## 回复
周报正文（结构化），可直接贴 Discord。
