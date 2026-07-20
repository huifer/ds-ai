---
name: raid
agent: pm
description: RAID 登记（Risks / Assumptions / Issues / Dependencies）
---

# RAID（风险与依赖登记）

触发：`!pm risk <PRJ-ID>`（查看）/ `!pm risk <PRJ-ID> add <类型> <描述>`（新增）

类型：`risk` 风险 / `assumption` 假设 / `issue` 问题 / `dependency` 依赖。

## 流程
1. 读写 `data/business/projects/<PRJ-ID>/raid.yaml`（不存在则创建）。
2. `add` 时追加条目：
```yaml
- id: R-001
  type: risk
  desc: ...
  severity: high|med|low
  mitigation: ...
  status: open
  createdAt: <ISO>
```
3. 查看时按类型分组输出，高严重度置顶。

## 回复
```
⚠️ <PRJ-ID> RAID（风险 N / 假设 N / 问题 N / 依赖 N）
[高] R-001 ... → 缓解: ...
[中] I-002 ...
```
