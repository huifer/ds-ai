---
name: runtime-research
agent: solution
description: PRD 填充时由 Multi-Agent 运行时调用的内部检索 skill
---

# Runtime Research（运行时检索）

> 本 skill 无独立 Discord 命令，由 `prd-v01` / `prd-v10` 在生成 PRD 时调用，
> 对应 CONTEXT.md 中「Research Agent + Knowledge Agent 在运行时检索行业现状、玩家、趋势后填充 PRD」。

## 调用契约
入参：`{ industry, topics: [...], project?: PRJ-ID }`

## 流程
1. 读 `agent-core/enterprise/industries/<industry>/` 下既有材料（prd-template、demo-case）。
2. 读 `data/business/research/*.md` 中与 topics 相关的已核验结论。
3. 按 topics 聚合输出结构化要点（现状 / 玩家 / 趋势 / 数据），每条标注来源或 `推断`。
4. 返回给 PRD 生成流程作为填充素材。

## 约束
- 只返回可追溯要点；未核验的明确标 `推断`。
- 不臆造玩家名称与数据。
