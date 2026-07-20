---
name: prd-v10
agent: solution
description: PRD 细化到 v1.0（详细功能、数据模型、接口、验收）
---

# PRD v1.0（产品需求文档细化版）

触发：`!prd v1.0 <PRJ-ID>`

## 前置
`data/business/projects/<PRJ-ID>/prd.md` 已存在 v0.1（先 `!prd v0.1`）。

## 流程
1. 读现有 PRD v0.1 与 discovery / research。
2. 细化：
   - 每个功能展开为详细需求（输入/处理/输出/异常）
   - 补充**数据模型**（核心实体与字段）
   - 补充**接口契约**（关键 API 端点 / 事件）
   - 细化**验收标准**（可测试）
   - 非功能需求量化（性能、安全、可用性）
3. 落盘 `data/business/projects/<PRJ-ID>/prd.md`，更新文件头 `version: v1.0`，保留 v0.1 摘要段（供 `!prd diff` 对比）。

## 回复
v1.0 关键变化摘要（新增/细化/量化项），提示 `!pm plan <PRJ-ID>`。
