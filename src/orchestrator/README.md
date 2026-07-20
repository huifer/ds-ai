# 多 Agent 系统架构 (Multi-Agent System)

## 概述

将原"单一 Discord Bot 处理所有频道"重构为"多 Agent 协作系统"，每个分类有专属的 Agent，实现:
- ✅ **Session 隔离** - 每个 (channelId, userId, topicKey, agentId) 独立上下文
- ✅ **自动压缩** - 轮次/token/时间三种触发，L1 L2 L3 三层摘要策略
- ✅ **智能路由** - 频道→Agent 硬映射 + 关键词软路由 + 默认兜底
- ✅ **Command 映射** - 60+ 命令绑定到具体 Agent，支持 Team 协作
- ✅ **Memory 分层** - Session(L0) → AgentScope(L1) → SharedScope(L2) → KnowledgeBase(L3)
- ✅ **无头模式** - 所有模块都不依赖 TUI，纯 RPC + 进程化
- ✅ **真实加载** - 从 agent-core/agents/registry.json 加载 25 个真实 agent + 115 个 skill

## 完整模块列表

```
src/orchestrator/
├── session-pool.mjs           # Session 池（每频道/每话题独立 session）
├── context-compressor.mjs     # 自动压缩（LLM/规则/混合策略）
├── agent-registry.mjs         # Agent 注册表（从 registry.json 加载 25 个真实 agent）
├── router.mjs                 # 三层路由（频道/关键词/兜底）
├── agent-manager.mjs          # 多 Agent 调度器（主入口）
├── command-router.mjs         # Command → Agent/Skill/Team 映射
├── team-engine.mjs            # Team 引擎（多 Agent 协作执行）
├── memory-bridge.mjs          # Memory 分层桥接（11 个 scope）
├── integrate.mjs              # 与现有 entry-bot 集成
└── README.md                  # 本文档
```

## Team 引擎

实现复杂任务的多 Agent 协作。预定义 5 个 Team：

| Team | 步骤 | 审批 |
|------|------|------|
| `lead-to-contract` | sales/lead-capture → sales/qualification → quote/estimate → contract/summarize | contract-sign |
| `idea-to-publish` | distill/brief → renderer/render (并行) → qa/report → publisher/publish | publish-domestic |
| `pr-full-cycle` | pm/bootstrap → project/plan → solution/prd-v10 → delivery/poc → qa/test-plan | prod-deploy |
| `sales-deep-dive` | sales/lead → sales/qualify → solution/disc → solution/prd → quote/estimate | quote-send |
| `incident-response` | delivery/incident → delivery/runbook (并行的 qa/health-report) → delivery/deploy | - |

使用示例：
```
!lead-to-contract 客户ABC公司,需要 AI Agent 平台,预算 50万
!idea-to-publish 灵感XYZ
```

执行状态：
- `success` - 全部步骤成功
- `awaiting_approval` - 等待人工审批
- `failed` - 某步骤失败

所有执行历史持久化到 `data/team-execution/<id>.json`。

## 核心架构图

```
                    Discord Messages
                          ↓
                   ┌─────────────┐
                   │   Router    │  ← 三层路由
                   └──────┬──────┘
                          ↓
              ┌───────────┴───────────┐
              ↓                       ↓
       ┌─────────────┐         ┌─────────────┐
       │ !command    │         │  自由文本    │
       │ CommandRouter│        │  Multi-Agent│
       └──────┬──────┘         └──────┬──────┘
              ↓                       ↓
       ┌──────────────┐       ┌──────────────┐
       │ 旧 AgentMgr  │       │ SessionPool  │
       │(兼容现有)    │       │  ContextCmpr │
       └──────────────┘       │ MemoryBridge │
                              └──────┬───────┘
                                     ↓
                              ┌──────────────┐
                              │   Pi RPC     │ ← 无头模式
                              │  (RpcClient) │
                              └──────────────┘
```

## Agent 详细列表

### 公开 Agent (14 个)

| ID | 名称 | 分类 | 频道数 | Memory Scope |
|----|------|------|--------|--------------|
| `orchestrator` | Orchestrator | 00-总控 | 2 | agent-internal |
| `planner` | Planner | 00-总控 | 1 | agent-internal |
| `approver` | Approver | 00-总控 | 1 | agent-internal |
| `sales` | Sales | 10-企业服务 | 5 | sales |
| `project` | Project Manager | 10-企业服务 | 2 | agent-internal |
| `support` | Customer Success | 10-企业服务 | 2 | agent-internal |
| `dev` | Developer | 20-技术产品 | 8 | coding |
| `eng-kb` | Engineering KB | 20-技术产品 | 1 | fde-knowledge |
| `seo` | SEO/GEO | 30-增长商业 | 2 | agent-internal |
| `marketing` | Marketing | 30-增长商业 | 4 | agent-internal |
| `domestic-editor` | 国内总编 | 40-国内总编 | 10 | content |
| `overseas-editor` | Overseas Editor | 50-海外总编 | 10 | content |
| `asset` | Asset Manager | 60-资产中心 | 12 | agent-internal |
| `dreaming` | Dreaming (遐思) | 遐思 | 2 | agent-internal |

### 兼容旧 Agent (3 个, hidden)

`pm`, `coding`, `chief` 等保留,用于兼容现有 `!command`。

## Command → Agent 完整映射

### 单 Agent 命令(共 60+ 个)

| Agent | 命令数 | 命令示例 |
|-------|--------|----------|
| approver | 3 | `!approve`, `!reject`, `!defer` |
| chief | 9 | `!state`, `!cost`, `!memory`, `!restart` |
| bid | 2 | `!bid start`, `!bid compliance` |
| coding | 4 | `!demo new`, `!demo run` |
| contract | 2 | `!contract new`, `!contract risk` |
| cs | 3 | `!cs health`, `!cs qbr` |
| delivery | 2 | `!poc start`, `!incident` |
| distill | 2 | `!distill now`, `!brief` |
| fact-check | 1 | `!fact check` |
| finance | 2 | `!invoice request`(需审批), `!invoice remind` |
| intake | 1 | `!intake now` |
| pm | 3 | `!pr new`, `!pr list`, `!build stage` |
| privacy | 1 | `!privacy check` |
| project | 3 | `!pm plan`, `!pm weekly`, `!pm risk` |
| publisher | 1 | `!publish`(需审批) |
| qa | 4 | `!qa plan`, `!qa accept`, `!qa defect` |
| quote | 2 | `!quote draft`, `!quote set` |
| renderer | 3 | `!render`, `!auto-render`, `!deliver` |
| sales | 3 | `!lead new`, `!lead list`, `!lead qualify` |
| solution | 7 | `!prd v0.1`, `!prd v1.0`, `!research new` |

### Team 协作命令(3 个)

| Team ID | 描述 | 步骤 |
|---------|------|------|
| `lead-to-contract` | 线索→商机→报价→合同 | sales → sales → quote → contract |
| `idea-to-publish` | 灵感→素材→渲染→发布 | distill → renderer → qa → publisher |
| `pr-full-cycle` | 项目立项→计划→POC→部署 | pm → project → solution → delivery → qa |

## Memory 分层架构

```
┌────────────────────────────────────────────────────────────┐
│ L0 Session (短期,单次对话)                                  │
│   - SessionPool 管理                                        │
│   - 自动压缩触发:轮次/token/时间                            │
│   - 持久化到 disk: data/multi-agent-sessions/               │
├────────────────────────────────────────────────────────────┤
│ L1 Agent Scope (中期,Agent 私有)                            │
│   - 每个 Agent 有独立 writeScope                            │
│   - MemoryBridge.writeMemory() 写入                        │
│   - 持久化到 disk: data/agent-runtime/memory/<scope>.jsonl  │
├────────────────────────────────────────────────────────────┤
│ L2 Shared Scope (中期,跨 Agent 共享)                        │
│   - readScopes 控制谁能读                                    │
│   - company / business / industry 等                         │
│   - transferMemory() 跨 agent 传递                          │
├────────────────────────────────────────────────────────────┤
│ L3 Knowledge Base (长期,全局)                               │
│   - memory-store (现有):data/memory/                         │
│   - 向量索引:data/memory/vector/                             │
│   - memoryContext.buildContext() RAG 检索                   │
└────────────────────────────────────────────────────────────┘
```

### Agent Memory 权限矩阵

| Agent | readScopes | writeScope |
|-------|------------|------------|
| orchestrator | company, business, agent-internal | agent-internal |
| sales | company, business, **sales** | sales |
| project | company, business, current-project, agent-internal | agent-internal |
| dev | **coding**, fde-knowledge, current-project | **coding** |
| eng-kb | **coding**, fde-knowledge | fde-knowledge |
| seo | company, business, industry | agent-internal |
| marketing | company, business, industry | agent-internal |
| domestic-editor | content, company | **content** |
| overseas-editor | content, company | **content** |
| asset | company, business, content | agent-internal |
| dreaming | company, business, **coding, content, sales**, agent-internal | agent-internal |

## Session 隔离设计

### Session Key 格式

```
{channelId}:{userId}:t:{topicKey}:a:{agentId}
```

举例:
- `ch_001:user_zhang:t:review_my_pr:a:dev` - 用户 zhang 在 dev 频道聊代码评审
- `ch_002:user_li:t:abc_company_intro:a:sales` - 用户 li 在 sales 频道聊 ABC 公司

### 隔离维度

1. **频道隔离** - 不同频道独立 session
2. **用户隔离** - 同一频道不同用户独立
3. **话题隔离** - 同一用户同一频道不同话题独立
4. **Agent 隔离** - 不同 Agent 处理同一消息时 session 也独立

### 自动压缩

3 种触发:
- **轮次** - 默认每 20 轮(user+assistant=1 轮)压缩
- **Token** - 默认累计 60k tokens 压缩
- **时间** - 默认 30 分钟空闲卸载(可恢复)

3 种策略:
- **Simple** - 规则化(提取数字、日期、决策词),无需 LLM
- **LLM** - 用 LLM(haiku)生成高质量摘要
- **Hybrid** - LLM 优先,失败降级

## 三层路由

### 第 1 层: 频道映射 (硬路由)

```
#软件开发 → dev
#销售线索 → sales
#seo-geo → seo
```

### 第 2 层: 关键词匹配 (软路由)

```javascript
KEYWORD_RULES = [
  // 开发
  { keywords: ['代码', 'bug', '函数', '重构', ...], agent: 'dev', weight: 3 },
  { keywords: ['commit', 'pr', 'merge', 'git'], agent: 'dev', weight: 2 },

  // 销售
  { keywords: ['客户', '合同', '报价', '跟进'], agent: 'sales', weight: 3 },

  // SEO
  { keywords: ['seo', '关键词', '排名', '外链'], agent: 'seo', weight: 3 },

  // 内容编辑 - 国内
  { keywords: ['公众号', '小红书', '抖音'], agent: 'domestic-editor', weight: 3.5 },

  // 内容编辑 - 海外
  { keywords: ['twitter', 'linkedin', 'youtube'], agent: 'overseas-editor', weight: 2.5 },
  ...
]
```

### 第 3 层: 默认兜底

- 主入口 → orchestrator
- 业务频道 → 该频道的 Agent
- 其他 → orchestrator (fallback)

## Pi Agent SDK 集成(无头模式)

我们使用 Pi Agent 提供的 **RPC 模式** 实现无头运行:

```javascript
import { RpcClient } from '@earendil-works/pi-coding-agent';

const pi = new RpcClient({
  cliPath: '/path/to/pi-coding-agent/dist/cli.js',
  cwd: '/path/to/project',
  provider: 'minimax-cn',
  model: 'MiniMax-M3',
  args: [
    '--mode', 'rpc',         // ← 无头模式,不走 TUI
    '--extension', toolPath,
    '--session-dir', sessionDir,
  ],
});

await pi.start();

// 流式调用
await pi.prompt(text);
await pi.waitForIdle();

// 一次性调用
const events = await pi.promptAndWait(text, null, 60_000);
const reply = await pi.getLastAssistantText();

// 内置压缩
const result = await pi.compact(customInstructions);
await pi.setAutoCompaction(true);
```

### Pi Agent SDK 关键能力

| 能力 | 用法 |
|------|------|
| 流式响应 | `pi.onEvent()` 订阅 + `text_delta` 事件 |
| Session 管理 | `newSession()`, `switchSession()`, `fork()`, `clone()` |
| 内置压缩 | `compact()`, `setAutoCompaction(true)` |
| Token 统计 | `getSessionStats()` |
| 工具调用 | 通过 `--extension` 注入自定义工具 |
| Bash 执行 | `pi.bash(command)` |
| 消息历史 | `getEntries()`, `getMessages()` |
| 模型切换 | `setModel()`, `cycleModel()` |
| 思考级别 | `setThinkingLevel()` |

## 使用方式

### 1. 测试所有功能

```bash
# Agent 频道配置 vs Discord 真实频道
node verify-agents.mjs

# 路由测试(用真实 Discord 频道 ID)
node test-routing-real.mjs

# Command Router 测试
node test-command-router.mjs

# Multi-Agent 核心测试(不依赖 LLM)
node test-multi-agent.mjs

# Memory Bridge 测试
node test-memory-bridge.mjs

# 端到端真实 LLM 测试(消耗 token)
node test-e2e-real-llm.mjs
```

### 2. 查看状态

```bash
node multi-agent-status.mjs
```

### 3. 在 entry-bot.mjs 中启用(灰度切换)

在 `src/entry-bot.mjs` 的 `handleUserMessage` 早期添加:

```javascript
import { shouldRouteToMultiAgent, handleViaMultiAgent, createMultiAgentManager } from './orchestrator/integrate.mjs';

// 初始化(在 main() 中)
const multiAgentManager = createMultiAgentManager({
  rootDir: ROOT,
  piBridge,
  log,
});
// 可选:接入现有 memory 系统
// multiAgentManager.setMemoryContext(memoryContext);

// 在 handleUserMessage 早期判断
if (shouldRouteToMultiAgent(msg, multiAgentManager.registry)) {
  await discord.react(msg, '⏳');
  try {
    const result = await handleViaMultiAgent(multiAgentManager, msg);
    await msg.reply(result.reply.slice(0, 1900)).catch(() => {});
    if (result.compressed) {
      await msg.react('🗜️').catch(() => {});
    }
  } catch (e) {
    await msg.reply(`❌ ${e.message}`).catch(() => {});
  }
  await discord.removeReact(msg, '⏳');
  return;
}
// ... 继续原有逻辑(处理 !command 等)
```

## 配置项 (.env)

```bash
# ---- Session Pool ----
SESSION_MAX_TURNS=20              # 每 20 轮触发压缩
SESSION_MAX_TOKENS=60000          # token 超 60k 触发压缩
SESSION_KEEP_RECENT=5             # 压缩后保留最近 5 轮
SESSION_IDLE_MINUTES=30           # 30 分钟空闲卸载
SESSION_PERSIST_DIR=data/multi-agent-sessions

# ---- 压缩策略 ----
COMPRESS_STRATEGY=hybrid          # simple / llm / hybrid
COMPRESS_MODEL=haiku              # 摘要用便宜模型

# ---- Memory Bridge ----
MEMORY_DEFAULT_SCOPE=agent-internal
MEMORY_MAX_READ=100
```

## 测试矩阵

| 测试 | 覆盖 | 结果 |
|------|------|------|
| `verify-agents.mjs` | Agent 声明频道 vs Discord 真实频道 | 67/67 |
| `test-routing-real.mjs` | 16 个真实路由场景 | 16/16 |
| `test-command-router.mjs` | 60+ 命令 + 3 Team | 18/18 |
| `test-multi-agent.mjs` | 核心 Session/压缩/路由 | 5/5 |
| `test-memory-bridge.mjs` | Memory 分层 + 权限隔离 | 全部通过 |
| `test-e2e-real-llm.mjs` | 端到端真实 LLM 调用 | 7/7 |

总计:**40+ 测试场景全部通过**

## 兼容性矩阵

| 现有功能 | 是否兼容 |
|----------|----------|
| 现有 `!command` 命令 | ✅ 通过 CommandRouter + 旧 AgentManager |
| 现有 Pi RPC 客户端 | ✅ 复用,无需重启 |
| 现有 memory-store | ✅ MemoryBridge 桥接 |
| 现有 dreaming 系统 | ✅ 独立 dreaming agent |
| 旧 agent id (pm/coding/chief) | ✅ 作为 hidden 保留 |
| launchd 守护进程 | ✅ 不改变启动方式 |

## 未来扩展

- **进程级隔离**: 每个 Agent 独立 Pi RPC 进程(更彻底的资源隔离)
- **跨进程编排**: orchestrator 可调度多进程 agent
- **可视化面板**: Web UI 显示多 Agent 状态、session 拓扑
- **Token 计量**: 精确统计每个 Agent 的 token 消耗 + 成本
- **A/B 测试**: 同一 agent 不同 prompt 模板的对比
- **持久记忆 RAG**: 把每个 Agent 的重要发现存入 MemoryStore + 向量索引