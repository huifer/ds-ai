// ~/pi-discord-agents/src/workflow/summary-engine.mjs
// 对话摘要引擎

/**
 * 摘要触发条件
 */
const SUMMARY_TRIGGERS = {
  // 每隔多少轮触发
  INTERVAL: 10,
  
  // 关键词触发
  KEYWORDS: [
    '总结', '汇总', '小结', '整理一下',
    '完成了', '可以了', '好了', '搞定',
    '就这样', '结束',
  ],
  
  // 命令触发
  COMMANDS: ['!summary', '/summary', '生成摘要'],
};

/**
 * 摘要生成器
 */
export class SummaryEngine {
  constructor({ log = () => {} } = {}) {
    this.log = log;
  }

  /**
   * 判断是否应该生成摘要
   * @param {object} context - { turnCount, lastSummaryTurn, message }
   * @returns {object} { should: boolean, reason: string }
   */
  shouldSummarize(context) {
    const { turnCount, lastSummaryTurn = 0, message = '' } = context;

    // 1. 命令触发
    const lowerMessage = message.toLowerCase();
    for (const cmd of SUMMARY_TRIGGERS.COMMANDS) {
      if (lowerMessage.includes(cmd.toLowerCase())) {
        return { should: true, reason: '命令触发' };
      }
    }

    // 2. 关键词触发
    for (const keyword of SUMMARY_TRIGGERS.KEYWORDS) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return { should: true, reason: `关键词: ${keyword}` };
      }
    }

    // 3. 轮数触发
    const turnsSinceLastSummary = turnCount - lastSummaryTurn;
    if (turnsSinceLastSummary >= SUMMARY_TRIGGERS.INTERVAL) {
      return { should: true, reason: `对话 ${turnsSinceLastSummary} 轮` };
    }

    return { should: false };
  }

  /**
   * 生成对话摘要
   * @param {Array} turns - 对话轮次 [{ role: 'user'|'assistant', content, timestamp }]
   * @param {object} options - { maxLength, includeContext }
   * @returns {object} 摘要结果
   */
  async generateSummary(turns, options = {}) {
    const {
      maxLength = 500,
      includeContext = true,
    } = options;

    if (!turns || turns.length === 0) {
      return {
        summary: '（无对话内容）',
        keyPoints: [],
        decisions: [],
        pending: [],
        nextAction: '',
        turns: { start: 0, end: 0, count: 0 },
      };
    }

    // 提取关键信息
    const userMessages = turns.filter(t => t.role === 'user').map(t => t.content);
    const assistantMessages = turns.filter(t => t.role === 'assistant').map(t => t.content);

    // 生成摘要文本
    const summary = this.generateSummaryText(userMessages, assistantMessages);

    // 提取关键点
    const keyPoints = this.extractKeyPoints(turns);

    // 提取决策
    const decisions = this.extractDecisions(turns);

    // 提取待确认事项
    const pending = this.extractPending(turns);

    // 建议下一步
    const nextAction = this.suggestNextAction(turns);

    return {
      summary,
      keyPoints,
      decisions,
      pending,
      nextAction,
      turns: {
        start: turns[0]?.index ?? 1,
        end: turns[turns.length - 1]?.index ?? turns.length,
        count: turns.length,
      },
    };
  }

  /**
   * 生成摘要文本
   */
  generateSummaryText(userMessages, assistantMessages) {
    const maxLen = 500;
    
    // 取第一条和最后一条用户消息作为核心
    const first = userMessages[0] || '';
    const last = userMessages[userMessages.length - 1] || '';

    // 如果第一条和最后一条相似，说明对话主题单一
    if (this.isSimilar(first, last, 0.6)) {
      return first.slice(0, maxLen);
    }

    // 否则综合描述
    const combined = `主题：${first.slice(0, 100)}${last !== first ? `\n最新：${last.slice(0, 100)}` : ''}`;
    return combined.slice(0, maxLen);
  }

  /**
   * 提取关键点
   */
  extractKeyPoints(turns) {
    const keyPoints = [];
    const seen = new Set();

    // 从用户消息中提取关键信息
    for (const turn of turns || []) {
      if (turn.role !== 'user') continue;
      
      const content = turn.content || '';
      
      // 提取需求
      const needMatches = content.match(/需要(.+)/g);
      if (needMatches) {
        for (const m of needMatches) {
          const point = m.replace('需要', '').trim();
          if (!seen.has(point) && point.length > 2) {
            keyPoints.push(point);
            seen.add(point);
          }
        }
      }

      // 提取约束
      const constraintMatches = content.match(/(?:不能|不许|不要|禁止)(.+)/g);
      if (constraintMatches) {
        for (const m of constraintMatches) {
          const point = '禁止：' + m.replace(/(?:不能|不许|不要|禁止)/, '').trim();
          if (!seen.has(point) && point.length > 3) {
            keyPoints.push(point);
            seen.add(point);
          }
        }
      }
    }

    return keyPoints.slice(0, 5);
  }

  /**
   * 提取决策
   */
  extractDecisions(turns) {
    const decisions = [];
    const seen = new Set();

    for (const turn of turns || []) {
      if (turn.role !== 'assistant') continue;
      
      const content = turn.content || '';
      
      // 提取确认的决策
      const confirmMatches = content.match(/决定用|选择|确认|已选(.+)/g);
      if (confirmMatches) {
        for (const m of confirmMatches) {
          const decision = m.replace(/决定用|选择|确认|已选/, '').trim();
          if (!seen.has(decision) && decision.length > 1) {
            decisions.push(decision);
            seen.add(decision);
          }
        }
      }
    }

    return decisions.slice(0, 3);
  }

  /**
   * 提取待确认事项
   */
  extractPending(turns) {
    const pending = [];
    const safeTurns = turns || [];

    // 从最后几条消息中提取待确认事项
    const recentTurns = safeTurns.slice(-3);
    for (const turn of recentTurns) {
      const content = turn.content || '';
      
      // 问号结尾的句子可能是待确认
      const questions = content.match(/[^.!?]*[?？][^.!?]*/g);
      if (questions) {
        for (const q of questions) {
          if (q.trim().length > 3) {
            pending.push(q.trim());
          }
        }
      }
    }

    return [...new Set(pending)].slice(0, 3);
  }

  /**
   * 建议下一步
   */
  suggestNextAction(turns) {
    const lastTurn = turns[turns.length - 1];
    if (!lastTurn) return '';

    const content = lastTurn.content;

    // 根据最后一条消息推断下一步
    if (content.includes('完成') || content.includes('好了')) {
      return '等待用户确认或开始下一步';
    }

    if (content.includes('?') || content.includes('？')) {
      return '等待用户回复';
    }

    if (content.includes('代码') || content.includes('生成')) {
      return '代码生成完成，等待测试或部署';
    }

    return '继续执行或等待用户指示';
  }

  /**
   * 检查两个文本是否相似
   */
  isSimilar(text1, text2, threshold = 0.6) {
    if (!text1 || !text2) return false;
    
    // 简单相似度：共享字符比例
    const set1 = new Set(text1.toLowerCase());
    const set2 = new Set(text2.toLowerCase());
    
    const intersection = [...set1].filter(c => set2.has(c)).length;
    const union = new Set([...set1, ...set2]).size;
    
    return intersection / union >= threshold;
  }

  /**
   * 生成摘要卡片（用于 Discord）
   */
  generateSummaryCard(summary) {
    const timestamp = new Date().toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    let card = `## 📋 对话摘要\n\n`;
    card += `**时间**: ${timestamp}\n\n`;
    card += `### 📝 ${summary.summary}\n\n`;

    if (summary.keyPoints?.length > 0) {
      card += `### 🎯 关键点\n`;
      for (const point of summary.keyPoints) {
        card += `- ${point}\n`;
      }
      card += '\n';
    }

    if (summary.decisions?.length > 0) {
      card += `### ✅ 已确认\n`;
      for (const decision of summary.decisions) {
        card += `- ${decision}\n`;
      }
      card += '\n';
    }

    if (summary.pending?.length > 0) {
      card += `### ❓ 待确认\n`;
      for (const item of summary.pending) {
        card += `- ${item}\n`;
      }
      card += '\n';
    }

    if (summary.nextAction) {
      card += `### ➡️ 下一步\n`;
      card += `${summary.nextAction}\n`;
    }

    return card;
  }
}
