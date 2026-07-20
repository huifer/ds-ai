// ~/pi-discord-agents/src/orchestrator/agent-manager.mjs
// MultiAgentManager:多 Agent 系统的核心调度器
//
// 职责:
//   1. 接收路由结果,从 SessionPool 取/建 session
//   2. 调用对应 Agent 的 Pi RPC(未来:每个 agent 独立进程)
//   3. 注入上下文(摘要 + 最近轮次 + 记忆)
//   4. 自动压缩(轮次/token 触发)
//   5. 跨 Agent 协调(orchestrator 调用其他 agent)

import { SessionPool } from './session-pool.mjs';
import { ContextCompressor, HybridStrategy } from './context-compressor.mjs';
import { AgentRegistry } from './agent-registry.mjs';
import { Router } from './router.mjs';
import { MemoryBridge } from './memory-bridge.mjs';

export class MultiAgentManager {
  constructor({
    rootDir,
    piBridge,
    log = () => {},
    sessionPoolOpts = {},
    compressionStrategy = null,
    memoryStore = null,
    memoryContext = null,
  }) {
    this.rootDir = rootDir;
    this.piBridge = piBridge;
    this.log = log;

    // 初始化组件
    this.registry = new AgentRegistry({ rootDir, log });
    this.registry.loadFromRegistryJson();

    this.sessionPool = new SessionPool({
      rootDir,
      log,
      ...sessionPoolOpts,
    });

    this.strategy = compressionStrategy ?? new HybridStrategy({ piBridge, log });
    this.compressor = new ContextCompressor({
      sessionPool: this.sessionPool,
      strategy: this.strategy,
      log,
    });

    this.router = new Router({
      agentRegistry: this.registry,
      sessionPool: this.sessionPool,
      log,
    });

    // Memory Bridge
    this.memoryBridge = new MemoryBridge({
      rootDir,
      agentRegistry: this.registry,
      memoryStore,
      memoryContext,
      log,
    });
    this.memoryBridge.injectConfig();

    // 健康状态
    this.startedAt = new Date().toISOString();
    this.callCount = 0;
    this.errorCount = 0;
  }

  /**
   * 处理一条 Discord 消息(主入口)
   * @returns {Promise<{reply: string, agentId: string, sessionKey: string, compressed?: boolean}>}
   */
  async handleMessage(msg) {
    const { channelId, channelName, userId, text } = msg;

    // 1. 路由
    const route = await this.router.route({ channelId, channelName, userId, text });
    this.log(`[multi-agent] 路由: channel=${channelName} → agent=${route.agentId} (${route.reason}, conf=${route.confidence.toFixed(2)})`);

    // 2. 获取或创建 session
    const session = this.sessionPool.getOrCreate({
      channelId,
      userId,
      topicKey: this.router._extractTopicKey(text),
      agentId: route.agentId,
    });

    // 3. 获取 agent 定义
    const agentDef = this.registry.get(route.agentId);
    if (!agentDef) {
      return {
        reply: `❌ Agent ${route.agentId} 未找到`,
        agentId: route.agentId,
        sessionKey: route.sessionKey,
      };
    }

    // 4. 构造 prompt
    const contextStr = this.sessionPool.buildContext(session.key);
    const memoryContext = await this._buildMemoryContext(route.agentId, text);
    const prompt = this._buildPrompt(agentDef, contextStr, memoryContext, text);

    // 5. 调用 LLM
    this.callCount += 1;
    let reply = '';
    try {
      reply = await this.piBridge.prompt(agentDef.systemPrompt, prompt, { timeoutMs: 120_000 });
      if (!reply) reply = '(无响应)';
    } catch (e) {
      this.errorCount += 1;
      this.log(`[multi-agent] LLM 错误: ${e.message}`);
      reply = `❌ 调用失败: ${e.message}`;
    }

    // 6. 记录到 session
    const userTokens = SessionPool.estimateTokens(text);
    const replyTokens = SessionPool.estimateTokens(reply);
    await this.sessionPool.addTurn(session.key, 'user', text, userTokens);
    const compressResult = await this.sessionPool.addTurn(session.key, 'assistant', reply, replyTokens);

    return {
      reply,
      agentId: route.agentId,
      agentDisplayName: agentDef.displayName,
      sessionKey: session.key,
      compressed: compressResult.compressed,
      compressionReason: compressResult.reason,
    };
  }

  /**
   * 构造发给 LLM 的完整 prompt
   */
  _buildPrompt(agentDef, sessionContext, memoryContext, userText) {
    const parts = [];

    if (sessionContext) {
      parts.push(`# 对话上下文\n${sessionContext}`);
    }

    if (memoryContext) {
      parts.push(`# 记忆检索\n${memoryContext}`);
    }

    parts.push(`# 用户输入\n${userText}`);

    return parts.join('\n\n---\n\n');
  }

  /**
   * 构建记忆上下文(从 memory-store 检索 + memory-bridge 注入)
   * 注:这里先简单实现,后续接 memory-context.mjs
   */
  async _buildMemoryContext(agentId, userText) {
    if (!this.memoryBridge) return '';
    try {
      return await this.memoryBridge.buildAgentContext(agentId, userText, { limit: 5 });
    } catch (e) {
      this.log(`[multi-agent] 记忆上下文失败: ${e.message}`);
      return '';
    }
  }

  /**
   * 注入 memory-context(可选,运行时设置)
   */
  setMemoryContext(memoryContext) {
    this.memoryContext = memoryContext;
    if (this.memoryBridge) {
      this.memoryBridge.memoryContext = memoryContext;
    }
  }

  /**
   * 列出所有 session(用于监控)
   */
  listSessions() {
    return this.sessionPool.list();
  }

  /**
   * 强制压缩一个 session
   */
  async compressSession(sessionKey) {
    return await this.compressor.forceCompress(sessionKey);
  }

  /**
   * 批量压缩所有 session
   */
  async compressAllSessions() {
    return await this.compressor.compressAll();
  }

  /**
   * 获取系统状态
   */
  getStatus() {
    const sessions = this.sessionPool.list();
    const totalTokens = sessions.reduce((sum, s) => sum + s.tokenEstimate, 0);
    const sessionsByAgent = {};
    for (const s of sessions) {
      const aid = s.agentId || 'unknown';
      sessionsByAgent[aid] = (sessionsByAgent[aid] ?? 0) + 1;
    }
    return {
      startedAt: this.startedAt,
      uptimeSec: Math.floor((Date.now() - new Date(this.startedAt).getTime()) / 1000),
      callCount: this.callCount,
      errorCount: this.errorCount,
      agentCount: this.registry.list().length,
      sessionCount: sessions.length,
      totalTokenEstimate: totalTokens,
      sessionsByAgent,
      agents: this.registry.list().map(a => ({
        id: a.id,
        name: a.displayName,
        channels: a.channels,
        primary: a.primary ?? false,
      })),
    };
  }

  /**
   * 关闭
   */
  async shutdown() {
    this.sessionPool.shutdown();
    this.log(`[multi-agent] shutdown · ${this.callCount} calls, ${this.errorCount} errors`);
  }
}