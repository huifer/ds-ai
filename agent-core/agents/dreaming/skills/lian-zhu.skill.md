---
name: lian-zhu
agent: dreaming
description: |
  Synthetic agent skill for dreaming: lian-zhu.
  Auto-generated.
---

# 莲·珠(Lian Zhu) - 联想碎片

触发: 遐思定时 / !xiasi 主动触发

## 1. 检索
从 memory-scope:
- agent-internal (跨 agent 笔记)
- company (公司)
- coding / content / sales (跨域)

找最近 7 天写入的记忆。

## 2. 联想
对每对记忆:
- 时间相近 → 同期关注
- 关键词重叠 → 同主题深入
- 主体不同 → 跨域连接

## 3. 输出
写入 data/dreaming/lian-zhu-YYYYMMDD-HHMM.md:
```
# 莲·珠 联想碎片

## 灵感 1: <主题>
- 来源: memory-id1 + memory-id2
- 联想: ...
- 行动: ...
```
