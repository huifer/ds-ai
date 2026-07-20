// ~/pi-discord-agents/src/orchestrator/context-compressor.mjs
// ContextCompressor:用 LLM 把长对话历史压缩成摘要
//
// 设计要点:
//   1. 支持多种压缩策略:简单文本 / LLM 摘要 / 增量摘要
//   2. 用便宜模型(haiku)做摘要,降低成本
//   3. 保留关键事实:数字、日期、决策、承诺
//   4. 可降级:LLM 不可用时用规则化压缩

import { SessionPool } from './session-pool.mjs';

/**
 * 压缩策略接口
 *
 * LlmStrategy: 用 LLM 生成高质量摘要
 * SimpleStrategy: 用规则拼接,无需 LLM
 * HybridStrategy: LLM 优先,失败降级到 Simple
 */

export class LlmStrategy {
  /**
   * @param {object} opts
   * @param {object} opts.piBridge - PiBridge 实例
   * @param {string} [opts.model='haiku'] - 摘要模型
   * @param {number} [opts.maxTokens=800] - 摘要最大 token
   */
  constructor({ piBridge, model = 'haiku', maxTokens = 800 }) {
    this.piBridge = piBridge;
    this.model = model;
    this.maxTokens = maxTokens;
  }

  async summarize({ previousSummary, turns }) {
    if (!this.piBridge?.available) {
      throw new Error('PiBridge 不可用,无法用 LLM 摘要');
    }

    const userText = turns.map((t, i) => {
      const preview = String(t.content ?? '').slice(0, 1500);
      return `[轮${i + 1}] ${t.role}: ${preview}`;
    }).join('\n\n');

    const systemPrompt = `你是一个对话摘要专家。你的任务是:
1. 保留所有关键事实:数字、日期、姓名、决策、承诺、待办事项
2. 删除冗余、寒暄、重复表达
3. 用简洁的项目符号格式输出,目标长度 ${this.maxTokens} tokens 以内
4. 用中文输出
5. 如果已有历史摘要,请把新内容合并进去,而非重复`;

    const input = previousSummary
      ? `# 已有摘要\n${previousSummary}\n\n# 新增对话\n${userText}\n\n请输出合并后的完整摘要:`
      : `# 待摘要对话\n${userText}\n\n请输出摘要:`;

    const result = await this.piBridge.prompt(systemPrompt, input, { timeoutMs: 60_000 });
    if (!result) throw new Error('LLM 返回空结果');
    return result.trim();
  }
}

export class SimpleStrategy {
  async summarize({ previousSummary, turns }) {
    const lines = [];
    if (previousSummary) lines.push(previousSummary);
    lines.push(`\n--- 截至 ${new Date().toISOString().slice(0, 16)} ---`);

    // 提取关键句子(包含数字、日期、决策词的)
    for (const t of turns) {
      const content = String(t.content ?? '');
      const keyPoints = extractKeyPoints(content);
      if (keyPoints.length === 0) continue;
      const prefix = t.role === 'user' ? '👤' : '🤖';
      for (const kp of keyPoints.slice(0, 3)) {
        lines.push(`${prefix} ${kp}`);
      }
    }

    return lines.join('\n');
  }
}

export class HybridStrategy {
  constructor({ piBridge, ...opts }) {
    this.llm = new LlmStrategy({ piBridge, ...opts });
    this.simple = new SimpleStrategy();
  }

  async summarize(ctx) {
    try {
      return await this.llm.summarize(ctx);
    } catch (e) {
      // LLM 失败时降级
      return await this.simple.summarize(ctx);
    }
  }
}

/**
 * 从文本中提取关键信息点(用于规则化摘要)
 */
function extractKeyPoints(text) {
  if (!text) return [];
  const points = [];

  // 包含数字的句子(订单号、价格、数量)
  const withNumbers = text.match(/[^。\n]{0,80}(\d[\d,.]*\s*[元块个件年月日天小时]|第\s*\d+|v?\d+\.\d+)[^。\n]{0,80}[。\n]/g);
  if (withNumbers) points.push(...withNumbers.map(s => s.trim()).filter(Boolean));

  // 包含决策/承诺的句子
  const decisions = text.match(/[^。\n]{0,80}(决定|同意|批准|拒绝|确认|承诺|下周|明天|TODO|待办)[^。\n]{0,80}[。\n]/g);
  if (decisions) points.push(...decisions.map(s => s.trim()).filter(Boolean));

  // 包含日期的句子
  const dates = text.match(/[^。\n]{0,80}(\d{4}-\d{2}-\d{2}|周[一二三四五六日])[^。\n]{0,80}[。\n]/g);
  if (dates) points.push(...dates.map(s => s.trim()).filter(Boolean));

  return points;
}

/**
 * ContextCompressor:在 SessionPool 之上提供自动压缩
 *
 * 用法:
 *   const compressor = new ContextCompressor({ sessionPool, strategy, log });
 *   const result = await compressor.maybeCompress(sessionKey);
 */
export class ContextCompressor {
  constructor({
    sessionPool,
    strategy,
    log = () => {},
  }) {
    this.sessionPool = sessionPool;
    this.strategy = strategy ?? new SimpleStrategy();
    this.log = log;
  }

  /**
   * 检查并压缩指定 session
   */
  async maybeCompress(sessionKey) {
    const s = this.sessionPool.sessions.get(sessionKey);
    if (!s) return { compressed: false, reason: 'session_not_found' };

    const uncompressedTurns = s.turns.length - s.summaryTurnCount;
    if (uncompressedTurns < this.sessionPool.maxTurnsBeforeCompress &&
        s.tokenEstimate < this.sessionPool.maxTokensBeforeCompress) {
      return { compressed: false, reason: 'below_threshold' };
    }

    return await this.sessionPool.compress(s, (ctx) => this.strategy.summarize(ctx));
  }

  /**
   * 强制压缩一个 session
   */
  async forceCompress(sessionKey) {
    const s = this.sessionPool.sessions.get(sessionKey);
    if (!s) return { compressed: false, reason: 'session_not_found' };
    return await this.sessionPool.compress(s, (ctx) => this.strategy.summarize(ctx));
  }

  /**
   * 批量压缩所有超过阈值的 session
   */
  async compressAll() {
    const results = [];
    for (const s of this.sessionPool.sessions.values()) {
      const r = await this.sessionPool.compress(s, (ctx) => this.strategy.summarize(ctx));
      if (!r.skipped) results.push({ key: s.key, ...r });
    }
    this.log(`[compressor] 批量压缩完成:${results.length} 个 session`);
    return results;
  }
}