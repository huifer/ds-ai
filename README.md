# 🤖 pi-discord-bridge

**Discord ↔ Pi Agent (RPC mode) 桥接 daemon** — 单入口对话 + 多频道沉淀 + 7×24 守护 + 每日定时任务。

> v2 架构:用 Pi 官方的 RPC 子进程模式,**不再用 TUI + tmux**。零 `ctx stale`,零 5 次重试,
> 启动从 ~10s 降到 ~200ms,assistant 输出支持流式转发。
>
> v2.1 新增:**RSS Hub** 每天北京时间 12:00 推送 / **每日总结** 每天北京时间 23:00 推送,均由 Pi Agent 自主完成。

---

## 📂 目录结构

```
pi-discord-bridge/
│
├── 🤖 src/                              ← Node daemon 主程序(我们写的)
│   ├── entry-bot.mjs                      主编排:连 Discord + spawn Pi RPC + 事件转发 + 调度器
│   ├── discord-client.mjs                 discord.js 客户端封装工厂(无业务)
│   ├── config.mjs                         .env 解析 + 频道配置
│   ├── scheduler.mjs                      内存 cron 调度器(无依赖,纯 setInterval)
│   └── jobs/
│       ├── rss-daily.mjs                  RSS hub 任务(12:00 北京时间触发)
│       └── daily-summary.mjs              每日总结任务(23:00 北京时间触发)
│
├── 🧩 extensions/                       ← Pi 扩展(被 Pi 子进程加载)
│   ├── discord-tools.mjs                  3 个工具:post_message / archive / send_image(支持分片推送)
│   ├── discord-tools-shared.mjs           cfg 解析 + 懒加载 Discord client
│   └── file-tools.mjs                     2 个工具:write_file / read_file(落本地 md 用)
│
├── 🚀 scripts/                          ← 启动 / 控制 / 测试
│   ├── launch.sh                          launchd 主用
│   ├── dev.sh                             前台跑(调试用)
│   ├── status.sh                          健康度
│   ├── stop.sh                            完整停止
│   ├── smoke-test.mjs                     跳过 Discord,纯 RPC + extension 链路测试
│   ├── create-channels.mjs                一次性:在 Guild 里建 #📰 资讯 + #🌙 每日总结
│   └── trigger-job.mjs                    手动触发 RSS hub 或每日总结(立刻跑一次)
│
├── 📁 legacy/                           ← 旧版本归档(已废弃,参考用)
│   ├── README.md                          废弃原因 / 迁移对照
│   └── v1-discord-entry-bot/             v1 源码(直接调 LLM API 的简化版)
│
├── 📋 logs/                             ← 运行时日志
│   ├── orchestrator.log                   entry-bot + Pi 子进程输出
│   ├── launchd.out.log                    launchd stdout
│   ├── launchd.err.log                    launchd stderr
│   └── trigger.log                        trigger-job 输出
│
├── 📁 sessions/                         ← Pi session jsonl(持久化对话历史)
│
├── 📁 data/                             ← 定时任务产物的本地留底(不进 git)
│   ├── rss/                               每日 RSS hub md(YYYY-MM-DD.md)
│   └── daily-summary/                     每日总结 md
│
├── 🔒 .env                              ← Discord Token + 9 个 channel ID
├── 📝 .env.example                      ← 配置模板
├── 📦 package.json                      ← npm 依赖(discord.js + pi-coding-agent)
│
└── 🔗 links/                           ← Pi Agent 资源 symlink
    ├── auth.json    -> ~/.pi/agent/auth.json         (LLM API keys)
    ├── settings.json -> ~/.pi/agent/settings.json
    ├── models.json  -> ~/.pi/agent/models.json
    ├── skills/      -> ~/.pi/agent/skills/           (lark-* 等)
    ├── npm/         -> ~/.pi/agent/npm/
    ├── git/         -> ~/.pi/agent/git/
    ├── bin/         -> ~/.pi/agent/bin/
    ├── sessions/    -> ~/.pi/agent/sessions/
    └── extensions/  -> ~/.pi/agent/extensions/
```

---

## 🌐 关联文件(本目录之外)

| 路径 | 说明 |
|------|------|
| `~/Library/LaunchAgents/com.zhangsan.pi-discord-agents.plist` | macOS launchd |
| `~/.pi/agent/skills/headless-pi-discord-bridge/SKILL.md` | 复用本架构的规范 |
| `~/summary/profile/`, `~/summary/work/` | RSS hub 的用户画像源 |

---

## 🔧 常用命令

```bash
# --- daemon 控制 ---
~/pi-discord-bridge/scripts/status.sh              # 看健康度、进程、日志
tail -f ~/pi-discord-bridge/logs/orchestrator.log  # 实时日志
~/pi-discord-bridge/scripts/dev.sh                 # 前台跑(开发调试)
~/pi-discord-bridge/scripts/stop.sh                # 完全停止
launchctl kickstart -k "gui/$(id -u)/com.zhangsan.pi-discord-agents"  # 重启
node ~/pi-discord-bridge/scripts/smoke-test.mjs "ping?"  # 不连 Discord,只测 RPC + extension

# --- 一次性频道创建(已经建好可忽略) ---
node ~/pi-discord-bridge/scripts/create-channels.mjs

# --- 手动触发定时任务(跳过等待) ---
node ~/pi-discord-bridge/scripts/trigger-job.mjs rss             # 立刻跑 RSS hub
node ~/pi-discord-bridge/scripts/trigger-job.mjs daily            # 立刻跑每日总结
node ~/pi-discord-bridge/scripts/trigger-job.mjs rss 2026-07-17   # 指定日期
```

---

## 🕒 定时任务(daemon 内置)

| 任务 ID | 触发时间(北京时间) | 内容 | 输出位置 |
|---|---|---|---|
| `rss-daily` | 每天 **12:00** | 读 ~/summary 画像 → web_search 拉取今日资讯 → 整理 md → 推 #📰 资讯 | `data/rss/YYYY-MM-DD.md` + Discord |
| `daily-summary` | 每天 **23:00** | 汇总今天 ~/.workbuddy / .zcode / .pi / .gemini / .kiro / .claude 干了啥 → 推 #🌙 每日总结 | `data/daily-summary/YYYY-MM-DD.md` + Discord |

调度器: `src/scheduler.mjs` —— 无依赖、纯 `setInterval`,30 秒一次 tick;按 `(id, dateKey)` 去重避免重复触发;启动时立即 tick 一次可补跑刚错过的任务(1 小时内的错过)。

---

## 🌐 Discord 频道清单(9 个)

| Channel | 用途 | 自动写入方 |
|---|---|---|
| `#主入口` | 唯一对话位置 | 用户 ↔ Pi 双向 |
| `#🧠 记忆` | 长期偏好 / 原则 | Pi |
| `#✨ 灵感` | idea / hack | Pi |
| `#🔨 工程` | 代码 / 部署 / commit | Pi |
| `#🌿 日记` | 心情 / 反思 | Pi |
| `#📡 发现` | 24/7 信号(路由到这里) | Pi |
| `#🛠 系统` | 告警 / 诊断 | Pi / daemon |
| `#📰 资讯` | **RSS hub 每日推送** | 调度器 → Pi |
| `#🌙 每日总结` | **每日工作总结** | 调度器 → Pi |

---

## 🎯 架构对比

| | v1 (TUI + tmux) ❌ | v2 (RPC) ✅ |
|---|---|---|
| 启动延迟 | ~10s (`script -q` + Pi TUI) | ~200ms |
| `ctx stale` 错误 | 有(session 切换/reload 期间) | **没有**(RPC 设计就是 reload-safe) |
| 5 次重试退避 | 需要(治症状) | 不需要 |
| 流式输出 | 没有(只能"发一次等整段") | **天然支持** (`text_delta` 实时) |
| tmux / 假 TTY | 需要 | 不需要 |
| 与 Pi 进程关系 | extension hook 进 TUI | daemon spawn 子进程 |
| 定时任务 | 需额外 launchd plist | **daemon 内存 cron** |

---

## 🧬 实现要点

### 1. daemon ↔ Pi 通讯:`RpcClient`

```js
import { RpcClient } from '@earendil-works/pi-coding-agent';
const pi = new RpcClient({
  cliPath: '/abs/.../dist/cli.js',
  cwd: '/abs/.../pi-discord-bridge',
  provider: 'minimax-cn',
  model: 'MiniMax-M3',
  env: { DISCORD_TOKEN: cfg.token, CH_ENTRY: cfg.channels.entry, ... },
  args: ['--mode', 'rpc',
         '--extension', '<discord-tools.mjs>',
         '--extension', '<file-tools.mjs>',
         '--session-dir', '<sessions>'],
});
await pi.start();
```

### 2. 事件流:`message_update.text_delta` → `message_end` 整段转发

```js
let buf = '';
let lastFlush = '';
pi.onEvent(ev => {
  if (ev.type === 'message_update' && ev.assistantMessageEvent?.type === 'text_delta') {
    buf += ev.assistantMessageEvent.delta;
  }
  if (ev.type === 'message_end' && ev.message?.role === 'assistant') {
    const text = (ev.message.content ?? [])
      .filter(c => c?.type === 'text').map(c => c.text).join('');
    if (text && text !== lastFlush) {
      lastFlush = text;
      discord.send(channelId, text, originalUserMsg);
    }
  }
});
```

### 3. 工具放 Pi 子进程里

`extensions/discord-tools.mjs` + `extensions/file-tools.mjs` 被 `--extension` 加载,在子进程里执行。
工具自己连 Discord(同 token,Discord 允许多连接),从 env 拿 cfg;路径白名单防止越权写文件。

### 4. 调度器与定时任务

```js
const sched = createScheduler({ log });
sched.register({
  id: 'rss-daily',
  hour: 12, minute: 0, tzOffsetHours: 8,
  run: ({ dateKey }) => pi.prompt(buildRssPrompt({ dateKey })),
});
sched.start();
```

触发时 Pi 用 `read_file` 读画像、`web_search` 拉资讯、`write_file` 落 md、`discord_post_message` 推 Discord。

---

## 👤 你日常怎么用

1. 打开 Discord(网页 `https://discord.com/channels/1527726951425507348` 或客户端)
2. 进你的服务器 **zhangsan**
3. 进 **`#🚪主入口`** 这个频道
4. 像跟朋友聊天一样发消息,Pi 会回话
5. 同时,Pi 会把有价值的部分默默写到对应沉淀频道(`#🧠记忆库 / #✨灵感 / #🔨工程 / #🌿日记`)
6. 每天 12:00 北京时间自动推 `#📰 资讯`,23:00 自动推 `#🌙 每日总结`

不需要 ID、不需要指令前缀,**自然语言就够**。

## ⚠️ Pi Agent 的探索行为(踩过的坑)

**现象**:当 Pi Agent 被赋予任务(如 "拉 RSS")但首选工具失败时,它会在工作目录里**新建源文件**作为替代方案。

**实测**:跑 RSS dry-run 时,web_search / minimax_web_search / web_fetch 全部鉴权失败 → Pi 自己写了
`extensions/gh-tools-shared.mjs` + `extensions/gh-tools.mjs`(GitHub trending 替代方案),
但这俩没被 `--extension` 加载、也没人调用,变成孤儿。

**影响**:
- 工作目录被未知文件污染
- 可能跟现有架构冲突(比如新文件 import 一个旧设计)
- Git 里出现一堆未 review 的"探索代码"

**治理方案**(未实现,记一笔):
- 在 `src/entry-bot.mjs` 的 Pi spawn 前加 `chdir` 到 `drafts/`,让 Pi 的探索产物落到独立目录
- 或在 Pi prompt 里强制说"禁止写文件到 extensions/,如需创建走 drafts/"
- 或用 `chokidar` 监听 extensions/ 有新文件就告警

**当下临时做法**:跑完任务后 `git status --short` 看有没有意外文件,有就 review / 删除。

---

## 🛡️ 安全 / 白名单

- **Discord Token** `.env`,权限 600
- **白名单** `ALLOWED_USER_IDS`,默认只有你(在 `.env` 里)
- 其他用户发消息会被 bot 加 🚫
- **`write_file` 路径白名单**:只允许写到项目内 `data/` 子目录,绝对路径和 `..` 都拒绝
- **Scheduler tick = 30s**,错过任务最多 1 小时内补跑(避免重启时把陈年任务全补了)

---

## 🚧 维护

- **改 `src/` 或 `extensions/`** → `launchctl kickstart -k ...` 重启 daemon
- **改 `.env`** → 同上
- **改 launchd plist(代理端口、Throttle)** → `launchctl unload ... && load ...`
- **转 Discord Token** → `.env` 改 + kickstart
- **加 LLM key** → 写到 `~/.pi/agent/auth.json`(Pi 子进程会自己读)
- **改定时任务时间** → 改 `src/jobs/rss-daily.mjs` 的 `RSS_JOB_SCHEDULE` 或 `src/jobs/daily-summary.mjs` 的 `DAILY_JOB_SCHEDULE`,然后重启 daemon
- **加新定时任务** → 在 `src/jobs/` 加新文件,export 一个 `run*(args)` 函数,再到 `src/entry-bot.mjs` 注册