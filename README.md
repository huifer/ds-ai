# 🤖 pi-discord-agents

**Discord ↔ Pi Agent (RPC mode) 桥接 daemon** — 单入口对话 + 多频道沉淀 + 长期记忆 + 7×24 守护 + 每日定时任务。

> v2 架构:用 Pi 官方的 RPC 子进程模式,**不再用 TUI + tmux**。零 `ctx stale`,零 5 次重试,
> 启动从 ~10s 降到 ~200ms,assistant 输出支持流式转发。
>
> v2.2 新增:**长期记忆系统** + **机会发现** + **记忆蒸馏** + **记忆治理**
>
> v3.0 规划:**记忆2.0** + **Loop Agent** + **做梦增强(好梦机制)** + **OPC优化**
> 详见: [`docs/OPC_MEMORY_AND_LOOP_AGENT_DESIGN.md`](docs/OPC_MEMORY_AND_LOOP_AGENT_DESIGN.md)
> 遐思增强详细方案: [`docs/XIASI_ENHANCEMENT_PLAN.md`](docs/XIASI_ENHANCEMENT_PLAN.md)

---

## ✨ 核心功能

### 1️⃣ Discord ↔ Pi Agent 桥接
- **流式对话**: Discord 消息实时转发给 Pi，支持打字机式输出
- **单入口设计**: 所有对话从 `#主入口` 发起，自动分类沉淀
- **零延迟启动**: ~200ms 启动，无 TUI/tmux 开销
- **稳定可靠**: RPC 模式天然 reload-safe，零 ctx stale 错误

### 2️⃣ 多频道知识管理 (按分类组织)

#### 📢 用户对话频道
| 频道 | 用途 |
|------|------|
| `#主入口` | 唯一的人机对话入口，所有消息发到这里 |

#### 🧠 长期沉淀频道（记忆系统）
| 频道 | 用途 | 自动化 |
|------|------|--------|
| `#记忆库` | 长期事实、偏好、决策、约束 | 记忆蒸馏自动归档 |
| `#灵感` | 创意、点子、实验方向 | `!archive ideas` / 机会发现 |
| `#工程` | 技术结论、代码决策、部署记录 | `!archive build` |

#### 🔍 发现与调研频道
| 频道 | 用途 | 触发方式 |
|------|------|--------|
| `#机会` | 机会发现调研 brief（含历史 Discover） | `!opportunity <topic>` 手动触发 |

#### 📊 自动化报告频道
| 频道 | 用途 | 自动触发时间 |
|------|------|--------|
| `#资讯` | RSS 资讯日报（42 个源） | 每天 12:00 |
| `#每日总结` | 多 Agent 工作总结 | 每天 23:00 |
| `#每日任务` | GitHub Issue 待办清单 | 每天 10:00 |
| `#用量` | Token 使用量报告 + 可视化 | 每天 12:30 |

#### 🛠 系统与诊断频道
| 频道 | 用途 | 触发方式 |
|------|------|--------|
| `#系统` | 告警、诊断、降级输出 | 系统自动推送 |

### 3️⃣ 长期记忆系统
- **自动蒸馏**: 每天 23:30 从对话中提取 0-5 条记忆
- **多模态存储**: JSON（机器读）+ Markdown（人读）
- **智能检索**: 语义搜索 + 关键词搜索 + 混合检索
- **自动治理**: 每周自动清理过期记忆、归档低置信度记忆
- **质量保障**: 置信度评分、去重合并、矛盾检测
- **Discord 镜像**: 每条记忆同步到 `#记忆库` 频道
- **Prompt 注入**: 对话时自动注入相关记忆上下文

### 4️⃣ 定时任务系统
| 任务 | 时间 | 说明 |
|------|------|------|
| `gh-todo-daily` | 10:00 | GitHub 仓库监控 Issue 待办 |
| `rss-daily` | 12:00 | RSS 资讯日报（42 个源） |
| `token-usage` | 12:30 | Token 用量统计 + 可视化 |
| `daily-summary` | 23:00 | 每日工作总结 |
| `distillation-daily` | 23:30 | 记忆蒸馏 |
| `memory-governance-weekly` | 周日 02:00 | 记忆治理（过期/归档/删除） |
| `memory-quality-weekly` | 周日 03:00 | 置信度更新 + 质量报告 |

### 5️⃣ 机会发现系统
- **多源采集**: HN Algolia / GitHub / 中文 RSS / Reddit
- **智能聚类**: AI 聚类 + 合成 + 写 brief
- **结构化输出**: 5 个 cluster + SaaS/App 创业灵感
- **灵活触发**: `!opportunity <topic>` 手动触发

### 6️⃣ Connection 系统（第三方服务接入）
- **统一接入**: Strava / Notion / RescueTime / Garmin / HealthKit 等
- **OAuth 授权**: 安全的标准 OAuth 2.0 流程
- **自动刷新**: Token 过期自动刷新，无需手动操作
- **统一查询**: `!connection <add|list|status|sync|remove>`
- **数据查询**: `!connection query <service> <type> [params]`

#### 🚴 Strava 集成
```bash
# 查看已连接服务
!connection list

# 添加 Strava
!connection add strava

# 查看状态
!connection status strava

# 查询数据
!connection query strava recent 10       # 最近 10 次活动
!connection query strava stats weekly   # 本周统计
!connection query strava stats monthly # 本月统计

# 同步数据
!connection sync strava
```

详细文档: [`docs/CONNECTIONS_README.md`](docs/CONNECTIONS_README.md)

### 7️⃣ GitHub 仓库监控
- **监控池管理**: `!watch add/remove/list` 管理仓库
- **自动生成**: 每天 10:00 生成未评论 Issue 待办
- **直接推送**: 推送到 `#每日任务` 频道

### 8️⃣ 命令系统
- `!help` - 显示所有命令
- `!watch` - GitHub 仓库监控
- `!archive` - 显式知识归档
- `!usage` - Token 用量查询
- `!distill` - 手动触发记忆蒸馏
- `!memory` - 记忆管理（查询/统计/清理）
- `!opportunity` - 机会发现调研
- `!connection` - 第三方服务连接管理

### 9️⃣ 遐思梦境系统 (Xiasi)
- **三阶段流水线**: Light → REM → Deep
- **四种梦**: 连珠(自由联想) / 归藏(抽象巩固) / 明台(主题沉思) / 预言(反事实)
- **5 信号评分**: 新颖性 / 连贯性 / 实用性 / 扎根度 / 惊喜度
- **影子试用**: AI 对比候选洞察的价值
- **Discord 投票**: 👍👎⭐ + 归档
- **周报/月报**: 主题云 + 关系图
- **好梦机制(v3)**: 自动区分正向/负向洞察
- **噩梦干预(v3)**: 负面联想自动干预和替换
- **预言模式(v3)**: yu-yan 反事实推理和情景模拟
- **梦境→记忆(v3)**: 高分产物自动沉淀到记忆系统

### 🔟 Agent Team 系统 (v1.0)
- **25 个真实 Agent**: 从 registry.json 加载 + 115 个 Skill
- **Session 隔离**: 6 维度 (channel, user, project, task, intent, agent) 独立上下文
- **自动压缩**: 轮次/token/时间三种触发
- **Team 引擎**: 多 Agent 串行/并行/层级/扇出收集协作
- **Subagent 管理**: 生命周期、资源限制、自动清理
- **预定义模板**: 开发团队 / 销售团队 / 内容团队
- **Memory 四层**: Session → AgentScope → SharedScope → KnowledgeBase

---

## 📂 目录结构

```
pi-discord-agents/
│
├── 🤖 src/                              ← Node daemon 主程序(我们写的)
│   ├── entry-bot.mjs                      主编排:连 Discord + spawn Pi RPC + 事件转发 + 调度器
│   ├── discord-client.mjs                 discord.js 客户端封装工厂(无业务)
│   ├── config.mjs                         .env 解析 + 频道配置
│   ├── scheduler.mjs                      内存 cron 调度器(无依赖,纯 setInterval)
│   ├── gh-watch.mjs                        GitHub 仓库监控池读写 + !watch 共用逻辑
│   ├── memory-*.mjs                        长期记忆系统(store/distiller/mirror/context/governance/quality)
│   ├── embedder.mjs                        语义 embedding(用于记忆检索)
│   ├── rss-fetcher.mjs                     RSS 抓取器
│   ├── storage.mjs                         本地存储(credentials等)
│   ├── dreaming/                          遐思梦境系统(store/distiller/mirror/context/governance/quality)
│   ├── connections/                       ← 第三方服务连接管理
│   │   ├── base.mjs                       Connection 基类
│   │   ├── manager.mjs                    Connection 管理器
│   │   ├── strava.mjs                     Strava 连接器
│   │   └── index.mjs                      统一导出
│   └── jobs/
│       ├── rss-daily.mjs              RSS hub 任务(12:00 北京时间触发)
│       ├── daily-summary.mjs          每日总结任务(23:00 北京时间触发)
│       ├── token-usage.mjs            Token 用量任务(12:30 北京时间触发)
│       └── opportunity.mjs            机会发现 brief 生成
│   ├── connections/                       ← 第三方服务连接管理
│   │   ├── base.mjs                       Connection 基类
│   │   ├── manager.mjs                    Connection 管理器
│   │   ├── strava.mjs                     Strava 连接器
│   │   └── index.mjs                      统一导出
│   └── jobs/
│       ├── rss-daily.mjs              RSS hub 任务(12:00 北京时间触发)
│       ├── daily-summary.mjs          每日总结任务(23:00 北京时间触发)
│       ├── token-usage.mjs            Token 用量任务(12:30 北京时间触发)
│       └── opportunity.mjs            机会发现 brief 生成
│
├── 🧩 extensions/                       ← Pi 扩展(被 Pi 子进程加载)
│   ├── discord-tools.mjs                  频道发送 / 知识归档 / 发图工具
│   ├── discord-tools-shared.mjs           全部频道映射 + 懒加载 Discord client
│   └── file-tools.mjs                     2 个工具:write_file / read_file(落本地 md 用)
│
├── 🚀 scripts/                          ← 启动 / 控制 / 测试
│   ├── launch.sh                          launchd 主用
│   ├── dev.sh                             前台跑(调试用)
│   ├── status.sh                          健康度
│   ├── stop.sh                            完整停止
│   ├── smoke-test.mjs                     跳过 Discord,纯 RPC + extension 链路测试
│   ├── create-channels.mjs                一次性:在 Guild 里建 #📰 资讯 + #🌙 每日总结
│   ├── trigger-job.mjs                    手动触发 RSS hub 或每日总结(立刻跑一次)
│   ├── connection-cli.mjs                 Connection CLI 工具
│   ├── connection-server.mjs              OAuth 回调服务器
│   └── connection-quickstart.mjs          Connection 快速开始向导
│
├── 🧪 test/                            ← Node 内置测试(频道路由 / GitHub 监控池)
│   ├── channel-routing.test.mjs           显式频道类别路由测试
│   └── gh-watch.test.mjs                  监控池读写和校验测试
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
│   ├── daily-summary/                     每日总结 md
│   ├── token-usage/                       Token 用量报告(md/png/svg)
│   ├── gh/                                GitHub Issue 待办
│   ├── memory/                            长期记忆(store/journal/vector/mirror)
│   ├── opportunity/                       机会发现 brief
│   └── dreams/                            遐思梦境产物
│
├── 🔒 .env                              ← Discord Token + 10 个 channel ID
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
~/pi-discord-agents/scripts/status.sh              # 看健康度、进程、日志
tail -f ~/pi-discord-agents/logs/orchestrator.log  # 实时日志
~/pi-discord-agents/scripts/dev.sh                 # 前台跑(开发调试)
~/pi-discord-agents/scripts/stop.sh                # 完全停止
launchctl kickstart -k "gui/$(id -u)/com.zhangsan.pi-discord-agents"  # 重启
node ~/pi-discord-agents/scripts/smoke-test.mjs "ping?"  # 不连 Discord,只测 RPC + extension
npm test                                                   # 频道路由 / 监控池单元测试

# --- 主入口命令(在 Discord #主入口 发送) ---
!watch list
!watch add owner/repo
!watch remove owner/repo
!archive memory 这是一个长期偏好
!archive ideas 这是一个值得验证的点子
!archive build 技术方案已确认
!memory search TypeScript 新项目用什么
!memory forget ts-vs-js 改主意
!usage / !usage today / !usage model
!trend 7                                                # 兼容旧命令

# --- 长期记忆系统(依赖 MongoDB 容器)---
bash scripts/memory-start-mongo.sh                     # 启动 pi-memory-mongo 容器(数据在 data/memory/mongo)
bash scripts/memory-status-mongo.sh                    # 健康检查
node scripts/memory-migrate.mjs                        # 把 #记忆库 现有消息导入 MongoDB store
npm test                                                # memory-store + mirror + channel-routing + gh-watch

# --- 一次性频道创建 ---
node ~/pi-discord-agents/scripts/create-channels.mjs           # 资讯 / 每日总结 频道
node ~/pi-discord-agents/scripts/create-opportunity-channel.mjs # 💡 机会 频道

# --- 手动触发定时任务(跳过等待) ---
node ~/pi-discord-agents/scripts/trigger-job.mjs rss             # 立刻跑 RSS hub → #资讯
node ~/pi-discord-agents/scripts/trigger-job.mjs daily           # 立刻跑每日总结 → #每日总结
node ~/pi-discord-agents/scripts/trigger-job.mjs usage 14        # 立刻跑 Token 用量 → #用量
node ~/pi-discord-agents/scripts/trigger-job.mjs rss 2026-07-17 # 指定日期

# --- 偶发机会发现(取代旧的 !discover) ---
node ~/pi-discord-agents/scripts/trigger-job.mjs opportunity "AI coding agents"  # 默认推 #💡 机会
node ~/pi-discord-agents/scripts/trigger-job.mjs opportunity "Cursor vs Codex" build  # 推 #🔨 工程
node ~/pi-discord-agents/scripts/trigger-job.mjs discover "topic"   # 兼容旧名
```

---

## 🕒 定时任务(daemon 内置)

| 任务 ID | 触发时间(北京时间) | 内容 | 输出位置 |
|---|---|---|---|
| `rss-daily` | 每天 **12:00** | 读取用户画像 + RSS 源，整理行业资讯 | `data/rss/YYYY-MM-DD.md` + `#资讯` |
| `token-usage` | 每天 **12:30** | ccusage + 本地 session 统计 Token、cost，生成 PNG + Markdown | `data/token-usage/YYYY-MM-DD.*` + `#用量` |
| `gh-todo-daily` | 每天 **10:00** | 读取 GitHub 仓库监控池，生成未评论 issue 待办 | `data/gh/YYYY-MM-DD.md` + `#每日任务` |
| `daily-summary` | 每天 **23:00** | 汇总多个 Agent 当天工作、决定、阻塞和新坑 | `data/daily-summary/YYYY-MM-DD.md` + `#每日总结` |

调度器: `src/scheduler.mjs` —— 无依赖、纯 `setInterval`,30 秒一次 tick;按 `(id, dateKey)` 去重避免重复触发;启动时立即 tick 一次可补跑刚错过的任务(1 小时内的错过)。当前 daemon 注册 4 个任务: `gh-todo-daily`、`rss-daily`、`token-usage`、`daily-summary`。

---

## 🌐 Discord 频道清单(按分类组织)

### 📢 用户对话频道
| Channel | Channel ID | 用途 | 代码交互 |
|---|---:|---|---|
| `#主入口` | `1527730710410956841` | 唯一用户对话入口、命令入口 | `entry-bot` 接收/回复 |

### 🧠 长期沉淀频道（记忆系统）
| Channel | Channel ID | 用途 | 代码交互 |
|---|---:|---|---|
| `#记忆库` | `1527730714626490480` | 长期事实、偏好、决策、约束 | `archive(memory)` / `post(memory)` / 记忆蒸馏自动归档 |
| `#灵感` | `1527730719286235296` | 产品想法、点子、实验方向 | `archive(ideas)` / `post(ideas)` |
| `#工程` | `1527730722914304121` | 代码、部署、Bug、架构和配置决策 | `archive(build)` / `post(build)` |

### 🔍 发现与调研频道
| Channel | Channel ID | 用途 | 代码交互 |
|---|---:|---|---|
| `#机会` | `1527730730418044991` | 历史 Discover + 新机会调研 brief | `trigger-job` 读 brief 后直发；工具也支持 `post(opportunity)` |

### 📊 自动化报告频道
| Channel | Channel ID | 用途 | 代码交互 |
|---|---:|---|---|
| `#资讯` | `1527764058709954672` | 每天 12:00 RSS Hub 日报 | `rss-daily` → `post(rss)` |
| `#每日总结` | `1527764062027644989` | 每天 23:00 多 Agent 工作总结 | `daily-summary` → `post(daily)` |
| `#每日任务` | `1527767944170573935` | 每天 10:00 GitHub Issue 待办 | `gh-todo-daily` 直发 REST |
| `#用量` | `1527906366553849866` | 每天 12:30 Token / cost / 图表报告 | `token-usage` 直发 PNG + 文本 |

### 🛠 系统与诊断频道
| Channel | Channel ID | 用途 | 代码交互 |
|---|---:|---|---|
| `#系统` | `1527730734536720484` | 告警、诊断、降级输出 | `post(system)` / 用量 fallback |

所有项目频道的详细 Topic、配置键和审计结论见 [`docs/discord-channels.md`](docs/discord-channels.md)。

原 `#发现` 已重命名为 `#机会`，历史 Discover 内容被保留；原本只有测试消息的旧 `#机会` 已删除。`#机会` 现在是发现和机会调研的唯一频道。

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
  cwd: '/abs/.../pi-discord-agents',
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

触发时 Pi 用 `read_file` 读画像、`src/rss-fetcher.mjs` 抓 RSS、`write_file` 落 md、`discord_post_message` 推 Discord。普通对话中的知识沉淀由 Pi 根据上下文决定是否调用归档工具；如果需要确定写入某个频道，可使用 `!archive` 命令。

---

## 👤 你日常怎么用

1. 打开 Discord(网页 `https://discord.com/channels/1527726951425507348` 或客户端)
2. 进你的服务器 **zhangsan**
3. 进 **`#主入口`** 这个频道
4. 像跟朋友聊天一样发消息,Pi 会回话
5. 可用显式命令管理沉淀和 GitHub 监控池：
   - `!archive memory|ideas|build <内容>`
   - `!watch list|add owner/repo|remove owner/repo`
   - `!usage [7/30/90|today|month|model|agent|cost]`
6. 每天 10:00 自动推 `#每日任务`,12:00 推 `#资讯`,12:30 推 `#用量`,23:00 推 `#每日总结`。

不需要 ID，日常对话不需要指令前缀；只有专项操作使用命令。

**手动触发机会发现**(偶发):

```
!opportunity AI coding agents            # 推 #💡 机会(默认)
!opportunity Cursor vs Codex build       # 推 #🔨 工程
!opportunity Rust MCP server ideas       # 推 #✨ 灵感
!opportunity help                        # 查帮助
!discover <topic>                        # 兼容旧名,等价于 !opportunity
```

底层: spawn 一次性 Pi subprocess,加载 `discover-tools` extension,走 HN + GitHub + 中文 RSS + Reddit 多源采集 + AI 合成。`!opportunity` 走主 Pi(daemon 那个),`!opportunity <topic>` spawn 子进程(避免阻塞主对话)。

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

## 🤖 多 Agent 系统(2026-07 重构)

**最新进展**:将原"单一 Discord Bot"重构为多 Agent 系统,详见 [`src/orchestrator/README.md`](./src/orchestrator/README.md)。

### 核心特性
- ✅ **25 个真实 Agent** - 从 `agent-core/agents/registry.json` 加载 19 个 + 6 个合成 agent
- ✅ **115 个 Skill 文件** - 每个 agent 有真实的 `.skill.md` 指令,LLM 按指令执行
- ✅ **Session 隔离** - 每个 (channel, user, topic, agent) 独立上下文
- ✅ **自动压缩** - 轮次/token/时间三种触发,LLM/规则/混合三种策略
- ✅ **智能路由** - 频道→Agent 硬映射 + 关键词软路由 + 默认兜底
- ✅ **60+ Command + 5 Team** - 完整命令到 Agent/Skill/Team 的映射
- ✅ **Team 引擎** - 多 Agent 串行/并行/条件执行 + 审批流
- ✅ **Memory 分层** - Session → AgentScope → SharedScope → KnowledgeBase 四层
- ✅ **无头模式** - 复用 Pi Agent RPC,纯无 TUI
- ✅ **灰度切换** - 通过 `MULTI_AGENT_ENABLED` 环境变量控制启用

### 灰度切换配置 (.env)

```bash
# 启用多 Agent 系统 (默认 true)
MULTI_AGENT_ENABLED=true

# Session 配置
SESSION_MAX_TURNS=20              # 每 20 轮触发压缩
SESSION_MAX_TOKENS=60000          # token 超 60k 触发压缩
SESSION_KEEP_RECENT=5             # 压缩后保留最近 5 轮
SESSION_IDLE_MINUTES=30           # 30 分钟空闲卸载
SESSION_PERSIST_DIR=data/multi-agent-sessions
```

### 快速使用

```bash
# 验证 Agent 频道配置 vs Discord 真实频道
node verify-agents.mjs

# 路由测试(16 个真实场景)
node test-routing-real.mjs

# Command Router 测试(60+ 命令)
node test-command-router.mjs

# Team 引擎测试
node test-team-engine.mjs

# Team 真实端到端测试(消耗 token)
node test-team-e2e.mjs

# 真实 Agent + Skill 加载测试
node test-real-agent-loading.mjs

# Memory 分层测试
node test-memory-bridge.mjs

# 端到端真实 LLM 测试(消耗 token)
node test-e2e-real-llm.mjs
node test-e2e-agent-with-skills.mjs

# 查看多 Agent 系统状态
node multi-agent-status.mjs
```

### Team 协作命令示例

```
!lead-to-contract 客户ABC公司,需要 AI Agent 平台,预算 50万
   → sales/lead-capture → sales/qualification → quote/estimate → contract/summarize → 审批:contract-sign

!idea-to-publish 灵感XYZ
   → distill/brief → renderer/render (并行国内+海外) → qa/report → publisher/publish → 审批:publish-domestic

!pr-full-cycle 项目TEST
   → pm/bootstrap → project/plan → solution/prd-v10 → delivery/poc → qa/test-plan → 审批:prod-deploy

!sales-deep-dive 客户ABC
   → sales/lead → sales/qualify → solution/disc → solution/prd → quote/estimate → 审批:quote-send

!incident-response 支付服务异常
   → delivery/incident → delivery/runbook → qa/health-report → delivery/deploy
```

执行结果会持久化到 `data/team-execution/<id>.json`。

### 测试结果

| 测试 | 场景数 | 通过 |
|------|--------|------|
| test-real-agent-loading | 25 agent + 115 skill | ✅ 全部加载 |
| verify-agents | 67 频道 | ✅ 全覆盖 |
| test-routing-real | 16 路由 | ✅ 16/16 |
| test-command-router | 18 (含 5 Team) | ✅ 18/18 |
| test-team-engine | 5 team + 串行+持久化 | ✅ 全部通过 |
| test-multi-agent | 5 核心 | ✅ 5/5 |
| test-memory-bridge | 7 分层 | ✅ 全部通过 |
| test-e2e-real-llm | 7 Agent | ✅ 7/7 |
| test-e2e-agent-with-skills | 5 agent+skill 真实 LLM | ✅ 5/5 |
| test-team-e2e | 真实 LLM 跑 4 步 team | ✅ 4/4 |

**总计:60+ 测试场景全部通过**
