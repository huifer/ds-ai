// ~/pi-discord-agents/src/runtime/session/context-inheritance.mjs
// 多层上下文继承管理器
//
// 功能:
//   - 实现 5 层上下文继承
//   - 按优先级拼接上下文
//   - 范围控制和 token 限制

import { SessionKey } from './session-key.mjs';

/**
 * 上下文优先级
 */
const CONTEXT_PRIORITY = {
  session: 100,   // 当前 Session
  task: 80,      // 任务层
  project: 60,   // 项目层
  channel: 40,   // 频道层
  agent: 20,     // Agent 层
  global: 10,   // 全局层
};

/**
 * 上下文范围配置
 */
const CONTEXT_SCOPE = {
  task: { maxRecent: 50, maxTokens: 30000 },
  project: { maxRecent: 20, maxTokens: 15000 },
  channel: { maxRecent: 10, maxTokens: 8000 },
  agent: { maxRecent: 5, maxTokens: 3000 },
  global: { maxRecent: 3, maxTokens: 2000 },
};

/**
 * 上下文继承管理器
 */
export class ContextInheritanceManager {
  constructor({
    sessionManager,
    memoryStore,
    projectStore = null,
    log = () => {},
  }) {
    this.sessionManager = sessionManager;
    this.memoryStore = memoryStore;
    this.projectStore = projectStore;
    this.log = log;
  }
  
  /**
   * 构建完整上下文
   * @param {string} sessionKey
   * @param {Object} options
   */
  async buildContext(sessionKey, {
    includeGlobal = true,
    includeAgent = true,
    includeChannel = true,
    includeProject = true,
    includeTask = true,
    maxTokens = 50000,
  } = {}) {
    const parts = [];
    let totalTokens = 0;
    
    // 1. 全局上下文（始终包含）
    if (includeGlobal) {
      const globalCtx = await this._getGlobalContext();
      if (globalCtx) {
        parts.push({ source: 'global', content: globalCtx, tokens: this._estimateTokens(globalCtx) });
      }
    }
    
    const parsed = SessionKey.parse(sessionKey);
    
    // 2. Agent 上下文
    if (includeAgent && parsed.agentId) {
      const agentCtx = await this._getAgentContext(parsed.agentId);
      if (agentCtx) {
        parts.push({ source: 'agent', content: agentCtx, tokens: this._estimateTokens(agentCtx) });
      }
    }
    
    // 3. 频道上下文
    if (includeChannel && parsed.channelId) {
      const channelCtx = await this._getChannelContext(parsed.channelId);
      if (channelCtx) {
        parts.push({ source: 'channel', content: channelCtx, tokens: this._estimateTokens(channelCtx) });
      }
    }
    
    // 4. 项目上下文
    if (includeProject && parsed.projectId) {
      const projectCtx = await this._getProjectContext(parsed.projectId);
      if (projectCtx) {
        parts.push({ source: 'project', content: projectCtx, tokens: this._estimateTokens(projectCtx) });
      }
    }
    
    // 5. 任务上下文
    if (includeTask && parsed.taskId) {
      const taskCtx = await this._getTaskContext(parsed.taskId);
      if (taskCtx) {
        parts.push({ source: 'task', content: taskCtx, tokens: this._estimateTokens(taskCtx) });
      }
    }
    
    // 6. Session 上下文（最高优先级）
    const sessionCtx = await this._getSessionContext(sessionKey);
    if (sessionCtx) {
      parts.push({ source: 'session', content: sessionCtx, tokens: this._estimateTokens(sessionCtx) });
    }
    
    // 按优先级排序并截断
    parts.sort((a, b) => {
      const priorityA = CONTEXT_PRIORITY[a.source] || 0;
      const priorityB = CONTEXT_PRIORITY[b.source] || 0;
      return priorityB - priorityA;
    });
    
    // 构建最终上下文
    const result = [];
    for (const part of parts) {
      if (totalTokens + part.tokens > maxTokens) {
        // 截断
        const remaining = maxTokens - totalTokens;
        if (remaining > 100) {
          result.push(this._truncate(part.content, remaining));
          totalTokens = maxTokens;
        }
        break;
      }
      result.push(part.content);
      totalTokens += part.tokens;
    }
    
    return {
      content: result.join('\n\n---\n\n'),
      totalTokens,
      sources: parts.map(p => p.source),
    };
  }
  
  /**
   * 获取全局上下文
   */
  async _getGlobalContext() {
    try {
      const memories = await this.memoryStore.query({
        scope: 'company',
        limit: CONTEXT_SCOPE.global.maxRecent,
      });
      
      if (!memories.items?.length) return null;
      
      return `# 全局上下文\n\n${memories.items.map(m => 
        `- [${m.kind || 'info'}] ${m.subject || m.title}: ${m.content?.slice(0, 150) || ''}`
      ).join('\n')}`;
    } catch (e) {
      this.log(`[context] 全局上下文获取失败: ${e.message}`);
      return null;
    }
  }
  
  /**
   * 获取 Agent 上下文
   */
  async _getAgentContext(agentId) {
    try {
      const memories = await this.memoryStore.query({
        scope: 'agent-internal',
        tags: [agentId],
        limit: CONTEXT_SCOPE.agent.maxRecent,
      });
      
      if (!memories.items?.length) return null;
      
      return `# Agent 上下文 (${agentId})\n\n${memories.items.map(m => 
        `- ${m.content?.slice(0, 150) || ''}`
      ).join('\n')}`;
    } catch (e) {
      return null;
    }
  }
  
  /**
   * 获取频道上下文
   */
  async _getChannelContext(channelId) {
    const session = this.sessionManager.sessions.get(
      Object.keys(this.sessionManager.sessions).find(k => 
        SessionKey.parse(k).channelId === channelId
      )
    );
    
    if (!session) return null;
    
    // 获取频道级 Session
    const channelKey = SessionKey.build({
      channelId,
      userId: SessionKey.parse(session.key).userId,
    });
    
    const channelSession = this.sessionManager.sessions.get(channelKey);
    if (!channelSession) return null;
    
    const lines = [`# 频道上下文 (${channelId})`];
    
    if (channelSession.summary) {
      lines.push(`\n## 频道历史摘要\n${channelSession.summary}`);
    }
    
    const recentTurns = channelSession.turns.slice(
      channelSession.summaryTurnCount
    ).slice(-CONTEXT_SCOPE.channel.maxRecent);
    
    if (recentTurns.length > 0) {
      lines.push(`\n## 最近对话`);
      for (const t of recentTurns) {
        lines.push(`- ${t.role}: ${String(t.content || '').slice(0, 100)}`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * 获取项目上下文
   */
  async _getProjectContext(projectId) {
    const lines = [`# 项目上下文 (${projectId})`];
    
    // 项目信息
    if (this.projectStore) {
      try {
        const project = await this.projectStore.get(projectId);
        if (project) {
          lines.push(`\n## 项目信息`);
          lines.push(`- 名称: ${project.name || '未命名'}`);
          lines.push(`- 阶段: ${project.phase || 'unknown'}`);
          lines.push(`- 描述: ${project.description || '无'}`);
        }
      } catch (e) {}
    }
    
    // 项目决策
    try {
      const decisions = await this.memoryStore.query({
        scope: 'project',
        scopeId: projectId,
        kind: 'decision',
        limit: CONTEXT_SCOPE.project.maxRecent,
      });
      
      if (decisions.items?.length > 0) {
        lines.push(`\n## 项目决策`);
        for (const d of decisions.items) {
          lines.push(`- ${d.subject}: ${d.content?.slice(0, 100) || ''}`);
        }
      }
    } catch (e) {}
    
    // 项目约束
    try {
      const constraints = await this.memoryStore.query({
        scope: 'project',
        scopeId: projectId,
        kind: 'constraint',
        limit: 10,
      });
      
      if (constraints.items?.length > 0) {
        lines.push(`\n## 项目约束`);
        for (const c of constraints.items) {
          lines.push(`- ${c.content?.slice(0, 100) || ''}`);
        }
      }
    } catch (e) {}
    
    return lines.join('\n');
  }
  
  /**
   * 获取任务上下文
   */
  async _getTaskContext(taskId) {
    const lines = [`# 任务上下文 (${taskId})`];
    
    if (this.projectStore) {
      try {
        const task = await this.projectStore.getTask(taskId);
        if (task) {
          lines.push(`\n## 任务信息`);
          lines.push(`- 标题: ${task.title || '未命名'}`);
          lines.push(`- 状态: ${task.status || 'unknown'}`);
          lines.push(`- 描述: ${task.description || '无'}`);
          
          if (task.assignee) lines.push(`- 负责人: ${task.assignee}`);
          if (task.dueDate) lines.push(`- 截止: ${task.dueDate}`);
        }
      } catch (e) {}
    }
    
    return lines.join('\n');
  }
  
  /**
   * 获取 Session 上下文
   */
  async _getSessionContext(sessionKey) {
    const session = this.sessionManager.sessions.get(sessionKey);
    if (!session) return null;
    
    const lines = [`# 当前会话`];
    
    if (session.summary) {
      lines.push(`\n## 对话摘要\n${session.summary}`);
    }
    
    const recentTurns = session.turns.slice(session.summaryTurnCount);
    if (recentTurns.length > 0) {
      lines.push(`\n## 最近对话`);
      for (const t of recentTurns.slice(-10)) {
        lines.push(`**${t.role === 'user' ? '用户' : '助手'}**: ${String(t.content || '').slice(0, 200)}`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * 估算 token 数
   */
  _estimateTokens(text) {
    if (!text) return 0;
    const s = String(text);
    const cnChars = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
    const enWords = (s.match(/[a-zA-Z]+/g) || []).length;
    return Math.ceil(cnChars * 1.5 + enWords * 1.3 + s.length * 0.5);
  }
  
  /**
   * 截断文本到指定 token 数
   */
  _truncate(text, maxTokens) {
    const lines = String(text).split('\n');
    const result = [];
    let tokens = 0;
    
    for (const line of lines) {
      const lineTokens = this._estimateTokens(line);
      if (tokens + lineTokens > maxTokens) {
        result.push(`... (截断, 共 ${this._estimateTokens(text)} tokens)`);
        break;
      }
      result.push(line);
      tokens += lineTokens;
    }
    
    return result.join('\n');
  }
  
  /**
   * 获取上下文来源树
   */
  getContextTree(sessionKey) {
    const parsed = SessionKey.parse(sessionKey);
    const tree = {
      level: SessionKey.getLevel(sessionKey),
      sources: [],
    };
    
    if (parsed.agentId) {
      tree.sources.push({ type: 'agent', id: parsed.agentId, priority: CONTEXT_PRIORITY.agent });
    }
    
    if (parsed.channelId) {
      tree.sources.push({ type: 'channel', id: parsed.channelId, priority: CONTEXT_PRIORITY.channel });
    }
    
    if (parsed.projectId) {
      tree.sources.push({ type: 'project', id: parsed.projectId, priority: CONTEXT_PRIORITY.project });
    }
    
    if (parsed.taskId) {
      tree.sources.push({ type: 'task', id: parsed.taskId, priority: CONTEXT_PRIORITY.task });
    }
    
    tree.sources.push({ type: 'session', id: sessionKey, priority: CONTEXT_PRIORITY.session });
    
    // 按优先级排序
    tree.sources.sort((a, b) => b.priority - a.priority);
    
    return tree;
  }
}
