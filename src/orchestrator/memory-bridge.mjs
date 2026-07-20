// ~/pi-discord-agents/src/orchestrator/memory-bridge.mjs
// MemoryBridge:把多 Agent 系统与现有 memory-store + memory-scope 集成
//
// 设计要点:
//   1. 每个 Agent 有专属 memory scope (写权限)
//   2. Agent 之间通过共享 scope 协作 (读权限)
//   3. 重要信息自动存入 memory (跨 session 持久化)
//   4. 检索时按 agent 的 readScopes 过滤
//   5. 复用现有 memory-context.mjs 做向量检索
//
// Memory 分层:
//   - L0 Session (短期):当前对话上下文,SessionPool 管理
//   - L1 Agent Memory (中期):每个 Agent 独立 scope,MemoryScope 管理
//   - L2 Cross-Agent Memory (长期):共享 scope,如 company / business
//   - L3 Knowledge Base (永久):memory-store 中的全局知识

import { MemoryScope } from '../runtime/memory-scope.mjs';

/**
 * 每个 Agent 的 memory 配置
 * 与 agent-registry.mjs 中的 agent 定义合并使用
 */
export const AGENT_MEMORY_CONFIG = {
  // 总控
  orchestrator: { readScopes: ['company', 'business', 'agent-internal'], writeScope: 'agent-internal' },
  planner:     { readScopes: ['company', 'business'], writeScope: 'agent-internal' },
  approver:    { readScopes: ['company', 'business', 'agent-internal'], writeScope: 'agent-internal' },

  // 企业服务
  sales:       { readScopes: ['company', 'business', 'sales'], writeScope: 'sales' },
  project:     { readScopes: ['company', 'business', 'current-project', 'agent-internal'], writeScope: 'agent-internal' },
  support:     { readScopes: ['company', 'business', 'sales'], writeScope: 'agent-internal' },

  // 技术
  dev:         { readScopes: ['coding', 'fde-knowledge', 'current-project'], writeScope: 'coding' },
  'eng-kb':    { readScopes: ['coding', 'fde-knowledge'], writeScope: 'fde-knowledge' },

  // 增长
  seo:         { readScopes: ['company', 'business', 'industry'], writeScope: 'agent-internal' },
  marketing:   { readScopes: ['company', 'business', 'industry'], writeScope: 'agent-internal' },

  // 内容
  'domestic-editor': { readScopes: ['content', 'company'], writeScope: 'content' },
  'overseas-editor': { readScopes: ['content', 'company'], writeScope: 'content' },

  // 资产
  asset:       { readScopes: ['company', 'business', 'content'], writeScope: 'agent-internal' },

  // 遐思 - 特殊:可读所有,只写自己
  dreaming:    { readScopes: ['company', 'business', 'coding', 'content', 'sales', 'agent-internal'], writeScope: 'agent-internal' },
};

/**
 * MemoryBridge
 */
export class MemoryBridge {
  /**
   * @param {object} opts
   * @param {string} opts.rootDir
   * @param {object} opts.agentRegistry
   * @param {object} [opts.memoryStore] - 现有 memory-store 实例(可选)
   * @param {object} [opts.memoryContext] - 现有 memory-context 实例(可选)
   * @param {function} opts.log
   */
  constructor({ rootDir, agentRegistry, memoryStore = null, memoryContext = null, log = () => {} }) {
    this.rootDir = rootDir;
    this.registry = agentRegistry;
    this.memoryStore = memoryStore;
    this.memoryContext = memoryContext;
    this.log = log;
    this.scope = new MemoryScope({ root: rootDir });
  }

  /**
   * 获取 agent 的 memory config
   */
  getAgentMemoryConfig(agentId) {
    return AGENT_MEMORY_CONFIG[agentId] ?? {
      readScopes: ['company'],
      writeScope: 'agent-internal',
    };
  }

  /**
   * 注入 memory config 到 agent def
   */
  injectConfig() {
    for (const agent of this.registry.list({ includeHidden: true })) {
      if (!agent.memory) {
        agent.memory = this.getAgentMemoryConfig(agent.id);
      }
    }
    return this.registry.agents.size;
  }

  /**
   * Agent 写入记忆
   * @returns {Promise<boolean>} 成功
   */
  async writeMemory(agentId, content, { tags = [], kind = 'fact' } = {}) {
    const config = this.getAgentMemoryConfig(agentId);
    const scope = config.writeScope;
    const agentDef = { id: agentId, memory: config };

    try {
      await this.scope.write(scope, agentDef, {
        kind,
        content,
        tags,
      });
      this.log(`[memory-bridge] ${agentId} wrote to scope=${scope}, kind=${kind}, ${content.length} chars`);
      return true;
    } catch (e) {
      this.log(`[memory-bridge] write 失败: ${e.message}`);
      return false;
    }
  }

  /**
   * Agent 读取自己的记忆
   */
  async readOwnMemory(agentId, { limit = 50 } = {}) {
    const config = this.getAgentMemoryConfig(agentId);
    const scope = config.writeScope;
    const agentDef = { id: agentId, memory: config };

    try {
      const records = await this.scope.read(scope, agentDef, { limit });
      return records;
    } catch (e) {
      this.log(`[memory-bridge] read 失败: ${e.message}`);
      return [];
    }
  }

  /**
   * Agent 读取可访问 scope 的记忆
   */
  async readAccessibleMemory(agentId, { limit = 100 } = {}) {
    const config = this.getAgentMemoryConfig(agentId);
    const allRecords = [];
    for (const scopeName of config.readScopes) {
      const agentDef = { id: agentId, memory: config };
      try {
        const records = await this.scope.read(scopeName, agentDef, { limit });
        for (const r of records) {
          allRecords.push({ ...r, scope: scopeName });
        }
      } catch {}
    }
    return allRecords;
  }

  /**
   * 构建 Agent 的 memory context(注入到 prompt)
   * 包含:
   *   1. 该 Agent 自己 scope 的最近记忆
   *   2. 共享 scope 的关键记忆
   *   3. RAG 检索相关的(如果 memoryContext 可用)
   */
  async buildAgentContext(agentId, userText, { limit = 5 } = {}) {
    const parts = [];

    // 1. RAG 检索(如果有 memoryContext)
    if (this.memoryContext && typeof this.memoryContext.buildContext === 'function') {
      try {
        const ragCtx = await this.memoryContext.buildContext({ userText, limit });
        if (ragCtx) parts.push(`# 记忆检索\n${ragCtx}`);
      } catch (e) {
        this.log(`[memory-bridge] RAG 检索失败: ${e.message}`);
      }
    }

    // 2. Agent 自己 scope 的最近记忆
    const ownMem = await this.readOwnMemory(agentId, { limit: 3 });
    if (ownMem.length > 0) {
      parts.push(`# ${agentId} 的近期记忆`);
      for (const m of ownMem.slice(-3)) {
        const preview = String(m.content ?? '').slice(0, 200);
        parts.push(`- [${m.kind}] ${preview}`);
      }
    }

    // 3. 共享 scope(company) 的关键事实
    const config = this.getAgentMemoryConfig(agentId);
    if (config.readScopes.includes('company')) {
      const companyMem = await this.readScope(agentId, 'company', { limit: 2 });
      if (companyMem.length > 0) {
        parts.push(`# 公司关键事实`);
        for (const m of companyMem.slice(-2)) {
          const preview = String(m.content ?? '').slice(0, 150);
          parts.push(`- ${preview}`);
        }
      }
    }

    return parts.join('\n');
  }

  /**
   * 读取指定 scope 的记忆(权限校验)
   */
  async readScope(agentId, scopeName, { limit = 50 } = {}) {
    const config = this.getAgentMemoryConfig(agentId);
    if (!config.readScopes.includes(scopeName)) {
      this.log(`[memory-bridge] ${agentId} 无权读 scope=${scopeName}`);
      return [];
    }
    const agentDef = { id: agentId, memory: config };
    try {
      return await this.scope.read(scopeName, agentDef, { limit });
    } catch {
      return [];
    }
  }

  /**
   * 跨 agent 知识传递(orchestrator 用)
   * 从 source agent 的 scope 读一条记忆,转移到 target agent 的 scope
   *
   * 策略:
   *   1. 直接转移:source 可读 target.writeScope → 写过去
   *   2. 中转转移:通过 agent-internal scope 中转
   *   3. 广播转移:如果都失败,写到 company(公共 scope)
   */
  async transferMemory(sourceAgentId, targetAgentId, record) {
    const targetConfig = this.getAgentMemoryConfig(targetAgentId);
    const sourceConfig = this.getAgentMemoryConfig(sourceAgentId);

    // 策略 1: 直接转移
    if (sourceConfig.readScopes.includes(targetConfig.writeScope)) {
      return await this.writeMemory(targetAgentId, record.content, {
        tags: [...(record.tags ?? []), `from:${sourceAgentId}`],
        kind: record.kind ?? 'fact',
      });
    }

    // 策略 2: 中转到 agent-internal(target 能读)
    if (targetConfig.readScopes.includes('agent-internal') &&
        sourceConfig.writeScope === 'agent-internal') {
      this.log(`[memory-bridge] 中转: ${sourceAgentId} → agent-internal → ${targetAgentId}`);
      return await this.writeMemory(targetAgentId, record.content, {
        tags: [...(record.tags ?? []), `from:${sourceAgentId}`],
        kind: record.kind ?? 'fact',
      });
    }

    // 策略 3: 广播到 company
    if (targetConfig.readScopes.includes('company')) {
      this.log(`[memory-bridge] 广播: ${sourceAgentId} → company ← ${targetAgentId}`);
      return await this.writeMemory(targetAgentId, record.content, {
        tags: [...(record.tags ?? []), `from:${sourceAgentId}`, `broadcast:true`],
        kind: record.kind ?? 'fact',
      });
    }

    this.log(`[memory-bridge] 无路径转移: ${sourceAgentId} → ${targetAgentId}`);
    return false;
  }

  /**
   * 获取统计
   */
  getStats() {
    return {
      agentMemoryConfig: Object.keys(AGENT_MEMORY_CONFIG).length,
      scopes: Array.from(this.scope.scopes),
    };
  }
}