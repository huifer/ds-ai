# Discord 频道使用说明

> 项目：`pi-discord-agents`  
> Guild：`zhangsan`（`1527726951425507348`）  
> 核对时间：2026-07-19  
> 核对范围：当前工作区的运行时代码、`.env` 中的频道配置，以及 Discord Guild 中实际存在的频道。`legacy/` 下的 v1 代码不作为当前运行逻辑。

## 1. 总体说明

当前项目在 Discord 中配置并实际识别 **10 个项目频道**。本次核查删除了无历史内容的 `#日记`，并将原 `#发现` 的历史内容合并到 `#机会`。

1. **交互入口**：用户只需要在 `#主入口` 与 Pi 对话。
2. **知识沉淀与运营输出**：Pi、定时任务或独立脚本把内容写入其他频道。
3. **专项频道**：统一的机会发现、GitHub 待办、Token 用量、RSS 和每日总结。

主进程在 `src/entry-bot.mjs` 中只处理 `CH_ENTRY`（`#主入口`）收到的用户消息；其他频道不会被当作对话入口监听。Pi 扩展和专项任务可以通过 Discord API 向其他频道发消息。

### 当前频道分布

| 类别 | 频道 |
|---|---|
| 用户对话 | `#主入口` |
| 长期沉淀 | `#记忆库`、`#灵感`、`#工程` |
| 发现与调研 | `#机会`（包含历史 Discover 内容） |
| 自动化报告 | `#资讯`、`#每日总结`、`#每日任务`、`#用量` |
| 系统与诊断 | `#系统` |

### 频道 ID 一览

| 频道 | 配置键 | Channel ID | 当前定位/状态 |
|---|---|---:|---|
| `#主入口` | `CH_ENTRY` | `1527730710410956841` | 有效；唯一用户对话入口 |
| `#记忆库` | `CH_MEMORY` | `1527730714626490480` | 有效；长期知识沉淀 |
| `#灵感` | `CH_IDEAS` | `1527730719286235296` | 有效；灵感与点子沉淀 |
| `#工程` | `CH_BUILD` | `1527730722914304121` | 有效；工程结论与技术调研 |
| `#系统` | `CH_SYSTEM` | `1527730734536720484` | 有效；告警/诊断/降级目标 |
| `#资讯` | `CH_RSS` | `1527764058709954672` | 有效；每天 12:00 RSS Hub |
| `#每日总结` | `CH_DAILY` | `1527764062027644989` | 有效；每天 23:00 工作总结 |
| `#每日任务` | `CH_GH` | `1527767944170573935` | 有效；每天 10:00 GitHub 待办 |
| `#用量` | `CH_TREND`（被 `usage` 使用） | `1527906366553849866` | 有效；每天 12:30 Token 报告 |
| `#机会` | `CH_OPPORTUNITY` | `1527730730418044991` | 有效；历史 Discover + 新机会 brief 统一目标 |

---

## 2. 频道清单与功能说明

### 2.1 `#主入口`：唯一的人机对话入口

- **配置键**：`CH_ENTRY`
- **Channel ID**：`1527730710410956841`
- **Discord Topic**：`🚪 你和 AI Agent 唯一对话的位置 · 把消息发这里就行`
- **读写方式**：用户和 Pi 双向读写
- **核心代码**：`src/entry-bot.mjs`、`src/discord-client.mjs`

#### 功能

- 接收用户的自然语言消息，并将消息通过 Pi RPC 注入主 Agent。
- Pi 的回答在同一频道回复，并尽量以原消息作为 reply reference。
- Bot 启动成功后，会在此发送“主入口已就绪”提示。
- 用户不需要记住其他频道 ID；知识沉淀和定时报告由系统自动处理。

#### 支持的命令

- `!usage`：生成 Token 用量报告，结果推送到 `#用量`。
- `!usage 7`、`!usage today`、`!usage month`、`!usage model`、`!usage agent`、`!usage cost`：查看不同维度的用量数据。
- `!trend`：`!usage` 的旧命令别名。
- `!opportunity <topic>`：触发一次机会发现任务，默认目标为 `#机会`。
- `!discover <topic>`：`!opportunity` 的兼容别名。

#### 使用原则

> 日常只在 `#主入口` 发消息。其他频道主要是自动生成的资料库和报告区，不是第二套对话入口。

---

### 2.2 `#记忆库`：长期事实、偏好与约束

- **配置键**：`CH_MEMORY`
- **Channel ID**：`1527730714626490480`
- **Discord Topic**：`🧠 AI 自动沉淀:长期事实 / 偏好 / 决策 / 约束`
- **写入方式**：Pi 通过 `discord_archive_knowledge(category: "memory")` 或 `discord_post_message(category: "memory")` 写入
- **主要内容**：长期偏好、固定原则、已确认的决策、技术或工作约束

#### 典型内容

- 用户偏好的语言、框架、模型或工具。
- “以后总是……”或“禁止……”这类长期规则。
- 已经确认、不应在后续对话中反复讨论的决策。
- 对目标用户、产品方向、工作方式的稳定认知。

#### 边界

- 不应把一次性的聊天过程、临时想法或完整工作日志全部复制进来。
- 当前 Bot 不监听此频道作为对话输入；它是沉淀和检索位置。

---

### 2.3 `#灵感`：想法、点子与实验方向

- **配置键**：`CH_IDEAS`
- **Channel ID**：`1527730719286235296`
- **Discord Topic**：`✨ 自动沉淀:你的灵感 / 点子 / 突发奇想`
- **写入方式**：Pi 通过 `discord_archive_knowledge(category: "ideas")` 或指定 `category: "ideas"` 的消息工具写入
- **主要内容**：产品想法、功能点子、Hack 方向、突发奇想、未来可验证的假设

#### 典型内容

- “如果做一个……会不会有价值”的早期想法。
- 值得以后验证的 SaaS / App / 自动化方向。
- 从外部资讯或技术趋势中提炼出的产品机会。
- 暂时不适合直接进入工程实现、但值得保留的探索方向。

#### 与 `#机会` 的区别

- `#灵感` 是长期积累的轻量想法库，内容可以很短。
- `#机会` 是一次完整的、带外部证据和链接的调研 brief 输出区。

---

### 2.4 `#工程`：技术实现与工程决策

- **配置键**：`CH_BUILD`
- **Channel ID**：`1527730722914304121`
- **Discord Topic**：`🔨 自动沉淀:技术 / 工程 / 代码 / 配置决策`
- **写入方式**：Pi 通过 `discord_archive_knowledge(category: "build")`、`discord_post_message(category: "build")`，或机会发现任务显式指定 `build` 写入
- **主要内容**：代码、部署、Bug 修复、架构选型、依赖、配置和提交记录

#### 典型内容

- 某项实现采用了什么方案，以及为什么这样选。
- 报错、修复过程和需要长期记住的工程约束。
- 部署、分支、版本、依赖升级等重要记录。
- `!opportunity <topic> build` 指定输出的技术机会调研。

#### 边界

- 不是完整 Git 日志的替代品。
- 只沉淀可复用的工程结论，不建议把所有临时调试输出都发到这里。

---

### 2.5 `#机会`：发现归档与机会调研统一频道

- **配置键**：`CH_OPPORTUNITY`
- **Channel ID**：`1527730730418044991`
- **Discord Topic**：`💡 机会与发现 · 历史 Discover 归档 + !opportunity <topic> 深度调研 · 完整机会内容统一进入本频道`
- **触发方式**：`#主入口` 中的 `!opportunity <topic>`、兼容命令 `!discover <topic>`，或 `scripts/trigger-job.mjs opportunity "<topic>"`
- **主要代码**：`src/jobs/opportunity.mjs`、`scripts/trigger-job.mjs`、`extensions/discord-tools.mjs`
- **本地留档**：`data/opportunity/YYYY-MM-DD-<topic>.md`

#### 合并说明

原 `#发现` 中已有的历史 Discover 内容被保留在当前频道中；原先单独创建但只有连通性测试消息的 `#机会` 频道已删除。这样可以避免“发现”和“机会”两个频道重复承载调研内容。

#### 功能

- 保留历史 Discover / 短发现信号。
- 接收新的机会发现 brief：Hacker News、GitHub、中文 RSS、Reddit 多源调研、主题聚类、SaaS/App 机会和 MVP 建议。
- `trigger-job` 在 brief 写入本地后直接校验目标频道并分片推送，避免模型工具调用遗漏导致内容丢失。
- `!discover` 只作为 `!opportunity` 的命令兼容别名，不再产生第二个输出频道。

#### 可选目标

```bash
node scripts/trigger-job.mjs opportunity "AI coding agents"
node scripts/trigger-job.mjs opportunity "Cursor vs Codex" build
node scripts/trigger-job.mjs opportunity "Rust MCP server ideas" ideas
```

### 2.6 `#系统`：健康度、告警与降级输出

- **配置键**：`CH_SYSTEM`
- **Channel ID**：`1527730734536720484`
- **Discord Topic**：`🛠 AI 健康度 / Token 用量 / 告警`
- **写入方式**：Pi 可通过 `discord_post_message(category: "system")` 写入；Token 用量任务在没有专用目标频道时会回退到这里
- **主要内容**：系统状态、诊断信息、异常告警、低频运维信息

#### 功能

- 作为系统类消息的集中查看位置。
- 当 `CH_USAGE` 和 `CH_TREND` 都没有配置时，Token 用量功能会将结果回退到此频道。
- 可用于显式发送 daemon、Pi 扩展或外部任务的告警。

#### 当前行为

主 daemon 的普通运行日志主要写入本地 `logs/orchestrator.log`，并不会把每一条日志都复制到 `#系统`。因此此频道更适合作为告警和诊断输出区，而不是完整日志替代品。

---

### 2.7 `#资讯`：RSS Hub 每日资讯

- **配置键**：`CH_RSS`
- **Channel ID**：`1527764058709954672`
- **Discord Topic**：`RSS hub · 每天 12:00(北京时间)推送行业资讯,基于 ~/summary/ 画像筛选`
- **自动触发**：每天 12:00（北京时间，UTC+8）
- **主要代码**：`src/jobs/rss-daily.mjs`、`src/rss-fetcher.mjs`
- **本地留档**：`data/rss/YYYY-MM-DD.md`

#### 功能流程

1. 调用 RSS fetcher 抓取配置在 `config/rss-sources.json` 中的 RSS / Atom 源。
2. 读取 `~/summary/profile/` 和 `~/summary/work/` 下的用户画像与技术栈信息。
3. 按相关性筛选和整理行业资讯。
4. 将 Markdown 日报写入本地 `data/rss/`。
5. 通过 `discord_post_message(category: "rss")` 推送到本频道。
6. 完成后在 `#主入口` 发送任务完成提示。

#### 手动触发

```bash
node scripts/trigger-job.mjs rss
node scripts/trigger-job.mjs rss 2026-07-18
```

---

### 2.8 `#每日总结`：多 Agent 工作日报

- **配置键**：`CH_DAILY`
- **Channel ID**：`1527764062027644989`
- **Discord Topic**：`每天 23:00(北京时间)汇总今天 .workbuddy / .zcode / .pi / .gemini / .kiro / .claude 干了啥`
- **自动触发**：每天 23:00（北京时间，UTC+8）
- **主要代码**：`src/jobs/daily-summary.mjs`
- **本地留档**：`data/daily-summary/YYYY-MM-DD.md`

#### 功能流程

1. 检查当天修改过的文件。
2. 从 `~/.workbuddy`、`~/.zcode`、`~/.pi`、`~/.gemini`、`~/.kiro`、`~/.claude` 等目录提取当天活动信号。
3. 汇总主要工作、关键决定、阻塞/待办、学到的新知和可自动化的重复模式。
4. 将 Markdown 日报写入本地 `data/daily-summary/`。
5. 通过 `discord_post_message(category: "daily")` 推送到本频道。
6. 完成后在 `#主入口` 发送完成提示。

#### 手动触发

```bash
node scripts/trigger-job.mjs daily
node scripts/trigger-job.mjs daily 2026-07-18
```

---

### 2.9 `#每日任务`：GitHub Issue 待办清单

- **配置键**：`CH_GH`
- **Channel ID**：`1527767944170573935`
- **Discord Topic**：`🎯 每天 10:00(北京时间)推送 GH issues 清单:huifer 在仓库池里未评论过的 open issue,高亮 @huifer / good first issue / help wanted。仓库池用 !watch add/remove/list 在 #主入口 维护。`
- **自动触发**：每天 10:00（北京时间，UTC+8）
- **主要代码**：`scripts/push-gh-list.mjs`，由 `src/entry-bot.mjs` 的调度器启动
- **本地留档**：`data/gh/YYYY-MM-DD.md`

#### 功能

- 读取 `data/gh-watch.json` 中的仓库监控池。
- 通过 `gh` CLI 获取仓库中的 open issues。
- 把当前用户尚未评论的 issue 整理为待办。
- 单独追踪当天已经评论过的 issue，显示为“今日已完成”。
- 优先突出 `@huifer`、`good first issue`、`help wanted` 等信号。
- 长内容会按 Discord 消息长度限制自动分片发送。

#### 注意

频道 Topic 和自动生成的消息中列出的 `!watch add/remove/list` 管理命令现在已经由 `src/entry-bot.mjs` 实现，并与 `src/gh-watch.mjs`、`data/gh-watch.json` 共用同一份监控池。

---

### 2.10 `#用量`：Token 消耗与趋势报告

- **配置键**：当前使用 `CH_TREND`；运行配置中的 `usage` 会回退到 `CH_TREND`
- **Channel ID**：`1527906366553849866`
- **Discord Topic**：📊 Token 消耗趋势 · 每天 12:30（北京时间）推送 · 数据源 `ccusage`（LiteLLM 真实价，跨 claude/pi/opencode/codex/gemini）· 手动命令：`!trend` / `!trend 7` / `!trend today` / `!trend model` / `!trend agent` / `!trend month`
- **自动触发**：每天 12:30（北京时间，UTC+8）
- **主要代码**：`src/jobs/token-usage.mjs`
- **数据源**：优先 `ccusage`，同时结合项目本地 `sessions/*.jsonl`
- **本地留档**：`data/token-usage/YYYY-MM-DD.{md,png,svg,html}`

#### 功能

- 统计 input、output、cache、total tokens 和 cost。
- 按日期、模型、Agent、session 等维度汇总。
- 使用 ECharts + Resvg 生成 PNG 图表。
- 自动向本频道发送 PNG 主图和 Markdown 文字摘要。
- 通过 `!usage` 或旧命令 `!trend` 手动查看报告。

#### 当前配置说明

当前 `.env` 中存在 `CH_TREND`，但没有单独的 `CH_USAGE`；因此项目实际使用的是：

```text
CH_USAGE → 未配置
CH_TREND → #用量（当前有效目标）
```

如果将来增加 `CH_USAGE`，代码会优先使用 `CH_USAGE`，否则继续回退到 `CH_TREND`，再回退到 `#系统`。

#### 手动命令

定时任务、`scripts/trigger-job.mjs usage` 和主入口中的 `!usage` / `!trend` 现在统一调用 `handleUsageCommand`，报告会按 `CH_USAGE → CH_TREND → CH_SYSTEM` 的顺序选择目标频道。

---

## 3. 频道交互审计

本节不是只看 `.env` 是否有 ID，而是同时检查：

1. 频道是否在当前 Guild 中真实存在，并且是文字频道。
2. 当前运行时代码是否有明确的发送、接收或调度路径。
3. 代码路径是否真的把消息发到这个频道，而不是只在注释或 README 中声称支持。
4. Discord 中是否能看到近期运行痕迹。

核对结果：Bot 当前在线，Pi RPC 子进程在线，daemon 已注册 4 个调度任务（GitHub 待办、RSS、Token 用量、每日总结）。Discord API 查询到下表中的 10 个配置频道均存在。消息数量是最近一次抓取的最多 10 条样本，不代表频道总消息数。

### 审计结果一览

| 频道 | 接收用户消息 | 发送/调度代码 | 近期运行证据 | 结论 |
|---|---|---|---|---|
| `#主入口` | ✅ `messageCreate` + `channelId === CH_ENTRY` | ✅ Pi 回复、启动提示、命令分发、`!watch`、`!archive` | 最近 10 条有消息 | **核心有效** |
| `#记忆库` | ❌ 按设计不接收对话 | ✅ `discord_archive_knowledge(memory)` / `discord_post_message(memory)` | 最近 3 条，均为 Bot | **有效的输出型频道**；自动归档依赖 Pi 主动调用工具 |
| `#灵感` | ❌ 按设计不接收对话 | ✅ `archive(ideas)` / `post(ideas)` | 最近 2 条，均为 Bot | **有效的输出型频道**；没有独立调度器 |
| `#工程` | ❌ 按设计不接收对话 | ✅ `archive(build)` / `post(build)` | 最近 5 条，均为 Bot | **有效的输出型频道**；没有独立调度器 |
| `#系统` | ❌ 当前不监听 | ✅ `post(system)` + Token 用量降级目标 | 最近 7 条，含告警和任务输出 | **有效**；更像告警/诊断汇聚区，不是完整日志 |
| `#资讯` | ❌ 当前不监听 | ✅ 12:00 调度 → Pi → `post(rss)` | 最近抓取到至少 10 条 Bot 消息 | **有效**；有本地 Markdown 留档 |
| `#每日总结` | ❌ 当前不监听 | ✅ 23:00 调度 → Pi → `post(daily)` | 最近 3 条，均为 Bot | **有效**；有本地 Markdown 留档 |
| `#每日任务` | ❌ 当前不监听 | ✅ 10:00 调度 → `scripts/push-gh-list.mjs` 直发 REST；`!watch` 已接入监控池 | 最近 7 条，均为 Bot | **有效** |
| `#用量` | ❌ 当前不监听 | ✅ 12:30 调度/独立脚本直接发 PNG + 文本；`!usage` / `!trend` 已接线 | 最近 10 条，包含图片附件 | **有效** |
| `#机会` | ❌ 当前不监听 | ✅ `trigger-job` 读取 brief 后直发；通用工具也支持 `post(opportunity)` | 合并前已有至少 10 条历史 Discover 输出；新 brief 进入同一频道 | **有效** |

### 逐项合理性判断

#### A. 可以保留且当前确实在发挥作用

- `#主入口`：整个系统的唯一交互入口，不能删除。
- `#记忆库`：已经有长期偏好、架构决策等沉淀，保留价值明确。
- `#灵感`：已经有产品想法和趋势洞察，作为轻量想法库有价值。
- `#工程`：已经有架构、部署和技术判断，和 `#灵感` 的职责区分清楚。
- `#系统`：已经承载错误、告警和任务异常，适合作为运维观察区。
- `#资讯`：RSS Hub 有定时任务、代码路径、本地文件和 Discord 输出，功能完整。
- `#每日总结`：有定时任务、跨 Agent 数据源、本地留档和 Discord 输出，功能完整。
- `#每日任务`：GitHub Issue 脚本和 10:00 调度已经实际产生过消息，功能完整。
- `#用量`：当前 `CH_TREND` 实际指向已改名的 `#用量`，独立脚本已经成功发出 PNG 和文字报告。

#### B. 已合并或移除的低价值频道

- 原 `#日记`：频道为空，删除并同步移除配置和归档类别。
- 原 `#发现`：历史内容有价值，但与 `#机会` 功能重叠，已保留其 Channel ID 和历史消息并重命名为 `#机会`。

当前剩余 10 个频道都有明确代码路径，不再保留“只有配置没有用途”的频道。

#### C. 当前保留频道的判断

- `#系统` 和 `#用量` 不合并：前者是告警/诊断，后者是完整 Token 图表和成本报告。
- `#资讯` 和 `#机会` 不合并：前者是定时 RSS 新闻流，后者是按主题调研后的机会 brief。
- `#每日任务` 和 `#每日总结` 不合并：前者是 GitHub issue 行动清单，后者是多 Agent 工作回顾。
### 已完成的代码修复

1. **频道合并/删除**：原 `#发现` 改名为 `#机会` 并保留历史消息；空的 `#日记` 已删除；`.env` 和代码现在只维护 10 个项目频道。

2. **机会频道路由**：机会任务现在由 `scripts/trigger-job.mjs` 在 brief 写入后直接校验目标 ID、分片推送，并在 `#主入口` 发送完成通知；通用 Discord 工具也支持 `CH_OPPORTUNITY` / `opportunity`，显式未知 category 会拒绝。

3. **`!usage` / `!trend` 手动命令**：两条命令现在统一进入已声明的 `handleUsageCommand`，并复用 `src/jobs/token-usage.mjs` 的报告和频道选择逻辑。

4. **`!watch` 监控池管理**：已新增 `src/gh-watch.mjs`，实现 `list/add/remove`、格式校验、去重和原子写入；daemon 和每日 GitHub 任务共享同一套读写逻辑。

5. **知识沉淀交互**：归档类别收敛为 `memory`、`ideas`、`build`，增加明确的 `!archive` 命令；已删除没有实际目标频道的日记/发现类别。

6. **配置和文档收敛**：`.env.example`、README、Discord Topic 和审计文档已统一为 10 个项目频道。
### 后续验证与维护

- 运行 `npm test` 检查频道类别路由和 GitHub 监控池。
- 修改 `.env` 后启动时会校验所有必需频道 ID，缺失或格式错误会直接拒绝启动。
- 运行机会任务后检查 `logs/trigger.log` 和 `#机会`，确认 brief 与本地 `data/opportunity/` 同时产生。
- 使用 `!watch list` 验证 `data/gh-watch.json` 与 `#每日任务` 使用的是同一份数据。
- 使用 `!archive memory <内容>`、`!archive ideas <内容>` 或 `!archive build <内容>` 验证三个沉淀频道。
---

## 4. 频道之间的典型数据流

```text
用户
  │
  ▼
#主入口 ── 普通对话 ──> Pi RPC ──回复──> #主入口
  │
  ├─ !usage / !trend ────────────────> #用量
  ├─ !opportunity <topic> ───────────> #机会（runner 可靠分片直发）
  └─ 普通对话中的可沉淀信息 ──────────> #记忆库 / #灵感 / #工程

定时调度器
  ├─ 10:00 GitHub 待办 ──────────────> #每日任务
  ├─ 12:00 RSS Hub ─────────────────> #资讯
  ├─ 12:30 Token 用量 ──────────────> #用量
  └─ 23:00 工作总结 ────────────────> #每日总结

系统/专项任务 ─────────────────────> #系统 或 #机会
```

---

## 5. 运行权限与消息边界

- `#主入口` 是唯一会触发主 Pi 对话的频道。
- 其他频道的消息不会自动进入主 Pi 上下文。
- `ALLOWED_USER_IDS` 控制可使用主入口的用户；不在白名单的用户会收到 `🚫` 反应。
- Discord 单条消息按约 1900 字符分片，避免超过 Discord 2000 字符限制。
- **`discord_archive_knowledge`** 只允许三个沉淀类别：`memory`、`ideas`、`build`。
- `discord_post_message` 可以指定类别或直接指定 `channel_id`；直接指定 ID 的优先级更高。
- Token、Bot 配置和真实环境变量仍只保存在 `.env`，不应写入本 Markdown 文档。

---

## 6. 不属于项目频道的 Guild 频道

当前 `zhangsan` Guild 中还存在 `#通用`（`1527730783270211584`），Topic 为 `🍵 服务器介绍 / 闲聊 / 欢迎帖`。

它没有对应的 `CH_*` 配置，也没有在当前项目代码中被引用，因此不属于 `pi-discord-agents` 的功能频道清单。

---

## 7. 相关文件索引

| 文件 | 作用 |
|---|---|
| `src/config.mjs` | 读取 `.env` 并构建频道配置映射 |
| `src/entry-bot.mjs` | 监听 `#主入口`、注册定时任务、处理命令 |
| `src/gh-watch.mjs` | GitHub 监控池读写和 `!watch` 命令共享逻辑 |
| `src/discord-client.mjs` | Discord 登录、收消息、发消息和反应 |
| `extensions/discord-tools.mjs` | Pi 的 Discord 发消息、知识归档、发图工具 |
| `extensions/discord-tools-shared.mjs` | Pi 子进程使用的频道 ID 和 Discord 客户端 |
| `src/jobs/rss-daily.mjs` | `#资讯` 的每日 RSS Hub |
| `src/jobs/daily-summary.mjs` | `#每日总结` 的每日工作汇总 |
| `src/jobs/token-usage.mjs` | `#用量` 的 Token 统计和图表 |
| `src/jobs/opportunity.mjs` | 机会发现 prompt 和 brief 生成 |
| `scripts/push-gh-list.mjs` | `#每日任务` 的 GitHub Issue 清单 |
| `scripts/trigger-job.mjs` | 手动触发 RSS、总结、用量和机会任务 |
| `.env` | 当前环境的真实频道 ID（未纳入 Git） |
| `.env.example` | 频道配置模板 |
