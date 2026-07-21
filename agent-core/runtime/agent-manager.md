# AgentManager 契约

> `src/runtime/agent-manager.mjs` 的接口与行为规范。  
> 负责 19 个 Agent 的注册、Session 隔离、Skill 加载、Memory Scope、错误回退。  
> 由 `src/entry-bot.mjs` 启动后注入 Pi Agent。

---

# 1. 设计目标

- 一个进程只跑一个 AgentManager；
- AgentManager 不直接做 Discord 通讯，只负责「消息 → Agent → 结果 → 事件」；
- 每个 Agent 独立 Session，互不通讯；
- Skill 按 Agent 显式加载，不全局可见；
- Memory 按 Scope 显式声明，按 Agent 显式允许；
- 失败必须回退，不能静默丢失；
- 任何外部动作都先经过审批门禁（`approval.md`）。

---

# 2. 数据结构

## 2.1 Agent Definition

```ts
type AgentId =
  | 'chief' | 'intake' | 'distill' | 'renderer' | 'publisher' | 'qa'
  | 'privacy' | 'fact-check'
  | 'sales' | 'solution' | 'cost' | 'quote' | 'bid' | 'contract'
  | 'pm' | 'delivery' | 'cs' | 'finance'
  | 'coding';

type AgentDef = {
  id: AgentId;
  displayName: string;
  description: string;
  model: { primary: string; thinking: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' };
  runtime: {
    sessionScope: 'persistent' | 'daily' | 'per-thread' | 'per-artifact' | 'per-project';
    idleTtlMinutes: number;
    maxConcurrency: number;
  };
  skills: string[];          // 相对 agent-core/skills/<name> 的路径
  memory: {
    readScopes: MemoryScopeId[];
    writeScope: MemoryScopeId;
  };
  tools: string[];          // tools/<name>
  channels: { pm?: string; demo?: string; main?: string };
  buttons: ButtonDef[];
  commands: string[];        // 形如 '!demo new <args>'
};
```

## 2.2 Skill Definition

```ts
type SkillDef = {
  name: string;             // 'react-vite'
  path: string;             // 'agent-core/skills/<name>/SKILL.md'
  scope: 'agent' | 'shared' | 'global';
  dependencies?: string[];   // 其它 skill 名
  inputs?: string[];        // 命令形参
  outputs?: string[];       // 产物
};
```

## 2.3 Session Definition

```ts
type SessionKey =
  | `${AgentId}:global`                                // persistent
  | `${AgentId}:day:${YYYY-MM-DD}`                      // daily
  | `${AgentId}:thread:${guildId}:${channelId}:${threadId}` // per-thread
  | `${AgentId}:artifact:${artifactId}`                  // per-artifact
  | `${AgentId}:project:${prjId}`;                      // per-project
```

Session 文件路径：

```text
data/agent-runtime/sessions/<agent>/<hash>.jsonl
```

`<hash>` 由 `SessionKey` 的 SHA-1 派生。

## 2.4 Memory Scope

```ts
type MemoryScopeId =
  | 'company' | 'founder' | 'coding' | 'current-project'
  | 'business' | 'finance' | 'sales' | 'fde-knowledge' | 'content'
  | 'industry' | 'agent-internal';
```

每个 Memory Scope 在 `data/agent-runtime/memory/<scope>.jsonl` 中以追加方式存储；读权限按 Agent `readScopes` 校验；写权限只能由 `writeScope` 所属 Agent 写。

## 2.5 Approval

```ts
type ApprovalKind =
  | 'quote-send' | 'contract-sign' | 'bid-submit' | 'demo-approve'
  | 'publish-domestic' | 'publish-overseas' | 'prod-deploy'
  | 'external-file-send' | 'data-delete' | 'payment-remind';

type Approval = {
  id: string;               // APR-2026-0001
  kind: ApprovalKind;
  producer: AgentId;
  summary: string;
  evidence: string[];        // 链接 / 路径 / commit
  risk: 'low' | 'medium' | 'high';
  expiresAt: string;         // ISO
  buttons: ('approve' | 'reject' | 'changes' | 'defer')[];
};
```

---

# 3. 公共接口

## 3.1 registerAgent(agent: AgentDef)

注册单个 Agent。

```ts
agentManager.registerAgent({
  id: 'coding',
  displayName: 'Coding',
  // ...
});
```

## 3.2 registerSkills(skills: SkillDef[])

预加载共享 Skill；Agent 私有 Skill 在 `registerAgent` 时按 `skills` 字段加载。

## 3.3 start()

启动 AgentManager：
1. 校验 `AgentDef.skills` 全部存在；
2. 预热 `SessionStore` 目录；
3. 注入 `SkillLoader`；
4. 启动心跳到 `#agent-状态`；
5. 注册 `extensions/discord-tools.mjs` 的新工具。

## 3.4 dispatch(event: DispatchEvent)

入口。

```ts
type DispatchEvent = {
  source: 'discord' | 'cron' | 'api' | 'pipeline';
  channelId?: string;
  userId?: string;
  text?: string;
  attachment?: { path: string; name: string };
  threadKey?: string;
  raw?: unknown;
};
```

`dispatch` 行为：

1. 解析命令（`!pr new` / `!demo new` / `!intake now` 等）；
2. 找到目标 Agent（命令路由表在 `dispatch.md`）；
3. 解析参数；
4. 检查 Approval（必要时发到 `#审批中心`）；
5. 调用 `agent.run({ session, prompt, attachments })`；
6. 订阅事件流，错误回退到 `chief-agent`。

## 3.5 shutdown()

关闭 AgentManager：
1. 取消所有 cron；
2. 等待所有 Session 落盘；
3. 关闭 Discord WebSocket；
4. 关闭 SkillLoader。

## 3.6 getStatus(agentId?: AgentId)

返回：

```ts
type AgentStatus = {
  agentId: AgentId;
  state: 'idle' | 'running' | 'queued' | 'error' | 'cooldown';
  lastRunAt?: string;
  lastError?: string;
  sessionCount: number;
  tokenUsage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  costUsd: number;
  currentTask?: string;
};
```

由 `qa-agent` 写入 `#agent-状态` 频道。

---

# 4. 内部行为

## 4.1 Session 隔离

- `sessionScope` 决定 Session 复用策略：
  - `persistent`：全局一份；
  - `daily`：每天 00:00（UTC+8）新建；
  - `per-thread`：每个 Discord Thread 一份；
  - `per-artifact`：每个 artifact 一份；
  - `per-project`：每个 PRJ 一份。
- 同一 Agent 不同 Session **绝不**互相读取内容，只共享 `MemoryScope`。
- Session 文件超过 `idleTtlMinutes` 后被回收。

## 4.2 Skill 加载

- Agent 注册时根据 `skills` 字段，按顺序加载；
- Skill 加载失败 → `state = 'error'`，心跳到 `#agent-状态`；
- Skill 之间有 `dependencies` 时，依赖项自动前置；
- 加载结果缓存到 `data/agent-runtime/skill-cache/<agent>/<skill>.json`。

## 4.3 Memory Scope

- `readScopes` 决定 Agent 可以读取哪些 Memory；
- `writeScope` 决定 Agent 可以写入哪个 Memory（只能一个）；
- `industry` Memory Scope 按行业命名，例如 `industry/ai-agent`；
- 任何越权读写都会抛 `PermissionError`，记入 `audit.md`。

## 4.4 并发

- 每个 Agent 有 `maxConcurrency`；
- 超过并发限制时新请求进入队列；
- 队列超过 10 分钟仍未开始 → 记入 `audit.md` 并通知 `chief-agent`；
- 长期运行任务（> 30 分钟）需要拆分为子任务或由 `chief-agent` 仲裁。

## 4.5 错误回退

| 错误类型 | 行为 |
|---|---|
| `AgentNotFound` | `dispatch` 返回错误，记入 `audit.md` |
| `SkillNotFound` | 启动时拒绝注册；运行时返回错误 |
| `SessionLockTimeout` | 5 秒后强制解锁并告警 |
| `ToolPermissionDenied` | 发到 `#审批中心` |
| `ModelTimeout` | 切换备用模型，重试 1 次 |
| `TokenBudgetExceeded` | 进入 cooldown 1 小时 |
| `DiscordSendFailed` | 退避重试 3 次，失败后写本地 inbox |

## 4.6 失败重试

- 同一任务最多 3 次重试；
- 重试间隔 30s / 2min / 10min；
- 仍失败 → 通知 `chief-agent` 人工介入；
- 任何重试必须先重置 Session 上下文。

## 4.7 审批门禁

- 详见 `agent-core/runtime/approval.md`；
- `dispatch` 在执行外部动作前必须 `await approval.check(kind, payload)`；
- 超过 `expiresAt` 自动撤销；
- 审批未通过 → 不执行外部动作，结果回到 Agent。

## 4.8 心跳

每 60s：

```text
[2026-07-19 23:50] coding: idle (1.2k ctx) | session:0 | cost:0.21 USD
```

由 `qa-agent` 写入 `#agent-状态`。

## 4.9 审计

- 所有 dispatch、approval、external 动作都写入 `data/agent-runtime/audit/YYYY-MM-DD.jsonl`；
- `chief-agent` 每周汇总 `audit.md` 中的 Top10 风险。

## 4.10 关闭

- `shutdown()` 必须等待所有 running 任务完成或超时；
- 写 `audit.md` 记录 shutdown 事件；
- Discord 推送 "AgentManager stopped"。

---

# 5. 错误码

```ts
enum AgentError {
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  SKILL_NOT_FOUND = 'SKILL_NOT_FOUND',
  SESSION_LOCK_TIMEOUT = 'SESSION_LOCK_TIMEOUT',
  TOOL_PERMISSION_DENIED = 'TOOL_PERMISSION_DENIED',
  MODEL_TIMEOUT = 'MODEL_TIMEOUT',
  TOKEN_BUDGET_EXCEEDED = 'TOKEN_BUDGET_EXCEEDED',
  DISCORD_SEND_FAILED = 'DISCORD_SEND_FAILED',
  APPROVAL_REJECTED = 'APPROVAL_REJECTED',
  APPROVAL_EXPIRED = 'APPROVAL_EXPIRED',
  RATE_LIMITED = 'RATE_LIMITED',
  UNKNOWN = 'UNKNOWN',
}
```

---

# 6. 持久化

```text
data/agent-runtime/
├── sessions/         # Session JSONL
├── memory/           # Memory Scope JSONL
├── skill-cache/      # Skill 加载缓存
├── intake/           # intake-agent 每日拉取
├── drafts/           # 草稿
├── library/          # 内容库
├── audit/            # 审计日志
└── state.json        # AgentManager 状态
```

每条文件均含 `created_at` / `agent_id` / `session_id` 三个元字段。

---

# 7. 与现有系统连接

| 已有 | 改造方式 |
|---|---|
| `src/entry-bot.mjs` | 抽 AgentManager；保留 Discord 客户端与 RpcClient |
| `src/scheduler.mjs` | 注册 `intake / distill / coding` 三个 cron |
| `extensions/discord-tools.mjs` | 新增 7 个工具 |
| `extensions/file-tools.mjs` | 新增 5 个 writer |
| `src/runtime/agent-manager.mjs` | 本契约的实现入口 |

---

# 8. 测试

- 每个 Agent 至少 1 条路由测试；
- 每个 Skill 至少 1 条加载测试；
- Session 隔离测试：两个不同 Session 互不读取；
- Memory 权限测试：未声明的 Scope 不可读；
- Approval 测试：必须人工确认的动作在未通过时返回 `APPROVAL_REJECTED`。

---

# 9. 下一项

下一项：

- 实现 `src/runtime/agent-manager.mjs` 骨架（仅类型与注册表）；
- 把 19 个 Agent 的 `AgentDef` 写成 JSON 文件 `agent-core/agents/registry.json`；
- 在 `entry-bot.mjs` 中替换 `pendingReply` 为 `agentManager.dispatch()`。

完成后，Day 1 任务完成。
