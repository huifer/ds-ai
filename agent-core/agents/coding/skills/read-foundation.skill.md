---
name: read-foundation
description: |
  Use this skill at the start of every coding task.
  Reads company, founder, and project context to keep design consistent.
---

# 1. 必读

- `CONTEXT.md`（公司术语）；
- `profile/founder-profile.md`（杭州 OPC 张三 + Zenbuild 双品牌）；
- `data/business/projects/index.yaml`（项目索引）；
- 目标项目的 `data/business/accounts/<id>/projects/<PRJ-ID>/`（brief / knowledge-pack / prd / research）。

# 2. 输出

- `agent_id`
- `prj_id`
- `industry`
- `style_hint`（从 industry 模板与 brief 推断）
- `routes_plan`
- `components_plan`

# 3. 失败回退

- 基础文件缺失 → 提示 `solution-agent` 走 Stage 1；
- 行业模板缺失 → 用 `industries/generic/` 兜底。
