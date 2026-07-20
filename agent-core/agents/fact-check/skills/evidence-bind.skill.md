---
name: evidence-bind
agent: fact-check
description: |
  Auto-generated skill for fact-check agent.
  事实校验、证据绑定、引用规范。
---

# Evidence Bind（证据绑定）

## 1. 任务
为每个 verified claim 绑定 evidence:
- URL
- 文档 ID
- 内部数据点

## 2. 存储
data/business/evidence/<claim-id>.json:
- claim
- sources (array)
- confidence (0-1)
- verifiedAt
- verifiedBy

## 3. 复用
下次 fact-check 时,优先查 evidence store。
