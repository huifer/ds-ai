---
name: memory-read
agent: chief
description: 读取记忆库摘要
---

# Memory Read（记忆库摘要）

触发：`!memory`

## 流程
读取 `data/memory/` 记忆库并摘要：
1. **index.json** — 记忆条目总数、scopes 分布。
2. **store/** — 近期记忆条目（按时间倒序，取若干条标题 + scope）。
3. **journal/** — 最近记忆写入日志。
4. **snapshots/** — 快照数量与最近一次时间。

## 回复
```
🧠 记忆库摘要
条目 N · scopes: content / agent-internal / ...
近期：[content] xxx · [agent-internal] yyy
最近快照：YYYY-MM-DD
```
## 备注
memoryStore 由 entry-bot 的 `createMemoryStore({rootDir})` 创建，数据持久化在 `data/memory/`，Pi RPC 子进程可直接读取这些文件。
