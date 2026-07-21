// ~/pi-discord-agents/src/dreaming/enhancement/nightmare-mitigation.mjs
// 噩梦检测与干预 — 防止负面联想放大焦虑

/**
 * 噩梦信号关键词
 */
const NIGHTMARE_KEYWORDS = [
  '担心', '焦虑', '害怕', '失败', '来不及', '崩溃',
  '扛不住', '绝望', '无望', '无解', '完蛋', '死定了',
  '不行', '不可能', '没办法', '毫无', '彻底失败',
];

/**
 * 负面模式（正则）
 */
const NIGHTMARE_PATTERNS = [
  /(不|没).*(不|没).*(不|没)/,  // 双重否定/连续否定
  /总是.*失败/,                     // 泛化失败
  /永远.*不会/,                     // 泛化消极
  /所有.*都.*问题/,                 // 全局化问题
  /根本.*解决/,                     // 无望感
  /必然.*失败/,                     // 宿命论
];

/**
 * 好梦信号关键词
 */
const GOOD_DREAM_KEYWORDS = [
  '连接', '创意', '如果', '可以', '也许', '说不定',
  '有趣', '有意思', '启发', '行动', '下一步', '机会',
  '优势', '成功', '搞定', '突破', '创新', '启发',
  '原来如此', '恍然大悟', '竟然', '居然',
];

/**
 * 检测文本中的噩梦信号
 */
function detectNightmareSignals(text) {
  let keywordCount = 0;
  let patternCount = 0;

  // 关键词计数
  for (const kw of NIGHTMARE_KEYWORDS) {
    const matches = text.match(new RegExp(kw, 'g'));
    if (matches) keywordCount += matches.length;
  }

  // 模式检测
  for (const pattern of NIGHTMARE_PATTERNS) {
    if (pattern.test(text)) patternCount++;
  }

  return {
    keywordCount,
    patternCount,
    totalScore: keywordCount + patternCount * 2,  // 模式命中权重更高
    hasNightmare: keywordCount >= 2 || patternCount >= 1,
  };
}

/**
 * 检测文本中的好梦信号
 */
function detectGoodDreamSignals(text) {
  let keywordCount = 0;

  for (const kw of GOOD_DREAM_KEYWORDS) {
    const matches = text.match(new RegExp(kw, 'g'));
    if (matches) keywordCount += matches.length;
  }

  return {
    keywordCount,
    hasGoodDream: keywordCount >= 1,
  };
}

/**
 * 计算洞察极性分数 (-1 到 1)
 */
export function computePolarity(text) {
  const nightmare = detectNightmareSignals(text);
  const goodDream = detectGoodDreamSignals(text);

  const total = nightmare.keywordCount + goodDream.keywordCount + 1;
  const polarity = (goodDream.keywordCount - nightmare.keywordCount) / total;

  return {
    polarity: Math.max(-1, Math.min(1, polarity)),
    nightmareSignals: nightmare,
    goodDreamSignals: goodDream,
  };
}

/**
 * 构建噩梦干预 prompt
 */
export function buildNightmareInterventionPrompt(originalText, context) {
  return `这段洞察偏向负面和焦虑：

---
${originalText}
---

请重新思考，聚焦于：

1. **这个机会的另一面是什么？** — 每个问题都藏着机会
2. **过去有没有类似情况后来变好的？** — 老张的记忆里有答案
3. **如果乐观一点，会怎样？** — 「如果当初选了X」而不是「如果失败了就糟了」

请生成 1-2 条替代洞察，每条要求：
- 包含至少一个积极元素
- 有一个具体的下一步行动
- 避免上述噩梦关键词和模式

输出 JSON 格式：
\`\`\`json
[
  {
    "text": "替代洞察内容...",
    "citedMemories": ["mem_xxx"],
    "selfCoherence": 0.7,
    "selfUtility": 0.6,
    "positivity": 0.7
  }
]
\`\`\`
`;
}

/**
 * 检查是否需要干预
 * @param {Array} artifacts - REM阶段产生的候选洞察
 * @param {number} threshold - 极性阈值，默认 -0.2
 * @returns {Object} 干预结果
 */
export function checkAndMitigate(artifacts, { threshold = -0.2 } = {}) {
  const results = {
    needsIntervention: false,
    mitigated: [],
    passed: [],
    interventionCount: 0,
  };

  for (const artifact of artifacts) {
    const { polarity } = computePolarity(artifact.text || '');

    if (polarity < threshold) {
      results.needsIntervention = true;
      results.mitigated.push({
        original: artifact,
        polarity,
        reason: 'polarity-below-threshold',
      });
      results.interventionCount++;
    } else {
      results.passed.push(artifact);
    }
  }

  return results;
}

/**
 * 批量处理洞察的极性标注
 */
export function annotatePolarity(artifacts) {
  return artifacts.map(artifact => {
    const { polarity, nightmareSignals, goodDreamSignals } = computePolarity(artifact.text || '');
    return {
      ...artifact,
      polarity,
      polarityLabel: polarity > 0.3 ? 'good' : polarity > -0.2 ? 'neutral' : 'nightmare',
      nightmareSignals,
      goodDreamSignals,
    };
  });
}

/**
 * 过滤洞察（只保留正向的）
 * @param {Array} artifacts
 * @param {number} minPolarity 最小极性，默认 0
 * @returns {Array} 过滤后的洞察
 */
export function filterByPolarity(artifacts, { minPolarity = 0 } = {}) {
  return artifacts.filter(artifact => {
    const { polarity } = computePolarity(artifact.text || '');
    return polarity >= minPolarity;
  });
}

/**
 * 创建 NightmareMitigator 实例
 */
export function createNightmareMitigator({
  log = () => {},
  threshold = -0.2,
} = {}) {
  return {
    log,
    threshold,

    /**
     * 检测洞察是否需要干预
     */
    shouldMitigate(artifact) {
      const { polarity } = computePolarity(artifact.text || '');
      return polarity < this.threshold;
    },

    /**
     * 获取干预 prompt
     */
    getInterventionPrompt(originalText, context) {
      return buildNightmareInterventionPrompt(originalText, context);
    },

    /**
     * 批量处理
     */
    process(artifacts) {
      return checkAndMitigate(artifacts, { threshold: this.threshold });
    },

    /**
     * 标注所有洞察的极性
     */
    annotate(artifacts) {
      return annotatePolarity(artifacts);
    },

    /**
     * 过滤洞察
     */
    filter(artifacts, minPolarity = 0) {
      return filterByPolarity(artifacts, { minPolarity });
    },

    /**
     * 获取极性统计
     */
    getStats(artifacts) {
      const annotated = annotatePolarity(artifacts);
      return {
        total: annotated.length,
        good: annotated.filter(a => a.polarityLabel === 'good').length,
        neutral: annotated.filter(a => a.polarityLabel === 'neutral').length,
        nightmare: annotated.filter(a => a.polarityLabel === 'nightmare').length,
        avgPolarity: annotated.reduce((sum, a) => sum + a.polarity, 0) / (annotated.length || 1),
      };
    },
  };
}
