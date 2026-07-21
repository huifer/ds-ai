# 一人公司 Agent 增强体系：记忆·循环·做梦·OPC 优化

> 本文档针对 pi-discord-agents 系统的深度增强，涵盖：
> 1. 内存与记忆层面的问题诊断与增强设计
> 2. 循环智能体（Loop Agent / Loop Engineer）体系设计
> 3. 「做梦」（Dreaming）机制增强（好梦 + 信息挖掘）
> 4. 一人公司（OPC）场景优化

---

## 一、内存与记忆层面：问题诊断与增强设计

### 1.1 当前系统现状

当前系统已有**四层记忆架构**：

```
┌────────────────────────────────────────────────────────────┐
│ L0 Session (短期)                                          │
│   - SessionPool 管理                                        │
│   - 自动压缩:轮次/token/时间三种触发                        │
│   - 持久化到 data/multi-agent-sessions/                    │
├────────────────────────────────────────────────────────────┤
│ L1 Agent Scope (中期,Agent 私有)                            │
│   - 每个 Agent 有独立 writeScope                            │
│   - MemoryBridge.writeMemory() 写入                        │
│   - 持久化到 data/agent-runtime/memory/<scope>.jsonl       │
├────────────────────────────────────────────────────────────┤
│ L2 Shared Scope (中期,跨 Agent 共享)                       │
│   - company / business / industry 等                        │
│   - transferMemory() 跨 Agent 传递                         │
├────────────────────────────────────────────────────────────┤
│ L3 Knowledge Base (长期,全局)                               │
│   - memory-store: data/memory/                              │
│   - 向量索引: data/memory/vector/                          │
│   - memoryContext.buildContext() RAG 检索                   │
└────────────────────────────────────────────────────────────┘
```

### 1.2 当前存在的核心问题

| # | 问题 | 影响 | 优先级 |
|---|------|------|--------|
| 1 | **记忆无生命周期管理** | 记忆只增不减，久而久之变成垃圾堆 | 🔴 高 |
| 2 | **记忆无重要性评分** | 无法区分"关键决策"和"日常闲聊" | 🔴 高 |
| 3 | **记忆无引用计数** | 不知道哪些记忆被真正使用 | 🟡 中 |
| 4 | **记忆无增量更新** | 同一主题多次分散存储，无法合并 | 🟡 中 |
| 5 | **梦境产物未自动吸收** | 梦境洞察只存在梦境系统，无法反哺主记忆 | 🟡 中 |
| 6 | **Agent 间记忆传递不智能** | 只能显式 transfer，无自动发现机制 | 🟡 中 |
| 7 | **遗忘机制缺失** | 用户改变主意后，记忆不会自动更新 | 🟡 中 |

### 1.3 增强设计：记忆 2.0 系统

#### 1.3.1 记忆生命周期管理

```javascript
// 新增记忆状态机
const MEMORY_STATES = {
  ACTIVE: 'active',           // 活跃，正在使用
  STALE: 'stale',             // 过期，超过 90 天无引用
  ARCHIVED: 'archived',       // 已归档，冷存储
  SUPERSEDED: 'superseded',   // 已被新记忆替代
  FLAGGED: 'flagged',         // 标记待审核（矛盾检测触发）
};

// 自动状态转换规则
async function evaluateMemoryState(memory, { context }) {
  const now = Date.now();
  const lastUsed = new Date(memory.lastUsedAt || memory.createdAt).getTime();
  const daysSinceUse = (now - lastUsed) / (86400 * 1000);
  
  // 规则1: 90 天无引用 → STALE
  if (daysSinceUse > 90 && memory.state === MEMORY_STATES.ACTIVE) {
    return MEMORY_STATES.STALE;
  }
  
  // 规则2: 365 天无引用 → ARCHIVED
  if (daysSinceUse > 365) {
    return MEMORY_STATES.ARCHIVED;
  }
  
  // 规则3: 被新记忆 supersedes → SUPERSEDED
  if (memory.supersedes && memory.supersedes.length > 0) {
    return MEMORY_STATES.SUPERSEDED;
  }
  
  // 规则4: 矛盾检测触发 → FLAGGED
  if (context.contradictions?.includes(memory.id)) {
    return MEMORY_STATES.FLAGGED;
  }
  
  return MEMORY_STATES.ACTIVE;
}
```

#### 1.3.2 记忆重要性评分（Importance Score）

```javascript
// 重要性评分算法（0-100 分）
async function computeImportanceScore(memory, { usageHistory, context }) {
  let score = 0;
  
  // 因子1: 引用频率（最高 30 分）
  const refCount = usageHistory.getRefCount(memory.id);
  score += Math.min(30, refCount * 3);
  
  // 因子2: 记忆类型权重（最高 25 分）
  const KIND_WEIGHTS = {
    decision: 25,      // 决策最重要
    constraint: 22,   // 约束条件
    fact: 18,         // 事实
    preference: 15,    // 偏好
    project: 20,      // 项目
    reflection: 12,   // 反思
    definition: 10,   // 定义
    build: 20,       // 工程
    idea: 8,         // 想法（权重较低）
    todo: 5,         // 待办（临时）
  };
  score += KIND_WEIGHTS[memory.kind] || 10;
  
  // 因子3: 来源权威性（最高 20 分）
  const SOURCE_WEIGHTS = {
    'user-direct': 20,    // 用户直接声明
    'distillation': 15,   // 自动蒸馏
    'dreaming': 12,       // 梦境产物
    'team-transfer': 10,  // Agent 传递
  };
  score += SOURCE_WEIGHTS[memory.source?.type] || 8;
  
  // 因子4: 时间衰减（最高 15 分）
  const ageInDays = (Date.now() - new Date(memory.createdAt).getTime()) / (86400 * 1000);
  const timeScore = Math.max(0, 15 - ageInDays * 0.1);
  score += timeScore;
  
  // 因子5: 跨 Agent 共享度（最高 10 分）
  if (memory.sharedScopes && memory.sharedScopes.length > 0) {
    score += Math.min(10, memory.sharedScopes.length * 3);
  }
  
  return Math.round(Math.min(100, score));
}
```

#### 1.3.3 记忆引用计数系统

```javascript
// 新增引用追踪表
// data/memory/references.json
{
  "memoryId": {
    "totalRefs": 42,
    "byAgent": {
      "dev": 15,
      "sales": 8,
      "domestic-editor": 12,
      "orchestrator": 7
    },
    "bySource": {
      "prompt-injection": 30,
      "agent-query": 10,
      "team-transfer": 2
    },
    "lastRefs": [
      { "at": "2026-07-20T15:30:00Z", "by": "dev", "context": "代码评审" },
      { "at": "2026-07-20T14:20:00Z", "by": "orchestrator", "context": "决策参考" }
    ]
  }
}
```

#### 1.3.4 增量记忆合并（Incremental Memory Merge）

```javascript
// 当新记忆与旧记忆主题相似时，自动合并
async function tryMergeMemories(newMemory, existingMemories, { memoryStore }) {
  const similar = existingMemories.filter(m => 
    computeSimilarity(newMemory, m) > 0.75  // 相似度阈值
  );
  
  if (similar.length === 0) return null;  // 无需合并
  
  // 选择最相似的一个作为主记忆
  const primary = similar[0];
  
  // 创建合并记忆
  const merged = {
    ...primary,
    content: mergeContent(primary.content, newMemory.content),
    tags: [...new Set([...primary.tags, ...newMemory.tags])],
    confidence: Math.max(primary.confidence, newMemory.confidence),
    supersedes: [...(primary.supersedes || []), newMemory.id],
    mergedAt: new Date().toISOString(),
    importanceScore: await computeImportanceScore(merged),
  };
  
  // 更新主记忆，标记被合并的
  await memoryStore.update(primary.id, merged);
  await memoryStore.update(newMemory.id, { 
    status: 'merged', 
    mergedInto: primary.id 
  });
  
  return merged;
}
```

#### 1.3.5 梦境→主记忆自动吸收通道

```javascript
// 新增函数: dream-to-memory promotion
async function promoteDreamToMemory(dreamArtifact, { memoryStore, threshold = 0.7 }) {
  if (dreamArtifact.scores.total < threshold) {
    return { promoted: false, reason: 'score-below-threshold' };
  }
  
  // 检查是否已有类似记忆
  const existing = await memoryStore.query({
    contains: dreamArtifact.title,
    limit: 5,
  });
  
  if (existing.items.some(m => computeSimilarity(dreamArtifact, m) > 0.8)) {
    // 相似记忆存在，改为追加引用
    return { promoted: false, reason: 'similar-memory-exists', linkedTo: existing.items[0].id };
  }
  
  // 创建新记忆
  const memory = {
    id: `dream-${dreamArtifact.id}`,
    kind: 'reflection',
    subject: dreamArtifact.title,
    content: dreamArtifact.text,
    source: {
      type: 'dreaming',
      artifactId: dreamArtifact.id,
      scores: dreamArtifact.scores,
    },
    tags: ['dreaming', dreamArtifact.type],
    confidence: dreamArtifact.scores.total,
    importanceScore: Math.round(dreamArtifact.scores.total * 100),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await memoryStore.upsert(memory);
  return { promoted: true, memoryId: memory.id };
}
```

---

## 二、循环智能体（Loop Agent / Loop Engineer）体系设计

### 2.1 核心理念

Loop Agent 的核心思想是：**AI Agent 应该像人一样，能够持续学习、反思、改进**。不是一次性完成任务就结束，而是：

1. **执行 → 观察 → 反思 → 改进 → 再执行** 的循环
2. 随着使用时间的增长，**能力曲线应该上升**而非持平
3. 每次失败都应该转化为下一次成功的垫脚石

### 2.2 当前系统缺失的 Loop 能力

| # | 能力 | 当前状态 | 需要的改进 |
|---|------|----------|------------|
| 1 | **反思机制** | 无 | Agent 完成任务后自动反思 |
| 2 | **能力积累** | 无 | 失败案例→成功路径的知识沉淀 |
| 3 | **自我改进** | 无 | 基于反思自动调整行为模式 |
| 4 | **跨任务学习** | 部分 | Team Engine 只做执行，无学习 |
| 5 | **长期趋势分析** | 无 | 分析一段时间内的成功/失败模式 |

### 2.3 Loop Agent 架构设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Loop Agent System                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                   │
│  │  Execute  │────▶│  Observe │────▶│ Reflect  │                   │
│  │  (执行)   │     │  (观察)   │     │  (反思)   │                   │
│  └──────────┘     └──────────┘     └────┬─────┘                   │
│                                         │                           │
│                                         ▼                           │
│                                  ┌──────────┐                       │
│                                  │  Learn   │                       │
│                                  │  (学习)   │                       │
│                                  └────┬─────┘                       │
│                                       │                              │
│                                       ▼                              │
│                                  ┌──────────┐                       │
│                                  │ Improve  │                       │
│                                  │  (改进)   │──────────────────────▶│
│                                  └──────────┘                        │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                        知识层 (Knowledge Layer)                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │ Execution  │  │   Failed   │  │   Success  │  │   Trend    │   │
│  │   Log      │  │   Cases    │  │  Patterns  │  │   Analysis │   │
│  │ (执行日志)  │  │ (失败案例)  │  │ (成功模式)  │  │ (趋势分析)  │   │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.4 核心模块实现

#### 2.4.1 LoopAgent 基类

```javascript
// src/runtime/loop-agent.mjs
// LoopAgent:为每个 Agent 增加循环学习能力

export class LoopAgent {
  constructor({ agentId, skillSet, memoryStore, log }) {
    this.agentId = agentId;
    this.skillSet = skillSet;
    this.memoryStore = memoryStore;
    this.log = log;
    
    // 循环状态
    this.loopState = {
      consecutiveSuccesses: 0,
      consecutiveFailures: 0,
      lastReflection: null,
      adaptationCount: 0,
    };
    
    // 知识沉淀
    this.knowledge = {
      successPatterns: [],   // 成功模式
      failurePatterns: [],   // 失败模式  
      adaptations: [],       // 适应性调整记录
    };
  }
  
  // ===== 执行循环 =====
  async execute(task, context) {
    const executionId = generateId('exec');
    const startTime = Date.now();
    
    this.log(`[loop:${this.agentId}] ▶ 开始执行 ${executionId}`);
    
    // Step 1: 执行
    let result;
    try {
      result = await this.executeImpl(task, context);
      result.status = 'success';
    } catch (e) {
      result = { status: 'failed', error: e.message };
    }
    
    result.executionId = executionId;
    result.duration = Date.now() - startTime;
    
    // Step 2: 观察
    const observation = await this.observe(result, context);
    
    // Step 3: 反思（仅在特定条件触发）
    if (this.shouldReflect(result, observation)) {
      await this.reflect(executionId, task, result, observation, context);
    }
    
    // Step 4: 学习
    await this.learn(result, observation);
    
    // Step 5: 改进
    await this.maybeImprove(observation);
    
    return result;
  }
  
  // ===== 反思机制 =====
  async shouldReflect(result, observation) {
    // 条件1: 任务失败
    if (result.status === 'failed') return true;
    
    // 条件2: 连续成功超过 5 次 → 反思保持优势
    if (this.loopState.consecutiveSuccesses >= 5) return true;
    
    // 条件3: 任务耗时异常（超过 P95）
    if (observation.duration > this.getP95Duration() * 1.5) return true;
    
    // 条件4: 用户反馈（未来扩展）
    if (observation.userFeedback === 'negative') return true;
    
    return false;
  }
  
  async reflect(executionId, task, result, observation, context) {
    const reflectionPrompt = `
你是 Loop Engineer，负责反思这次任务执行。

## 任务信息
- 执行 ID: ${executionId}
- Agent: ${this.agentId}
- 任务: ${task.description || JSON.stringify(task)}
- 结果: ${result.status}
${result.error ? `- 错误: ${result.error}` : ''}

## 观察数据
- 耗时: ${observation.duration}ms
- 工具调用: ${JSON.stringify(observation.toolCalls)}
- 上下文复杂度: ${observation.contextComplexity}

## 你的反思维度

### 1. 成功因素（如果成功）
- 哪些策略有效？
- 哪些决策正确？

### 2. 失败因素（如果失败）
- 失败的根本原因是什么？
- 是规划问题还是执行问题？
- 是知识缺失还是推理错误？

### 3. 改进建议
- 下次遇到类似任务应该怎么做？
- 需要学习什么新知识？
- 需要调整什么策略？

### 4. 知识沉淀
- 需要写入长期记忆的关键信息是什么？

请以 JSON 格式输出：
{
  "factors": { "success": [], "failure": [] },
  "rootCause": "根本原因分析",
  "improvements": [{ "action": "改进动作", "priority": "high/medium/low" }],
  "knowledgeToPersist": "需要持久化的知识"
}
`;
    
    const reflection = await this.callLLM(reflectionPrompt);
    const parsed = JSON.parse(reflection);
    
    // 写入反思记录
    await this.persistReflection({
      executionId,
      task,
      result,
      observation,
      reflection: parsed,
    });
    
    // 更新循环状态
    if (result.status === 'success') {
      this.loopState.consecutiveSuccesses++;
      this.loopState.consecutiveFailures = 0;
    } else {
      this.loopState.consecutiveSuccesses = 0;
      this.loopState.consecutiveFailures++;
    }
    this.loopState.lastReflection = new Date().toISOString();
    
    return parsed;
  }
  
  // ===== 学习机制 =====
  async learn(result, observation) {
    // 更新知识库
    if (result.status === 'success') {
      // 提取成功模式
      const pattern = this.extractPattern(result, observation, 'success');
      this.knowledge.successPatterns.push(pattern);
    } else {
      // 提取失败模式
      const pattern = this.extractPattern(result, observation, 'failure');
      this.knowledge.failurePatterns.push(pattern);
      
      // 如果是重复失败，标记需要干预
      if (this.loopState.consecutiveFailures >= 3) {
        await this.flagForIntervention(result, observation);
      }
    }
    
    // 持久化知识
    await this.persistKnowledge();
  }
  
  // ===== 改进机制 =====
  async maybeImprove(observation) {
    // 仅在连续失败时尝试改进
    if (this.loopState.consecutiveFailures < 2) return;
    
    // 分析失败模式
    const commonFailure = this.analyzeCommonFailure();
    
    if (commonFailure) {
      const adaptation = await this.generateAdaptation(commonFailure);
      
      if (adaptation.confidence > 0.7) {
        await this.applyAdaptation(adaptation);
        this.loopState.adaptationCount++;
        this.log(`[loop:${this.agentId}] ✓ 应用改进 #${this.loopState.adaptationCount}: ${adaptation.description}`);
      }
    }
  }
  
  // ===== 干预机制 =====
  async flagForIntervention(result, observation) {
    const intervention = {
      id: generateId('intervention'),
      agentId: this.agentId,
      type: 'repeated-failure',
      severity: this.loopState.consecutiveFailures >= 5 ? 'high' : 'medium',
      executionId: observation.executionId,
      failurePattern: this.analyzeCommonFailure(),
      suggestedActions: [
        'review-agent-prompt',
        'escalate-to-human',
        'retry-with-different-strategy',
      ],
      createdAt: new Date().toISOString(),
    };
    
    // 写入干预队列
    await this.writeIntervention(intervention);
    
    // 如果严重，推送通知
    if (intervention.severity === 'high') {
      await this.notifyHuman(intervention);
    }
  }
}
```

#### 2.4.2 执行日志（Execution Log）

```javascript
// data/agent-runtime/loop/execution-log.jsonl
// 每个执行一条记录，用于趋势分析

{
  "executionId": "exec-xxx",
  "agentId": "dev",
  "taskType": "code-review",
  "status": "success",
  "duration": 15230,
  "startTime": "2026-07-20T15:30:00Z",
  "endTime": "2026-07-20T15:30:15Z",
  "contextTokens": 3200,
  "toolsUsed": ["read_file", "bash"],
  "toolCallCount": 5,
  "successIndicators": ["found-bug", "suggested-fix"],
  "failureIndicators": [],
  "userFeedback": null,
}
```

#### 2.4.3 失败案例库（Failed Cases）

```javascript
// data/agent-runtime/loop/failed-cases.jsonl

{
  "caseId": "fail-xxx",
  "agentId": "sales",
  "taskType": "lead-qualification",
  "executionId": "exec-yyy",
  "failureTime": "2026-07-20T14:00:00Z",
  "errorType": "context-missing",
  "errorMessage": "无法获取客户历史记录",
  "rootCause": "CRM 集成未完成，销售无法访问客户历史",
  "failureContext": {
    "leadId": "lead-123",
    "attemptedTools": ["crm_query", "memory_search"],
    "missingData": ["客户历史购买记录", "上次沟通摘要"],
  },
  "recoveryAction": "人工补充客户背景信息后重试",
  "preventionRecommendations": [
    "优先完成 CRM 集成",
    "在 lead-qualification 前强制检查数据完整性",
  ],
  "resolved": true,
  "resolvedAt": "2026-07-20T14:30:00Z",
}
```

#### 2.4.4 成功模式库（Success Patterns）

```javascript
// data/agent-runtime/loop/success-patterns.jsonl

{
  "patternId": "success-xxx",
  "agentId": "dev",
  "taskType": "code-review",
  "firstOccurrence": "2026-07-10T10:00:00Z",
  "occurrenceCount": 15,
  "patternDescription": "代码评审时先读 README，再看相关文件，最后给建议",
  "successIndicators": [
    "context-understood",
    "relevant-feedback",
    "user-satisfied",
  ],
  "contextRequirements": {
    "minContextTokens": 2000,
    "requiredFiles": ["README.md"],
  },
  "associatedSkills": ["code-review", "documentation-reading"],
  "effectiveness": {
    "avgDuration": 45000,
    "successRate": 0.92,
    "userSatisfaction": 4.5,
  },
  "lastUsed": "2026-07-20T16:00:00Z",
}
```

### 2.5 Loop Engineer 特化设计

```javascript
// src/runtime/loop-engineer.mjs
// Loop Engineer:专门负责分析和改进其他 Agent 的 Agent

export class LoopEngineer {
  constructor({ memoryStore, loopStore, log }) {
    this.agentId = 'loop-engineer';
    this.memoryStore = memoryStore;
    this.loopStore = loopStore;
    this.log = log;
  }
  
  // ===== 定期分析 =====
  async runPeriodicAnalysis() {
    this.log('[loop-engineer] 开始定期分析...');
    
    // 1. 分析所有 Agent 的执行数据
    const agentStats = await this.analyzeAllAgents();
    
    // 2. 识别问题 Agent
    const problematicAgents = agentStats.filter(a => a.healthScore < 0.7);
    
    // 3. 对每个问题 Agent 生成改进建议
    for (const agent of problematicAgents) {
      const recommendations = await this.generateRecommendations(agent);
      await this.applyRecommendations(agent, recommendations);
    }
    
    // 4. 总结报告
    return {
      analyzedAt: new Date().toISOString(),
      agentCount: agentStats.length,
      healthyAgents: agentStats.filter(a => a.healthScore >= 0.7).length,
      problemAgents: problematicAgents.length,
      improvementsApplied: await this.getRecentImprovements(),
    };
  }
  
  // ===== Agent 健康度评分 =====
  async analyzeAgentHealth(agentId, { timeRange = 7 } = {}) {
    const executions = await this.loopStore.getExecutions(agentId, { days: timeRange });
    
    const stats = {
      totalExecutions: executions.length,
      successCount: executions.filter(e => e.status === 'success').length,
      failureCount: executions.filter(e => e.status === 'failed').length,
      avgDuration: this.mean(executions.map(e => e.duration)),
      successRate: executions.length > 0 
        ? executions.filter(e => e.status === 'success').length / executions.length 
        : 0,
      trend: this.calculateTrend(executions),
    };
    
    // 计算健康度
    stats.healthScore = (
      stats.successRate * 0.5 +
      this.normalizedTrendScore(stats.trend) * 0.3 +
      this.efficiencyScore(stats.avgDuration) * 0.2
    );
    
    return stats;
  }
  
  // ===== 生成改进建议 =====
  async generateRecommendations(agentStats) {
    const recommendations = [];
    
    // 建议1: 成功率过低
    if (agentStats.successRate < 0.6) {
      recommendations.push({
        type: 'prompt-tuning',
        priority: 'high',
        description: `成功率 ${(agentStats.successRate * 100).toFixed(0)}% 过低，建议增强 prompt 中的约束条件`,
        action: 'review-agent-prompt',
        expectedImpact: '+15% success rate',
      });
    }
    
    // 建议2: 耗时异常
    if (agentStats.avgDuration > this.getExpectedDuration(agentStats.agentId) * 1.5) {
      recommendations.push({
        type: 'process-optimization',
        priority: 'medium',
        description: '平均耗时过高，建议优化执行流程',
        action: 'optimize-workflow',
        expectedImpact: '-30% duration',
      });
    }
    
    // 建议3: 趋势下降
    if (agentStats.trend < -0.1) {
      recommendations.push({
        type: 'root-cause-analysis',
        priority: 'high',
        description: '执行效果呈下降趋势，需要深入分析原因',
        action: 'deep-analysis',
      });
    }
    
    return recommendations;
  }
  
  // ===== 应用改进建议 =====
  async applyRecommendations(agent, recommendations) {
    for (const rec of recommendations) {
      if (rec.priority !== 'high') continue;  // 只自动应用高优先级
      
      switch (rec.action) {
        case 'review-agent-prompt':
          await this.updateAgentPrompt(agent.agentId, rec);
          break;
        case 'optimize-workflow':
          await this.optimizeAgentWorkflow(agent.agentId);
          break;
        case 'deep-analysis':
          await this.triggerDeepAnalysis(agent.agentId);
          break;
      }
    }
  }
}
```

### 2.6 Loop Agent 集成到现有系统

```javascript
// 在 entry-bot.mjs 中集成 Loop Agent

import { LoopAgent } from './runtime/loop-agent.mjs';
import { LoopEngineer } from './runtime/loop-engineer.mjs';

// 初始化 Loop 系统
const loopAgents = new Map();
for (const agentDef of agentRegistry.list()) {
  loopAgents.set(agentDef.id, new LoopAgent({
    agentId: agentDef.id,
    skillSet: agentDef.skills,
    memoryStore,
    log,
  }));
}

const loopEngineer = new LoopEngineer({
  memoryStore,
  loopStore: createLoopStore({ rootDir: ROOT }),
  log,
});

// 注册定时任务:Loop Engineer 每周分析
scheduler.register({
  id: 'loop-analysis-weekly',
  schedule: '0 2 * * 0',  // 每周日凌晨 2 点
  run: async () => {
    const report = await loopEngineer.runPeriodicAnalysis();
    await discord.send(cfg.channels.system, formatReport(report));
  },
});
```

---

## 三、「做梦」（Dreaming）机制增强

### 3.1 当前系统现状

当前系统已有**完整的梦境系统**：

```
Light → REM → Deep
  ↓       ↓      ↓
信号    Pi 思考  评分 + 写产物
```

**四种梦**：
- `lian-zhu` (连珠) - 轻、跳、跨域自由联想
- `gui-cang` (归藏) - 沉、整、抽象巩固
- `ming-tai` (明台) - 深、思、主题清明梦
- `yu-yan` (预言) - v2，反事实剧场（未实现）

### 3.2 增强需求分析

| # | 需求 | 优先级 | 当前状态 |
|---|------|--------|----------|
| 1 | **好梦机制（正面生成）** | 🔴 高 | ❌ 缺失 |
| 2 | **信息挖掘层面增强** | 🔴 高 | 🟡 部分 |
| 3 | **梦境自我改进** | 🟡 中 | ❌ 缺失 |
| 4 | **梦境质量持续提升** | 🟡 中 | ❌ 缺失 |
| 5 | **yu-yan 预言实现** | 🟡 中 | ❌ 未实现 |

### 3.3 好梦机制（Good Dream）设计

#### 3.3.1 好梦 vs 噩梦

```javascript
// 新增 Dream Quality 分类
const DREAM_QUALITY = {
  GOOD: 'good-dream',      // 好梦：产生正面洞察、创意、解决方案
  NEUTRAL: 'neutral-dream', // 中性梦：信息整合、无明显正负
  BAD: 'bad-dream',        // 噩梦：焦虑放大、错误联想、无价值
};

// 好梦触发条件
async function evaluateDreamQuality(dreamResult, { moodHistory }) {
  const indicators = {
    positiveCount: 0,
    negativeCount: 0,
    actionableCount: 0,
    creativeCount: 0,
    anxietySignals: 0,
  };
  
  // 检查洞察极性
  for (const insight of dreamResult.insights) {
    const sentiment = await analyzeSentiment(insight.text);
    if (sentiment > 0.3) indicators.positiveCount++;
    if (sentiment < -0.3) indicators.negativeCount++;
  }
  
  // 检查可操作性
  for (const insight of dreamResult.insights) {
    if (extractActionability(insight.text) > 0.5) {
      indicators.actionableCount++;
    }
  }
  
  // 检查创意性
  for (const insight of dreamResult.insights) {
    if (detectCreativity(insight) > 0.6) {
      indicators.creativeCount++;
    }
  }
  
  // 检查焦虑信号
  const anxietyKeywords = ['担心', '焦虑', '害怕', '失败', '来不及', '崩溃'];
  for (const insight of dreamResult.insights) {
    for (const kw of anxietyKeywords) {
      if (insight.text.includes(kw)) indicators.anxietySignals++;
    }
  }
  
  // 综合评分
  const positiveScore = indicators.positiveCount + indicators.actionableCount * 2 + indicators.creativeCount * 1.5;
  const negativeScore = indicators.negativeCount + indicators.anxietySignals;
  
  if (positiveScore > negativeScore * 2) return DREAM_QUALITY.GOOD;
  if (negativeScore > positiveScore) return DREAM_QUALITY.BAD;
  return DREAM_QUALITY.NEUTRAL;
}
```

#### 3.3.2 好梦生成策略

```javascript
// 新增好梦 prompt 模板
// src/dreaming/prompts/rem-good-dream.txt

你是一个充满创造力的梦想家。你的任务是创造"好梦"——那些能带来希望、创意和解决方案的洞察。

## 好梦的特征

### ✅ 应该是
- 连接看似无关的点子，产生新视角
- 发现被忽视的机会或优势
- 提供具体、可行的建议
- 激发信心和行动力
- 找到问题的优雅解决方案

### ❌ 不应该是
- 放大焦虑或担忧
- 产生无关的负面联想
- 提出难以实现的空想
- 重复已知的失败模式

## 当前状态
- 日期: {{DATE}}
- 最近情绪: {{MOOD}}
- 最近成功: {{RECENT_SUCCESSES}}
- 面临的挑战: {{CHALLENGES}}

## 你的任务

基于以上背景，生成 3-5 条"好梦"洞察。每条洞察应该：
1. 有明确的标题（简洁有力）
2. 连接 2-3 个看似无关的点
3. 包含至少一个"如果...会怎样"的假设
4. 提供一个具体的下一步行动

## 输出格式

```json
{
  "dreamQuality": "good",
  "insights": [
    {
      "title": "洞察标题",
      "connection": "描述你连接了哪些点",
      "whatIf": "如果...会怎样",
      "action": "下一步具体行动",
      "confidence": 0.0-1.0
    }
  ]
}
```
```

#### 3.3.3 噩梦抑制机制

```javascript
// 噩梦检测与干预
async function detectAndMitigateNightmare(dreamResult, { moodHistory }) {
  const nightmareIndicators = {
    anxietyKeywords: ['担心', '焦虑', '害怕', '失败', '崩溃', '来不及', '扛不住'],
    catastrophicThinking: false,
    rumination: false,
  };
  
  // 检查文本
  const fullText = dreamResult.insights.map(i => i.text).join(' ');
  
  // 焦虑关键词计数
  let anxietyCount = 0;
  for (const kw of nightmareIndicators.anxietyKeywords) {
    anxietyCount += (fullText.match(new RegExp(kw, 'g')) || []).length;
  }
  
  // 灾难化思维检测（连续否定）
  if (/不.*不.*不|没.*没.*没/.test(fullText)) {
    nightmareIndicators.catastrophicThinking = true;
  }
  
  // 反刍检测（重复同一问题）
  const repeatedProblems = detectRepeatedThemes(dreamResult.insights);
  if (repeatedProblems.length > 2) {
    nightmareIndicators.rumination = true;
  }
  
  // 如果检测到噩梦，进行干预
  if (nightmareIndicators.anxietyKeywords.length > 3 || 
      nightmareIndicators.catastrophicThinking ||
      nightmareIndicators.rumination) {
    
    return {
      isNightmare: true,
      intervention: {
        type: 'reframe',
        prompt: `
这些思考似乎偏向焦虑和担忧。让我们换一个视角：

1. 这些担心背后有什么真正的需求？
2. 最坏情况真的会发生吗？概率有多大？
3. 即使发生，有什么备选方案？
4. 过去类似情况是如何解决的？

请重新生成 2 条更建设性的洞察。
        `,
      },
    };
  }
  
  return { isNightmare: false };
}
```

### 3.4 信息挖掘层面增强

#### 3.4.1 隐式知识挖掘

```javascript
// 从对话历史中挖掘隐式知识
// src/dreaming/mining/implicit-knowledge-miner.mjs

export class ImplicitKnowledgeMiner {
  async mine({ journal, memoryStore, timeRange = 7 }) {
    const conversations = await this.getConversations(timeRange);
    const implicitKnowledge = [];
    
    for (const conv of conversations) {
      // 1. 挖掘未明说的偏好
      const preferences = this.extractImplicitPreferences(conv);
      implicitKnowledge.push(...preferences);
      
      // 2. 挖掘决策依据
      const decisionRationale = this.extractDecisionRationale(conv);
      implicitKnowledge.push(...decisionRationale);
      
      // 3. 挖掘成功模式
      const successPatterns = this.extractSuccessPatterns(conv);
      implicitKnowledge.push(...successPatterns);
      
      // 4. 挖掘痛点
      const painPoints = this.extractPainPoints(conv);
      implicitKnowledge.push(...painPoints);
    }
    
    // 去重和聚类
    const clustered = this.clusterSimilarKnowledge(implicitKnowledge);
    
    return clustered;
  }
  
  // 挖掘隐式偏好
  extractImplicitPreferences(conversation) {
    const preferences = [];
    
    // 模式1: "其实我更喜欢..."
    const preferencePattern = /其实我更(喜欢|倾向于|想|希望|愿意)/g;
    const matches = conversation.text.match(preferencePattern);
    if (matches) {
      preferences.push({
        type: 'preference',
        category: 'implicit',
        source: 'explicit-stated',
        content: this.extractAroundMatch(conversation.text, matches[0], 50),
        confidence: 0.9,
      });
    }
    
    // 模式2: 行为模式推断
    // 如果用户总是拒绝某个方案 → 负面偏好
    const rejectionPattern = this.countPattern(conversation, /(不要|不用|算了|算了不)/);
    if (rejectionPattern.count > 3) {
      preferences.push({
        type: 'preference',
        category: 'inferred-negative',
        source: 'behavior-inference',
        content: `用户倾向于避免: ${rejectionPattern.context}`,
        confidence: 0.7,
      });
    }
    
    return preferences;
  }
  
  // 挖掘决策依据
  extractDecisionRationale(conversation) {
    const rationales = [];
    
    // 寻找决策点
    const decisionPoints = this.findDecisions(conversation);
    
    for (const decision of decisionPoints) {
      // 提取决策前的讨论（决策依据）
      const precedingContext = this.getPrecedingText(conversation, decision.position, 500);
      
      // 识别依据类型
      const rationaleType = this.classifyRationale(precedingContext);
      
      rationales.push({
        type: 'decision-rationale',
        decision: decision.content,
        rationale: precedingContext,
        rationaleType,  // 'cost', 'quality', 'time', 'risk', 'preference'
        decisionDate: decision.timestamp,
      });
    }
    
    return rationales;
  }
}
```

#### 3.4.2 跨领域连接发现

```javascript
// src/dreaming/mining/cross-domain-connector.mjs
// 发现不同领域之间的隐藏连接

export class CrossDomainConnector {
  async findConnections({ memories, journal, timeRange = 30 }) {
    // 1. 按领域分类记忆
    const domainMemories = this.categorizeByDomain(memories);
    
    // 2. 提取每个领域的核心概念
    const domainConcepts = {};
    for (const [domain, mems] of Object.entries(domainMemories)) {
      domainConcepts[domain] = this.extractCoreConcepts(mems);
    }
    
    // 3. 寻找跨领域概念重叠
    const connections = [];
    const domains = Object.keys(domainConcepts);
    
    for (let i = 0; i < domains.length; i++) {
      for (let j = i + 1; j < domains.length; j++) {
        const domainA = domains[i];
        const domainB = domains[j];
        
        const overlaps = this.findConceptOverlaps(
          domainConcepts[domainA],
          domainConcepts[domainB]
        );
        
        if (overlaps.length > 0) {
          connections.push({
            domainA,
            domainB,
            sharedConcepts: overlaps,
            insight: this.generateCrossDomainInsight(domainA, domainB, overlaps),
          });
        }
      }
    }
    
    // 4. 按价值排序
    connections.sort((a, b) => b.sharedConcepts.length - a.sharedConcepts.length);
    
    return connections.slice(0, 10);  // 返回 top 10
  }
  
  // 生成跨领域洞察
  generateCrossDomainInsight(domainA, domainB, sharedConcepts) {
    return {
      title: `「${domainA}」的${sharedConcepts[0]}可以应用于「${domainB}」`,
      description: `
领域 A（${domainA}）和领域 B（${domainB}）共享以下概念：
${sharedConcepts.map(c => `- ${c}`).join('\n')}

这意味着：
1. ${domainA} 的成功经验可能适用于 ${domainB}
2. ${domainB} 的问题可能用 ${domainA} 的方法解决
3. 两个领域可以相互借鉴，产生创新
      `,
      sharedConcepts,
      potentialActions: [
        `尝试用 ${domainA} 的方法解决 ${domainB} 的问题`,
        `将 ${domainA} 的成功案例应用到 ${domainB} 场景`,
      ],
    };
  }
}
```

### 3.5 梦境自我改进系统

```javascript
// src/dreaming/self-improvement.mjs
// 梦境系统根据历史表现自我改进

export class DreamSelfImprover {
  async analyzeAndImprove({ dreamHistory, voteHistory }) {
    // 1. 分析历史投票数据
    const voteAnalysis = this.analyzeVotes(voteHistory);
    
    // 2. 识别高价值梦境模式
    const valuablePatterns = this.findValuablePatterns(dreamHistory, voteAnalysis);
    
    // 3. 识别低价值梦境模式
    const lowValuePatterns = this.findLowValuePatterns(dreamHistory, voteAnalysis);
    
    // 4. 生成改进建议
    const improvements = this.generateImprovements(valuablePatterns, lowValuePatterns);
    
    // 5. 应用改进
    for (const improvement of improvements) {
      await this.applyImprovement(improvement);
    }
    
    return {
      analyzedAt: new Date().toISOString(),
      patternsFound: valuablePatterns.length + lowValuePatterns.length,
      improvementsApplied: improvements.length,
      expectedImpact: this.estimateImpact(improvements),
    };
  }
  
  // 分析投票数据
  analyzeVotes(voteHistory) {
    const stats = {
      totalVotes: 0,
      upVotes: 0,
      downVotes: 0,
      starVotes: 0,
      byDreamType: {},
      byTheme: {},
    };
    
    for (const [artifactId, votes] of Object.entries(voteHistory)) {
      stats.totalVotes += votes.up + votes.down + votes.star;
      stats.upVotes += votes.up;
      stats.downVotes += votes.down;
      stats.starVotes += votes.star;
      
      // 按类型统计
      const artifactType = votes.artifactType || 'unknown';
      if (!stats.byDreamType[artifactType]) {
        stats.byDreamType[artifactType] = { up: 0, down: 0, star: 0, count: 0 };
      }
      stats.byDreamType[artifactType].up += votes.up;
      stats.byDreamType[artifactType].down += votes.down;
      stats.byDreamType[artifactType].star += votes.star;
      stats.byDreamType[artifactType].count++;
    }
    
    // 计算每个类型的评分
    for (const [type, data] of Object.entries(stats.byDreamType)) {
      data.score = (data.up * 2 + data.star - data.down) / data.count;
    }
    
    return stats;
  }
  
  // 生成改进建议
  generateImprovements(valuable, lowValue) {
    const improvements = [];
    
    // 建议1: 增加某类型梦的权重
    for (const [type, data] of Object.entries(this.voteStats.byDreamType)) {
      if (data.score > 1.5) {
        improvements.push({
          type: 'increase-frequency',
          target: type,
          reason: `评分 ${data.score.toFixed(2)} 很高`,
          action: `增加 ${type} 的调度频率`,
        });
      } else if (data.score < 0.5) {
        improvements.push({
          type: 'decrease-frequency',
          target: type,
          reason: `评分 ${data.score.toFixed(2)} 偏低`,
          action: `降低 ${type} 的调度频率或改进 prompt`,
        });
      }
    }
    
    // 建议2: 改进 low-value 类型的 prompt
    for (const pattern of lowValue) {
      improvements.push({
        type: 'improve-prompt',
        target: pattern.type,
        reason: pattern.reason,
        action: `改进 ${pattern.type} 的 prompt，减少 ${pattern.issue}`,
      });
    }
    
    return improvements;
  }
}
```

### 3.6 梦境系统增强路线图

```
Phase 1: 好梦机制 (v3.0)
├── ✅ 好梦 prompt 模板
├── ✅ 噩梦检测与干预
├── ⬜ 好梦生成质量评估
└── ⬜ 梦境极性反馈循环

Phase 2: 信息挖掘增强 (v3.1)
├── ⬜ 隐式知识挖掘
├── ⬜ 跨领域连接发现
├── ⬜ 趋势预测能力
└── ⬜ 竞争情报分析

Phase 3: 自我改进 (v3.2)
├── ⬜ 投票数据分析
├── ⬜ Prompt 自动优化
├── ⬜ 梦境质量持续提升
└── ⬜ 自主学习循环

Phase 4: yu-yan 预言 (v4.0)
├── ⬜ 反事实推理引擎
├── ⬜ 情景模拟
├── ⬜ 风险预测
└── ⬜ 机会预判
```

---

## 四、一人公司（OPC）场景优化

### 4.1 OPC 场景的特殊需求

一人公司的独特挑战：
1. **时间极度稀缺** - 每分钟都要高效利用
2. **多角色切换** - 销售/开发/运营/客服全是一个人
3. **认知负载高** - 需要同时处理多个领域的知识
4. **决策疲劳** - 大量小决策消耗精力
5. **知识管理困难** - 没有团队分工，知识全在脑中

### 4.2 OPC Agent 优化方向

#### 4.2.1 智能时间管理

```javascript
// src/runtime/opc/time-intelligence.mjs
// 智能时间管理，为 OPC 最大化效率

export class TimeIntelligence {
  constructor({ memoryStore, journal, log }) {
    this.memoryStore = memoryStore;
    this.journal = journal;
    this.log = log;
  }
  
  // ===== 精力曲线分析 =====
  async analyzeEnergyPatterns({ timeRange = 14 } = {}) {
    const conversations = await this.journal.getConversations({ days: timeRange });
    
    // 分析每个时段的对话质量
    const hourlyStats = {};
    
    for (const conv of conversations) {
      const hour = new Date(conv.timestamp).getHours();
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { total: 0, quality: 0, count: 0 };
      }
      
      hourlyStats[hour].total += conv.duration || 0;
      hourlyStats[hour].quality += this.estimateConversationQuality(conv);
      hourlyStats[hour].count++;
    }
    
    // 计算每个小时的平均质量
    for (const hour of Object.keys(hourlyStats)) {
      hourlyStats[hour].avgQuality = hourlyStats[hour].quality / hourlyStats[hour].count;
    }
    
    // 识别高峰期和低谷期
    const sortedHours = Object.entries(hourlyStats)
      .sort((a, b) => b[1].avgQuality - a[1].avgQuality);
    
    const peakHours = sortedHours.slice(0, 3).map(([h]) => parseInt(h));
    const lowHours = sortedHours.slice(-2).map(([h]) => parseInt(h));
    
    return { hourlyStats, peakHours, lowHours };
  }
  
  // ===== 任务-精力匹配 =====
  async matchTaskToEnergy(task, { energyLevel = 'medium' } = {}) {
    const energyPatterns = await this.analyzeEnergyPatterns();
    
    // 任务复杂度分类
    const taskComplexity = this.classifyTaskComplexity(task);
    
    // 精力等级映射
    const energyToHour = {
      high: energyPatterns.peakHours,
      medium: [...energyPatterns.peakHours, ...energyPatterns.lowHours].filter(
        h => !energyPatterns.peakHours.includes(h)
      ),
      low: energyPatterns.lowHours,
    };
    
    // 推荐执行时间
    const recommendedHours = energyToHour[energyLevel].filter(h => {
      if (taskComplexity === 'high') {
        return energyPatterns.peakHours.includes(h);
      }
      return true;
    });
    
    return {
      taskComplexity,
      recommendedHours,
      reason: `该任务为${taskComplexity}复杂度，建议在${recommendedHours.join('点和')}点执行`,
    };
  }
  
  // ===== 日程优化建议 =====
  async suggestDailySchedule({ pendingTasks }) {
    const energyPatterns = await this.analyzeEnergyPatterns();
    
    // 按任务类型分组
    const tasksByType = this.categorizeTasks(pendingTasks);
    
    const schedule = [];
    
    // 上午高峰期：复杂任务（开发、战略）
    schedule.push({
      time: '09:00-11:00',
      type: 'peak',
      tasks: tasksByType.complex.slice(0, 2),
      reason: '精力高峰期，适合处理复杂任务',
    });
    
    // 上午低谷期：简单任务（邮件、审批）
    schedule.push({
      time: '11:00-12:00',
      type: 'low',
      tasks: tasksByType.simple.slice(0, 3),
      reason: '精力下降期，适合处理简单事务',
    });
    
    // 下午高峰期：创意任务（内容、方案）
    schedule.push({
      time: '14:00-16:00',
      type: 'peak',
      tasks: tasksByType.creative.slice(0, 2),
      reason: '二次高峰，适合创意工作',
    });
    
    // 下午低谷期：沟通任务（会议、回复）
    schedule.push({
      time: '16:00-17:00',
      type: 'low',
      tasks: tasksByType.communication.slice(0, 3),
      reason: '精力再次下降，适合沟通协作',
    });
    
    return schedule;
  }
}
```

#### 4.2.2 决策辅助系统

```javascript
// src/runtime/opc/decision-assistant.mjs
// 帮助 OPC 快速做出高质量决策

export class DecisionAssistant {
  constructor({ memoryStore, loopStore, log }) {
    this.memoryStore = memoryStore;
    this.loopStore = loopStore;
    this.log = log;
  }
  
  // ===== 快速决策框架 =====
  async assistDecision({ decision, context, urgency = 'normal' }) {
    // 1. 检查历史决策
    const pastDecisions = await this.findSimilarDecisions(decision);
    
    // 2. 获取相关记忆
    const relevantMemories = await this.getRelevantMemories(decision, context);
    
    // 3. 分析利弊
    const prosCons = await this.analyzeProsCons(decision, relevantMemories);
    
    // 4. 生成建议
    const suggestion = await this.generateSuggestion({
      decision,
      prosCons,
      pastDecisions,
      urgency,
    });
    
    return {
      decision,
      prosCons,
      pastDecisions: pastDecisions.slice(0, 3),
      suggestion,
      confidence: suggestion.confidence,
      reasoning: suggestion.reasoning,
    };
  }
  
  // ===== 决策模板 =====
  async quickDecision(decision) {
    // 5分钟决策框架
    const framework = `
## 快速决策框架

### 决策: ${decision.description}

#### 1. 这真的是一个决策吗？
- [ ] 还是一个执行动作？（如果是，直接执行）
- [ ] 还是多个决策？（如果是，拆分成多个）

#### 2. 如果错了，后果严重吗？
- [ ] 可逆 → 大胆做
- [ ] 难逆 → 谨慎做

#### 3. 后悔成本
- 做错了后悔：___ 
- 没做后悔：___

#### 4. 决策
_____（写下你的决定）
_____（写下你的行动）
    `;
    
    return framework;
  }
  
  // ===== 决策疲劳监测 =====
  async detectDecisionFatigue({ timeRange = 24 } = {}) {
    const recentDecisions = await this.loopStore.getDecisions({ hours: timeRange });
    
    // 计算决策数量和趋势
    const hourlyCount = {};
    for (const d of recentDecisions) {
      const hour = new Date(d.timestamp).getHours();
      hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
    }
    
    // 检测疲劳信号
    const fatigueSignals = {
      decisionCount: recentDecisions.length,
      recentTrend: this.calculateTrend(recentDecisions.map(d => ({
        time: new Date(d.timestamp),
        quality: d.quality || 0.5,
      }))),
      reversalRate: this.calculateReversalRate(recentDecisions),
      quickDecisionRatio: recentDecisions.filter(d => d.duration < 60000).length / recentDecisions.length,
    };
    
    // 疲劳评分
    let fatigueScore = 0;
    if (fatigueSignals.decisionCount > 20) fatigueScore += 30;
    if (fatigueSignals.quickDecisionRatio > 0.5) fatigueScore += 30;
    if (fatigueSignals.reversalRate > 0.2) fatigueScore += 40;
    
    return {
      fatigueScore,
      level: fatigueScore > 70 ? 'high' : fatigueScore > 40 ? 'medium' : 'low',
      signals: fatigueSignals,
      recommendations: this.getFatigueRecommendations(fatigueScore),
    };
  }
}
```

#### 4.2.3 知识自动整理

```javascript
// src/runtime/opc/knowledge-automation.mjs
// 自动整理 OPC 的碎片知识

export class KnowledgeAutomation {
  constructor({ memoryStore, journal, log }) {
    this.memoryStore = memoryStore;
    this.journal = journal;
    this.log = log;
  }
  
  // ===== 每日知识整理 =====
  async dailyKnowledge整理({ date }) {
    const conversations = await this.journal.getDay(date);
    
    // 1. 提取关键决策
    const decisions = this.extractDecisions(conversations);
    
    // 2. 提取学到的东西
    const learnings = this.extractLearnings(conversations);
    
    // 3. 提取待办事项
    const todos = this.extractTodos(conversations);
    
    // 4. 提取问题与解决方案
    const problems = this.extractProblemSolutions(conversations);
    
    // 5. 生成每日知识简报
    const dailyBrief = await this.generateDailyBrief({
      date,
      decisions,
      learnings,
      todos,
      problems,
    });
    
    // 6. 写入记忆
    for (const decision of decisions) {
      await this.memoryStore.upsert({
        kind: 'decision',
        subject: decision.summary,
        content: decision.details,
        source: { type: 'daily整理', date },
        tags: ['daily', '整理'],
      });
    }
    
    for (const learning of learnings) {
      await this.memoryStore.upsert({
        kind: 'reflection',
        subject: learning.title,
        content: learning.details,
        source: { type: 'daily整理', date },
        tags: ['daily', 'learning'],
      });
    }
    
    return dailyBrief;
  }
  
  // ===== 自动标签 =====
  async autoTag(memory) {
    // 基于内容自动推断标签
    const tagPatterns = {
      'business-strategy': ['战略', '商业模式', '竞争', '市场'],
      'technical': ['代码', '架构', '部署', 'API'],
      'content': ['文章', '视频', '社交媒体', 'SEO'],
      'customer': ['客户', '需求', '反馈', '投诉'],
      'financial': ['收入', '成本', '定价', '合同'],
      'personal': ['健康', '休息', '家庭', '生活'],
    };
    
    const matchedTags = [];
    for (const [tag, keywords] of Object.entries(tagPatterns)) {
      for (const kw of keywords) {
        if (memory.content.includes(kw)) {
          matchedTags.push(tag);
          break;
        }
      }
    }
    
    return [...new Set(matchedTags)];
  }
}
```

#### 4.2.4 多角色智能切换

```javascript
// src/runtime/opc/role-switcher.mjs
// 智能识别角色并切换 Agent 上下文

export class RoleSwitcher {
  constructor({ agentRegistry, memoryStore, log }) {
    this.agentRegistry = agentRegistry;
    this.memoryStore = memoryStore;
    this.log = log;
    this.currentRole = 'orchestrator';
  }
  
  // ===== 角色识别 =====
  async detectRole(message, context) {
    const roleIndicators = {
      developer: {
        keywords: ['代码', 'bug', '函数', '部署', 'git', 'pr'],
        agents: ['dev', 'coding'],
      },
      sales: {
        keywords: ['客户', '报价', '合同', '跟进', '商机'],
        agents: ['sales'],
      },
      content: {
        keywords: ['文章', '视频', '小红书', '公众号', '内容'],
        agents: ['domestic-editor', 'overseas-editor'],
      },
      marketing: {
        keywords: ['推广', 'SEO', '增长', '转化', '投放'],
        agents: ['marketing', 'seo'],
      },
      finance: {
        keywords: ['发票', '账单', '付款', '收入', '成本'],
        agents: ['finance'],
      },
    };
    
    const scores = {};
    for (const [role, config] of Object.entries(roleIndicators)) {
      let score = 0;
      const text = (message + ' ' + context).toLowerCase();
      
      for (const kw of config.keywords) {
        if (text.includes(kw.toLowerCase())) score++;
      }
      
      if (score > 0) {
        scores[role] = { score, agents: config.agents };
      }
    }
    
    // 选择得分最高的角色
    const sorted = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);
    
    if (sorted.length === 0) {
      return { role: 'orchestrator', agents: ['orchestrator'] };
    }
    
    return {
      role: sorted[0][0],
      agents: sorted[0][1].agents,
      confidence: sorted[0][1].score / 5,
      alternatives: sorted.slice(1, 3),
    };
  }
  
  // ===== 角色切换执行 =====
  async switchToRole(role, message, context) {
    const detection = await this.detectRole(message, context);
    
    if (detection.role === this.currentRole && detection.confidence < 0.8) {
      // 角色未变且置信度不高，保持当前
      return { switched: false, currentRole: this.currentRole };
    }
    
    // 记录角色切换
    await this.logRoleSwitch(this.currentRole, detection.role, message);
    
    this.currentRole = detection.role;
    
    // 加载新角色的上下文
    const roleContext = await this.loadRoleContext(detection.agents[0]);
    
    return {
      switched: true,
      fromRole: this.currentRole,
      toRole: detection.role,
      context: roleContext,
    };
  }
  
  // ===== 加载角色上下文 =====
  async loadRoleContext(agentId) {
    const agent = this.agentRegistry.get(agentId);
    
    // 获取角色相关记忆
    const memories = await this.memoryStore.query({
      kinds: ['preference', 'constraint', 'fact', 'decision'],
      tags: [agentId],
      limit: 20,
    });
    
    // 获取角色最近的决策
    const recentDecisions = await this.getRecentDecisions(agentId, { limit: 5 });
    
    return {
      agentId,
      agentName: agent?.displayName,
      memories: memories.items,
      recentDecisions,
      skills: agent?.skills,
    };
  }
}
```

### 4.3 OPC 场景的 Agent Team 设计

```javascript
// src/runtime/opc/opc-team.mjs
// 一人公司专用的 Agent Team 配置

export const OPCTeams = {
  // 销售闭环：从线索到回款
  'sales-cycle': {
    name: '销售闭环',
    steps: [
      { agent: 'intake', task: '线索录入', parallel: false },
      { agent: 'sales', task: '需求发现', parallel: false },
      { agent: 'solution', task: '方案设计', parallel: false },
      { agent: 'quote', task: '报价估算', parallel: false },
      { agent: 'contract', task: '合同准备', parallel: false },
      { agent: 'finance', task: '开票回款', parallel: false },
      { agent: 'cs', task: '客户成功', parallel: false },
    ],
    totalDays: 30,
  },
  
  // 内容生产闭环：从选题到发布
  'content-cycle': {
    name: '内容生产闭环',
    steps: [
      { agent: 'domestic-editor', task: '选题策划', parallel: false },
      { agent: 'distill', task: '素材整理', parallel: false },
      { agent: 'renderer', task: '内容创作', parallel: false },
      { agent: 'qa', task: '质量审核', parallel: false },
      { agent: 'publisher', task: '多平台发布', parallel: true },
    ],
    totalDays: 7,
  },
  
  // 项目交付闭环：从立项到验收
  'delivery-cycle': {
    name: '项目交付闭环',
    steps: [
      { agent: 'pm', task: '项目立项', parallel: false },
      { agent: 'dev', task: '开发实现', parallel: false },
      { agent: 'qa', task: '测试验收', parallel: false },
      { agent: 'delivery', task: '部署上线', parallel: false },
      { agent: 'cs', task: '客户培训', parallel: false },
    ],
    totalDays: 60,
  },
  
  // 每日启动：从早晨到下班
  'daily-startup': {
    name: '每日启动',
    steps: [
      { agent: 'orchestrator', task: '日程规划', parallel: false },
      { agent: 'sales', task: '客户跟进', parallel: false },
      { agent: 'dev', task: '开发任务', parallel: false },
      { agent: 'marketing', task: '内容发布', parallel: false },
      { agent: 'finance', task: '财务处理', parallel: false },
    ],
    totalDays: 1,
  },
};
```

### 4.4 OPC 效率仪表盘

```javascript
// src/runtime/opc/dashboard.mjs
// OPC 专属效率仪表盘

export class OPCDashboard {
  async generateDailyReport({ date }) {
    const stats = {
      // 时间分配
      timeAllocation: await this.getTimeAllocation(date),
      
      // 决策统计
      decisions: await this.getDecisionStats(date),
      
      // 任务完成率
      taskCompletion: await this.getTaskCompletion(date),
      
      // 收入相关
      revenue: await this.getRevenueMetrics(date),
      
      // 精力状态
      energyState: await this.getEnergyState(date),
      
      // AI 协作效果
      aiCollaboration: await this.getAICollaborationStats(date),
    };
    
    // 生成可视化
    const visualizations = {
      timePie: this.renderTimePie(stats.timeAllocation),
      decisionFunnel: this.renderDecisionFunnel(stats.decisions),
      taskBurndown: this.renderTaskBurndown(stats.taskCompletion),
      energyWave: this.renderEnergyWave(stats.energyState),
    };
    
    return {
      date,
      stats,
      visualizations,
      insights: await this.generateInsights(stats),
      recommendations: await this.generateRecommendations(stats),
    };
  }
  
  // ===== 洞察生成 =====
  async generateInsights(stats) {
    const insights = [];
    
    // 洞察1: 时间效率
    if (stats.aiCollaboration.effectiveTimeRatio > 0.6) {
      insights.push({
        type: 'positive',
        text: `AI 协作效率很高，${(stats.aiCollaboration.effectiveTimeRatio * 100).toFixed(0)}% 的时间产生了有效产出`,
      });
    }
    
    // 洞察2: 决策质量
    if (stats.decisions.reversalRate > 0.2) {
      insights.push({
        type: 'warning',
        text: `决策反转率偏高 (${(stats.decisions.reversalRate * 100).toFixed(0)}%)，建议增加决策前的验证环节`,
      });
    }
    
    // 洞察3: 精力管理
    if (stats.energyState.afternoonDip > 0.3) {
      insights.push({
        type: 'suggestion',
        text: '下午精力下降明显，建议将复杂任务安排在上午',
      });
    }
    
    return insights;
  }
}
```

### 4.5 OPC 优化总结

| 优化方向 | 核心功能 | 价值 |
|----------|----------|------|
| 智能时间管理 | 精力曲线分析、任务-精力匹配 | 提升 30% 高效工作时间 |
| 决策辅助 | 快速决策框架、决策疲劳监测 | 减少 50% 决策时间 |
| 知识自动整理 | 每日整理、自动标签、碎片整合 | 减少 80% 知识管理负担 |
| 角色智能切换 | 自动识别角色、上下文切换 | 无缝多角色协作 |
| Team 闭环 | 预定义工作流、自动执行追踪 | 从手工到自动化的跨越 |
| 效率仪表盘 | 每日报告、洞察生成 | 可视化、可优化 |

---

## 五、综合实现路线图

### Phase 1: 记忆 2.0 (2 周)
- [ ] 记忆生命周期管理
- [ ] 重要性评分系统
- [ ] 引用计数追踪
- [ ] 梦境→主记忆通道

### Phase 2: Loop Agent (3 周)
- [ ] LoopAgent 基类实现
- [ ] 执行日志系统
- [ ] 失败案例库
- [ ] 成功模式库
- [ ] Loop Engineer

### Phase 3: 梦境增强 (2 周)
- [ ] 好梦机制
- [ ] 噩梦抑制
- [ ] 隐式知识挖掘
- [ ] 跨领域连接发现

### Phase 4: OPC 优化 (2 周)
- [ ] 时间智能管理
- [ ] 决策辅助系统
- [ ] 知识自动整理
- [ ] 多角色切换
- [ ] 效率仪表盘

### 总工期: 9 周

---

## 六、技术债务与风险

### 6.1 技术债务
1. **记忆合并逻辑复杂** - 需要仔细处理边界情况
2. **Loop Agent 可能过度干预** - 需要设置合理的干预阈值
3. **梦境自我改进可能震荡** - 需要添加冷却机制

### 6.2 风险缓解
1. **所有改动都应该可回滚** - 通过 feature flag 控制
2. **渐进式部署** - 先在小流量验证
3. **人工监督** - 高风险操作仍需人工确认

---

*本文档为深度设计文档，具体实现时需要根据实际情况调整。*
