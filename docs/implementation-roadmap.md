# 实施执行路线

> 蓝图设计已经全部定稿，下一阶段是把设计层转换为可执行层。
> 本文件定义：阶段目标、任务清单、完成判定、风险与回退。

---

# 0. 路线总览

```text
阶段 0 · 代码保护                    [DONE]
阶段 1 · Runtime 基座与 Agent 路由   [DONE] ← Week 1
阶段 2 · Discord 工具扩展与内容 SOP  [DONE] ← Week 1
阶段 3 · 企业 FDE Project 自动化     [DONE] ← Week 1
阶段 4 · 自媒体内容主链              [DONE] ← Week 1 (骨架)
阶段 5 · 评测、合规与运行期观测      [NEXT] ← Week 2
阶段 6 · entry-bot 重构 + Pi Agent RPC [NEXT] ← Week 2
阶段 7 · 真实平台发布器              [NEXT] ← Week 3
```

---

# 1. Week 1 完成总结

## 1.1 已交付

| 模块 | 文件 | 状态 |
|---|---|---|
| AgentManager | `src/runtime/agent-manager.mjs` | ✅ 19 Agent 注册 + 命令路由 + 审批门禁 |
| SkillLoader | `src/runtime/skill-loader.mjs` | ✅ frontmatter 解析 + 缓存 |
| SessionStore | `src/runtime/session-store.mjs` | ✅ SHA-1 哈希 + JSONL 追加 |
| MemoryScope | `src/runtime/memory-scope.mjs` | ✅ 11 个 scope + 读/写权限 |
| Approval | `src/runtime/approval.mjs` | ✅ 14 种 ApprovalKind + check/grant/list/expire |
| 项目骨架 | `src/runtime/commands/project-bootstrap.mjs` | ✅ `!pr new` 端到端 |
| Demo 拷贝 | `src/runtime/commands/react-demo.mjs` | ✅ `!demo new` 端到端 |
| 内容流水线 | `src/runtime/commands/content.mjs` | ✅ 7 阶段全部跑通 |
| 命令路由 | 60+ 条 setRoute | ✅ parseCommand + parseArgs + lookupRoute |
| 审批门禁集成 | dispatch → approval.check → call | ✅ NEED_APPROVAL → grant → re-dispatch |
| Discord 工具 | `extensions/discord-tools.mjs` | ✅ 7 个新工具 |
| 文件工具 | `extensions/file-tools.mjs` | ✅ 5 个新写入器 |
| 设计系统 | `agent-core/design/` | ✅ tokens.css + 13 组件 |
| React Demo 模板 | `agent-core/enterprise/templates/demo-react/` | ✅ 26 文件 |
| 行业知识包 | `agent-core/enterprise/industries/` | ✅ 6 行业 × 4 文件 |
| PRD 模板 | `agent-core/enterprise/templates/prd/` | ✅ 5 行业 |
| 合同文档 | `agent-core/runtime/*.md` | ✅ 4 份（agent-manager / dispatch / approval / content-pipeline） |

## 1.2 冒烟测试结果

| 测试 | 脚本 | 结果 |
|---|---|---|
| Agent 注册 + 路由 | `scripts/runtime-smoke.mjs` | ✅ 19 Agent |
| 审批门禁 | `scripts/approval-smoke.mjs` | ✅ check/grant/list/expire |
| FDE 项目 + Demo | `scripts/coding-smoke.mjs` | ✅ pr new → demo new → approve → list |
| 内容流水线 | `scripts/content-smoke.mjs` | ✅ intake → distill → privacy → fact → render → publish → qa |
| **完整 E2E** | `scripts/fde-e2e.mjs` | ✅ FDE → Demo 审批 → 内容 → 3 平台发布 → QA |

## 1.3 E2E 验证场景

```text
客户 client-beta 要做 SaaS 数据分析平台

Phase 1: !pr new client-beta saas "..."   → PRJ-XXXX ✅
         !demo new PRJ-XXXX               → React Demo 拷贝 ✅
         !demo approve PRJ-XXXX           → 审批 → grant → 通过 ✅

Phase 2: !intake now "完成了 Demo..."     → MAT-XXXX ✅
         !distill now --mat=MAT-XXXX      → CNT-XXXX 33/40 推荐 ✅
         !privacy check --cnt=CNT-XXXX    → 0 findings ✅
         !fact check --cnt=CNT-XXXX       → 事实核查 ✅

Phase 3: !render platform=wechat          → RND-XXXX → publish → approve → PUB-XXXX ✅
         !render platform=x               → RND-XXXX → publish → approve → PUB-XXXX ✅
         !render platform=newsletter      → RND-XXXX → publish → approve → PUB-XXXX ✅

Phase 4: !qa last --pub=PUB-XXXX          → QA-XXXX 7/8 pass-with-warnings ✅
         (3 平台全部 QA 通过)
```

---

# 2. Week 2 计划

## 2.1 阶段 5 · entry-bot 重构 + Pi Agent RPC

目标：把 `src/entry-bot.mjs`（约 1400 行）从全局 `pendingReply` 改造为 `agentManager.dispatch()` 统一入口。

### 任务

- [ ] 在 `entry-bot.mjs` 中实例化 `AgentManager`，替换 `pendingReply` 逻辑；
- [ ] Discord `messageCreate` 事件 → `agentManager.dispatch({ source, channelId, userId, text })`；
- [ ] Discord 按钮交互 → `agentManager.dispatch({ text: '!approve <id>' })`；
- [ ] dispatch 返回 `NEED_APPROVAL` → 推 Discord 审批卡片 + 按钮；
- [ ] dispatch 返回 `result.card` / `result.demoCard` / `result.kanban` → 推对应频道；
- [ ] 连接 Pi Agent RPC（`call()` 中替换占位实现）；
- [ ] 内容 Agent 接入真实 LLM（distill / privacy / fact-check / render）。

### 重构原则

```text
Before:  Discord message → entry-bot.mjs 全局 pendingReply → Pi RPC → 回复
After:   Discord message → agentManager.dispatch() → route → approval? → call() → 回复
```

### 产出

```text
src/entry-bot.mjs (重构)
src/runtime/pi-rpc-bridge.mjs (Pi Agent RPC 桥接)
```

### 完成判定

- Discord 中发送 `!pr new` → Kanban 卡片出现在 `#项目管理`；
- Discord 中发送 `!intake now` → 素材卡片出现在 `#今日素材`；
- 审批按钮点击 → `!approve <id>` 自动触发；
- 所有 19 个 Agent 的 Session JSONL 正确写入。

## 2.2 阶段 6 · 定时任务接入

目标：把内容流水线接入 cron。

### 任务

- [ ] `src/scheduler.mjs` 增加 cron：
  - 23:50 `!intake now`（intake-agent）
  - 00:00 / 09:00 / 18:00 `!distill now`（distill-agent）
  - 22:00 `!qa last`（qa-agent）
- [ ] `!distill now` 后自动推送候选卡到 `#主快讯`；
- [ ] 审批通过后自动触发 `!render` + `!publish`。

## 2.3 阶段 7 · 真实平台发布器

目标：把 `publisher-agent` 的 mock 实现替换为真实 API。

### 任务

- [ ] `src/publishers/domestic.mjs`：微信公众号 / 小红书 / 视频号 / 抖音；
- [ ] `src/publishers/overseas.mjs`：X / Newsletter / Product Hunt / YouTube / LinkedIn；
- [ ] 每个发布器实现 `publish({ html, platform })` → 返回 `{ externalUrl }`；
- [ ] 发布回执写入 `published/PUB-XXXX.json` 的 `externalUrl`。

---

# 3. 各阶段详细任务（历史记录）

## 3.1 阶段 1 · Runtime 基座 ✅

- [x] 抽 `AgentManager` 到 `src/runtime/agent-manager.mjs`；
- [x] 写 `agent-core/runtime/agent-manager.md`；
- [x] 写 `agent-core/runtime/dispatch.md`；
- [x] 注册 19 个 Agent；
- [x] 实现 `SkillLoader`；
- [x] 实现 `SessionStore`；
- [x] 实现 `MemoryScope`。

## 3.2 阶段 2 · Discord 工具扩展 ✅

- [x] `extensions/discord-tools.mjs` 新增 7 个工具；
- [x] `extensions/file-tools.mjs` 新增 5 个写入器；
- [x] 写 `agent-core/runtime/approval.md`。

## 3.3 阶段 3 · 企业 FDE Project ✅

- [x] `!pr new` → 创建项目骨架 + Kanban 卡片；
- [x] `!demo new` → 拷贝 React Demo 模板；
- [x] `!demo approve` → 审批门禁；
- [x] `!pr list` → 列出项目索引。

## 3.4 阶段 4 · 内容流水线 ✅

- [x] `!intake now` → 素材摄入；
- [x] `!distill now` → 8 维评分 + 隐私 + 事实核查；
- [x] `!privacy check` → 正则脱敏；
- [x] `!fact check` → 证据核查；
- [x] `!render platform=<p>` → HTML 渲染；
- [x] `!publish platform=<p>` → 审批 → 发布记录；
- [x] `!qa last` → 8 项质量检查。
- [x] 写 `agent-core/runtime/content-pipeline.md` 合同文档。

---

# 4. 风险与回退

| 风险 | 缓解 |
|---|---|
| `entry-bot.mjs` 一次性改造过大 | 分 PR：先接 dispatch()，再接 Pi RPC |
| Pi Agent Skill 加载过慢 | Skill 文件用 frontmatter 索引 |
| Discord 上传文件体积超 10MB | 先压缩 PDF，再长图分段上传 |
| 业务 Agent 误触外发 | `!approve` 硬性人工通过 |
| 客户数据泄露 | `data/business/accounts/<id>/` 强制权限 |
| 审批objectId 冲突 | objectId = rnd/cnt/prjId/_positional[0]，确保唯一 |

---

# 5. 同步维护

- 任何阶段产出写到对应 `agent-core/` 目录；
- 任何架构变更同步到 `docs/agent-workforce-enterprise-operating-system-blueprint.md`；
- 任何品牌 / 业务边界变更同步到 `CONTEXT.md`；
- 任何 Profile 资料更新到 `profile/`。

---

# 6. Week 1 每日落地记录

```text
Day 1  ✅ agent-manager.md + dispatch.md 契约 + AgentManager 骨架
Day 2  ✅ SkillLoader + SessionStore + MemoryScope + 19 Agent 注册
Day 3  ✅ approval.md + Approval 实现 + 14 种 ApprovalKind
Day 4  ✅ !pr new 端到端 + project-bootstrap + dispatch → approval → call 集成
Day 5  ✅ !demo new + react-demo + !pr list + parseCommand/parseArgs 修复
Day 6  ✅ 内容流水线 7 阶段 + content.mjs + content-pipeline.md + privacy/fact-check
Day 7  ✅ 完整 E2E (fde-e2e.mjs) + 3 平台渲染/发布/QA + roadmap 收尾
```

**Week 1 交付：19 Agent 注册 · 60+ 命令路由 · 7 阶段内容流水线 · 审批门禁 · 完整 E2E 验证**

---

# 7. 下一项

**Week 2 Day 1**：重构 `src/entry-bot.mjs`，把全局 `pendingReply` 替换为 `agentManager.dispatch()`，让 Discord 消息真正进入 Agent 路由系统。
