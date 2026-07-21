# Discord Dispatch 契约

> `agentManager.dispatch()` 的命令路由与动作映射。  
> 落地在 `src/commands/dispatch.mjs`，被 `src/runtime/agent-manager.mjs` 调用。  
> 不直接耦合 Discord 客户端，Agent 输出通过 `extensions/discord-tools.mjs` 推回 Discord。

---

# 1. 设计目标

- 一个表覆盖所有命令；
- 命令 → Agent → Skill 串接；
- 错误回退到 `chief-agent`；
- 参数解析在表内完成；
- 不允许 Agent 互相通讯（除 chief 仲裁外）。

---

# 2. 命令分类

| 分类 | 前缀 | 来源 |
|---|---|---|
| 内容 | `!intake` / `!distill` / `!render` / `!publish` / `!qa` | 国内 `#主快讯` / 海外 `#main-feed` |
| FDE | `!pr` / `!prd` / `!demo` / `!research` / `!build` / `!cs` | 国内 `#项目管理` / `#fde-客户交付` |
| 业务 | `!lead` / `!disc` / `!quote` / `!bid` / `!contract` / `!pm` / `!cs` / `!invoice` | 业务频道 |
| 系统 | `!state` / `!restart` / `!cost` / `!memory` / `!approve` | `#总控台` / `#审批中心` |
| Coding | `!code` / `!coding` | 编程与构建 |

---

# 3. 完整命令路由表

## 3.1 内容主链

| 命令 | Agent | 关键 Skill | 接收频道 |
|---|---|---|---|
| `!intake now` | intake | daily-intake | `#今日素材` / `#raw-materials` |
| `!distill now` | distill | privacy-redact, fact-check, brand-voice-zh/en | `#主快讯` / `#main-feed` |
| `!render platform=<p> id=<id>` | renderer | platform-*, channel-renderer-* | `#preview-*` / `#publish-*` |
| `!publish platform=<p> id=<id>` | publisher | platform-* | `#publish-*` |
| `!qa last 7d` | qa | fact-check | `#主快讯` / `#main-feed` |
| `!brief id=<id>` | distill | brand-voice-zh/en | `#主快讯` / `#main-feed` |
| `!approve id=<id>` | chief | approval | `#审批中心` |
| `!reject id=<id>` | chief | approval | `#审批中心` |
| `!defer id=<id>` | chief | approval | `#审批中心` |

## 3.2 FDE Project 主链

| 命令 | Agent | 关键 Skill | 接收频道 |
|---|---|---|---|
| `!pr new <alias> <industry> <一句话需求>` | pm | project-bootstrap | `#项目管理` |
| `!pr list` | pm | project-list | `#项目管理` |
| `!prd v0.1 <PRJ-ID>` | solution | industry-prd, runtime-research | `#项目管理` |
| `!prd v1.0 <PRJ-ID>` | solution | industry-prd, demo-review | `#项目管理` |
| `!prd diff <PRJ-ID> <from> <to>` | solution | prd-diff | `#项目管理` |
| `!demo new <PRJ-ID>` | coding | react-design, component-library, react-vite, react-router, tailwind-v4, shadcn-ui, tanstack-query, msw-mock, react-testing, zenbuild-design-tokens, react-demo, pnpm-install, codespace-build | `#fde-客户交付` |
| `!demo refactor <PRJ-ID>` | coding | react-design | `#fde-客户交付` |
| `!demo approve <PRJ-ID>` | coding + chief | approval | `#fde-客户交付` |
| `!demo request-changes <PRJ-ID> <note>` | coding | react-design | `#fde-客户交付` |
| `!demo run <PRJ-ID>` | coding | codespace-build | `#fde-客户交付` |
| `!research new <PRJ-ID> <alg-name>` | solution | research-notebook | `#项目管理` |
| `!research update <PRJ-ID> <alg-name>` | solution | research-notebook | `#项目管理` |
| `!build stage set <PRJ-ID> <stage>` | pm | stage-gate | `#项目管理` |
| `!cs document <PRJ-ID>` | cs | knowledge-redact | `#主快讯` |

## 3.3 业务主链

| 命令 | Agent | 关键 Skill | 接收频道 |
|---|---|---|---|
| `!lead new <name> <contact> <problem>` | sales | lead-capture | `#销售线索` |
| `!lead list` | sales | lead-list | `#销售线索` |
| `!lead qualify <LEAD-ID>` | sales | qualification | `#销售线索` |
| `!disc start <OPP-ID>` | solution | discovery | `#商机与方案` |
| `!disc set goals <DISC-ID> ...` | solution | discovery | `#商机与方案` |
| `!disc set scope <DISC-ID> ...` | solution | discovery | `#商机与方案` |
| `!quote draft <OPP-ID>` | quote | estimate | `#报价` |
| `!quote set discount <QTE-ID> <n>` | quote | discount | `#报价` |
| `!quote approve <QTE-ID>` | chief | approval | `#审批中心` |
| `!bid start <tender-url-or-id>` | bid | tender-ingestion | `#标书` |
| `!bid compliance <BID-ID>` | bid | compliance-matrix | `#标书` |
| `!bid submit <BID-ID>` | chief | approval | `#审批中心` |
| `!contract new <QTE-ID>` | contract | contract-summarize | `#合同运营` |
| `!contract risk <CTR-ID>` | contract | risk-register | `#合同运营` |
| `!contract sign <CTR-ID>` | chief | approval | `#审批中心` |
| `!pm plan <PRJ-ID>` | pm | plan-build | `#项目管理` |
| `!pm weekly <PRJ-ID>` | pm | weekly-report | `#项目管理` |
| `!pm risk <PRJ-ID>` | pm | raid | `#项目管理` |
| `!poc start <PRJ-ID>` | delivery | poc-plan | `#fde-客户交付` |
| `!poc deploy <PRJ-ID>` | delivery | deploy | `#fde-客户交付` |
| `!incident <PRJ-ID> <summary>` | delivery | incident | `#fde-客户交付` |
| `!qa plan <PRJ-ID>` | qa | test-plan | `#测试与验收` |
| `!qa accept <PRJ-ID>` | qa | acceptance | `#测试与验收` |
| `!qa defect <PRJ-ID> ...` | qa | defect | `#测试与验收` |
| `!cs health <account-id>` | cs | health-report | `#客户成功` |
| `!cs qbr <account-id>` | cs | qbr | `#客户成功` |
| `!invoice request <CTR-ID>` | finance | invoice-request | `#开票与回款` |
| `!invoice remind <INV-ID>` | finance | reminder | `#开票与回款` |

## 3.4 系统

| 命令 | Agent | 关键 Skill | 接收频道 |
|---|---|---|---|
| `!state` | chief | status-read | `#总控台` |
| `!state <agent>` | chief | status-read | `#总控台` |
| `!restart <agent>` | chief | restart | `#总控台` |
| `!cost today` | chief | cost-read | `#总控台` |
| `!cost last 7d` | chief | cost-read | `#总控台` |
| `!memory <scope>` | chief | memory-read | `#总控台` |
| `!approve <object-id>` | chief | approval | `#审批中心` |
| `!reject <object-id>` | chief | approval | `#审批中心` |
| `!defer <object-id>` | chief | approval | `#审批中心` |

---

# 4. 命令解析器

```ts
type Command = {
  raw: string;          // 原文
  name: string;         // 'pr'
  sub: string;          // 'new'
  args: Record<string, string>;
  flags: Record<string, string | true>;
};

function parseCommand(text: string): Command | null {
  // 形如 "!pr new client-alpha ai-agent \"做一个 AI 客服\""
  // flag: --industry=ai-agent
}
```

解析错误 → 把原消息送回 `chief-agent` 提示 `unknown command`。

---

# 5. 路由决策

```ts
function route(cmd: Command): {
  agentId: AgentId;
  skill: string;
  channelId: string;
  approval?: ApprovalKind;
} {
  // 1. 找表项
  // 2. 找 Agent
  // 3. 找 Skill
  // 4. 找 Channel
  // 5. 找 Approval
}
```

未匹配 → 路由到 `chief-agent`，频道 `#总控台`，提示 `unknown command: <cmd>`。

---

# 6. Channel → Agent 绑定

| Channel | 接收 Agent | 命令前缀 |
|---|---|---|
| `#主快讯` | distill | 内容 |
| `#main-feed` | distill | 内容 |
| `#今日素材` | intake | 内容 |
| `#raw-materials` | intake | 内容 |
| `#preview-*` | renderer | 内容 |
| `#publish-*` | publisher | 内容 |
| `#销售线索` | sales | 业务 |
| `#商机与方案` | solution | 业务 |
| `#报价` | cost / quote | 业务 |
| `#标书` | bid | 业务 |
| `#合同运营` | contract | 业务 |
| `#项目管理` | pm | 业务 / FDE |
| `#fde-客户交付` | coding | FDE |
| `#测试与验收` | qa | 业务 |
| `#客户成功` | cs | 业务 |
| `#开票与回款` | finance | 业务 |
| `#总控台` | chief | 系统 |
| `#审批中心` | chief | 系统 |
| `#agent-状态` | qa | 系统 |

未匹配频道 → `chief-agent`。

---

# 7. 按钮 → Action 映射

| 按钮 | Action | 触发 Agent |
|---|---|---|
| `Approve` | 推进 stage / 触发 publish / 标记合同已签 | chief |
| `Reject` | 状态回到 previous stage | chief |
| `Defer` | 候选入池 | chief |
| `Request Changes` | 回到 render / distill 阶段 | renderer / distill |
| `Open Live Preview` | 拉起 codespace / dev server | coding |
| `Download Build` | 推送 `dist.zip` | coding |
| `Send to Publish` | 触发 publisher-agent | publisher |
| `Send to Engineering` | 进入 Stage 4 | delivery |
| `Send to Knowledge Base` | 入 knowledge-pack | knowledge |
| `Approve Stage` | 推进 stage | chief |
| `Move to Next Stage` | 推进 stage | chief |
| `Block` | 卡住当前 stage，等人工 | chief |

按钮回调在 Discord 收到 Interaction，由 `dispatch.handleButtonInteraction()` 派发。

---

# 8. 失败回退

| 失败 | 回退 |
|---|---|
| 命令不存在 | 提示 `unknown command`，路由 `chief-agent` |
| 参数缺失 | 提示 `missing arg: <key>`，不路由 |
| Agent 不可用 | 提示 `agent <id> unavailable`，路由 `chief-agent` |
| 越权 Skill | 提示 `permission denied`，audit |
| 审批未通过 | 不执行外部动作 |
| Channel 不匹配 | 路由 `chief-agent` |

---

# 9. 与 AgentManager 连接

```ts
agentManager.dispatch({
  source: 'discord',
  channelId: 'CH_...',
  userId: '...',
  text: '!demo new PRJ-2026-0001',
  threadKey: 'thread-id',
});
```

`agentManager` 内部：

1. `dispatch` 解析命令；
2. `route` 找到 Agent + Skill + Channel + Approval；
3. 调 `approval.check()`；
4. 通过则 `agentManager.call(agentId, skill, args)`；
5. Agent 输出通过 `extensions/discord-tools.mjs` 推回 Discord。

---

# 10. 测试

- 19 个 Agent × 4 类命令 = 76 个最小测试矩阵；
- 每个命令至少 1 个 happy path + 1 个 missing-arg + 1 个 permission-denied；
- 按钮回调至少 1 个 happy + 1 个 reject。

---

# 11. 下一项

实现 `src/commands/dispatch.mjs`：

1. 写 `Command` 类型与解析器；
2. 把本文件 §3 的表格写成数据；
3. 实现 `route()`；
4. 实现 `handleButtonInteraction()`；
5. 接入 `agentManager.dispatch()`。

完成后 Day 1 完成。
