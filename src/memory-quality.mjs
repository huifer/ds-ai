// ~/pi-discord-agents/src/memory-quality.mjs
// 记忆质量衰减：根据时间、访问次数等因素动态调整记忆置信度
//
// 核心功能：
//   - 计算衰减后的置信度
//   - 访问时提升置信度
//   - 矛盾记忆检测和解决
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

// 不同 kind 的衰减速度（越小衰减越慢）
const DECAY_RATES = {
  decision: 0.0005,     // 决策衰减慢（稳定）
  constraint: 0.0003,    // 约束衰减更慢（硬性）
  preference: 0.001,     // 偏好中等（可能改变）
  fact: 0.002,          // 事实衰减快（可能过时）
  build: 0.0015,        // 工程结论中等
  reflection: 0.001,    // 反思中等
  definition: 0.0008,   // 定义较稳定
  idea: 0.005,          // 想法衰减最快（临时）
  project: 0.002,       // 项目信息衰减快
  context: 0.003,       // 上下文衰减快（短期）
  todo: 0.004,          // 待办衰减快（完成后过期）
};

// 访问提升系数（访问次数对置信度的提升）
const ACCESS_BOOST = {
  base: 0.05,            // 基础提升
  logFactor: 0.02,       // 对数因子
  maxBoost: 0.3,          // 最大提升
};

// 矛盾关键词对
const CONTRADICTION_PAIRS = [
  ['用', '不用', ['使用', '不使用']],
  ['选择', '放弃', ['选择', '不选择']],
  ['喜欢', '不喜欢', ['喜欢', '讨厌']],
  ['要', '不要', ['需要', '不需要']],
  ['必须', '不能', ['必须', '禁止']],
  ['启用', '禁用', ['开启', '关闭']],
  ['允许', '拒绝', ['允许', '禁止']],
  ['支持', '反对', ['支持', '不支持']],
  ['推荐', '不推荐', ['推荐', '不建议']],
];

// 计算衰减后的置信度
function calculateDecayedConfidence(meta, baseConfidence) {
  if (!meta || !meta.updatedAt) return baseConfidence;

  const daysSinceUpdate = daysBetween(meta.updatedAt, new Date());
  const kind = meta.kind || 'fact';

  const decayRate = DECAY_RATES[kind] || 0.001;
  const decayFactor = Math.exp(-decayRate * daysSinceUpdate);

  const decayed = baseConfidence * decayFactor;

  // 置信度不低于最小值
  const minConfidence = kind === 'decision' || kind === 'constraint' ? 0.7 : 0.5;
  return Math.max(minConfidence, decayed);
}

// 计算访问提升后的置信度
function calculateAccessBoostedConfidence(meta, accessCount) {
  if (!meta) {
    const boost = Math.min(ACCESS_BOOST.maxBoost, ACCESS_BOOST.base + Math.log(accessCount + 1) * ACCESS_BOOST.logFactor);
    return Math.min(0.99, 0.8 + boost);
  }

  const decayed = calculateDecayedConfidence(meta, meta.confidence || 0.8);
  const boost = Math.min(ACCESS_BOOST.maxBoost, ACCESS_BOOST.base + Math.log(accessCount + 1) * ACCESS_BOOST.logFactor);

  const boosted = Math.min(0.99, decayed + boost);

  return boosted;
}

// 检测矛盾
function isContradictory(text1, text2) {
  if (!text1 || !text2) return false;

  const t1 = text1.toLowerCase();
  const t2 = text2.toLowerCase();

  for (const [pos, neg] of CONTRADICTION_PAIRS) {
    const posRegex = new RegExp(pos, 'i');
    const negRegex = new RegExp(neg, 'i');

    if (posRegex.test(t1) && negRegex.test(t2)) return true;
    if (negRegex.test(t1) && posRegex.test(t2)) return true;
  }

  return false;
}

// 天数差
function daysBetween(date1, date2) {
  const d1 = new Date(date1).getTime();
  const d2 = new Date(date2).getTime();
  return Math.abs(d2 - d1) / 86400_000;
}

// 更新记忆置信度（访问时）
export async function updateMemoryOnAccess(memoryStore, memoryId, log = () => {}) {
  const meta = memoryStore.readMeta(memoryId);
  if (!meta) return null;

  const newAccessCount = (meta.accessCount || 0) + 1;
  const boosted = calculateAccessBoostedConfidence(meta, newAccessCount);

  // 置信度变化超过 0.05 才更新
  if (Math.abs(boosted - (meta.confidence || 0)) > 0.05) {
    try {
      await memoryStore.upsert({
        ...meta,
        accessCount: newAccessCount,
        lastAccessedAt: new Date().toISOString(),
        confidence: boosted,
      });

      log(`[quality] 更新置信度: ${meta.subject} ${(meta.confidence || 0).toFixed(2)} → ${boosted.toFixed(2)} (访问 ${newAccessCount} 次)`);

      return { updated: true, oldConfidence: meta.confidence || 0, newConfidence: boosted };
    } catch (e) {
      log(`[quality] 更新失败: ${e.message}`);
      return { updated: false, error: e.message };
    }
  }

  return { updated: false, reason: 'confidence 变化不足' };
}

// 批量更新置信度（定时任务）
export async function batchUpdateConfidence(memoryStore, { dryRun = false, log = () => {} } = {}) {
  log('[quality] 批量更新置信度...');

  const result = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  const allMemories = await memoryStore.query({ includeSuperseded: false });

  for (const memory of allMemories.items) {
    result.scanned++;

    try {
      const current = memory.confidence || 0.8;
      const accessCount = memory.accessCount || 0;
      const decayed = calculateDecayedConfidence(memory, current);
      const boosted = calculateAccessBoostedConfidence(memory, accessCount);

      // 变化超过阈值才更新
      if (Math.abs(boosted - current) > 0.05) {
        if (dryRun) {
          log(`[quality] [DRY-RUN] 将更新: ${memory.subject} ${current.toFixed(2)} → ${boosted.toFixed(2)}`);
          result.updated++;
        } else {
          await memoryStore.upsert({
            ...memory,
            confidence: boosted,
          });

          log(`[quality] ✅ 更新: ${memory.subject} ${current.toFixed(2)} → ${boosted.toFixed(2)}`);
          result.updated++;
        }
      } else {
        result.skipped++;
      }
    } catch (e) {
      log(`[quality] ❌ 失败: ${memory.subject} - ${e.message}`);
      result.errors++;
    }
  }

  log(`[quality] 完成: 扫描=${result.scanned}, 更新=${result.updated}, 跳过=${result.skipped}, 错误=${result.errors}`);

  return result;
}

// 检测矛盾记忆
export async function detectAndResolveContradictions(memoryStore, { log = () => {} } = {}) {
  log('[quality] 检测矛盾记忆...');

  const allMemories = await memoryStore.query({ status: 'active' });
  const groups = {};

  // 按主题分组
  for (const memory of allMemories.items) {
    const key = `${memory.kind}:${memory.subject}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(memory);
  }

  const contradictions = [];
  const resolved = { conflicts: 0, resolved: 0 };

  for (const [key, memories] of Object.entries(groups)) {
    if (memories.length < 2) continue;

    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        if (isContradictory(memories[i].content, memories[j].content)) {
          contradictions.push({
            id1: memories[i].id,
            id2: memories[j].id,
            subject: memories[i].subject,
            kind: memories[i].kind,
            content1: memories[i].content,
            content2: memories[j].content,
            score1: (memories[i].accessCount || 0) * memories[i].confidence,
            score2: (memories[j].accessCount || 0) * memories[j].confidence,
          });
        }
      }
    }
  }

  resolved.conflicts = contradictions.length;

  if (contradictions.length > 0) {
    log(`[quality] 发现 ${contradictions.length} 组矛盾，开始解决...`);

    for (const conflict of contradictions) {
      try {
        // 选择分数高的
        const winnerId = conflict.score1 >= conflict.score2 ? conflict.id1 : conflict.id2;
        const loserId = conflict.score1 >= conflict.score2 ? conflict.id2 : conflict.id1;

        // 撤销输家
        await memoryStore.revoke({
          id: loserId,
          reason: `与 [${winnerId}] 矛盾`,
        });

        // 更新赢家的 supersedes
        const winner = memoryStore.readMeta(winnerId);
        if (winner) {
          await memoryStore.upsert({
            ...winner,
            supersedes: [
              ...(winner.supersedes || []),
              loserId,
            ],
          });
        }

        log(`[quality] ✅ 解决矛盾: ${loserId} → ${winnerId}`);
        resolved.resolved++;
      } catch (e) {
        log(`[quality] ❌ 解决矛盾失败: ${e.message}`);
      }
    }
  } else {
    log('[quality] 未发现矛盾记忆');
  }

  return { contradictions, resolved };
}

// 生成质量报告
export async function generateQualityReport(memoryStore, { log = () => {} } = {}) {
  const stats = await memoryStore.stats();
  const allMemories = await memoryStore.query({ includeSuperseded: false });

  // 置信度分布
  const confidenceBuckets = {
    high: 0,    // >= 0.8
    medium: 0,  // 0.6 - 0.8
    low: 0,     // < 0.6
  };

  // 访问次数分布
  const accessBuckets = {
    never: 0,   // 0 次
    low: 0,     // 1-3 次
    medium: 0,  // 4-10 次
    high: 0,    // > 10 次
  };

  // 衰减分布
  const decayBuckets = {
    fresh: 0,   // 衰减 < 10%
    mild: 0,    // 衰减 10-30%
    moderate: 0,// 衰减 30-50%
    severe: 0,  // 衰迁 > 50%
  };

  for (const memory of allMemories.items) {
    const conf = memory.confidence || 0.8;
    const access = memory.accessCount || 0;
    const decayed = calculateDecayedConfidence(memory, conf);
    const decayRatio = 1 - (decayed / conf);

    if (conf >= 0.8) confidenceBuckets.high++;
    else if (conf >= 0.6) confidenceBuckets.medium++;
    else confidenceBuckets.low++;

    if (access === 0) accessBuckets.never++;
    else if (access <= 3) accessBuckets.low++;
    else if (access <= 10) accessBuckets.medium++;
    else accessBuckets.high++;

    if (decayRatio < 0.1) decayBuckets.fresh++;
    else if (decayRatio < 0.3) decayBuckets.mild++;
    else if (decayRatio < 0.5) decayBuckets.moderate++;
    else decayBuckets.severe++;
  }

  return {
    timestamp: new Date().toISOString(),
    summary: stats,
    confidence: confidenceBuckets,
    access: accessBuckets,
    decay: decayBuckets,
    recommendations: generateQualityRecommendations(confidenceBuckets, accessBuckets, decayBuckets),
  };
}

function generateQualityRecommendations(confidence, access, decay) {
  const recommendations = [];

  // 低置信度记忆过多
  const total = confidence.high + confidence.medium + confidence.low;
  if (total > 0 && confidence.low / total > 0.2) {
    recommendations.push({
      type: 'warning',
      message: `${confidence.low} 条记忆置信度 < 0.6，建议审查或删除`,
    });
  }

  // 从未访问的记忆过多
  if (access.never > 20) {
    recommendations.push({
      type: 'warning',
      message: `${access.never} 条记忆从未被访问，建议清理或归档`,
    });
  }

  // 严重衰减的记忆
  if (decay.severe > 10) {
    recommendations.push({
      type: 'info',
      message: `${decay.severe} 条记忆置信度衰减 > 50%，建议更新或删除`,
    });
  }

  return recommendations;
}

// 导出工厂函数
export function createMemoryQuality({ memoryStore, log = () => {} } = {}) {
  // 更新单个记忆
  async function updateOnAccess(memoryId) {
    return updateMemoryOnAccess(memoryStore, memoryId, log);
  }

  // 批量更新
  async function batchUpdate(opts) {
    return batchUpdateConfidence(memoryStore, { ...opts, log });
  }

  // 检测矛盾
  async function resolveContradictions() {
    return detectAndResolveContradictions(memoryStore, { log });
  }

  // 生成报告
  async function report() {
    return generateQualityReport(memoryStore, { log });
  }

  return {
    updateOnAccess,
    batchUpdate,
    resolveContradictions,
    report,
    calculateDecayedConfidence,
    calculateAccessBoostedConfidence,
  };
}