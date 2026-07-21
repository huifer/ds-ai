## 变更类型

请勾选适用的类型：

- [ ] 🐛 Bug 修复
- [ ] ✨ 新功能（新 Agent / 新命令 / 新频道）
- [ ] 🧠 记忆 / 遐思系统改动
- [ ] 🔗 Connection 系统改动
- [ ] ⏰ 定时任务 / 调度器改动
- [ ] 📝 文档改进（README / docs / CONTEXT）
- [ ] 🎨 重构（结构调整，不改语义）
- [ ] ⚡ 性能 / 资源占用优化
- [ ] 🧪 测试改动

## 关联 Issue

<!-- 例如：Fixes #123, Related to #456 -->
Fixes #
Related to #

## 改动说明

简要描述这次 PR 做了什么、为什么做。

## 主要变更

- 变更 1
- 变更 2
- 变更 3

## 影响范围

- 涉及模块：`src/...` / `extensions/...` / `scripts/...` / `docs/...`
- 是否改变 Discord 频道列表：否 / 是（新增/移除/重命名 ___ 频道）
- 是否改变 CLI 命令：否 / 是（新增/移除/重命名 ___ 命令）
- 是否影响多 Agent 系统行为：否 / 是

## 测试方式

- [ ] `npm test`
- [ ] `node scripts/smoke-test.mjs "ping?"`
- [ ] `node test-routing-real.mjs`（如涉及多 Agent 路由）
- [ ] `node test-command-router.mjs`（如涉及命令）
- [ ] `node test-team-engine.mjs`（如涉及 team-engine）
- [ ] Discord 端手工验证（请说明哪个频道、发送什么命令）

## 截图 / 录屏（如适用）

## Checklist

- [ ] 我已阅读 [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] 我已阅读 [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)
- [ ] 我在本地跑通了相关测试
- [ ] 我确认没有把 `.env` / `logs/` / `sessions/` / `data/` / `links/` 误提交
- [ ] 我已更新 [CHANGELOG.md](../CHANGELOG.md)（如适用）
- [ ] 新依赖（如有）已写入 `package.json`

## 其它备注

<!-- Reviewer 注意点 -->