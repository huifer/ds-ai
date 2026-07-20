---
name: prd-v01
agent: solution
description: 基于行业模板 + 调研生成 PRD v0.1
---

# PRD v0.1（产品需求文档初版）

触发：`!prd v0.1 <PRJ-ID>`

## 前置（缺则提示先做）
- 项目存在于 `data/business/projects/index.yaml`（先 `!pr new`）
- 有需求发现 `data/business/discovery/<关联LEAD>.md`（先 `!disc start`）

## 流程
1. 读 `data/business/projects/index.yaml` 取 `<PRJ-ID>` 的 **行业** 与关联线索。
2. 读行业模板 `agent-core/enterprise/industries/<行业>/prd-template.md`。
   - 模板缺失 → 用通用 PRD 结构，并在文档标注「行业模板缺失，需补 `agent-core/enterprise/industries/<行业>/prd-template.md`」。
3. 读 `data/business/discovery/<LEAD-ID>.md` + `data/business/research/*.md` 作填充素材。
4. 填充生成 PRD（目标、范围、用户故事、功能列表、非功能需求、约束、验收标准）。
5. 落盘 `data/business/projects/<PRJ-ID>/prd.md`，文件头标注 `version: v0.1` 与生成时间。

## 约束（来自 CONTEXT.md）
- **禁止**跨行业复用空白模板；必须基于 discovery + research 填充。
- **禁止**跳过 knowledge 直接写 PRD。

## 回复
PRD v0.1 摘要（目标 / 核心功能 / 行业），提示 `!prd v1.0 <PRJ-ID>` 细化或 `!pm plan <PRJ-ID>` 出计划。
