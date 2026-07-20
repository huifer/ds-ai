---
name: prd-diff
agent: solution
description: 对比项目 PRD 版本差异
---

# PRD Diff（版本差异）

触发：`!prd diff <PRJ-ID>`

## 流程
1. 读 `data/business/projects/<PRJ-ID>/prd.md`，解析文件头 `version`（v0.1 → v1.0）。
2. 对比 v0.1 摘要段与 v1.0 全文，输出：
   - **新增** 需求项
   - **细化** 项（从粗到细）
   - **量化** 项（新增指标/约束）
   - **变更/移除** 项

## 回复
```
📋 <PRJ-ID> PRD 版本差异 (v0.1 → v1.0)
➕ 新增: ...
🔍 细化: ...
📏 量化: ...
🔄 变更: ...
```
若仅存在单一版本，提示「仅 v0.1，先 !prd v1.0」。
