# 多层 Session 隔离设计方案 v2.0

> 针对当前 Session 系统的维度不足问题，设计完整的多层隔离方案

---

## 一、问题分析

### 1.1 当前 Session Key 设计

```javascript
// 现有设计
sessionKey = `${channelId}:${userId}:t:${topicKey}:a:${agentId}`

// 问题：
// 1. 只有 4 个维度：频道、用户、话题、Agent
// 2. 没有项目维度 — 同一项目的多个任务会互相污染
// 3. 没有任务维度 — 无法区分不同的工作任务
// 4. 没有意图维度 — 同一话题的不同意图无法分离
```

### 1.2 当前系统的问题

| 问题 | 影响 | 优先级 |
|------|------|--------|
| 项目维度缺失 | 同一项目的讨论和闲聊混在一起 | 🔴 高 |
| 任务维度缺失 | 不同任务共享上下文，导致混淆 | 🔴 高 |
| 意图维度缺失 | "了解项目"和"修改代码"无法分离 | 🟡 中 |
| 上下文继承缺失 | 下级维度无法访问上级上下文 | 🟡 中 |
| 生命周期管理粗糙 | 只有 idle timeout，没有基于任务的清理 | 🟡 中 |
| 跨 Session 共享困难 | 项目级上下文无法传递给任务 | 🟡 中 |

---

## 二、多层 Session 架构设计

### 2.1 维度层次

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 0: Global (全局层)                                   │
│   - 公司上下文、品牌、个人IP                                │
│   - 跨项目的长期记忆                                       │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Channel (频道层)                                 │
│   - 频道专用上下文                                        │
│   - 频道历史对话                                          │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Project (项目层)                                  │
│   - 项目上下文、需求、约束                                  │
│   - 项目级决策和知识                                       │
│   - ⭐ 新增维度                                          │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Task (任务层)                                    │
│   - 单个任务的具体上下文                                   │
│   - 任务进展、讨论                                         │
│   - ⭐ 新增维度                                          │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Intent (意图层)                                   │
│   - 具体对话的意图（聊天/任务/查询）                        │
│   - ⭐ 新增维度                                          │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Agent (Agent层)                                  │
│   - Agent 专用上下文                                      │
│   - 每个 Agent 的私有记忆                                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Session Key 设计

```javascript
// 新设计：五层 Session Key
class SessionKey {
  static build({
    channelId,    // 频道
    userId,       // 用户
    projectId,    // 项目（可选）
    taskId,       // 任务（可选）
    intentType,   // 意图类型
    agentId,      // Agent
  }) {
    const parts = [
      `ch:${channelId}`,
      `u:${userId}`,
    ];
    
    if (projectId) parts.push(`p:${projectId}`);
    if (taskId) parts.push(`t:${taskId}`);
    if (intentType) parts.push(`i:${intentType}`);
    if (agentId) parts.push(`a:${agentId}`);
    
    return parts.join('::');  // 用 :: 分隔便于阅读
  }
}

// 示例
SessionKey.build({
  channelId: '1527730710410956841',
  userId: 'user_123',
  projectId: 'PRJ-2026-001',
  taskId: 'task_456',
  intentType: 'code_review',
  agentId: 'dev'
})
// 结果: ch:1527730710410956841::u:user_123::p:PRJ-2026-001::t:task_456::i:code_review::a:dev
```

### 2.3 Intent Type 枚举

```javascript
const INTENT_TYPES = {
  // 闲聊/探索
  CHAT: 'chat',           // 日常聊天
  EXPLORE: 'explore',     // 探索性讨论
  
  // 任务执行
  TASK_EXECUTE: 'task',   // 任务执行
  CODE_REVIEW: 'review',   // 代码评审
  BUG_FIX: 'bug',         // Bug修复
  
  // 信息查询
  QUERY: 'query',         // 信息查询
  SEARCH: 'search',       // 搜索
  
  // 决策
  DECISION: 'decision',    // 决策讨论
  BRAINSTORM: 'brainstorm', // 头脑风暴
  
  // 协作
  COLLABORATE: 'collab',  // 协作
  REVIEW_RESPONSE: 'response', // 响应评审
};

// 意图自动检测规则
const INTENT_RULES = [
  { pattern: /^(代码|看看|帮我|给我)/, type: INTENT_TYPES.TASK_EXECUTE },
  { pattern: /^(这个|那个|怎么|如何)/, type: INTENT_TYPES.QUERY },
  { pattern: /^(review|pr|评审)/i, type: INTENT_TYPES.CODE_REVIEW },
  { pattern: /^(bug|报错|崩溃)/i, type: INTENT_TYPES.BUG_FIX },
  { pattern: /^(聊聊|随便说)/, type: INTENT_TYPES.CHAT },
];
```

---

## 三、上下文继承机制

### 3.1 继承链

```javascript
// 上下文继承优先级（从高到低）
const CONTEXT_PRIORITY = {
  // 任务层最高
  task: 100,
  // 项目层次之
  project: 80,
  // 频道层第三
  channel: 60,
  // Agent 层第四
  agent: 40,
  // 全局层最低
  global: 20,
};

// 当构建 LLM 上下文时，按优先级拼接
async function buildContext(sessionKey) {
  const parts = [];
  
  // 1. 全局上下文（始终包含）
  parts.push(await getGlobalContext());
  
  // 2. Agent 上下文
  if (sessionKey.agentId) {
    parts.push(await getAgentContext(sessionKey.agentId));
  }
  
  // 3. 频道上下文
  if (sessionKey.channelId) {
    parts.push(await getChannelContext(sessionKey.channelId));
  }
  
  // 4. 项目上下文（可选）
  if (sessionKey.projectId) {
    parts.push(await getProjectContext(sessionKey.projectId));
  }
  
  // 5. 任务上下文（可选）
  if (sessionKey.taskId) {
    parts.push(await getTaskContext(sessionKey.taskId));
  }
  
  // 6. 当前 Session 上下文（最高优先级）
  parts.push(await getSessionContext(sessionKey));
  
  return parts.join('\n\n---\n\n');
}
```

### 3.2 上下文范围控制

```javascript
// 上下文范围配置
const CONTEXT_SCOPE = {
  // 频道层：只包含本频道的近期对话
  channel: { maxRecent: 10, maxTokens: 8000 },
  
  // 项目层：包含项目的关键决策和约束
  project: { maxRecent: 20, maxTokens: 15000 },
  
  // 任务层：包含任务的完整上下文
  task: { maxRecent: 50, maxTokens: 30000 },
  
  // Agent 层：只包含 Agent 特有的记忆
  agent: { maxRecent: 5, maxTokens: 3000 },
  
  // 全局层：只包含最重要的长期记忆
  global: { maxRecent: 3, maxTokens: 2000 },
};
```

---

## 四、生命周期管理

### 4.1 基于任务的 Session 清理

```javascript
class SessionLifecycleManager {
  constructor({ sessionStore, projectStore, log }) {
    this.sessionStore = sessionStore;
    this.projectStore = projectStore;
    this.log = log;
  }
  
  // 任务完成时清理任务级 Session
  async onTaskComplete(taskId) {
    const sessions = await this.sessionStore.findByTask(taskId);
    
    for (const session of sessions) {
      // 1. 提取关键信息到项目层
      await this.promoteToProject(session);
      
      // 2. 归档 Session
      await this.archiveSession(session);
      
      // 3. 删除 Session
      await this.sessionStore.delete(session.key);
      
      this.log(`[lifecycle] 清理任务 Session: ${session.key}`);
    }
  }
  
  // 项目完成时清理项目级 Session
  async onProjectComplete(projectId) {
    const sessions = await this.sessionStore.findByProject(projectId);
    
    for (const session of sessions) {
      // 1. 提取关键信息到全局层
      await this.promoteToGlobal(session);
      
      // 2. 归档 Session
      await this.archiveSession(session);
      
      // 3. 删除 Session
      await this.sessionStore.delete(session.key);
    }
  }
  
  // 定时清理：归档超过一定时间的 Session
  async scheduledCleanup({ maxAge = 7 } = {}) {
    const cutoff = Date.now() - maxAge * 24 * 60 * 60 * 1000;
    const oldSessions = await this.sessionStore.findOld(cutoff);
    
    for (const session of oldSessions) {
      // 不删除，只归档
      await this.archiveSession(session);
    }
    
    return { cleaned: oldSessions.length };
  }
}
```

### 4.2 Session 状态机

```javascript
const SESSION_STATES = {
  ACTIVE: 'active',      // 活跃，正在使用
  IDLE: 'idle',          // 空闲，可恢复
  ARCHIVED: 'archived',   // 已归档，冷存储
  PROMOTED: 'promoted',   // 已提升到上级
  DELETED: 'deleted',     // 已删除
};

// 状态转换规则
const STATE_TRANSITIONS = {
  ACTIVE: ['IDLE', 'ARCHIVED', 'PROMOTED'],
  IDLE: ['ACTIVE', 'ARCHIVED', 'DELETED'],
  ARCHIVED: ['ACTIVE', 'DELETED'],
  PROMOTED: ['DELETED'],
  DELETED: [],  // 终态
};
```

---

## 五、跨 Session 共享机制

### 5.1 项目级上下文共享

```javascript
class ProjectContextSharing {
  constructor({ sessionStore, projectStore, memoryStore }) {
    this.sessionStore = sessionStore;
    this.projectStore = projectStore;
    this.memoryStore = memoryStore;
  }
  
  // 任务可以读取项目级上下文
  async getProjectContextForTask(taskId) {
    const task = await this.projectStore.getTask(taskId);
    const projectId = task.projectId;
    
    // 1. 项目描述和目标
    const project = await this.projectStore.get(projectId);
    
    // 2. 项目级决策
    const decisions = await this.memoryStore.query({
      scope: 'project',
      scopeId: projectId,
      kind: 'decision',
    });
    
    // 3. 项目约束
    const constraints = await this.memoryStore.query({
      scope: 'project',
      scopeId: projectId,
      kind: 'constraint',
    });
    
    // 4. 项目成员（如果有）
    const members = await this.getProjectMembers(projectId);
    
    return {
      project: {
        id: projectId,
        name: project.name,
        description: project.description,
      },
      decisions,
      constraints,
      members,
    };
  }
  
  // 任务可以更新项目级上下文
  async updateProjectContext(taskId, updates) {
    const task = await this.projectStore.getTask(taskId);
    
    for (const update of updates) {
      if (update.type === 'decision') {
        await this.memoryStore.write({
          scope: 'project',
          scopeId: task.projectId,
          kind: 'decision',
          content: update.content,
        });
      }
    }
  }
}
```

### 5.2 上下文注入点

```javascript
// 在构建 LLM prompt 时注入上下文
async function buildLLMPrompt(sessionKey, userMessage) {
  const parts = [];
  
  // 1. 系统提示（固定）
  parts.push(getSystemPrompt(sessionKey.agentId));
  
  // 2. 项目上下文（如果有）
  if (sessionKey.projectId) {
    const projectCtx = await projectSharing.getProjectContextForTask(sessionKey.taskId);
    parts.push(formatContext('项目上下文', projectCtx));
  }
  
  // 3. 相关记忆（检索增强）
  const relevantMemories = await memoryStore.query({
    query: userMessage,
    scope: sessionKey.projectId ? 'project' : 'channel',
    scopeId: sessionKey.projectId || sessionKey.channelId,
    limit: 5,
  });
  if (relevantMemories.length > 0) {
    parts.push(formatContext('相关记忆', relevantMemories));
  }
  
  // 4. Session 历史
  const history = await sessionStore.getHistory(sessionKey, { limit: 10 });
  parts.push(formatContext('近期对话', history));
  
  // 5. 当前消息
  parts.push(`用户: ${userMessage}`);
  
  return parts.join('\n\n');
}
```

---

## 六、完整实现架构

### 6.1 目录结构

```
data/
├── sessions/
│   ├── .sessions/                    # Session 元数据
│   │   ├── channel:{channelId}/
│   │   │   └── user:{userId}/
│   │   │       └── session.json
│   │   ├── project:{projectId}/
│   │   │   └── user:{userId}/
│   │   │       └── session.json
│   │   └── task:{taskId}/
│   │       └── user:{userId}/
│   │           └── session.json
│   │
│   ├── history/                      # 对话历史
│   │   └── {sessionKey}.jsonl
│   │
│   ├── archive/                     # 归档
│   │   └── {year}/{month}/
│   │       └── {sessionKey}.json
│   │
│   └── context/                     # 上下文快照
│       ├── project:{projectId}.json
│       └── task:{taskId}.json
```

### 6.2 Session 存储设计

```javascript
// data/sessions/.sessions/project:PRJ-001/user:user_123/session.json
{
  "key": "ch:xxx::u:user_123::p:PRJ-001::a:sales",
  "state": "active",
  "layers": {
    "channel": {
      "channelId": "1527730710410956841",
      "name": "#主入口"
    },
    "project": {
      "projectId": "PRJ-001",
      "name": "张三FDE项目",
      "phase": "poc"
    },
    "task": null,  // 当前没有活动任务
    "intent": {
      "type": "chat",
      "confidence": 0.8
    },
    "agent": {
      "agentId": "sales",
      "name": "Sales Agent"
    }
  },
  "stats": {
    "turnCount": 45,
    "totalTokens": 32000,
    "compressedCount": 2,
    "lastActiveAt": "2026-07-21T10:30:00Z"
  },
  "context": {
    "summary": "用户咨询FDE项目报价...",
    "recentTopics": ["报价", "FDE服务", "POC"],
    "pendingActions": []
  }
}
```

### 6.3 Session 隔离规则

```javascript
// 隔离规则矩阵
const ISOLATION_RULES = {
  // 频道内：用户间隔离
  'channel:user': 'isolated',
  
  // 项目内：任务间部分共享
  'project:task': 'shared-project',
  
  // 项目内：用户间部分共享
  'project:user': 'shared-project',
  
  // 任务内：完全隔离
  'task:user': 'isolated',
  
  // 意图间：同一任务内隔离
  'intent:user': 'isolated',
  
  // Agent 间：完全隔离
  'agent:user': 'isolated',
};

// 共享级别
const SHARING_LEVELS = {
  isolated: {
    read: [],
    write: [],
    description: '完全隔离，不共享任何上下文',
  },
  'shared-project': {
    read: ['project', 'global'],
    write: ['task'],
    description: '可读取项目级上下文，只能写任务级',
  },
  'shared-channel': {
    read: ['channel', 'global'],
    write: ['task'],
    description: '可读取频道级上下文，只能写任务级',
  },
};
```

---

## 七、意图识别与自动路由

### 7.1 意图识别流程

```javascript
class IntentClassifier {
  async classify(message, context) {
    // 1. 规则匹配（快速）
    const ruleMatch = this.matchRules(message);
    if (ruleMatch.confidence > 0.8) {
      return ruleMatch;
    }
    
    // 2. 上下文推断
    const contextMatch = this.inferFromContext(context);
    if (contextMatch.confidence > 0.7) {
      return contextMatch;
    }
    
    // 3. LLM 推断（慢速，作为 fallback）
    const llmMatch = await this.inferWithLLM(message, context);
    return llmMatch;
  }
  
  // 基于上下文的推断
  inferFromContext(context) {
    // 如果上一轮是任务执行，继续任务
    if (context.lastIntent === 'task' && context.pendingTasks?.length > 0) {
      return {
        type: 'task',
        confidence: 0.75,
        reason: 'continuation',
      };
    }
    
    // 如果有活动任务，保持在任务上下文
    if (context.activeTask) {
      return {
        type: 'task',
        confidence: 0.8,
        reason: 'active-task',
        taskId: context.activeTask.id,
      };
    }
    
    return null;
  }
}
```

### 7.2 自动 Session 创建

```javascript
class SessionAutoManager {
  async getOrCreateSession({ message, channelId, userId, agentId, projectId, taskId }) {
    // 1. 识别意图
    const intent = await this.classifier.classify(message, this.getCurrentContext(channelId, userId));
    
    // 2. 确定 Session 层级
    let sessionKey;
    let sessionLevel;
    
    if (taskId) {
      // 有活动任务，使用任务级 Session
      sessionKey = SessionKey.build({
        channelId, userId, projectId, taskId,
        intentType: intent.type, agentId,
      });
      sessionLevel = 'task';
    } else if (projectId) {
      // 有项目，使用项目级 Session
      sessionKey = SessionKey.build({
        channelId, userId, projectId,
        intentType: intent.type, agentId,
      });
      sessionLevel = 'project';
    } else {
      // 只有频道，使用频道级 Session
      sessionKey = SessionKey.build({
        channelId, userId,
        intentType: intent.type, agentId,
      });
      sessionLevel = 'channel';
    }
    
    // 3. 获取或创建 Session
    const session = await this.sessionStore.getOrCreate(sessionKey, {
      level: sessionLevel,
      intent,
    });
    
    return { session, intent, sessionKey };
  }
}
```

---

## 八、监控与可观测性

### 8.1 Session 状态监控

```javascript
class SessionMonitor {
  async getDashboard() {
    const sessions = await this.sessionStore.listAll();
    
    return {
      overview: {
        total: sessions.length,
        byLevel: this.groupBy(sessions, 'level'),
        byState: this.groupBy(sessions, 'state'),
        byIntent: this.groupBy(sessions, 'intent.type'),
      },
      
      tokens: {
        total: sessions.reduce((s, x) => s + x.stats.totalTokens, 0),
        avgPerSession: sessions.reduce((s, x) => s + x.stats.totalTokens, 0) / sessions.length,
        byLevel: this.aggregateBy(sessions, 'level', 'stats.totalTokens'),
      },
      
      activity: {
        activeCount: sessions.filter(s => s.state === 'active').length,
        idleCount: sessions.filter(s => s.state === 'idle').length,
        avgTurns: sessions.reduce((s, x) => s + x.stats.turnCount, 0) / sessions.length,
      },
      
      alerts: await this.detectAlerts(sessions),
    };
  }
  
  // 检测异常
  async detectAlerts(sessions) {
    const alerts = [];
    
    // 1. Token 过多
    const highTokenSessions = sessions.filter(s => s.stats.totalTokens > 100000);
    if (highTokenSessions.length > 0) {
      alerts.push({
        type: 'high-tokens',
        severity: 'warning',
        count: highTokenSessions.length,
        message: `${highTokenSessions.length} 个 Session Token 超过 100k`,
      });
    }
    
    // 2. 压缩过多
    const overCompressedSessions = sessions.filter(s => s.stats.compressedCount > 5);
    if (overCompressedSessions.length > 0) {
      alerts.push({
        type: 'over-compressed',
        severity: 'info',
        count: overCompressedSessions.length,
        message: `${overCompressedSessions.length} 个 Session 压缩超过 5 次`,
      });
    }
    
    // 3. 长时间空闲
    const longIdleSessions = sessions.filter(s => {
      const idle = Date.now() - new Date(s.stats.lastActiveAt).getTime();
      return idle > 2 * 60 * 60 * 1000 && s.state === 'idle';
    });
    if (longIdleSessions.length > 5) {
      alerts.push({
        type: 'long-idle',
        severity: 'info',
        count: longIdleSessions.length,
        message: `${longIdleSessions.length} 个 Session 空闲超过 2 小时`,
      });
    }
    
    return alerts;
  }
}
```

---

## 九、总结

### 9.1 核心改进

| 改进 | 之前 | 之后 |
|------|------|------|
| Session Key 维度 | 4 个 | 6 个 |
| 隔离级别 | 2 种 | 5 种 |
| 上下文继承 | 无 | 5 层继承 |
| 生命周期管理 | 仅 idle timeout | 基于任务/项目/时间的精细管理 |
| 意图识别 | 关键词匹配 | 规则 + 上下文 + LLM 三层推断 |

### 9.2 预期效果

1. **隔离性提升**: 不同项目、任务、意图的对话完全隔离
2. **上下文质量**: 相关上下文自动注入，不相关上下文自动过滤
3. **资源效率**: 基于任务的自动清理，减少无效存储
4. **可观测性**: 完整的 Session 监控和告警

---

*本文档为 Session 隔离增强的详细设计方案*
