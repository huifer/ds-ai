# 贡献指南

感谢你考虑为 **pi-discord-agents** 做出贡献！🎉

本项目是一个 **Discord ↔ Pi Agent (RPC mode) 桥接 daemon**。欢迎任何形式的贡献：报告 Bug、提 Feature、改进文档、提交代码。

---

## 🤝 贡献方式

### 1. 报告 Bug（Issues）

提 Issue 前请确认：

- [ ] 已搜索现有 Issue，避免重复
- [ ] 用最新 `main` 复现过

**Bug 报告模板**：[`.github/ISSUE_TEMPLATE/bug_report.md`](.github/ISSUE_TEMPLATE/bug_report.md)

请包含：

- 复现步骤（命令 + Discord 频道 + 期望 vs 实际）
- 关键日志：`logs/orchestrator.log` / `logs/launchd.err.log`
- 环境：macOS 版本、Node 版本、Pi Agent 版本
- 是否影响 `MULTI_AGENT_ENABLED=true/false` 两种模式

### 2. 提 Feature / 改进建议

**Feature 模板**：[`.github/ISSUE_TEMPLATE/feature_request.md`](.github/ISSUE_TEMPLATE/feature_request.md)

请说明：

- 这个改动解决了什么问题
- 提议的实现思路（不一定完整）
- 是否涉及新增 Discord 频道（参考 [`docs/discord-channels.md`](docs/discord-channels.md) 的频道分类）
- 是否影响多 Agent 系统（参考 [`src/orchestrator/README.md`](src/orchestrator/README.md)）

### 3. 改进文档

文档改动可以直接提 PR，不需要先开 Issue。涉及面大的（例如改 `README.md` 的核心结构、改 `CONTEXT.md` 的业务模型）建议先在 Issue 里讨论。

### 4. 提交代码

参考 [`README.md` § 维护](README.md#-维护) 了解改动后的重启方式。

---

## 📋 开发规范

### 分支策略

- `main`：稳定分支，受保护
- `feat/<scope>-<short-desc>`：新功能，例如 `feat/multi-agent-team-e2e`
- `fix/<scope>-<short-desc>`：修 Bug，例如 `fix/scheduler-missed-job-backfill`
- `docs/<topic>`：纯文档改动
- `chore/<topic>`：杂项（重构、依赖升级）

### Commit 消息

推荐 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：

```
feat(multi-agent): 增加 team-engine 串行编排
fix(scheduler): 修 missed job backfill 1 小时判定
docs: README 更新 v3.0 规划章节
chore(deps): 升级 discord.js 到 v14.16
refactor(orchestrator): 提取 session-pool 中间件
test(multi-agent): 增加 team-engine e2e 5 场景
```

### PR 流程

1. Fork 仓库 → 创建分支 → 本地改动
2. **lint + 测试**：
   ```bash
   npm test                       # node 内置测试（频道路由 / GitHub 监控池）
   node --check src/**/*.mjs      # syntax check
   ```
3. 写清晰的 PR 描述（[模板](.github/pull_request_template.md)）
4. CI 全绿后等待 Review
5. Squash merge 到 `main`

---

## 🧪 本地验证清单

提交前请确认：

- [ ] `node scripts/smoke-test.mjs "ping?"` 通过（不连 Discord 的纯 RPC + extension 测试）
- [ ] `npm test` 通过
- [ ] 改动不引入 `.env`、`logs/`、`sessions/`、`data/`、`links/`（这些都在 `.gitignore`）
- [ ] 新依赖写到 `package.json` 的 `dependencies` / `devDependencies`
- [ ] 涉及多 Agent 改动：`node test-routing-real.mjs` 和 `node test-command-router.mjs` 通过

---

## 🔒 安全问题

**不要**通过公开 Issue 报告安全漏洞。详见 [`SECURITY.md`](SECURITY.md)。

---

## 📜 行为准则

请阅读并遵守 [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)。

简而言之：**友善、尊重、就事论事**。

---

## ❓ 提问

- 看现有 [Issues](https://github.com/huifer/ds-ai/issues) 与 Discussions
- 不确定从哪开始？找标签 `good first issue`
- 直接联系 Maintainer

期待你的 PR！🙌