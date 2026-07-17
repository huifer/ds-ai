# legacy/ · 历史归档

> 这里放已经废弃、但保留作参考的旧版本。**当前生产代码全部在上级目录**。

## 📦 v1-discord-entry-bot/

**状态**: 已废弃 · **生产不要再用**

**为什么废弃**: v1 是用 discord.js 直接调 LLM API 的简化实现,只能做"主入口对话 + 6 频道路由"。
v2 (上级目录) 用 **Pi Agent RPC 子进程** 替换了直接 LLM 调用,带来了:

| 维度 | v1 ❌ | v2 ✅ |
|---|---|---|
| LLM 调用方式 | 直接 fetch API | Pi Agent 子进程 |
| 流式输出 | 无 | 有 (`text_delta` 实时) |
| 工具调用 | 硬编码 7 频道 | Pi 注册任意工具 |
| 多 session | 单 session | 每次 prompt 自动持久化 |
| 上下文管理 | 自己实现 `HISTORY_LIMIT=50` | Pi 自己处理 |
| 定时任务 | 需另写 launchd | daemon 内存 cron |
| Skills 体系 | 无 | 100+ skill 直接用 |

**迁移对照**:

| v1 文件 | v2 替代 | 说明 |
|---|---|---|
| `lib/stable-bot.mjs` | `src/entry-bot.mjs` + `extensions/discord-tools.mjs` | 主程序 + Discord 工具拆分 |
| `.env`(7 个 CH_*) | `.env`(9 个 CH_*) | 新增 `CH_RSS`, `CH_DAILY` |
| `~/Library/LaunchAgents/com.zhangsan.discord-entry-bot.plist` | `~/Library/LaunchAgents/com.zhangsan.pi-discord-agents.plist` | launchd label 改名 |
| 无 | `src/scheduler.mjs` + `src/jobs/*.mjs` | 定时任务 |
| 无 | `extensions/file-tools.mjs` | 落本地 md |

**v1 README 里值得保留的内容**:
- "你日常怎么用" 的用户向操作手册 → 已合并到上级 `README.md` 的同章节
- Discord 频道表 → 已合并到上级 `README.md`

**清理动作**(已完成):
- v1 的 `.env`(含真实 token / API key)已删除,只留 `.env.example` 脱敏模板
- v1 的 launchd plist 已从 `~/Library/LaunchAgents/` 移除
- v1 的进程已停止
- v1 目录整体 `mv` 进 `legacy/v1-discord-entry-bot/`

**何时彻底删这个目录**: 等团队确认不需要回看 v1 源码(预计 2026 年底)。

---

## 🗂 legacy 目录约定

- 每个旧版本一个子目录:`v1-discord-entry-bot/`,`v0-xxx/` ...
- 子目录里的 `README.md` 必须说明:**为什么废弃 / 何时删 / 替代方案**
- 子目录的 `.env`(含密钥)在迁入时**必须**删除,只留 `.env.example` 脱敏
- 子目录的 `node_modules/` 和 `logs/` 不会被 git 跟踪(在上级 `.gitignore` 里忽略整个 `legacy/`)