# 记忆蒸馏系统设计

> 蒸馏的核心问题：**从混乱的日常对话中，提取真正值得永久记住的黄金**。

---

## 📋 目录

1. [蒸馏的哲学](#蒸馏的哲学)
2. [价值判断框架](#价值判断框架)
3. [蒸馏流程设计](#蒸馏流程设计)
4. [提取规则引擎](#提取规则引擎)
5. [质量控制机制](#质量控制机制)
6. [边缘情况处理](#边缘情况处理)
7. [效果评估](#效果评估)
8. [实施建议](#实施建议)

---

## 蒸馏的哲学

### 核心问题

> **什么值得永久记住？**

这个问题看似简单，但实际上涉及到几个深层次的判断：

### 时间维度

```
瞬间 < 会话 < 天 < 周 < 月 < 永久
```

- **瞬间**：临时变量、调试信息
- **会话**：当前任务、正在讨论的 bug
- **天**：每日总结、待办事项
- **周**：项目进展、趋势观察
- **月**：季度规划、学习收获
- **永久**：偏好、原则、决策、约束

### 价值维度

```
低价值 < 有用 < 重要 < 关键 < 核心
```

- **低价值**：闲聊、情绪表达
- **有用**：技巧、经验分享
- **重要**：决策、设计选择
- **关键**：原则、硬约束
- **核心**：身份定义、长期目标

### 可用性维度

```
一次性 < 重复性 < 可复用 < 可泛化
```

- **一次性**：特定的 bug 修复
- **重复性**：常用的命令、配置
- **可复用**：设计模式、解决方案
- **可泛化**：原则、方法论

### 蒸馏哲学总结

**值得永久记住的信息 = (跨时间有用) AND (高价值) AND (可复用)**

```
永久记忆 = f(时间持久性, 价值密度, 可复用性)
        = 时间持久性 × 价值密度 × 可复用性 × 置信度
```

---

## 价值判断框架

### 1. 时间持久性评分

| 指标 | 评分 | 说明 |
|------|------|------|
| 瞬间 | 0 | 临时变量、调试信息 |
| 会话 | 0.2 | 当前任务状态 |
| 天 | 0.4 | 每日待办、总结 |
| 周 | 0.6 | 项目进展、趋势 |
| 月 | 0.8 | 学习收获、习惯 |
| 永久 | 1.0 | 偏好、原则、决策 |

**判断方法**：
- 包含"总是"、"通常"、"偏好"、"习惯" → 永久
- 包含"决定"、"选择"、"采用" → 永久
- 包含"今天"、"现在" → 天/会话
- 包含"修复"、"解决" + 特定问题 → 瞬间/会话

### 2. 价值密度评分

| 指标 | 评分 | 示例 |
|------|------|------|
| 低 | 0-0.3 | 闲聊、"你好"、"感谢" |
| 中 | 0.3-0.6 | 技巧、小发现 |
| 高 | 0.6-0.8 | 决策、设计 |
| 核心 | 0.8-1.0 | 原则、硬约束 |

**判断方法**：
- 包含"不能"、"必须"、"禁止" → 核心
- 包含"决定"、"选择" → 高
- 包含"发现"、"学到" → 中
- 纯粹社交 → 低

### 3. 可复用性评分

| 指标 | 评分 | 说明 |
|------|------|------|
| 一次性 | 0 | 特定 bug 修复 |
| 低复用 | 0.3 | 项目特定配置 |
| 中复用 | 0.6 | 常用命令、模式 |
| 高复用 | 1.0 | 原则、方法论 |

**判断方法**：
- 通用原则 → 高复用
- 设计模式 → 中复用
- 项目特定 → 低复用
- 特定问题 → 一次性

### 4. 置信度评分

| 指标 | 评分 | 说明 |
|------|------|------|
| 推测 | 0.3 | "可能"、"也许" |
| 犹豫 | 0.5 | "不确定"、"不太确定" |
| 确定 | 0.8 | "应该是" |
| 肯定 | 1.0 | "是"、"决定" |

### 综合评分公式

```javascript
function calculatePermanenceScore(text, context) {
  const timeScore = evaluateTimePersistence(text);
  const valueScore = evaluateValueDensity(text);
  const reusabilityScore = evaluateReusability(text, context);
  const confidenceScore = evaluateConfidence(text);

  // 加权：时间和可复用性更重要
  const weights = {
    time: 0.3,
    value: 0.25,
    reusability: 0.3,
    confidence: 0.15,
  };

  return (
    timeScore * weights.time +
    valueScore * weights.value +
    reusabilityScore * weights.reusability +
    confidenceScore * weights.confidence
  );
}

// 蒸馏阈值
const DISTILL_THRESHOLD = 0.6;  // 0.6 以上才考虑蒸馏
```

---

## 蒸馏流程设计

### 完整流程

```
1. 数据收集
   ├─ 读取当日 journal
   ├─ 去重（去除纯工具调用、重复命令）
   └─ 预处理（分段、标记）

2. 初步筛选
   ├─ 长度过滤（< 50 字符跳过）
   ├─ 类型过滤（跳过纯工具输出）
   ├─ 价值评分（低于阈值跳过）
   └─ 候选集生成

3. 语义分析
   ├─ 提取主题聚类
   ├─ 识别关键陈述
   ├─ 检测冲突信息
   └─ 上下文关联

4. 规则提取
   ├─ 模式匹配（预定义规则）
   ├─ LLM 分析（深度理解）
   ├─ 去重合并（语义相似度）
   └─ 候选记忆生成

5. 验证阶段
   ├─ 重复检查（对比已有记忆）
   ├─ 冲突检查（是否存在矛盾）
   ├─ 格式验证（subject, kind, tags）
   └─ 置信度过滤（< 0.8 跳过）

6. 批量 upsert
   ├─ 并发写入
   ├─ 错误重试
   └─ 结果收集

7. 后处理
   ├─ 更新统计
   ├─ 同步到 Discord
   ├─ 发送总结
   └─ 记录审计日志
```

### 详细流程代码

```javascript
async function distillDay(dateKeyStr = null, opts = {}) {
  const day = dateKeyStr || new Date().toISOString().slice(0, 10);
  const log = opts.log || (() => {});

  // === 1. 数据收集 ===
  log(`[distiller] 开始收集数据: ${day}`);
  const journalEvents = journal.readDay(day);
  if (journalEvents.length < 10) {
    return { ok: true, count: 0, reason: 'journal too empty' };
  }

  // 去重和预处理
  const cleanedEvents = preprocessJournal(journalEvents);

  // === 2. 初步筛选 ===
  log(`[distiller] 初步筛选: ${cleanedEvents.length} 条事件`);
  const candidates = [];
  for (const event of cleanedEvents) {
    const score = calculatePermanenceScore(event.content, event);
    if (score >= DISTILL_THRESHOLD) {
      candidates.push({ ...event, score });
    }
  }
  log(`[distiller] 候选集: ${candidates.length} 条`);

  if (candidates.length === 0) {
    return { ok: true, count: 0, reason: 'no high-value content' };
  }

  // === 3. 语义分析 ===
  log(`[distiller] 语义分析...`);
  const clusters = await clusterBySemantics(candidates, embedder);
  const keyStatements = extractKeyStatements(clusters);

  // === 4. 规则提取 ===
  log(`[distiller] 规则提取...`);

  // 4.1 模式匹配
  const ruleMatches = extractByRules(keyStatements);

  // 4.2 LLM 深度分析
  const llmCandidates = await analyzeWithLLM({
    statements: keyStatements,
    existingMemories: await getExistingMemories(),
    journalEvents: cleanedEvents,
  });

  // 合并并去重
  const mergedCandidates = mergeAndDeduplicate([
    ...ruleMatches,
    ...llmCandidates,
  ]);

  log(`[distiller] 合并后候选: ${mergedCandidates.length} 条`);

  // === 5. 验证阶段 ===
  log(`[distiller] 验证阶段...`);
  const validated = [];
  for (const candidate of mergedCandidates) {
    const validation = await validateCandidate(candidate);
    if (validation.valid) {
      validated.push(candidate);
    } else {
      log(`[distiller] 验证失败: ${candidate.subject} - ${validation.reason}`);
    }
  }

  if (validated.length === 0) {
    return { ok: true, count: 0, reason: 'no valid candidates after validation' };
  }

  // 限制数量（宁缺毋滥）
  const finalCandidates = validated.slice(0, 5);
  log(`[distiller] 最终候选: ${finalCandidates.length} 条`);

  // === 6. 批量 upsert ===
  log(`[distiller] 批量 upsert...`);
  const results = [];
  for (const candidate of finalCandidates) {
    try {
      const result = await memoryStore.upsert({
        kind: candidate.kind,
        scope: 'user',
        subject: candidate.subject,
        content: candidate.content,
        contentBody: candidate.reasoning,
        tags: candidate.tags,
        source: { kind: 'distiller', ref: `journal:${day}` },
        confidence: candidate.confidence,
      });
      results.push({ ...result, candidate });
      log(`[distiller] ✅ ${candidate.kind}/${candidate.subject}`);
    } catch (e) {
      log(`[distiller] ❌ upsert 失败: ${e.message}`);
    }
  }

  // === 7. 后处理 ===
  const summary = buildDistillationSummary(results);
  await postSummary(summary);

  return {
    ok: true,
    count: results.length,
    results,
    summary,
  };
}
```

---

## 提取规则引擎

### 规则分类

```javascript
const DISTILLATION_RULES = [
  // ===== 决策类 =====
  {
    id: 'decision-declare',
    category: 'decision',
    priority: 1.0,
    patterns: [
      /(?:决定|选择|采用|确定)了?[^。！？]*[。！？]/gi,
      /(?:最终|最后)决定[^。！？]*[。！？]/gi,
    ],
    extractor: (text, match) => {
      const decision = match[0].trim();
      // 提取决策主题
      const topicMatch = decision.match(/(?:决定|选择|采用)(?:了)?(.+?)(?:，|。|！|？|$)/);
      const topic = topicMatch ? topicMatch[1].trim() : '未命名决策';
      return {
        kind: 'decision',
        subject: slugify(topic, 4),
        content: decision,
        confidence: 0.9,
      };
    },
  },

  {
    id: 'decision-compare',
    category: 'decision',
    priority: 0.9,
    patterns: [
      /(?:相比|对比|而不是|而非|放弃)[^。！？]*[。！？]/gi,
      /(?:选[A-Z]+?)(?:而不是|而非)/gi,
    ],
    extractor: (text, match) => {
      const sentence = match[0].trim();
      // 提取"选择A而不是B"的结构
      const compareMatch = sentence.match(/(?:选择|采用)([^，。]+?)(?:而不是|而非)([^，。]+)/);
      if (compareMatch) {
        return {
          kind: 'decision',
          subject: `${slugify(compareMatch[1], 2)}-vs-${slugify(compareMatch[2], 2)}`,
          content: sentence,
          confidence: 0.85,
        };
      }
      return null;
    },
  },

  // ===== 偏好类 =====
  {
    id: 'preference-always',
    category: 'preference',
    priority: 0.95,
    patterns: [
      /(?:总是|通常|习惯|偏好|喜欢)[^。！？]*[。！？]/gi,
      /(?:一般|默认|标准|惯例)[^。！？]*[。！？]/gi,
    ],
    extractor: (text, match) => {
      const pref = match[0].trim();
      const topicMatch = pref.match(/(?:总是|通常|习惯|偏好)(?:用|选|做)?(.+?)(?:，|。|！|？|$)/);
      const topic = topicMatch ? topicMatch[1].trim() : '未命名偏好';
      return {
        kind: 'preference',
        subject: slugify(topic, 3),
        content: pref,
        confidence: 0.85,
      };
    },
  },

  {
    id: 'preference-avoid',
    category: 'preference',
    priority: 0.9,
    patterns: [
      /(?:不要|避免|不喜欢|讨厌|反感)[^。！？]*[。！？]/gi,
      /(?:不推荐|不建议|尽量避免)[^。！？]*[。！？]/gi,
    ],
    extractor: (text, match) => {
      const avoid = match[0].trim();
      const topicMatch = avoid.match(/(?:不要|避免)(?:用|选|做)?(.+?)(?:，|。|！|？|$)/);
      const topic = topicMatch ? topicMatch[1].trim() : '未命名偏好';
      return {
        kind: 'preference',
        subject: `avoid-${slugify(topic, 2)}`,
        content: avoid,
        confidence: 0.8,
      };
    },
  },

  // ===== 约束类 =====
  {
    id: 'constraint-must',
    category: 'constraint',
    priority: 1.0,
    patterns: [
      /(?:必须|需要|要求|强制)[^。！？]*[。！？]/gi,
      /(?:不能|禁止|不允许|不可)[^。！？]*[。！？]/gi,
    ],
    extractor: (text, match) => {
      const constraint = match[0].trim();
      const topicMatch = constraint.match(/(?:必须|不能)(?:用|做)?(.+?)(?:，|。|！|？|$)/);
      const topic = topicMatch ? topicMatch[1].trim() : '未命名约束';
      return {
        kind: 'constraint',
        subject: slugify(topic, 3),
        content: constraint,
        confidence: 0.95,
      };
    },
  },

  // ===== 事实类 =====
  {
    id: 'fact-project',
    category: 'fact',
    priority: 0.8,
    patterns: [
      /(?:项目名|名称是|叫作|叫做)[^。！？]*[。！？]/gi,
      /(?:位于|路径是|地址是)[^。！？]*[。！？]/gi,
      /(?:版本|版本号)[^。！？]*[。！？]/gi,
    ],
    extractor: (text, match) => {
      const fact = match[0].trim();
      return {
        kind: 'fact',
        subject: slugify(fact.slice(0, 30), 3),
        content: fact,
        confidence: 0.9,
      };
    },
  },

  {
    id: 'fact-learned',
    category: 'fact',
    priority: 0.7,
    patterns: [
      /(?:学到|发现|了解到|才知道)[^。！？]*[。！？]/gi,
      /(?:原来|实际上)[^。！？]*[。！？]/gi,
    ],
    extractor: (text, match) => {
      const learned = match[0].trim();
      // 需要进一步判断是否"稳定"
      const stableIndicators = ['原理', '机制', '原理', '原因', '本质'];
      const isStable = stableIndicators.some(ind => learned.includes(ind));
      if (!isStable) return null;  // 不稳定的事实不记录

      return {
        kind: 'fact',
        subject: slugify(learned.slice(0, 30), 3),
        content: learned,
        confidence: 0.75,
      };
    },
  },

  // ===== 工程结论类 =====
  {
    id: 'build-solution',
    category: 'build',
    priority: 0.85,
    patterns: [
      /(?:解决|修复|处理)[^。！？]*(?:问题|bug|错误)[^。！？]*[。！？]/gi,
      /(?:方案|办法|方法)是[^。！？]*[。！？]/gi,
      /(?:最终|最后)(?:用了|采用)[^。！？]*[。！？]/gi,
    ],
    extractor: (text, match) => {
      const solution = match[0].trim();
      // 判断是否通用方案
      const genericIndicators = ['模式', '方法', '策略', '做法'];
      const isGeneric = genericIndicators.some(ind => solution.includes(ind));

      if (!isGeneric) return null;  // 特定 bug 修复不记录

      return {
        kind: 'build',
        subject: slugify(solution.slice(0, 30), 4),
        content: solution,
        confidence: 0.8,
      };
    },
  },

  // ===== 定义类 =====
  {
    id: 'definition-explain',
    category: 'definition',
    priority: 0.75,
    patterns: [
      /(?:是指|意思是|定义为)[^。！？]*[。！？]/gi,
      /(?:所谓|也就是|即)[^。！？]*[。！？]/gi,
    ],
    extractor: (text, match) => {
      const def = match[0].trim();
      // 提取被定义的词
      const termMatch = def.match(/^([^，。：]+?)(?:是指|意思是|定义为)/);
      if (!termMatch) return null;

      const term = termMatch[1].trim();
      return {
        kind: 'definition',
        subject: slugify(term, 2),
        content: def,
        confidence: 0.85,
      };
    },
  },

  // ===== 反思类 =====
  {
    id: 'reflection-lesson',
    category: 'reflection',
    priority: 0.8,
    patterns: [
      /(?:经验|教训|收获|启发)[^。！？]*[。！？]/gi,
      /(?:以后|下次)(?:要|应该|需要)[^。！？]*[。！？]/gi,
      /(?:应该|不应该)(?:先|后)[^。！？]*[。！？]/gi,
    ],
    extractor: (text, match) => {
      const reflection = match[0].trim();
      return {
        kind: 'reflection',
        subject: slugify(reflection.slice(0, 30), 4),
        content: reflection,
        confidence: 0.75,
      };
    },
  },

  // ===== 产品想法类 =====
  {
    id: 'idea-product',
    category: 'idea',
    priority: 0.7,
    patterns: [
      /(?:可以|能够)[^。！？]*(?:做|做|开发|实现)[^。！？]*[。！？]/gi,
      /(?:想到|觉得)(?:可以|应该)[^。！？]*[。！？]/gi,
      /(?:点子|主意|想法)[^。！？]*[。！？]/gi,
    ],
    extractor: (text, match) => {
      const idea = match[0].trim();
      return {
        kind: 'idea',
        subject: slugify(idea.slice(0, 30), 4),
        content: idea,
        confidence: 0.6,  // 想法的置信度较低
      };
    },
  },
];

// 提取函数
function extractByRules(statements) {
  const candidates = [];

  for (const stmt of statements) {
    const text = stmt.content;

    for (const rule of DISTILLATION_RULES) {
      for (const pattern of rule.patterns) {
        const match = text.match(pattern);
        if (match) {
          const extracted = rule.extractor(text, match);
          if (extracted) {
            candidates.push({
              ...extracted,
              ruleId: rule.id,
              category: rule.category,
              priority: rule.priority,
              sourceStmt: stmt,
            });
            break;  // 一个语句只匹配一个规则
          }
        }
      }
    }
  }

  // 按优先级排序
  return candidates.sort((a, b) => b.priority - a.priority);
}

// Slugify 工具
function slugify(text, maxWords = 4) {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5-]/g, '')  // 保留中文
    .split(/\s+/)
    .slice(0, maxWords)
    .join('-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'memory';
}
```

### LLM 深度分析

```javascript
async function analyzeWithLLM({ statements, existingMemories, journalEvents }) {
  if (!opts.pi) return [];

  // 构建上下文
  const existingSummary = existingMemories
    .slice(0, 10)
    .map(m => `- [${m.kind}] ${m.subject}: ${m.content.slice(0, 50)}`)
    .join('\n');

  const transcript = statements
    .map(s => `[${s.type} ${s.ts}] ${s.content.slice(0, 200)}`)
    .join('\n');

  const prompt = `你是一个智能记忆分析器。分析以下对话片段，提取值得永久记住的信息。

## 现有记忆（参考）
${existingSummary || '(无)'}

## 对话片段
${transcript}

## 提取规则
1. 只提取**跨时间仍然有用**的信息
2. 优先级：decision > constraint > preference > fact > build > reflection > definition > idea
3. 每个 subject 只保留最新的版本
4. 不要提取临时任务、短时效信息、闲聊
5. subject 用英文短键（2-4 个词，小写，用 - 连接）
6. tags 2-4 个相关标签

## 输出格式
返回 JSON 数组，每条格式：
{
  "kind": "decision|preference|constraint|fact|build|reflection|definition|idea",
  "subject": "英文短键",
  "content": "简洁陈述",
  "reasoning": "为什么值得记住",
  "tags": ["tag1", "tag2"],
  "confidence": 0.0-1.0
}

只返回 JSON，不要有其他内容。`;

  try {
    const result = await opts.pi.prompt(prompt);
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const candidates = JSON.parse(jsonMatch[0]);

    // 过滤置信度
    return candidates.filter(c => c.confidence >= 0.7);
  } catch (e) {
    log(`[distiller] LLM 分析失败: ${e.message}`);
    return [];
  }
}
```

---

## 质量控制机制

### 1. 重复检查

```javascript
async function checkDuplicate(candidate, existingMemories) {
  // 1. 完全相同 subject + kind
  const exactMatch = existingMemories.find(m =>
    m.subject === candidate.subject &&
    m.kind === candidate.kind &&
    m.status === 'active'
  );

  if (exactMatch) {
    return {
      isDuplicate: true,
      action: 'supersede',
      existingId: exactMatch.id,
    };
  }

  // 2. 语义相似度
  if (candidate.embedding) {
    const similar = existingMemories.filter(m => {
      if (!m.embedding) return false;
      const sim = cosineSimilarity(candidate.embedding, m.embedding);
      return sim > 0.85;  // 高相似度阈值
    });

    if (similar.length > 0) {
      return {
        isDuplicate: true,
        action: 'review',  // 需要人工确认
        similarIds: similar.map(m => m.id),
      };
    }
  }

  return { isDuplicate: false };
}
```

### 2. 冲突检查

```javascript
async function checkConflict(candidate, existingMemories) {
  const conflicts = [];

  // 检查同 subject + kind 但内容冲突的
  const sameKind = existingMemories.filter(m =>
    m.subject === candidate.subject &&
    m.kind === candidate.kind &&
    m.status === 'active'
  );

  for (const existing of sameKind) {
    // 简单的文本冲突检测
    if (hasConflict(candidate.content, existing.content)) {
      conflicts.push({
        existingId: existing.id,
        existingContent: existing.content,
        newContent: candidate.content,
        conflictType: 'content',
      });
    }
  }

  // 检查跨类型的逻辑冲突
  if (candidate.kind === 'preference' || candidate.kind === 'constraint') {
    const conflictingTypes = existingMemories.filter(m =>
      (m.kind === 'preference' || m.kind === 'constraint') &&
      m.status === 'active' &&
      isLogicalConflict(candidate.content, m.content)
    );

    for (const conflicting of conflictingTypes) {
      conflicts.push({
        existingId: conflicting.id,
        existingContent: conflicting.content,
        newContent: candidate.content,
        conflictType: 'logical',
      });
    }
  }

  return conflicts;
}

function hasConflict(text1, text2) {
  // 检测"相反"的关键词
  const opposites = [
    ['要', '不要'],
    ['用', '不用'],
    ['必须', '不能'],
    ['喜欢', '不喜欢'],
    ['选择', '放弃'],
  ];

  for (const [pos, neg] of opposites) {
    if (text1.includes(pos) && text2.includes(neg)) return true;
    if (text1.includes(neg) && text2.includes(pos)) return true;
  }

  return false;
}
```

### 3. 格式验证

```javascript
function validateFormat(candidate) {
  const errors = [];

  // subject 检查
  if (!candidate.subject || typeof candidate.subject !== 'string') {
    errors.push('subject 必填');
  } else if (candidate.subject.length > 50) {
    errors.push('subject 太长（> 50 字符）');
  } else if (!/^[a-z0-9-]+$/.test(candidate.subject)) {
    errors.push('subject 只能包含小写字母、数字、连字符');
  }

  // kind 检查
  if (!candidate.kind || !MEMORY_KINDS.includes(candidate.kind)) {
    errors.push('kind 非法');
  }

  // content 检查
  if (!candidate.content || typeof candidate.content !== 'string') {
    errors.push('content 必填');
  } else if (candidate.content.length < 5) {
    errors.push('content 太短（< 5 字符）');
  } else if (candidate.content.length > 500) {
    errors.push('content 太长（> 500 字符）');
  }

  // tags 检查
  if (candidate.tags) {
    if (!Array.isArray(candidate.tags)) {
      errors.push('tags 必须是数组');
    } else if (candidate.tags.length > 5) {
      errors.push('tags 太多（> 5 个）');
    } else if (candidate.tags.some(t => typeof t !== 'string' || t.length > 20)) {
      errors.push('tags 格式错误');
    }
  }

  // confidence 检查
  if (typeof candidate.confidence !== 'number' ||
      candidate.confidence < 0 || candidate.confidence > 1) {
    errors.push('confidence 必须是 0-1 之间的数字');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

### 4. 置信度过滤

```javascript
function filterByConfidence(candidates, threshold = 0.8) {
  return candidates.filter(c => {
    // 规则提取的置信度调整
    let adjustedConfidence = c.confidence;

    if (c.ruleId) {
      // 规则提取的置信度通常较高
      adjustedConfidence = Math.min(0.95, c.confidence + 0.1);
    } else {
      // LLM 提取的置信度需要更严格
      adjustedConfidence = c.confidence - 0.1;
    }

    // 不同 kind 有不同阈值
    const thresholds = {
      decision: 0.85,
      constraint: 0.85,
      preference: 0.8,
      fact: 0.8,
      build: 0.75,
      reflection: 0.7,
      definition: 0.75,
      idea: 0.65,  // 想法允许更低置信度
    };

    const kindThreshold = thresholds[c.kind] || 0.7;

    return adjustedConfidence >= kindThreshold;
  });
}
```

---

## 边缘情况处理

### 1. 同一天冲突信息

**场景**：上午说"用 TypeScript"，下午说"改用 JavaScript"

```javascript
async function handleSameDayConflicts(candidates, journalEvents) {
  // 按主题分组
  const grouped = groupBySubject(candidates);

  const resolved = [];
  for (const [subject, items] of Object.entries(grouped)) {
    if (items.length === 1) {
      resolved.push(items[0]);
      continue;
    }

    // 多个候选，按时间排序
    const sorted = items.sort((a, b) => {
      const tsA = new Date(a.sourceStmt.ts);
      const tsB = new Date(b.sourceStmt.ts);
      return tsB - tsA;  // 最新的在前
    });

    // 检查是否有明确的"修正"信号
    const hasCorrection = sorted.some(item =>
      item.content.includes('改为') ||
      item.content.includes('修正') ||
      item.content.includes('更新')
    );

    if (hasCorrection) {
      // 使用最新的修正版本
      resolved.push(sorted[0]);
      // 其他标记为 superseded
      for (let i = 1; i < sorted.length; i++) {
        sorted[i].action = 'supersede';
        sorted[i].supersedesBy = sorted[0].id;
      }
    } else {
      // 没有明确的修正信号，标记冲突需要人工确认
      resolved.push({
        ...sorted[0],
        needsReview: true,
        conflicts: sorted.slice(1).map(i => ({
          content: i.content,
          ts: i.sourceStmt.ts,
        })),
      });
    }
  }

  return resolved;
}
```

### 2. 信息后来被推翻

**场景**：昨天蒸馏"偏好 TypeScript"，今天改成"偏好 JavaScript"

```javascript
async function handleSuperseding(newCandidate, existingMemories) {
  const conflicts = await checkConflict(newCandidate, existingMemories);

  if (conflicts.length === 0) {
    return newCandidate;
  }

  // 标记旧版本为 superseded
  for (const conflict of conflicts) {
    await memoryStore.upsert({
      id: conflict.existingId,
      status: 'superseded',
      supersededBy: newCandidate.id,
    });
  }

  // 新版本标记 supersedes
  newCandidate.supersedes = conflicts.map(c => c.existingId);

  return newCandidate;
}
```

### 3. 模糊或不确定的陈述

**场景**："可能应该用 TypeScript"、"不太确定，但好像..."

```javascript
function handleUncertainty(candidate) {
  const uncertainPatterns = [
    /可能|也许|大概|应该|好像|似乎|不确定|不太确定/gi,
  ];

  const content = candidate.content;
  const hasUncertainty = uncertainPatterns.some(p => p.test(content));

  if (hasUncertainty) {
    // 降低置信度
    candidate.confidence *= 0.7;

    // 如果置信度过低，标记需要确认
    if (candidate.confidence < 0.6) {
      candidate.needsReview = true;
      candidate.reason = '包含不确定表述';
    }
  }

  return candidate;
}
```

### 4. 临时但高价值信息

**场景**："这个 bug 的原因是 X，解决方案是 Y"

```javascript
function handleTemporaryButUseful(candidate) {
  // 检查是否包含"解决方案"或通用模式
  const genericKeywords = [
    '方案', '方法', '模式', '策略', '做法', '原则', '规律',
  ];

  const isGeneric = genericKeywords.some(kw => candidate.content.includes(kw));

  if (!isGeneric) {
    // 不是通用的，可能只是临时修复
    // 如果是 build 类型，标记为短期（30 天过期）
    if (candidate.kind === 'build') {
      candidate.expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString();
    } else {
      // 其他类型标记需要人工确认
      candidate.needsReview = true;
      candidate.reason = '可能只是临时信息';
    }
  }

  return candidate;
}
```

---

## 效果评估

### 评估指标

```javascript
const DISTILLATION_METRICS = {
  // 基础指标
  totalDistilled: 0,           // 总蒸馏数量
  avgPerDay: 0,                // 平均每天蒸馏数
  byKind: {},                  // 按类型分布

  // 质量指标
  avgConfidence: 0,            // 平均置信度
  highQualityRate: 0,          // 高质量率（confidence >= 0.85）

  // 使用指标
  accessedMemories: 0,         // 被访问的记忆数
  accessRate: 0,               // 访问率
  avgAccessCount: 0,           // 平均访问次数

  // 效果指标
  duplicateRate: 0,            // 重复率
  conflictRate: 0,             // 冲突率
  reviewRate: 0,               // 需要人工确认率
};
```

### 评估方法

#### 1. 自动评估

```javascript
async function evaluateDistillation() {
  const stats = await memoryStore.stats();

  // 1. 访问率
  const activeMemories = await memoryStore.query({ status: 'active' });
  const accessedCount = activeMemories.items.filter(m => m.accessCount > 0).length;
  const accessRate = accessedCount / activeMemories.items.length;

  // 2. 平均访问次数
  const avgAccessCount = activeMemories.items.reduce((sum, m) => sum + (m.accessCount || 0), 0) /
                         activeMemories.items.length;

  // 3. 低访问率记忆
  const lowAccessMemories = activeMemories.items.filter(m => (m.accessCount || 0) === 0);
  const lowAccessRate = lowAccessMemories.length / activeMemories.items.length;

  // 4. 按类型统计
  const byKindAccess = {};
  for (const memory of activeMemories.items) {
    const kind = memory.kind;
    if (!byKindAccess[kind]) {
      byKindAccess[kind] = { total: 0, accessed: 0, avgAccess: 0 };
    }
    byKindAccess[kind].total++;
    if (memory.accessCount > 0) {
      byKindAccess[kind].accessed++;
      byKindAccess[kind].avgAccess += memory.accessCount;
    }
  }

  // 计算平均访问次数
  for (const kind of Object.keys(byKindAccess)) {
    byKindAccess[kind].avgAccess =
      byKindAccess[kind].avgAccess / byKindAccess[kind].accessed || 0;
  }

  return {
    accessRate,
    avgAccessCount,
    lowAccessRate,
    lowAccessCount: lowAccessMemories.length,
    byKindAccess,
  };
}
```

#### 2. 人工反馈

```javascript
// 在 #记忆库 中，用户可以添加反应
// ✅ = 有用
// ❌ = 无用
// 🤔 = 需要修改
async function collectFeedback() {
  const feedback = [];

  // 读取 mirror 映射
  const mirrorMap = loadMirrorMap();

  for (const [memoryId, mirror] of Object.entries(mirrorMap)) {
    // 获取 Discord 消息的反应
    const reactions = await getMessageReactions(mirror.channelId, mirror.messageId);

    if (reactions.includes('✅')) {
      feedback.push({ memoryId, type: 'positive' });
    } else if (reactions.includes('❌')) {
      feedback.push({ memoryId, type: 'negative' });
    } else if (reactions.includes('🤔')) {
      feedback.push({ memoryId, type: 'needs_review' });
    }
  }

  return feedback;
}

// 根据反馈调整蒸馏策略
async function adjustDistillationStrategy(feedback) {
  const negativeIds = feedback.filter(f => f.type === 'negative').map(f => f.memoryId);

  // 分析负反馈的记忆特征
  const negativeMemories = await Promise.all(
    negativeIds.map(id => memoryStore.readMeta(id))
  );

  // 统计问题类型
  const issues = {
    duplicate: 0,
    temporary: 0,
    inaccurate: 0,
    irrelevant: 0,
  };

  for (const memory of negativeMemories) {
    if (memory.reason === 'duplicate') issues.duplicate++;
    else if (memory.expiresAt) issues.temporary++;
    else if (memory.confidence < 0.7) issues.inaccurate++;
    else issues.irrelevant++;
  }

  // 输出调整建议
  const recommendations = [];

  if (issues.duplicate > 3) {
    recommendations.push('提高重复检测阈值（当前 0.85 → 0.90）');
  }

  if (issues.temporary > 3) {
    recommendations.push('加强临时信息识别，自动设置过期时间');
  }

  if (issues.inaccurate > 3) {
    recommendations.push('提高置信度阈值（当前 0.8 → 0.85）');
  }

  if (issues.irrelevant > 3) {
    recommendations.push('优化蒸馏规则，减少低价值信息提取');

    // 找出问题最严重的 kind
    const byKind = {};
    for (const memory of negativeMemories) {
      byKind[memory.kind] = (byKind[memory.kind] || 0) + 1;
    }
    const worstKind = Object.entries(byKind).sort((a, b) => b[1] - a[1])[0];
    recommendations.push(`重点优化 ${worstKind[0]} 类型的提取规则`);
  }

  return recommendations;
}
```

#### 3. A/B 测试

```javascript
// 测试不同蒸馏策略的效果
async function runABTest() {
  const strategies = [
    { name: 'baseline', threshold: 0.6 },
    { name: 'strict', threshold: 0.7 },
    { name: 'very-strict', threshold: 0.8 },
  ];

  const results = {};

  for (const strategy of strategies) {
    const distillResults = await distillWithStrategy(strategy);

    // 等待一周后评估
    await sleep(7 * 86400_000);

    const evaluation = await evaluateDistillation();
    const feedback = await collectFeedback();

    results[strategy.name] = {
      distilledCount: distillResults.count,
      accessRate: evaluation.accessRate,
      avgAccessCount: evaluation.avgAccessCount,
      positiveRate: feedback.filter(f => f.type === 'positive').length / feedback.length,
    };
  }

  return results;
}
```

---

## 实施建议

### 阶段 1：基础增强（Week 1-2）

1. **完善提取规则**
   - 添加更多模式（当前 10 条 → 30 条）
   - 优化现有规则的准确性
   - 添加规则优先级系统

2. **实现质量控制**
   - 重复检查（语义相似度）
   - 冲突检查（逻辑冲突检测）
   - 格式验证（严格格式检查）

3. **添加统计指标**
   - 记录蒸馏数量
   - 按类型统计
   - 访问率追踪

### 阶段 2：智能优化（Week 3-4）

1. **价值评分系统**
   - 实现时间持久性评分
   - 实现价值密度评分
   - 实现可复用性评分
   - 综合评分公式

2. **LLM 深度分析**
   - 优化蒸馏 Prompt
   - 添加 few-shot 示例
   - 实现置信度校准

3. **边缘情况处理**
   - 同一天冲突信息
   - 信息被推翻
   - 模糊陈述处理

### 阶段 3：效果优化（Week 5-6）

1. **效果评估**
   - 自动评估指标
   - 人工反馈收集
   - A/B 测试框架

2. **策略调优**
   - 根据反馈调整阈值
   - 优化提取规则
   - 改进 Prompt

3. **监控告警**
   - 低访问率告警
   - 高重复率告警
   - 高冲突率告警

### 阶段 4：长期优化（Week 7+）

1. **主动学习**
   - 从负反馈中学习
   - 自动更新规则
   - 持续优化 Prompt

2. **蒸馏时机**
   - 除了每日 23:30
   - 添加"高频对话后立即蒸馏"
   - 添加"重要对话后立即蒸馏"

3. **蒸馏范围**
   - 扩展到其他频道
   - 支持"手动触发蒸馏"
   - 支持"选择性蒸馏"

---

## 附录

### A. 完整的提取规则示例

```javascript
// 见上文 "提取规则引擎" 部分
```

### B. 蒸馏 Prompt 优化

```markdown
你是一个长期记忆蒸馏器。分析今日对话，提取**真正值得永久记住**的信息。

## 核心原则

只有满足**所有以下条件**的信息才值得蒸馏：

1. **跨时间有用**：
   - ✅ 不是临时任务、一次性 bug 修复
   - ✅ 不是"今天"、"现在"的短时效信息
   - ✅ 包含"总是"、"通常"、"偏好"、"决定"等时间持久词

2. **高价值**：
   - ✅ 涉及设计决策、原则、硬约束
   - ✅ 包含"必须"、"不能"、"禁止"等关键约束
   - ✅ 不是闲聊、情绪表达、社交客套

3. **可复用**：
   - ✅ 通用原则、方法论、设计模式
   - ✅ 不是特定项目、特定配置、特定环境
   - ✅ 未来遇到类似情况可以参考

## Few-shot 示例

### 示例 1：值得蒸馏
对话："决定了，还是用 RPC 模式而不是 TUI，这样启动快且没有 ctx stale 问题"
→ kind: decision, subject: rpc-vs-tui, confidence: 0.95

### 示例 2：不值得蒸馏
对话："今天修复了一个 bug，原因是变量名写错了"
→ 不蒸馏（临时任务）

### 示例 3：值得蒸馏
对话："我总是习惯用 TypeScript 开发新项目，避免类型错误"
→ kind: preference, subject: use-typescript, confidence: 0.85

### 示例 4：不值得蒸馏
对话："这个项目的数据库连接字符串是 mongodb://localhost:27017"
→ 不蒸馏（特定配置，不是通用原则）

## 现有记忆（避免重复）
{existing_memories}

## 今日对话
{transcript}

## 输出格式
返回 JSON 数组，最多 5 条：
[
  {
    "kind": "decision|preference|constraint|fact|build|reflection|definition|idea",
    "subject": "英文短键（2-4 词）",
    "content": "简洁陈述（< 200 字）",
    "reasoning": "为什么值得记住（< 100 字）",
    "tags": ["tag1", "tag2", "tag3"],
    "confidence": 0.0-1.0
  }
]

只返回 JSON，不要有其他内容。
```

### C. 监控指标定义

```javascript
const MONITORING_METRICS = [
  // 蒸馏数量
  'distillation_total_count',
  'distillation_avg_per_day',
  'distillation_by_kind_preference',
  'distillation_by_kind_fact',
  'distillation_by_kind_decision',
  'distillation_by_kind_constraint',
  'distillation_by_kind_build',

  // 蒸馏质量
  'distillation_avg_confidence',
  'distillation_high_quality_rate',
  'distillation_duplicate_rate',
  'distillation_conflict_rate',
  'distillation_review_rate',

  // 蒸馏效果
  'distillation_access_rate',
  'distillation_avg_access_count',
  'distillation_low_access_rate',
  'distillation_positive_feedback_rate',
  'distillation_negative_feedback_rate',
];
```

### D. 故障排查

| 问题 | 可能原因 | 诊断方法 | 解决方案 |
|------|----------|----------|----------|
| 蒸馏结果太多 | 阈值太低 | 检查 avgPerDay | 提高 DISTILL_THRESHOLD |
| 蒸馏结果太少 | 规则太严 | 检查规则匹配率 | 降低阈值或增加规则 |
| 重复记忆过多 | 重复检查太弱 | 检查相似度阈值 | 提高相似度阈值到 0.9 |
| 冲突记忆过多 | 冲突检查缺失 | 检查冲突率 | 实现冲突检测逻辑 |
| 访问率低 | 提取不准确 | 检查访问率统计 | 优化提取规则和 Prompt |
| 置信度不准 | 未校准 | 检查置信度分布 | 根据反馈校准 |

---

**文档版本**: 1.0
**最后更新**: 2024-07-19
**维护者**: zhangsan