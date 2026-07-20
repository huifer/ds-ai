---
name: stage-gate
agent: pm
description: FDE 项目阶段门控（推进 / 检查阶段产出）
---

# Stage Gate（阶段门控）

触发：`!build stage <PRJ-ID>`（查看当前阶段）/ `!build stage <PRJ-ID> next`（推进到下一阶段）

## FDE 阶段（CONTEXT.md）
- **setup** Project Setup：目录 + index + 资料整理 + knowledge-pack + PRD v0.1
- **demo** React Demo：Vite+TS+React Router+Tailwind v4+shadcn/ui+TanStack Query+MSW
- **algo** 算法预研：独立小任务、可被研发复用
- **rnd** R&D 主链：标准研发流程

## 流程
1. 读 `index.yaml` 取当前 `stage`。
2. **next** 前检查当前阶段产出（gate）：
   - setup → demo：要求 `prd.md` 存在（v0.1+）
   - demo → algo：要求 React Demo 产物（仓库/目录）
   - algo → rnd：要求预研结论
   产出缺失 → 拒绝推进并列出缺失项。
3. 通过则更新 `index.yaml` 的 `stage`，记录 `stageHistory`。

## 约束（CONTEXT.md）
- Demo 阶段**禁止**接入真实后端。
- **禁止**跳过 knowledge-pack 直接写 PRD。

## 回复
当前阶段 + 产出检查结果 + （推进时）新阶段与下一步。
