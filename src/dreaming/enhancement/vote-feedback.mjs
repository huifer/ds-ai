// ~/pi-discord-agents/src/dreaming/enhancement/vote-feedback.mjs
// 投票反馈循环 — 将用户投票转化为洞察质量的信号

/**
 * VoteFeedback: 分析投票数据，生成反馈信号
 * 
 * 设计:
 * 1. 统计每个产物的投票情况
 * 2. 按类型聚合分析
 * 3. 生成反馈信号供梦境系统使用
 */

import { createArtifacts } from '../artifacts.mjs';

/**
 * 投票权重
 */
const VOTE_WEIGHTS = {
  up: 1,
  down: -1,
  star: 3,  // star 加权更高
};

/**
 * 创建 VoteFeedback 实例
 * 
 * @param {Object} opts
 * @param {Object} opts.votes - votes 实例
 * @param {Object} opts.artifacts - artifacts 实例（可选）
 * @param {Function} opts.log - 日志函数
 */
export function createVoteFeedback({
  votes,
  artifacts = null,
  log = () => {},
}) {
  /**
   * 计算单个产物的投票得分
   */
  function computeArtifactScore(vote) {
    let score = 0;
    for (const [type, weight] of Object.entries(VOTE_WEIGHTS)) {
      score += (vote[type] || 0) * weight;
    }
    return score;
  }

  /**
   * 获取所有投票数据
   */
  async function getAllVotes() {
    return await votes.all();
  }

  /**
   * 分析投票数据
   */
  async function analyzeVotes({ days = 30 } = {}) {
    const allVotes = await getAllVotes();
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString();

    const stats = {
      totalArtifacts: 0,
      votedArtifacts: 0,
      totalVotes: 0,
      positiveVotes: 0,
      negativeVotes: 0,
      starredArtifacts: 0,
      byType: {},
      topArtifacts: [],
      bottomArtifacts: [],
    };

    const artifactScores = [];

    for (const [artifactId, vote] of Object.entries(allVotes)) {
      // 获取产物元数据
      let artifactMeta = null;
      if (artifacts) {
        try {
          artifactMeta = await artifacts.getMeta(artifactId);
        } catch {}
      }

      // 过滤时间范围
      if (artifactMeta?.createdAt && artifactMeta.createdAt < cutoff) {
        continue;
      }

      stats.totalArtifacts++;
      const score = computeArtifactScore(vote);
      const totalVotes = (vote.up || 0) + (vote.down || 0) + (vote.star || 0);

      if (totalVotes > 0) {
        stats.votedArtifacts++;
        stats.totalVotes += totalVotes;
        stats.positiveVotes += vote.up || 0;
        stats.negativeVotes += vote.down || 0;

        if (vote.star > 0) {
          stats.staredArtifacts++;
        }

        artifactScores.push({
          artifactId,
          score,
          ...vote,
          type: artifactMeta?.type || 'unknown',
          theme: artifactMeta?.theme || null,
          createdAt: artifactMeta?.createdAt || null,
        });

        // 按类型统计
        const type = artifactMeta?.type || 'unknown';
        if (!stats.byType[type]) {
          stats.byType[type] = {
            count: 0,
            voted: 0,
            score: 0,
            stars: 0,
            up: 0,
            down: 0,
          };
        }
        stats.byType[type].count++;
        stats.byType[type].voted++;
        stats.byType[type].score += score;
        stats.byType[type].stars += vote.star || 0;
        stats.byType[type].up += vote.up || 0;
        stats.byType[type].down += vote.down || 0;
      }
    }

    // 计算每个类型的平均分
    for (const [type, data] of Object.entries(stats.byType)) {
      data.avgScore = data.voted > 0 ? data.score / data.voted : 0;
      data.starRatio = data.count > 0 ? data.stars / data.count : 0;
      data.positiveRatio = data.voted > 0 ? data.up / data.voted : 0;
    }

    // 排序 top/bottom
    artifactScores.sort((a, b) => b.score - a.score);
    stats.topArtifacts = artifactScores.slice(0, 5);
    stats.bottomArtifacts = artifactScores.slice(-5).reverse();

    // 汇总统计
    stats.avgScore = stats.votedArtifacts > 0
      ? artifactScores.reduce((s, a) => s + a.score, 0) / stats.votedArtifacts
      : 0;
    stats.voteRate = stats.totalArtifacts > 0
      ? stats.votedArtifacts / stats.totalArtifacts
      : 0;

    return stats;
  }

  /**
   * 生成反馈信号（供梦境系统使用）
   */
  async function generateFeedbackSignals({ days = 30 } = {}) {
    const stats = await analyzeVotes({ days });

    const signals = {
      // 总体信号
      overall: {
        healthScore: stats.avgScore > 2 ? 'good' : stats.avgScore > 0 ? 'neutral' : 'poor',
        avgScore: stats.avgScore,
        voteRate: stats.voteRate,
      },

      // 类型反馈
      typeFeedback: {},

      // Top 洞察
      topInsights: stats.topArtifacts.map(a => ({
        artifactId: a.artifactId,
        theme: a.theme,
        score: a.score,
        stars: a.star,
      })),

      // 建议
      suggestions: [],
    };

    // 为每个类型生成反馈
    for (const [type, data] of Object.entries(stats.byType)) {
      const feedback = {
        score: data.avgScore,
        starRatio: data.starRatio,
        positiveRatio: data.positiveRatio,
        recommendations: [],
      };

      if (data.avgScore < 0) {
        feedback.recommendations.push({
          type: 'improve',
          message: `${type} 类型评分偏低，建议改进 prompt`,
          priority: 'high',
        });
      }

      if (data.starRatio > 0.2) {
        feedback.recommendations.push({
          type: 'increase',
          message: `${type} 类型星标率高，考虑增加调度频率`,
          priority: 'medium',
        });
      }

      if (data.starRatio < 0.05 && data.count >= 5) {
        feedback.recommendations.push({
          type: 'decrease',
          message: `${type} 类型星标率低，考虑减少调度频率`,
          priority: 'medium',
        });
      }

      signals.typeFeedback[type] = feedback;
    }

    // 总体建议
    if (stats.voteRate < 0.1) {
      signals.suggestions.push({
        type: 'engagement',
        message: '投票率偏低，考虑在 Discord 中更明显地展示产物',
        priority: 'medium',
      });
    }

    if (stats.avgScore < 1) {
      signals.suggestions.push({
        type: 'quality',
        message: '整体评分偏低，考虑启用好梦机制减少负面产出',
        priority: 'high',
      });
    }

    return signals;
  }

  /**
   * 获取特定类型的反馈
   */
  async function getTypeFeedback(type) {
    const stats = await analyzeVotes();
    return stats.byType[type] || null;
  }

  /**
   * 检查是否有新的高价值洞察
   */
  async function checkNewValuableInsights({ minScore = 3, minStars = 1 } = {}) {
    const stats = await analyzeVotes({ days: 7 });

    return stats.topArtifacts.filter(a =>
      a.score >= minScore || a.star >= minStars
    );
  }

  return {
    analyzeVotes,
    generateFeedbackSignals,
    getTypeFeedback,
    checkNewValuableInsights,
    getAllVotes,
  };
}
