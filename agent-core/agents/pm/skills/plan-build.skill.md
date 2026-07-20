---
name: plan-build
agent: pm
description: 基于 PRD 生成项目计划与里程碑
---

# Plan Build（项目计划）

触发：`!pm plan <PRJ-ID>`

## 前置
`data/business/projects/<PRJ-ID>/prd.md` 已存在（先 `!prd v0.1`）。

## 流程
1. 读 PRD（v0.1 或 v1.0）。
2. 按 **FDE Project Pipeline** 拆解（参考 CONTEXT.md）：
   - Stage 1 · Project Setup（目录 / index / 资料整理 / knowledge-pack / PRD v0.1）
   - Stage 2 · React Demo（Vite+TS+React Router+Tailwind v4+shadcn/ui+TanStack Query+MSW）
   - Stage 3 · 算法预研（独立小任务）
   - Stage 4 · R&D 主链
3. 每个 Stage 列：里程碑、任务、依赖、建议负责人、时间窗口。
4. 落盘 `data/business/projects/<PRJ-ID>/plan.md`。

## 回复
计划摘要（4 阶段 × 里程碑），提示 `!pm risk <PRJ-ID>` 登记 RAID、`!build stage <PRJ-ID>` 推进阶段。
