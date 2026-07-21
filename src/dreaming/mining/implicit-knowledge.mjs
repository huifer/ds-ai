// ~/pi-discord-agents/src/dreaming/mining/implicit-knowledge.mjs
// 隐式知识挖掘 — 从对话中提取未明说的偏好、决策依据、成功模式

/**
 * ImplicitKnowledgeMiner: 挖掘对话中的隐式知识
 * 
 * 设计目标:
 * 1. 从"其实我更喜欢..."中提取显式偏好
 * 2. 从拒绝/接受模式推断隐性偏好
 * 3. 从决策讨论中提取决策依据
 * 4. 从成功/失败中提取模式
 */

import { computePolarity } from '../enhancement/nightmare-mitigation.mjs';

/**
 * 偏好模式
 */
const PREFERENCE_PATTERNS = [
  // 显式偏好
  { pattern: /其实我更(喜欢|倾向于|想|希望|愿意)/g, type: 'explicit-positive' },
  { pattern: /其实不太(喜欢|想|愿意|想)/g, type: 'explicit-negative' },
  { pattern: /(算了|不|别).*(算了|不|别)/g, type: 'rejection' },
  // 隐式偏好
  { pattern: /总是.*拒绝/g, type: 'pattern-rejection' },
  { pattern: /每次都.*选/g, type: 'pattern-selection' },
];

/**
 * 决策依据模式
 */
const DECISION_PATTERNS = [
  { pattern: /因为(.+?),所以决定/g, type: 'cause-effect' },
  { pattern: /考虑到(.+?),决定/g, type: 'consideration' },
  { pattern: /基于(.+?),选/g, type: 'basis' },
  { pattern: /(主要|关键|核心)是(.+?)，所以/g, type: 'key-factor' },
];

/**
 * 成功模式
 */
const SUCCESS_PATTERNS = [
  { pattern: /(搞定了|完成了|成功了|搞定了)/g, type: 'success' },
  { pattern: /完美|漂亮|太棒了/g, type: 'praise' },
  { pattern: /原来如此|恍然大悟/g, type: 'insight' },
];

/**
 * 痛点模式
 */
const PAIN_PATTERNS = [
  { pattern: /(卡在|卡在|卡壳)/g, type: 'stuck' },
  { pattern: /(搞不定|解决不了)/g, type: 'blocker' },
  { pattern: /(崩溃|绝望)/g, type: 'frustration' },
  { pattern: /(担心|焦虑).*会/g, type: 'worry' },
];

/**
 * 从文本中提取偏好
 */
function extractPreferences(text) {
  const results = [];

  for (const { pattern, type } of PREFERENCE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        results.push({
          type: 'preference',
          subType: type,
          text: match,
          context: extractContext(text, match, 50),
          confidence: type.startsWith('explicit') ? 0.9 : 0.6,
        });
      }
    }
  }

  return results;
}

/**
 * 从文本中提取决策依据
 */
function extractDecisionRationale(text) {
  const results = [];

  for (const { pattern, type } of DECISION_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      results.push({
        type: 'decision-rationale',
        subType: type,
        factor: match[1] || match[0],
        decision: extractDecisionFromContext(text, match.index),
        context: extractContext(text, match[0], 80),
        confidence: 0.75,
      });
    }
  }

  return results;
}

/**
 * 从文本中提取成功模式
 */
function extractSuccessPatterns(text) {
  const results = [];

  for (const { pattern, type } of SUCCESS_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      results.push({
        type: 'success-pattern',
        subType: type,
        signals: matches,
        context: extractContext(text, matches[0], 100),
        confidence: 0.7,
      });
    }
  }

  return results;
}

/**
 * 从文本中提取痛点
 */
function extractPainPoints(text) {
  const results = [];

  for (const { pattern, type } of PAIN_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      results.push({
        type: 'pain-point',
        subType: type,
        signal: match[0],
        context: extractContext(text, match[0], 100),
        severity: detectSeverity(match[0]),
        confidence: 0.8,
      });
    }
  }

  return results;
}

/**
 * 提取上下文
 */
function extractContext(text, match, radius) {
  const idx = text.indexOf(match);
  if (idx < 0) return '';

  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + match.length + radius);

  let context = text.slice(start, end);
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context.replace(/\n/g, ' ').trim();
}

/**
 * 从上下文推断决策
 */
function extractDecisionFromContext(text, decisionIdx) {
  // 在决策词附近查找决策内容
  const decisionWords = ['决定', '选了', '采用', '用', '做', '选'];
  const searchRange = 200;

  const searchStart = Math.max(0, decisionIdx - searchRange);
  const searchEnd = Math.min(text.length, decisionIdx + searchRange);
  const searchText = text.slice(searchStart, searchEnd);

  for (const word of decisionWords) {
    const idx = searchText.indexOf(word);
    if (idx >= 0) {
      // 提取决策后的内容
      const after = searchText.slice(idx).match(/[选了采用用做](.+?)[，。,.!?]/);
      if (after) return after[1].trim();
    }
  }

  return '（无法确定）';
}

/**
 * 检测严重程度
 */
function detectSeverity(signal) {
  const highSeverity = ['崩溃', '绝望', '搞不定'];
  const mediumSeverity = ['卡在', '担心'];

  if (highSeverity.some(s => signal.includes(s))) return 'high';
  if (mediumSeverity.some(s => signal.includes(s))) return 'medium';
  return 'low';
}

/**
 * 聚类相似知识
 */
function clusterKnowledge(knowledge) {
  const clusters = {};

  for (const item of knowledge) {
    // 用类型和子类型作为聚类键
    const key = `${item.type}:${item.subType}`;

    if (!clusters[key]) {
      clusters[key] = [];
    }

    clusters[key].push(item);
  }

  // 合并同类
  const merged = [];
  for (const [key, items] of Object.entries(clusters)) {
    if (items.length === 1) {
      merged.push(items[0]);
    } else {
      merged.push({
        ...items[0],
        count: items.length,
        combinedContexts: items.map(i => i.context).join('\n---\n'),
      });
    }
  }

  return merged;
}

/**
 * 创建 ImplicitKnowledgeMiner 实例
 */
export function createImplicitKnowledgeMiner({
  log = () => {},
}) {
  return {
    /**
     * 从文本中提取所有隐式知识
     */
    extractFromText(text) {
      const knowledge = [];

      knowledge.push(...extractPreferences(text));
      knowledge.push(...extractDecisionRationale(text));
      knowledge.push(...extractSuccessPatterns(text));
      knowledge.push(...extractPainPoints(text));

      return knowledge;
    },

    /**
     * 从对话历史中提取
     */
    async extractFromJournal(journal, { days = 7 } = {}) {
      const allKnowledge = [];

      // 获取每日对话
      for (let i = 0; i < days; i++) {
        const date = new Date(Date.now() - i * 86400_000);
        const dateStr = date.toISOString().slice(0, 10);

        try {
          const events = journal.readDay(dateStr);
          const text = events
            .filter(e => e.type === 'user_message' || e.type === 'assistant_message')
            .map(e => e.content || '')
            .join('\n');

          const knowledge = this.extractFromText(text);
          allKnowledge.push(...knowledge.map(k => ({ ...k, date: dateStr })));
        } catch (e) {
          // 日期无数据，跳过
        }
      }

      return allKnowledge;
    },

    /**
     * 聚类知识
     */
    cluster(knowledge) {
      return clusterKnowledge(knowledge);
    },

    /**
     * 生成知识报告
     */
    generateReport(knowledge) {
      const clustered = this.cluster(knowledge);

      const report = {
        generatedAt: new Date().toISOString(),
        totalItems: clustered.length,
        byType: {},
        insights: [],
      };

      for (const item of clustered) {
        if (!report.byType[item.type]) {
          report.byType[item.type] = { count: 0, items: [] };
        }
        report.byType[item.type].count++;
        report.byType[item.type].items.push(item);
      }

      // 生成洞察
      for (const [type, data] of Object.entries(report.byType)) {
        if (type === 'preference') {
          const explicit = data.items.filter(i => i.subType.startsWith('explicit'));
          const implicit = data.items.filter(i => !i.subType.startsWith('explicit'));

          if (explicit.length > 0) {
            report.insights.push({
              type: 'preference',
              text: `显式偏好: ${explicit.map(i => i.text).join(', ')}`,
              confidence: 0.9,
            });
          }

          if (implicit.length > 2) {
            report.insights.push({
              type: 'pattern',
              text: `检测到隐式偏好模式 (${implicit.length} 次出现)`,
              confidence: 0.6,
            });
          }
        }

        if (type === 'pain-point') {
          const highSeverity = data.items.filter(i => i.severity === 'high');
          if (highSeverity.length > 0) {
            report.insights.push({
              type: 'alert',
              text: `高严重度痛点: ${highSeverity.map(i => i.signal).join(', ')}`,
              confidence: 0.8,
            });
          }
        }
      }

      return report;
    },
  };
}
