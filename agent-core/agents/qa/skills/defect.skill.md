---
name: defect
agent: qa
description: 缺陷管理（登记 / 跟踪 / 优先级 / 回归）
---

# Defect（缺陷管理）

触发：
- `!qa defect <PRJ-ID> add <描述>` — 登记缺陷
- `!qa defect <PRJ-ID>` — 查看缺陷清单

## 流程
1. 读写 `accounts/<account>/projects/<PRJ>/qa/defects.yaml`（不存在则创建）。
2. `add` 时登记：
```yaml
- id: DEF-001
  title: ...
  severity: P0|P1|P2|P3
  priority: high|med|low
  status: open|in-progress|resolved|closed
  module: ...
  assignee: ...
  foundAt: <验收/测试阶段>
  createdAt: <ISO>
```
3. 查看时按 severity 排序，统计 open/resolved。

## 回复
```
🐛 <PRJ-ID> 缺陷（open N / resolved N）
[P0] DEF-001 ... → assignee ...
```
缺陷关闭是 `acceptance` 通过的前置。
