// ~/pi-discord-agents/src/dreaming/enhancement/self-improvement.mjs
// 梦境自我改进 — 基于投票数据的持续优化

/**
 * DreamSelfImprover: 分析梦境表现，自动生成改进建议
 * 
 * 设计:
 * 1. 收集历史数据（产物、投票、执行记录）
 * 2. 分析类型效果
 * 3. 生成改进建议
 * 4. 可选：自动应用简单改进
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS } from '../paths.mjs';

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  // 分析时间范围（天）
  analysisDays: 30,
  // 评分阈值
  scoreThreshold: 0.5,
  // 星标率阈值
  starRatioThreshold: 0.1,
  // 自动应用简单改进
  autoApply: false,
};

/**
 * 创建 DreamSelfImprover 实例
 */
export function createDreamSelfImprover({
  artifacts,
  votes,
  log = () => {},
  config = {},
}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  /**
   * 加载历史运行记录
   */
  async function loadRunHistory({ days = 30 } = {}) {
    const runs = [];
    const cutoff = new Date(Date.now() - days * 86400_000);

    try {
      const dayDirs = await readdir(PATHS.runsDir);
      
      for (const day of dayDirs) {
        if (day < cutoff.toISOString().slice(0, 10)) continue;
        
        const dayDir = join(PATHS.runsDir, day);
        const files = await readdir(dayDir);
        
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          
          const content = await readFile(join(dayDir, file), 'utf8');
          const run = JSON.parse(content);
          runs.push(run);
        }
      }
    } catch (e) {
      log(`[self-improver] 加载历史失败: ${e.message}`);
    }

    return runs;
  }

  /**
   * 分析类型效果
   */
  async function analyzeTypeEffectiveness({ days = 30 } = {}) {
    const runs = await loadRunHistory({ days });
    const allVotes = votes ? await votes.all() : {};

    const typeStats = {
      lian_zhu: { runs: 0, completed: 0, artifacts: 0, avgScore: 0, starRatio: 0 },
      gui_cang: { runs: 0, completed: 0, artifacts: 0, avgScore: 0, starRatio: 0 },
      ming_tai: { runs: 0, completed: 0, artifacts: 0, avgScore: 0, starRatio: 0 },
      yu_yan: { runs: 0, completed: 0, artifacts: 0, avgScore: 0, starRatio: 0 },
    };

    const scoresByType = {
      lian_zhu: [],
      gui_cang: [],
      ming_tai: [],
      yu_yan: [],
    };

    // 统计运行
    for (const run of runs) {
      const typeKey = run.type.replace('-', '_');
      if (!typeStats[typeKey]) continue;

      typeStats[typeKey].runs++;
      if (run.status === 'completed') {
        typeStats[typeKey].completed++;
      }

      // 统计产物分数
      for (const artifactId of run.artifacts || []) {
        const vote = allVotes[artifactId];
        if (vote) {
          typeStats[typeKey].artifacts++;
          
          const score = (vote.up || 0) + (vote.star || 0) * 2 - (vote.down || 0);
          scoresByType[typeKey].push({
            artifactId,
            score,
            star: vote.star || 0,
          });

          if (vote.star > 0) {
            typeStats[typeKey].starRatio++;
          }
        }
      }
    }

    // 计算平均值
    for (const [type, stats] of Object.entries(typeStats)) {
      const scores = scoresByType[type] || [];
      stats.avgScore = scores.length > 0
        ? scores.reduce((s, x) => s + x.score, 0) / scores.length
        : 0;
      stats.starRatio = stats.artifacts > 0
        ? stats.starRatio / stats.artifacts
        : 0;
      stats.successRate = stats.runs > 0
        ? stats.completed / stats.runs
        : 0;
    }

    return { typeStats, scoresByType };
  }

  /**
   * 生成改进建议
   */
  async function generateSuggestions({ days = 30 } = {}) {
    const { typeStats } = await analyzeTypeEffectiveness({ days });

    const suggestions = [];

    for (const [type, stats] of Object.entries(typeStats)) {
      if (stats.runs === 0) continue;

      // 建议1: 完成率低
      if (stats.successRate < 0.7) {
        suggestions.push({
          category: 'reliability',
          type,
          severity: 'high',
          description: `${type} 完成率偏低 (${(stats.successRate * 100).toFixed(0)}%)`,
          possibleCauses: ['候选不足', 'LLM 调用超时', '错误处理不当'],
          recommendations: [
            '增加 light 阶段的候选数量',
            '检查 LLM 超时配置',
            '改进错误处理和降级逻辑',
          ],
        });
      }

      // 建议2: 评分低
      if (stats.avgScore < 1) {
        suggestions.push({
          category: 'quality',
          type,
          severity: 'medium',
          description: `${type} 平均评分偏低 (${stats.avgScore.toFixed(2)})`,
          possibleCauses: ['prompt 不够具体', '候选质量不高', '与用户兴趣不匹配'],
          recommendations: [
            '细化 prompt 中的风格指导',
            '优化 light 阶段的候选采样策略',
            '考虑用户最近的活跃主题',
          ],
        });
      }

      // 建议3: 星标率低
      if (stats.starRatio < cfg.starRatioThreshold && stats.artifacts >= 5) {
        suggestions.push({
          category: 'engagement',
          type,
          severity: 'medium',
          description: `${type} 星标率偏低 (${(stats.starRatio * 100).toFixed(0)}%)`,
          possibleCauses: ['洞察不够惊艳', '缺乏可操作性', '与用户偏好不符'],
          recommendations: [
            '增加「好梦」机制权重',
            '强调洞察的可执行性',
            '分析高星标洞察的共同特征',
          ],
        });
      }

      // 建议4: 产出少
      if (stats.runs > 3 && stats.artifacts / stats.runs < 1) {
        suggestions.push({
          category: 'volume',
          type,
          severity: 'low',
          description: `${type} 平均产出偏低 (${(stats.artifacts / stats.runs).toFixed(1)} 条/次)`,
          possibleCauses: ['候选不足', '过滤过于严格'],
          recommendations: [
            '放宽候选筛选条件',
            '调整分数阈值',
          ],
        });
      }
    }

    return suggestions;
  }

  /**
   * 生成改进报告
   */
  async function generateImprovementReport({ days = 30 } = {}) {
    const { typeStats } = await analyzeTypeEffectiveness({ days });
    const suggestions = await generateSuggestions({ days });

    const report = {
      generatedAt: new Date().toISOString(),
      analysisRange: `${days} 天`,
      summary: {
        totalTypes: Object.keys(typeStats).filter(t => typeStats[t].runs > 0).length,
        totalRuns: Object.values(typeStats).reduce((s, t) => s + t.runs, 0),
        totalArtifacts: Object.values(typeStats).reduce((s, t) => s + t.artifacts, 0),
        avgOverallScore: Object.values(typeStats).reduce((s, t) => s + t.avgScore * t.artifacts, 0) /
          Math.max(1, Object.values(typeStats).reduce((s, t) => s + t.artifacts, 0)),
      },
      typeStats,
      suggestions: {
        high: suggestions.filter(s => s.severity === 'high'),
        medium: suggestions.filter(s => s.severity === 'medium'),
        low: suggestions.filter(s => s.severity === 'low'),
      },
      actionItems: suggestions.map(s => s.recommendations).flat(),
    };

    return report;
  }

  /**
   * 执行自我改进（仅建议，不自动修改）
   */
  async function runSelfImprovement({ days = 30, apply = false } = {}) {
    const report = await generateImprovementReport({ days });

    log(`[self-improver] 分析完成:`);
    log(`  - 分析范围: ${report.analysisRange}`);
    log(`  - 总运行次数: ${report.summary.totalRuns}`);
    log(`  - 总产物数: ${report.summary.totalArtifacts}`);
    log(`  - 高优先级建议: ${report.suggestions.high.length}`);
    log(`  - 中优先级建议: ${report.suggestions.medium.length}`);

    // 如果需要应用改进（仅简单改进）
    if (apply && cfg.autoApply) {
      for (const suggestion of report.suggestions.high) {
        if (suggestion.category === 'reliability' && suggestion.recommendations.includes('增加候选数量')) {
          log(`[self-improver] 应用: 增加 ${suggestion.type} 的候选数量`);
          // 这里可以写配置文件或环境变量
        }
      }
    }

    return report;
  }

  return {
    analyzeTypeEffectiveness,
    generateSuggestions,
    generateImprovementReport,
    runSelfImprovement,
    loadRunHistory,
  };
}
