# 更新日志

本项目的所有重要变更都会记录在此文件中。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

> 早期版本历史（v0.x 阶段）已合并到下方主线。每条提交对应的代码细节请查阅 `git log`。

---

## [Unreleased]

### 计划中
- v3.0 规划：记忆 2.0 + Loop Agent + 做梦增强（好梦机制）+ OPC 优化
  - 详见 [`docs/OPC_MEMORY_AND_LOOP_AGENT_DESIGN.md`](docs/OPC_MEMORY_AND_LOOP_AGENT_DESIGN.md)
- 遐思增强（Xiasi）详细方案
  - 详见 [`docs/XIASI_ENHANCEMENT_PLAN.md`](docs/XIASI_ENHANCEMENT_PLAN.md)

---

## [2.2.x] - 2025-07（v2.2 多 Agent 系统）

### Added
- 🤖 **多 Agent 系统**：从单一 Discord Bot 重构为多 Agent 系统
  - 25 个真实 Agent（19 个 registry + 6 个合成）
  - 115 个 Skill 文件
  - Session 隔离（6 维度：channel, user, project, task, intent, agent）
  - 自动压缩（轮次/token/时间三种触发；LLM/规则/混合三种策略）
  - 智能路由（频道→Agent 硬映射 + 关键词软路由 + 默认兜底）
  - 60+ Command + 5 Team 模板
  - Team 引擎（串行/并行/条件 + 审批流）
  - Memory 四层（Session → AgentScope → SharedScope → KnowledgeBase）
  - 灰度切换（`MULTI_AGENT_ENABLED` 环境变量）
- 🌙 **遐思梦境系统 (Xiasi)**
  - 三阶段流水线：Light → REM → Deep
  - 四种梦：连珠 / 归藏 / 明台 / 预言
  - 5 信号评分 + 影子试用 + Discord 投票
  - 好梦机制 + 噩梦干预 + 预言模式（v3 规划）
- 💡 **机会发现**：`#机会` 频道 + `!opportunity <topic>` 命令
- 🔗 **Connection 系统**：Strava / Notion / RescueTime / Garmin / HealthKit OAuth 接入
- 📚 **完整测试套件**：60+ 场景，覆盖 routing / team-engine / memory-bridge / e2e-real-llm

### Changed
- 📂 项目结构整理（移动测试文件与脚本到 `test/`、`scripts/` 目录）
- 📝 README 大幅扩展（多 Agent 系统章节）
- 📋 `.env.example` 扩展多 Agent 系统环境变量
- 🚫 移除 `#📡 发现` 频道，新增 `#💡 机会`

---

## [2.1.x] - 2025-06（v2.1 RSS & 每日总结）

### Added
- 📰 **RSS Hub**：42 个 RSS 源，每天 12:00 北京时间触发
- 📊 **每日总结**：每天 23:00 多 Agent 工作汇总
- 📈 **Token 用量统计**：ccusage + 本地 session，每天 12:30
- 📝 **GitHub 仓库监控**：`!watch add/remove/list` + 每天 10:00 自动生成 Issue 待办
- 🏷️ **WebFetch UA**：浏览器风格避免被拦

### Fixed
- 🐛 `--` 分隔符在 Discord 不渲染 → 用 `▬▬▬` Unicode 矩形
- 🐛 `trigger-job.mjs` dateKey 判断漏了 `opportunity` kind

---

## [2.0.x] - 2025-05（v2 RPC 架构）

### Changed（Breaking）
- 🔄 **架构升级**：从 v1（TUI + tmux）切换到 v2（Pi RPC 子进程模式）
  - 启动延迟：~10s → **~200ms**
  - 消除 `ctx stale` 错误与 5 次重试
  - 天然支持流式输出（`text_delta`）
  - 不再依赖 tmux / 假 TTY
- 📦 daemon 改为 spawn `pi-coding-agent` 的 RPC 子进程模式

### Added
- ⏰ **内存 cron 调度器**（`src/scheduler.mjs`）：无依赖、纯 `setInterval`、30 秒 tick
- 🧩 **Pi 扩展**：`extensions/discord-tools.mjs` + `file-tools.mjs`
- 🌐 **事件流转发**：`message_update.text_delta` → 打字机式 Discord 输出
- 🔌 **白名单机制**：`ALLOWED_USER_IDS` + `write_file` 路径白名单
- 📜 **长期记忆系统**（基础版）：JSON + Markdown 双格式

---

## [1.x] - 早期版本

- 详见 [`legacy/v1-discord-entry-bot/`](legacy/v1-discord-entry-bot/) 与 [`legacy/README.md`](legacy/README.md)
- v1 直接调 LLM API 的简化版（已废弃）
- 迁移对照表见 `legacy/README.md`