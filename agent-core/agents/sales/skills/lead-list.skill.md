---
name: lead-list
agent: sales
description: 列出所有销售线索
---

# Lead List（线索清单）

触发：`!lead list`。

## 流程
1. 用 bash 工具读取 `data/business/leads/*.json`（目录不存在或为空 → 回复「暂无线索，用 !lead new 录入」）。
2. 解析每个 JSON，按 `createdAt` 倒序排列。
3. 表格输出：ID · 公司 · 行业 · 阶段 · 创建日。

## 输出格式
```
📋 销售线索（共 N 条）

| ID | 公司 | 行业 | 阶段 | 创建 |
|---|---|---|---|---|
| LEAD-20260719-3880 | Acme | SaaS | new | 07-19 |
| ... |
```
末尾提示高频操作：`!lead qualify <ID>` / `!disc start <ID>`。
