# 长期记忆系统

> 文件系统版（JSON + Markdown）。所有数据**完全在项目目录** `data/memory/`。

## 1. 设计

**目标**：你跟 Pi 在 Discord 对话时，**重要的事实自动沉淀为结构化记忆**。MD 是给"人"看的，JSON 是给"程序"看的。

| 文件 | 谁读 | 谁写 | 何时写 |
|---|---|---|---|
| `data/memory/index.json` | 启动时 LLM 注入 | `upsert/revoke` 时同步 | 每次变更 |
| `data/memory/store/<id>/meta.json` | 程序检索 / dedup / status | `upsert` 整条重写 | 每次变更 |
| `data/memory/store/<id>/content.md` | **人**（你在 VSCode 读、改） | `upsert` 时渲染 | 每次变更 |
| `data/memory/vector/index.json` | 语义检索 | `upsert` 后异步 | 每次 embedding |
| `data/memory/journal/YYYY-MM-DD.jsonl` | LLM 蒸馏 | 持续 append | 每次事件 |
| `data/memory/mirror.json` | mirror 同步 | 每次频道推送 | created/edit/revoke |
| `data/memory/snapshots/` | 备份 | 手工 | 周期备份 |

**关键不变量**：
- `meta.json` 是权威，程序永不解析 MD
- `content.md` 是给人看的，**你可以手动编辑**，下次会被读取
- 写时一起更新，原子（`write tmp + rename`），不完整写入会留下 `*.tmp` 文件
- `index.json` 是缓存，启动时如果不一致就 rebuild

## 2. 目录结构

```
data/memory/
├── index.json                    # 全局轻量索引
├── store/
│   └── mem_<timestamp>_<subject>/
│       ├── meta.json             # 机器读
│       └── content.md            # 人读
├── vector/
│   └── index.json                # 简化 HNSW 索引(brute-force cosine)
├── journal/
│   └── YYYY-MM-DD.jsonl          # 每日对话流
├── mirror.json                   # memory_id -> { channelId, messageId }
└── snapshots/                    # 备份
```

## 3. content.md 格式

```markdown
---
id: mem_1784441290707_ts-vs-js
kind: preference
scope: user
subject: ts-vs-js
tags: [language, stack]
confidence: 0.9
status: active
revision: 2
supersedes: [mem_1784441290707_ts-vs-js]
createdAt: 2026-07-19T06:08:10.707Z
updatedAt: 2026-07-19T06:08:10.808Z
expiresAt: null
source:
  kind: user
  ref: discord:1527
---

# ts-vs-js

新项目默认用 TypeScript。开启 strict 模式，禁用 any。

## 变更记录
- **2026-07-19T06:08:10.707Z** revision 1: 初次建立
- **2026-07-19T06:08:10.808Z** revision 2: 补充禁用 any
```

## 4. 数据模型

每条 memory 一条 meta.json：

```json
{
  "id": "mem_1784441290707_ts-vs-js",
  "kind": "preference",
  "scope": "user",
  "subject": "ts-vs-js",
  "tags": ["language", "stack"],
  "confidence": 0.9,
  "status": "active",
  "revision": 2,
  "supersedes": ["mem_xxx"],
  "source": { "kind": "user", "ref": "discord:1527" },
  "embedding": [0.012, -0.034, ...],
  "createdAt": "2026-07-19T06:08:10.707Z",
  "updatedAt": "2026-07-19T06:08:10.808Z",
  "expiresAt": null
}
```

**身份 = (scope, subject, kind)**：同 (scope, subject, kind) 自动 superseded，revision+1。

**kind 列表**：
- `preference` - 长期偏好
- `fact` - 稳定事实
- `decision` - 设计决定
- `constraint` - 硬约束
- `project` - 项目状态
- `context` - 当前上下文（默认 30 天过期）
- `todo` - 长期待办
- `reflection` - 反思
- `definition` - 命名/术语定义
- `idea` - 灵感
- `build` - 工程结论

## 5. 检索

| 场景 | 方式 |
|---|---|
| LLM 注入 prompt | 读 `index.json` → hybrid 选 top N → 取对应 content.md 头部 |
| 语义搜索 | `vector/index.json` brute-force cosine |
| 关键词搜索 | 文件名 + meta.json + content.md |
| 你在 VSCode 翻看 | `cat data/memory/store/mem_*/content.md` |
| 备份 | `tar czf backup.tgz data/memory/store data/memory/index.json data/memory/vector/` |

## 6. Pi 工具

`extensions/memory-tools.mjs`：

- `memory_upsert({ kind, scope?, subject, content, tags?, expires_at?, confidence? })`
- `memory_query({ kind?, subject?, tags?, contains?, scope?, mode?, limit?, include_superseded? })`
  - `mode`: `hybrid`（默认，FTS + vector RRF） | `text` | `vector` | `recent` | `filter` | `history`
- `memory_revoke({ id?, subject?, scope?, kind?, reason? })`
- `memory_recent({ kind?, limit? })`
- `memory_read({ id })` - 读 content.md 完整内容

## 7. 对话自动捕获 + 蒸馏

**目标**：你**不用**每次手动 `!archive`，日常对话自然产生记忆。

**流程**：

1. `entry-bot` 在 `handleUserMessage` 末尾异步把每条消息、Pi 回复、命令、工具调用写入 `journal/YYYY-MM-DD.jsonl`
2. 每天 23:30 跑一次 `memory-distiller`：
   - 读今天的 journal
   - 喂给 Pi 一次性蒸馏 prompt
   - Pi 返回 0-5 条建议的 memory
   - 对每条调 `memoryStore.upsert`
   - 写一条 summary 到 `#主入口`

## 8. Prompt 注入

`entry-bot` 在 `pi.prompt(userText)` 之前自动注入 `<memory-digest>` 块：

```
<memory-digest>
- [preference] ts-vs-js — 新项目默认用 TypeScript... (rev=2)
- [decision] rpc-arch — Discord 桥用 Pi RPC 模式... (rev=1)
- [fact] project-name — 项目名是 pi-discord-agents。 (rev=1)
</memory-digest>

[Discord 用户 zhangsan 在 #主入口]

（用户原文）
```

**选 N 条逻辑**：
- 候选：包含 userText 关键词的 hybrid 检索 top 20 + 最近 5 条
- 取 top 8，按 score + recency 排序
- 同 subject 取最新 revision
- 默认 kinds：`preference / fact / decision / constraint / project / context / reflection / definition / idea / build`

## 9. Discord 频道镜像

`#记忆库` 是 read mirror，不是 source of truth。每条 memory 对应一条 Discord 消息：
- `upsert` 成功 → 频道新发一条（或 edit 现有消息）
- `upsert` 修订 → 频道原消息 edit（不新发）
- `revoke` → 频道原消息加 ⛔ reaction + 文末加"已撤销: <reason>"

启动时调 `mirror.reconcile()` 修复消息不一致。

## 10. 备份

```bash
# 推荐:直接打包整个 store 和索引(纯文本,可 git diff)
tar czf ~/backup-memory-$(date +%Y%m%d).tgz \
  data/memory/store data/memory/index.json data/memory/vector data/memory/mirror.json

# 恢复
tar xzf backup.tgz -C ~/pi-discord-agents
```

## 11. 你可以手动编辑

最直接的方式：

```bash
# 查看所有 memory
ls data/memory/store/

# 查看某一条
cat data/memory/store/mem_*/content.md

# 手动添加一条（程序不感知，重启后会读取）
mkdir -p data/memory/store/mem_manual_2026-07-19_my-note
$EDITOR data/memory/store/mem_manual_2026-07-19_my-note/content.md
$EDITOR data/memory/store/mem_manual_2026-07-19_my-note/meta.json

# 修改索引（重要）
node -e "const fs=require('fs'); const idx=JSON.parse(fs.readFileSync('data/memory/index.json')); /* edit */ ; fs.writeFileSync('data/memory/index.json', JSON.stringify(idx,null,2))"
```

或者直接：

```bash
code data/memory/  # VSCode 打开
```

VSCode 会识别 `.md` 文件带 frontmatter，并且 `.json` 全部格式化。**完全可以当个人笔记本来用**。

## 12. 测试

```bash
npm test
```

11 个 memory-store 测试覆盖：
- upsert 创建 / 重复 upsert 自动 superseded
- content.md 含 YAML frontmatter 和变更记录
- query 过滤（status / kind / tags）
- revoke by id / by subject
- buildContext 按 userText 选 N 条
- hybrid 查询 FTS + 向量
- partial unique 索引
- stats 准确
- compact 删除 90 天前的 superseded
- index.json 同步状态

## 13. 已知限制

- **brute-force cosine**：1w 条 < 50ms。10w 条 ~500ms。50w+ 建议升级到 HNSW 索引。
- **ollama 不可用时**：自动降级到 FTS-only（无 embedding，但 FTS 仍能工作）。
- **写入不强制事务**：`upsert` 走原子 rename 写，崩溃中间态时 `*.tmp.<pid>` 残留在 store/ 目录，需要手动清理。
- **没集成 entry-bot**：当前只完成 store 层。下一阶段做：daemon 启动 init + journal 写入 + `!memory` 命令 + prompt 注入 + distiller 调度。

## 14. Roadmap

- [ ] `entry-bot` 启动时 init `memoryStore` + `mirror`
- [ ] `handleUserMessage` 注入 `<memory-digest>`
- [ ] `handleArchiveCommand` 改走 store
- [ ] `!memory search/show/forget/recent/stats` 命令
- [ ] `journal` 在 entry-bot 异步 append
- [ ] scheduler 注册 `memory-distill-daily` @ 23:30
- [ ] `!archive` 三类（memory/ideas/build）改走 memory_upsert
- [ ] 实测 Discord 蒸馏
