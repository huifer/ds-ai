// ~/pi-discord-agents/src/runtime/session/layered-session-manager.mjs
// 多层 Session 管理器
//
// 功能:
//   - 支持 5 层 Session: task > project > channel > agent > global
//   - 自动上下文继承
//   - 基于任务的生命周期管理
//   - Session 隔离与共享控制

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { SessionKey, SESSION_STATES, SESSION_LEVELS, INTENT_TYPES } from './session-key.mjs';

/**
 * 上下文继承优先级
 */
const CONTEXT_PRIORITY = {
  session: 100,   // 当前 Session（最高）
  task: 80,      // 任务层
  project: 60,   // 项目层
  channel: 40,   // 频道层
  agent: 20,     // Agent 层
  global: 10,   // 全局层（最低）
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
 * 多层 Session 管理器
 */
export class LayeredSessionManager {
  constructor({
    rootDir,
    log = () => {},
    // 压缩配置
    maxTurnsBeforeCompress = 20,
    maxTokensBeforeCompress = 60000,
    keepRecentTurns = 5,
    idleMinutesBeforeArchive = 30,
  }) {
    this.rootDir = rootDir;
    this.log = log;
    
    this.maxTurnsBeforeCompress = maxTurnsBeforeCompress;
    this.maxTokensBeforeCompress = maxTokensBeforeCompress;
    this.keepRecentTurns = keepRecentTurns;
    this.idleMinutesBeforeArchive = idleMinutesBeforeArchive;
    
    // Session 目录
    this.sessionsDir = resolve(rootDir, 'data', 'sessions', '.sessions');
    this.historyDir = resolve(rootDir, 'data', 'sessions', 'history');
    this.archiveDir = resolve(rootDir, 'data', 'sessions', 'archive');
    
    // 内存缓存
    this.sessions = new Map();  // key -> SessionState
    this.idleTimers = new Map();  // key -> Timer
    
    // 初始化目录
    this._ensureDirs();
  }
  
  _ensureDirs() {
    for (const dir of [this.sessionsDir, this.historyDir, this.archiveDir]) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
  }
  
  /**
   * 获取或创建 Session
   */
  getOrCreate({
    channelId,
    userId,
    projectId = null,
    taskId = null,
    intentType = null,
    agentId = null,
  }) {
    // 推断 intent
    if (!intentType) intentType = INTENT_TYPES.CHAT;
    
    const key = SessionKey.build({
      channelId,
      userId,
      projectId,
      taskId,
      intentType,
      agentId,
    });
    
    const level = SessionKey.getLevel(key);
    
    // 检查缓存
    if (this.sessions.has(key)) {
      const s = this.sessions.get(key);
      this._touchIdleTimer(key);
      return s;
    }
    
    // 尝试从磁盘加载
    const loaded = this._loadSession(key);
    if (loaded) {
      this.sessions.set(key, loaded);
      this._touchIdleTimer(key);
      return loaded;
    }
    
    // 创建新的
    const session = {
      key,
      level,
      state: SESSION_STATES.ACTIVE,
      layers: {
        channel: { channelId },
        project: projectId ? { projectId } : null,
        task: taskId ? { taskId } : null,
        intent: { type: intentType, confidence: 1.0 },
        agent: agentId ? { agentId } : null,
      },
      turns: [],
      summary: '',
      summaryTurnCount: 0,
      tokenEstimate: 0,
      compressedCount: 0,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    
    this.sessions.set(key, session);
    this._persist(session);
    this._touchIdleTimer(key);
    
    this.log(`[layered-session] 新建 ${level} Session: ${SessionKey.anonymize(key)}`);
    
    return session;
  }
  
  /**
   * 添加对话轮次
   */
  addTurn(key, role, content, tokens = 0) {
    const session = this.sessions.get(key);
    if (!session) throw new Error(`Session not found: ${key}`);
    
    session.turns.push({
      role,
      content,
      tokens,
      at: new Date().toISOString(),
    });
    
    session.tokenEstimate += tokens;
    session.lastActiveAt = new Date().toISOString();
    session.state = SESSION_STATES.ACTIVE;
    
    this._persist(session);
    this._touchIdleTimer(key);
    
    // 检查是否需要压缩
    return this._maybeCompress(session);
  }
  
  /**
   * 检查并触发压缩
   */
  _maybeCompress(session) {
    const reasons = [];
    
    const uncompressedTurns = session.turns.length - session.summaryTurnCount;
    if (uncompressedTurns >= this.maxTurnsBeforeCompress) {
      reasons.push(`turns=${uncompressedTurns}`);
    }
    
    if (session.tokenEstimate >= this.maxTokensBeforeCompress) {
      reasons.push(`tokens=${session.tokenEstimate}`);
    }
    
    if (reasons.length === 0) {
      return { compressed: false };
    }
    
    return this._compress(session);
  }
  
  /**
   * 压缩 Session
   */
  _compress(session, compressFn = null) {
    const turnsToSummarize = session.turns.slice(
      session.summaryTurnCount,
      -this.keepRecentTurns
    );
    
    if (turnsToSummarize.length < 3) {
      return { compressed: false, reason: 'insufficient_history' };
    }
    
    let newSummary = session.summary;
    
    if (compressFn && typeof compressFn === 'function') {
      try {
        newSummary = compressFn({
          previousSummary: session.summary,
          turns: turnsToSummarize,
        });
      } catch (e) {
        this.log(`[layered-session] 摘要失败: ${e.message}`);
        newSummary = this._simpleSummary(session.summary, turnsToSummarize);
      }
    } else {
      newSummary = this._simpleSummary(session.summary, turnsToSummarize);
    }
    
    session.summary = newSummary;
    session.summaryTurnCount = session.turns.length - this.keepRecentTurns;
    session.compressedCount += 1;
    
    // 重新估算 token
    const recentTokens = session.turns
      .slice(session.summaryTurnCount)
      .reduce((s, t) => s + (t.tokens || 0), 0);
    session.tokenEstimate = Math.ceil(newSummary.length / 4) + recentTokens;
    
    this._persist(session);
    
    this.log(`[layered-session] 压缩 ${session.key}: ${turnsToSummarize.length} 轮`);
    
    return {
      compressed: true,
      summarizedTurns: turnsToSummarize.length,
      compressedCount: session.compressedCount,
    };
  }
  
  /**
   * 简单摘要
   */
  _simpleSummary(prevSummary, turns) {
    const lines = [];
    if (prevSummary) lines.push(prevSummary);
    lines.push(`\n[${new Date().toISOString().slice(0, 10)}]`);
    for (const t of turns) {
      const preview = String(t.content || '').slice(0, 100).replace(/\n/g, ' ');
      lines.push(`- ${t.role}: ${preview}${t.content?.length > 100 ? '…' : ''}`);
    }
    return lines.join('\n');
  }
  
  /**
   * 构建 LLM 上下文
   */
  async buildContext(key, {
    memoryStore = null,
    projectContext = null,
  } = {}) {
    const parts = [];
    const parsed = SessionKey.parse(key);
    
    // 1. 全局上下文
    parts.push('# 系统信息\n你是一个 AI 助手。');
    
    // 2. Agent 上下文
    if (parsed.agentId) {
      parts.push(`\n# 当前 Agent\nAgent ID: ${parsed.agentId}`);
    }
    
    // 3. 项目上下文（如果有）
    if (parsed.projectId && projectContext) {
      parts.push(`\n# 项目上下文\n${JSON.stringify(projectContext, null, 2)}`);
    }
    
    // 4. 相关记忆（如果有 memoryStore）
    if (memoryStore) {
      try {
        const memories = await memoryStore.query({
          scope: parsed.projectId ? 'project' : 'channel',
          scopeId: parsed.projectId || parsed.channelId,
          limit: 5,
        });
        if (memories.items?.length > 0) {
          parts.push(`\n# 相关记忆\n${memories.items.map(m => 
            `- [${m.kind}] ${m.subject}: ${m.content?.slice(0, 100)}`
          ).join('\n')}`);
        }
      } catch (e) {
        this.log(`[layered-session] 记忆查询失败: ${e.message}`);
      }
    }
    
    // 5. Session 摘要和历史
    const session = this.sessions.get(key);
    if (session) {
      if (session.summary) {
        parts.push(`\n# 对话历史摘要\n${session.summary}`);
      }
      
      const recentTurns = session.turns.slice(session.summaryTurnCount);
      if (recentTurns.length > 0) {
        parts.push(`\n# 近期对话`);
        for (const t of recentTurns) {
          parts.push(`**${t.role === 'user' ? '用户' : '助手'}**: ${t.content}`);
        }
      }
    }
    
    return parts.join('\n\n');
  }
  
  /**
   * 获取当前 Intent
   */
  updateIntent(key, intentType) {
    const session = this.sessions.get(key);
    if (!session) return;
    
    session.layers.intent = {
      type: intentType,
      confidence: 1.0,
      updatedAt: new Date().toISOString(),
    };
    
    this._persist(session);
  }
  
  /**
   * 提升到项目层
   */
  promoteToProject(key, projectId) {
    const session = this.sessions.get(key);
    if (!session) return null;
    
    // 创建项目级 Session
    const projectKey = SessionKey.build({
      channelId: SessionKey.parse(key).channelId,
      userId: SessionKey.parse(key).userId,
      projectId,
      intentType: session.layers.intent?.type,
      agentId: session.layers.agent?.agentId,
    });
    
    const projectSession = this.getOrCreate({
      channelId: SessionKey.parse(key).channelId,
      userId: SessionKey.parse(key).userId,
      projectId,
      intentType: session.layers.intent?.type,
      agentId: session.layers.agent?.agentId,
    });
    
    // 复制摘要
    if (session.summary) {
      projectSession.summary = `[来自任务]\n${session.summary}`;
    }
    
    // 标记原 Session 为已提升
    session.state = SESSION_STATES.PROMOTED;
    session.promotedTo = projectKey;
    session.promotedAt = new Date().toISOString();
    this._persist(session);
    
    this.log(`[layered-session] 提升 ${SessionKey.anonymize(key)} -> ${SessionKey.anonymize(projectKey)}`);
    
    return projectSession;
  }
  
  /**
   * 归档 Session
   */
  archive(key) {
    const session = this.sessions.get(key);
    if (!session) return false;
    
    session.state = SESSION_STATES.ARCHIVED;
    this._persist(session, { toArchive: true });
    
    // 从内存移除
    this.sessions.delete(key);
    if (this.idleTimers.has(key)) {
      clearTimeout(this.idleTimers.get(key));
      this.idleTimers.delete(key);
    }
    
    this.log(`[layered-session] 归档 ${SessionKey.anonymize(key)}`);
    
    return true;
  }
  
  /**
   * 删除 Session
   */
  delete(key) {
    this.archive(key);
    
    // 删除历史文件
    const historyPath = this._historyPath(key);
    if (existsSync(historyPath)) {
      unlinkSync(historyPath);
    }
  }
  
  /**
   * 列出所有 Session
   */
  list({ level = null, state = null } = {}) {
    const result = [];
    
    for (const session of this.sessions.values()) {
      if (level && session.level !== level) continue;
      if (state && session.state !== state) continue;
      
      result.push({
        key: session.key,
        level: session.level,
        state: session.state,
        turns: session.turns.length,
        tokenEstimate: session.tokenEstimate,
        compressedCount: session.compressedCount,
        lastActiveAt: session.lastActiveAt,
      });
    }
    
    return result;
  }
  
  /**
   * 获取统计
   */
  getStats() {
    const sessions = Array.from(this.sessions.values());
    
    return {
      total: sessions.length,
      byLevel: this._groupBy(sessions, 'level'),
      byState: this._groupBy(sessions, 'state'),
      totalTokens: sessions.reduce((s, x) => s + x.tokenEstimate, 0),
      avgTokens: sessions.length > 0 
        ? sessions.reduce((s, x) => s + x.tokenEstimate, 0) / sessions.length 
        : 0,
    };
  }
  
  // ---- 内部方法 ----
  
  _touchIdleTimer(key) {
    if (this.idleTimers.has(key)) {
      clearTimeout(this.idleTimers.get(key));
    }
    
    const t = setTimeout(() => {
      const session = this.sessions.get(key);
      if (session) {
        session.state = SESSION_STATES.IDLE;
        this._persist(session);
        this.log(`[layered-session] Session 进入空闲: ${SessionKey.anonymize(key)}`);
      }
    }, this.idleMinutesBeforeArchive * 60 * 1000);
    
    this.idleTimers.set(key, t);
  }
  
  _sessionMetaPath(key) {
    const parsed = SessionKey.parse(key);
    const parts = [];
    
    if (parsed.channelId) parts.push(`channel:${parsed.channelId}`);
    if (parsed.userId) parts.push(`user:${parsed.userId}`);
    if (parsed.projectId) parts.push(`project:${parsed.projectId}`);
    if (parsed.taskId) parts.push(`task:${parsed.taskId}`);
    
    // 使用 hash 确保唯一性
    const hash = createHash('sha1').update(key).digest('hex').slice(0, 8);
    return resolve(this.sessionsDir, parts.join('/'), `session_${hash}.json`);
  }
  
  _historyPath(key) {
    const hash = createHash('sha1').update(key).digest('hex').slice(0, 12);
    const safe = key.replace(/[^a-zA-Z0-9:_-]/g, '_');
    return resolve(this.historyDir, `${safe}_${hash}.jsonl`);
  }
  
  _persist(session, { toArchive = false } = {}) {
    try {
      const metaPath = this._sessionMetaPath(session.key);
      const dir = resolve(metaPath, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(metaPath, JSON.stringify(session, null, 2), 'utf8');
      
      // 同时写入历史
      const historyPath = this._historyPath(session.key);
      const historyDir = resolve(historyPath, '..');
      if (!existsSync(historyDir)) mkdirSync(historyDir, { recursive: true });
      
      const lastTurn = session.turns[session.turns.length - 1];
      if (lastTurn) {
        const line = JSON.stringify({
          at: lastTurn.at,
          key: session.key,
          ...lastTurn,
        }) + '\n';
        // 追加模式
        const existContent = existsSync(historyPath) ? readFileSync(historyPath, 'utf8') : '';
        writeFileSync(historyPath, existContent + line, 'utf8');
      }
    } catch (e) {
      this.log(`[layered-session] 持久化失败: ${e.message}`);
    }
  }
  
  _loadSession(key) {
    const metaPath = this._sessionMetaPath(key);
    if (!existsSync(metaPath)) return null;
    
    try {
      return JSON.parse(readFileSync(metaPath, 'utf8'));
    } catch {
      return null;
    }
  }
  
  _groupBy(arr, key) {
    const result = {};
    for (const item of arr) {
      const k = item[key] || 'unknown';
      result[k] = (result[k] || 0) + 1;
    }
    return result;
  }
  
  /**
   * 关闭管理器
   */
  shutdown() {
    for (const t of this.idleTimers.values()) {
      clearTimeout(t);
    }
    this.idleTimers.clear();
    
    for (const session of this.sessions.values()) {
      this._persist(session);
    }
    
    this.log(`[layered-session] shutdown,持久化 ${this.sessions.size} 个 Session`);
  }
}
