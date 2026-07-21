// ~/pi-discord-agents/src/dreaming/enhancement/dream-to-memory.mjs
// 梦境→主记忆通道 — 高质量产物自动沉淀到记忆系统

/**
 * DreamToMemory: 将高质量梦境产物自动吸收到主记忆系统
 * 
 * 设计原则:
 * 1. 只吸收高分产物（避免污染主记忆）
 * 2. 检查相似记忆避免重复
 * 3. 保留来源追踪（source = dreaming）
 */

import { computePolarity } from './nightmare-mitigation.mjs';

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  // 吸收阈值（总分）
  scoreThreshold: 0.60,
  // 极性阈值（只吸收正向洞察）
  polarityThreshold: 0.0,
  // 最大吸收数量（每天）
  maxAbsorptionsPerDay: 5,
  // 检查相似度阈值
  similarityThreshold: 0.75,
};

/**
 * 创建 DreamToMemory 实例
 * 
 * @param {Object} opts
 * @param {Object} opts.memoryStore - memory-store 实例
 * @param {Object} opts.artifacts - artifacts 实例
 * @param {Object} opts.embedder - embedder 实例（可选）
 * @param {Function} opts.log - 日志函数
 * @param {Object} opts.config - 配置覆盖
 */
export function createDreamToMemory({
  memoryStore,
  artifacts,
  embedder = null,
  log = () => {},
  config = {},
}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  /**
   * 计算两条记忆的相似度
   */
  async function computeSimilarity(a, b) {
    if (embedder) {
      try {
        const vecA = await embedder.embed(a.content?.slice(0, 500) || a.title || '');
        const vecB = await embedder.embed(b.content?.slice(0, 500) || b.title || '');
        return cosineSimilarity(vecA, vecB);
      } catch (e) {
        log(`[dream-to-memory] embedding 失败: ${e.message}`);
      }
    }
    // Fallback: 简单文本相似度
    return textSimilarity(a.title || '', b.title || '');
  }

  /**
   * 余弦相似度
   */
  function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const den = Math.sqrt(na) * Math.sqrt(nb);
    return den > 0 ? dot / den : 0;
  }

  /**
   * 简单文本相似度
   */
  function textSimilarity(a, b) {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * 检查是否应该吸收某个产物
   */
  async function shouldAbsorb(artifact) {
    // 检查分数
    const score = artifact.scores?.total || 0;
    if (score < cfg.scoreThreshold) {
      return { ok: false, reason: 'score-below-threshold', score };
    }

    // 检查极性
    const { polarity } = computePolarity(artifact.body || artifact.text || '');
    if (polarity < cfg.polarityThreshold) {
      return { ok: false, reason: 'polarity-negative', polarity };
    }

    // 检查是否已有类似记忆
    const existingMemories = await memoryStore.query({
      limit: 10,
      kinds: ['reflection', 'idea', 'decision'],
    });

    for (const mem of existingMemories.items || []) {
      const sim = await computeSimilarity(artifact, mem);
      if (sim > cfg.similarityThreshold) {
        return { ok: false, reason: 'similar-memory-exists', similarId: mem.id, similarity: sim };
      }
    }

    return { ok: true };
  }

  /**
   * 从产物创建记忆
   */
  async function createMemoryFromArtifact(artifact) {
    const id = `dream-${artifact.id}`;
    const title = artifact.title || artifact.meta?.title || extractTitle(artifact.body || artifact.text);

    const memory = {
      id,
      kind: 'reflection',
      subject: title,
      content: artifact.body || artifact.text || '',
      source: {
        type: 'dreaming',
        artifactId: artifact.id,
        dreamType: artifact.type,
        scores: artifact.scores,
        polarity: computePolarity(artifact.body || '').polarity,
      },
      tags: ['dreaming', artifact.type, 'auto-absorbed'],
      confidence: artifact.scores?.total || 0.5,
      importanceScore: Math.round((artifact.scores?.total || 0.5) * 100),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await memoryStore.upsert(memory);
    return memory;
  }

  /**
   * 提取标题
   */
  function extractTitle(text) {
    if (!text) return '无标题';
    const lines = text.split('\n');
    const firstLine = lines.find(l => l.trim());
    if (firstLine) {
      return firstLine.replace(/^#+\s*/, '').trim().slice(0, 80);
    }
    return text.slice(0, 80);
  }

  /**
   * 处理新产物
   */
  async function processNewDreams({ limit = 20 } = {}) {
    const results = {
      processed: 0,
      absorbed: [],
      skipped: [],
      errors: [],
    };

    // 获取最近未处理的产物
    const types = ['lian-zhu', 'gui-cang', 'ming-tai', 'yu-yan'];
    const allArtifacts = [];

    for (const type of types) {
      try {
        const list = await artifacts.listMeta({ type, limit: limit });
        for (const meta of list) {
          // 检查是否已经被吸收
          const existing = await memoryStore.readMeta(`dream-${meta.id}`);
          if (!existing) {
            allArtifacts.push(meta);
          }
        }
      } catch (e) {
        log(`[dream-to-memory] 获取 ${type} 产物失败: ${e.message}`);
      }
    }

    // 按分数排序
    allArtifacts.sort((a, b) => (b.scores?.total || 0) - (a.scores?.total || 0));

    // 限制每天吸收数量
    let absorbedToday = 0;

    for (const artifact of allArtifacts) {
      results.processed++;

      // 检查每日限额
      if (absorbedToday >= cfg.maxAbsorptionsPerDay) {
        results.skipped.push({
          artifactId: artifact.id,
          reason: 'daily-limit-reached',
        });
        continue;
      }

      // 检查是否应该吸收
      const check = await shouldAbsorb(artifact);
      if (!check.ok) {
        results.skipped.push({
          artifactId: artifact.id,
          reason: check.reason,
          score: check.score,
          polarity: check.polarity,
          similarity: check.similarity,
        });
        continue;
      }

      // 吸收
      try {
        const memory = await createMemoryFromArtifact(artifact);
        absorbedToday++;
        results.absorbed.push({
          artifactId: artifact.id,
          memoryId: memory.id,
          score: artifact.scores?.total,
          polarity: computePolarity(artifact.body || '').polarity,
        });
        log(`[dream-to-memory] ✓ 吸收 ${artifact.id} → ${memory.id}`);
      } catch (e) {
        results.errors.push({
          artifactId: artifact.id,
          error: e.message,
        });
        log(`[dream-to-memory] ✗ 吸收失败 ${artifact.id}: ${e.message}`);
      }
    }

    return results;
  }

  /**
   * 获取吸收统计
   */
  async function getStats({ days = 7 } = {}) {
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString();

    const allMemories = await memoryStore.query({
      limit: 1000,
      kinds: ['reflection'],
    });

    const dreamMemories = (allMemories.items || []).filter(m =>
      m.source?.type === 'dreaming' && m.createdAt > cutoff
    );

    const byType = {};
    for (const m of dreamMemories) {
      const type = m.source?.dreamType || 'unknown';
      if (!byType[type]) byType[type] = 0;
      byType[type]++;
    }

    return {
      totalAbsorbed: dreamMemories.length,
      byType,
      avgScore: dreamMemories.reduce((s, m) => s + (m.confidence || 0), 0) / (dreamMemories.length || 1),
      avgImportance: dreamMemories.reduce((s, m) => s + (m.importanceScore || 0), 0) / (dreamMemories.length || 1),
    };
  }

  return {
    processNewDreams,
    getStats,
    shouldAbsorb,
    config: cfg,
  };
}
