// ~/pi-discord-agents/src/orchestrator/session-pool.mjs
// SessionPool:为每个 (channelId, userId, topicKey) 维护独立的对话上下文
//
// 设计目标:
//   1. Session 隔离:不同频道、不同话题的对话上下文互不污染
//   2. 自动压缩:达到阈值时自动摘要历史,保留最近 N 轮
//   3. 自动清理:空闲超时的 session 自动归档
//   4. 持久化:session 状态可落盘,重启后恢复
//
// 关键概念:
//   - sessionKey: 用于唯一标识一个会话,格式: `${channelId}:${userId}:${topicHash}`
//   - turns: 对话轮次(user 1 次 + assistant 1 次 = 1 轮)
//   - tokens: 估算的 token 数
//   - summary: 历史压缩后的摘要

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * 一个 Session 的状态
 */
class SessionState {
  constructor({ key, channelId, userId, agentId, createdAt }) {
    this.key = key;
    this.channelId = channelId;
    this.userId = userId;
    this.agentId = agentId;
    this.createdAt = createdAt;
    this.lastActiveAt = createdAt;
    this.turns = [];           // [{role: 'user'|'assistant', content, tokens, at}]
    this.summary = '';         // 历史摘要
    this.summaryTurnCount = 0; // 已被摘要覆盖的 turn 数
    this.tokenEstimate = 0;    // 估算的 token 数
    this.compressedCount = 0;  // 已压缩次数
  }

  addTurn(role, content, tokens = 0) {
    this.turns.push({ role, content, tokens, at: new Date().toISOString() });
    this.lastActiveAt = new Date().toISOString();
    this.tokenEstimate += tokens;
  }

  /** 当前可见上下文(token) */
  get visibleTokens() {
    return this.tokenEstimate;
  }

  /** 转为可序列化的对象 */
  toJSON() {
    return {
      key: this.key,
      channelId: this.channelId,
      userId: this.userId,
      agentId: this.agentId,
      createdAt: this.createdAt,
      lastActiveAt: this.lastActiveAt,
      turns: this.turns,
      summary: this.summary,
      summaryTurnCount: this.summaryTurnCount,
      tokenEstimate: this.tokenEstimate,
      compressedCount: this.compressedCount,
    };
  }

  static fromJSON(data) {
    const s = new SessionState({
      key: data.key,
      channelId: data.channelId,
      userId: data.userId,
      agentId: data.agentId,
      createdAt: data.createdAt,
    });
    s.lastActiveAt = data.lastActiveAt;
    s.turns = data.turns ?? [];
    s.summary = data.summary ?? '';
    s.summaryTurnCount = data.summaryTurnCount ?? 0;
    s.tokenEstimate = data.tokenEstimate ?? 0;
    s.compressedCount = data.compressedCount ?? 0;
    return s;
  }
}

/**
 * SessionPool:管理所有活跃 session
 */
export class SessionPool {
  constructor({
    rootDir,
    log = () => {},
    // 压缩触发阈值
    maxTurnsBeforeCompress = 20,        // 每 20 轮压缩一次
    maxTokensBeforeCompress = 60_000,   // 60k tokens 强制压缩
    keepRecentTurns = 5,                // 压缩后保留最近 5 轮
    idleMinutesBeforeArchive = 30,      // 30 分钟空闲归档
    // Session 持久化
    persistDir = 'data/sessions',
  } = {}) {
    this.rootDir = rootDir;
    this.log = log;
    this.maxTurnsBeforeCompress = maxTurnsBeforeCompress;
    this.maxTokensBeforeCompress = maxTokensBeforeCompress;
    this.keepRecentTurns = keepRecentTurns;
    this.idleMinutesBeforeArchive = idleMinutesBeforeArchive;

    this.persistDir = resolve(rootDir, persistDir);
    if (!existsSync(this.persistDir)) mkdirSync(this.persistDir, { recursive: true });

    /** key -> SessionState */
    this.sessions = new Map();
    /** key -> NodeJS.Timeout (for idle cleanup) */
    this.idleTimers = new Map();

    // 启动时从磁盘恢复
    this._loadFromDisk();
  }

  /**
   * 生成 session key
   * @param {object} params
   * @param {string} params.channelId
   * @param {string} params.userId
   * @param {string} [params.topicKey] - 话题/线程 key,空表示主话题
   * @param {string} [params.agentId] - 关联的 agent id
   */
  static makeKey({ channelId, userId, topicKey = '', agentId = '' }) {
    const parts = [channelId, userId];
    if (topicKey) parts.push(`t:${topicKey}`);
    if (agentId) parts.push(`a:${agentId}`);
    return parts.join(':');
  }

  /**
   * 获取或创建一个 session
   */
  /**
   * 查找频道中用户的活跃 session（最近有过对话的）
   */
  findActive(channelId, userId) {
    for (const [key, session] of this.sessions) {
      if (session.channelId === channelId && session.userId === userId) {
        // 5 分钟内有活动的 session
        const lastActive = new Date(session.lastActiveAt).getTime();
        if (Date.now() - lastActive < 5 * 60 * 1000) {
          return session;
        }
      }
    }
    return null;
  }

  getOrCreate({ channelId, userId, topicKey = '', agentId = '' }) {
    // 先找同频道同用户的活跃 session
    const active = this.findActive(channelId, userId);
    if (active) {
      this._touchIdleTimer(active.key);
      this.log(`[session-pool] 复用活跃 session: ${active.key}`);
      return active;
    }

    const key = SessionPool.makeKey({ channelId, userId, topicKey, agentId });
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
    const s = new SessionState({
      key,
      channelId,
      userId,
      agentId,
      createdAt: new Date().toISOString(),
    });
    this.sessions.set(key, s);
    this._touchIdleTimer(key);
    this._persist(s);
    this.log(`[session-pool] 新建 session: ${key}`);
    return s;
  }

  /**
   * 向 session 添加一轮对话
   * 自动检查是否需要压缩
   * @returns {Promise<{compressed: boolean, reason?: string}>}
   */
  async addTurn(key, role, content, tokens = 0) {
    const s = this.sessions.get(key);
    if (!s) throw new Error(`session not found: ${key}`);

    s.addTurn(role, content, tokens);
    this._touchIdleTimer(key);
    this._persist(s);

    return this._maybeCompress(s);
  }

  /**
   * 检查并触发压缩
   */
  async _maybeCompress(s) {
    const reasons = [];

    // 1. 轮次触发
    const uncompressedTurns = s.turns.length - s.summaryTurnCount;
    if (uncompressedTurns >= this.maxTurnsBeforeCompress) {
      reasons.push(`turns=${uncompressedTurns}>=${this.maxTurnsBeforeCompress}`);
    }

    // 2. token 触发
    if (s.tokenEstimate >= this.maxTokensBeforeCompress) {
      reasons.push(`tokens=${s.tokenEstimate}>=${this.maxTokensBeforeCompress}`);
    }

    if (reasons.length === 0) return { compressed: false };

    // 触发压缩
    const result = await this.compress(s);
    return { compressed: true, reason: reasons.join(','), ...result };
  }

  /**
   * 压缩 session:保留最近 N 轮 + 摘要历史
   * 注意:摘要生成需要外部提供 compressFn(因为要用 LLM)
   */
  async compress(s, compressFn = null) {
    const totalTurns = s.turns.length;
    const turnsToSummarize = s.turns.slice(s.summaryTurnCount, -this.keepRecentTurns);

    if (turnsToSummarize.length < 3) {
      // 没有足够历史可压缩
      return { skipped: true, reason: 'insufficient_history' };
    }

    let newSummary = s.summary;

    if (compressFn && typeof compressFn === 'function') {
      // 用 LLM 生成摘要
      try {
        newSummary = await compressFn({
          previousSummary: s.summary,
          turns: turnsToSummarize,
        });
      } catch (e) {
        this.log(`[session-pool] 摘要失败: ${e.message}`);
        // fallback:简单拼接
        newSummary = this._simpleSummary(s.summary, turnsToSummarize);
      }
    } else {
      newSummary = this._simpleSummary(s.summary, turnsToSummarize);
    }

    s.summary = newSummary;
    s.summaryTurnCount = totalTurns - this.keepRecentTurns;

    // 估算压缩后的 token
    const recentTokens = s.turns
      .slice(s.summaryTurnCount)
      .reduce((sum, t) => sum + (t.tokens || 0), 0);
    s.tokenEstimate = Math.ceil(newSummary.length / 4) + recentTokens;
    s.compressedCount += 1;

    this._persist(s);
    this.log(`[session-pool] 压缩 session ${s.key}: ${turnsToSummarize.length} 轮 -> 摘要`);

    return {
      summarizedTurns: turnsToSummarize.length,
      newTokenEstimate: s.tokenEstimate,
      compressedCount: s.compressedCount,
    };
  }

  /**
   * 简单摘要(fallback):拼接关键信息
   */
  _simpleSummary(prevSummary, turns) {
    const lines = [];
    if (prevSummary) lines.push(prevSummary);
    lines.push(`\n[${new Date().toISOString().slice(0, 10)}]`);
    for (const t of turns) {
      const preview = String(t.content ?? '').slice(0, 100).replace(/\n/g, ' ');
      lines.push(`- ${t.role}: ${preview}${t.content?.length > 100 ? '…' : ''}`);
    }
    return lines.join('\n');
  }

  /**
   * 构建发给 LLM 的上下文(摘要 + 最近 N 轮)
   */
  buildContext(key) {
    const s = this.sessions.get(key);
    if (!s) return '';

    const parts = [];
    if (s.summary) {
      parts.push(`# 历史摘要\n${s.summary}`);
    }

    const recentTurns = s.turns.slice(s.summaryTurnCount);
    if (recentTurns.length > 0) {
      parts.push(`# 最近对话`);
      for (const t of recentTurns) {
        parts.push(`\n**${t.role === 'user' ? '用户' : '助手'}**: ${t.content}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * 强制清空一个 session
   */
  clear(key) {
    if (this.sessions.has(key)) {
      const s = this.sessions.get(key);
      s.turns = [];
      s.summary = '';
      s.summaryTurnCount = 0;
      s.tokenEstimate = 0;
      this._persist(s);
      return true;
    }
    return false;
  }

  /**
   * 删除一个 session
   */
  remove(key) {
    if (this.idleTimers.has(key)) {
      clearTimeout(this.idleTimers.get(key));
      this.idleTimers.delete(key);
    }
    this.sessions.delete(key);
    const path = this._pathFor(key);
    if (existsSync(path)) unlinkSync(path);
  }

  /**
   * 列出所有 session(用于监控)
   */
  list() {
    const result = [];
    for (const s of this.sessions.values()) {
      result.push({
        key: s.key,
        channelId: s.channelId,
        userId: s.userId,
        agentId: s.agentId,
        turns: s.turns.length,
        summaryTurns: s.summaryTurnCount,
        tokenEstimate: s.tokenEstimate,
        compressedCount: s.compressedCount,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
      });
    }
    return result;
  }

  /**
   * 估算文本的 token 数(粗略:中文字符 × 1.5,英文单词 × 1.3)
   */
  static estimateTokens(text) {
    if (!text) return 0;
    const s = String(text);
    const cnChars = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
    const enWords = (s.match(/[a-zA-Z]+/g) || []).length;
    const otherChars = s.length - cnChars - enWords;
    return Math.ceil(cnChars * 1.5 + enWords * 1.3 + otherChars * 0.5);
  }

  // ---- 内部方法 ----

  _touchIdleTimer(key) {
    if (this.idleTimers.has(key)) {
      clearTimeout(this.idleTimers.get(key));
    }
    const t = setTimeout(() => {
      // 空闲超时:不删除 session(可持久化恢复),只从内存卸载
      const s = this.sessions.get(key);
      if (s) {
        this._persist(s);
        this.sessions.delete(key);
        this.idleTimers.delete(key);
        this.log(`[session-pool] idle session 卸载: ${key}`);
      }
    }, this.idleMinutesBeforeArchive * 60 * 1000);
    this.idleTimers.set(key, t);
  }

  _pathFor(key) {
    const safe = key.replace(/[^a-zA-Z0-9:_.-]/g, '_');
    const hash = createHash('sha1').update(key).digest('hex').slice(0, 12);
    return join(this.persistDir, `${safe}_${hash}.json`);
  }

  _persist(s) {
    try {
      writeFileSync(this._pathFor(s.key), JSON.stringify(s.toJSON(), null, 2), 'utf8');
    } catch (e) {
      this.log(`[session-pool] 持久化失败: ${e.message}`);
    }
  }

  _loadSession(key) {
    const path = this._pathFor(key);
    if (!existsSync(path)) return null;
    try {
      const data = JSON.parse(readFileSync(path, 'utf8'));
      return SessionState.fromJSON(data);
    } catch {
      return null;
    }
  }

  _loadFromDisk() {
    if (!existsSync(this.persistDir)) return;
    // 仅在启动时按需加载,不在此处批量加载
    const files = readdirSync(this.persistDir);
    this.log(`[session-pool] 发现 ${files.length} 个持久化 session,按需加载`);
  }

  /**
   * 关闭所有 timer,刷新到磁盘
   */
  shutdown() {
    for (const t of this.idleTimers.values()) clearTimeout(t);
    this.idleTimers.clear();
    for (const s of this.sessions.values()) {
      this._persist(s);
    }
    this.log(`[session-pool] shutdown,持久化 ${this.sessions.size} 个 session`);
  }
}