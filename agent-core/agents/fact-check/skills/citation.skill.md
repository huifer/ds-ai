---
name: citation
agent: fact-check
description: |
  Auto-generated skill for fact-check agent.
  事实校验、证据绑定、引用规范。
---

# Citation（引用规范）

## 1. 格式
- 数字来源: [数据](url "来源名称, YYYY-MM-DD")
- 引述: > "原文" — 来源
- 内部: [内部数据: memory-id]

## 2. 检查
- 是否每条 claim 都有引用
- 引用是否可达(URL 不死链)
- 引用是否最新(< 1 年)

## 3. 自动补充
对没有引用的 claim,标记 neededCitation: true。
