# 记忆蒸馏实施方案

> 基于你的选择：混合时机 + 纯 LLM + 每天 5 条 + 质量优先拒绝重复

---

## 📋 核心决策总结

| 决策项 | 你的选择 | 实施策略 |
|--------|----------|----------|
| 蒸馏时机 | 混合 | 每天 23:30 + 高频对话触发 + 手动触发 |
| 蒸馏策略 | 纯 LLM | 不用规则引擎，全力优化 Prompt |
| 数量控制 | 5 条 | LLM 内部排序，强制限制 |
| 质量控制 | 拒绝重复 | 相似度阈值 0.9，Prompt 强调查重 |
| 效果评估 | 都可以 | 访问率 + Emoji 反馈 + 主动学习 |

---

## 1. 混合蒸馏时机设计

### 触发条件

```javascript
const DISTILLATION_TRIGGERS = {
  // 每日常规蒸馏
  schedule: {
    hour: 23,
    minute: 30,
    timezone: 'Asia/Shanghai',
  },

  // 实时触发条件
  realtime: {
    enabled: true,
    conditions: [
      {
        name: '高频对话',
        check: (stats) => {
          // 10 条消息内检测到 3+ 个高价值候选
          return stats.last10Messages.candidates >= 3;
        },
        cooldown: 1800000,  // 30 分钟冷却
      },
      {
        name: '重要对话',
        check: (stats) => {
          // 检测到明确的决策/约束关键词
          const keywords = ['决定', '选择', '必须', '不能', '禁止'];
          return stats.last5Messages.includesKeyword(keywords);
        },
        cooldown: 600000,  // 10 分钟冷却
      },
      {
        name: '长时间对话',
        check: (stats) => {
          // 连续对话 20+ 条消息
          return stats.consecutiveMessages >= 20;
        },
        cooldown: 1800000,  // 30 分钟冷却
      },
    ],
  },

  // 手动触发
  manual: {
    command: '!distill',
    rateLimit: {
      maxPerHour: 3,  // 每小时最多 3 次
      maxPerDay: 10,  // 每天最多 10 次
    },
  },
};
```

### 实时蒸馏流程

```javascript
// 在每次收到消息后检查
async function checkRealtimeDistillation(message) {
  if (!DISTILLATION_TRIGGERS.realtime.enabled) return;

  const stats = await getConversationStats(message.channelId, { window: 10 });

  for (const condition of DISTILLATION_TRIGGERS.realtime.conditions) {
    if (condition.check(stats)) {
      const lastDistill = getLastDistillTime(message.channelId);
      const cooldownPassed = Date.now() - lastDistill > condition.cooldown;

      if (cooldownPassed) {
        log(`[distiller] 触发实时蒸馏: ${condition.name}`);
        await distillNow({ reason: condition.name, channelId: message.channelId });
        setLastDistillTime(message.channelId, Date.now());
      }
      break;
    }
  }
}

// 获取对话统计
async function getConversationStats(channelId, { window = 10 }) {
  const recentMessages = await getRecentMessages(channelId, window);
  const journalEvents = journal.readDay(new Date().toISOString().slice(0, 10));

  // 快速评分（不调用 LLM）
  const candidates = recentMessages
    .filter(msg => {
      const score = quickScore(msg.content);
      return score >= 0.6;  // 初步筛选阈值
    })
    .map(msg => ({
      content: msg.content,
      score: quickScore(msg.content),
    }));

  const keywords = ['决定', '选择', '必须', '不能', '禁止', '总是', '偏好'];

  return {
    last10Messages: {
      total: recentMessages.length,
      candidates: candidates.length,
    },
    last5Messages: {
      includesKeyword: recentMessages.slice(0, 5).some(msg =>
        keywords.some(kw => msg.content.includes(kw))
      ),
    },
    consecutiveMessages: await getConsecutiveMessageCount(channelId),
  };
}

// 快速评分（不调用 embedding，只做关键词匹配）
function quickScore(text) {
  let score = 0;

  // 时间持久性
  if (/(?:总是|通常|习惯|偏好|决定|选择|采用)/.test(text)) score += 0.4;
  if (/(?:今天|现在|当前)/.test(text)) score -= 0.2;

  // 价值密度
  if (/(?:必须|不能|禁止|要求)/.test(text)) score += 0.4;
  if (/(?:决定|选择)/.test(text)) score += 0.3;

  // 可复用性
  if (/(?:原则|方法|方案|模式|策略)/.test(text)) score += 0.3;
  if (/(?:修复|解决)(?:了?)(?:这个|那个)/.test(text)) score -= 0.3;

  // 置信度
  if (/(?:可能|也许|大概|好像|不确定)/.test(text)) score -= 0.2;

  return Math.max(0, Math.min(1, score));
}
```

### 手动触发命令

```javascript
// 在 entry-bot.mjs 中添加
if (message.content.startsWith('!distill')) {
  const args = message.content.slice(8).trim();
  const rateLimitCheck = checkRateLimit(message.author.id, 'distill');

  if (!rateLimitCheck.allowed) {
    await discord.send(message.channelId,
      `🚫 蒸馏触发次数超限 (${rateLimitCheck.reason})`);
    return;
  }

  log(`[distiller] 手动触发蒸馏: ${args || '(无参数)'}`);
  const result = await distillNow({
    reason: 'manual',
    channelId: message.channelId,
    manualArgs: args,
  });

  await discord.send(message.channelId,
    `✅ 蒸馏完成: ${result.count} 条记忆`);
  recordRateLimit(message.author.id, 'distill');
}
```

---

## 2. 纯 LLM 蒸馏策略

### 核心思路

**不再使用规则引擎**，全部依赖 LLM 的理解能力。重点在于：

1. **优化 Prompt**：清晰的 few-shot 示例
2. **提供上下文**：现有记忆列表
3. **强制排序**：让 LLM 自己选最重要的 5 条
4. **强调查重**：在 Prompt 里明确要求检查重复

### 蒸馏 Prompt（最终版）

```javascript
const DISTILL_PROMPT = `你是一个长期记忆蒸馏器。你的任务是：**从对话中提取 0-5 条真正值得永久记住的信息**。

## 🎯 核心原则

只有同时满足**以下所有条件**的信息才值得提取：

### 条件 1: 跨时间有用（时间持久性）
- ✅ 包含"总是"、"通常"、"习惯"、"偏好"等时间持久词
- ✅ 包含"决定"、"选择"、"采用"、"确定"等决策词
- ✅ 通用原则、方法论、设计模式
- ❌ "今天"、"现在"、"当前"的短时效信息
- ❌ 临时任务、一次性 bug 修复
- ❌ 具体的配置值（如端口号、路径）

### 条件 2: 高价值（价值密度）
- ✅ 涉及设计决策、技术选型
- ✅ 包含"必须"、"不能"、"禁止"等硬约束
- ✅ 重要的经验教训、反思总结
- ❌ 闲聊、社交客套
- ❌ 简单的确认或感叹

### 条件 3: 可复用（可复用性）
- ✅ 通用原则（"错误处理要记录日志"）
- ✅ 设计模式（"用工厂模式创建对象"）
- ✅ 方法论（"先做快速原型再优化"）
- ❌ 项目特定（"这个项目用 MongoDB"）
- ❌ 特定环境（"本地端口是 3000"）
- ❌ 特定问题（"这个 bug 的原因是变量名拼错"）

### 条件 4: 明确肯定（置信度）
- ✅ "决定用 TypeScript"
- ❌ "可能应该用 TypeScript"
- ❌ "不太确定，但好像..."

## 🔍 重复检查（非常重要！）

**必须检查以下重复情况：**

1. **完全重复**：相同 subject + kind
   - 示例：已有 "use-typescript" (preference)，不要再创建新的

2. **语义重复**：表达相同意思
   - 示例：已有 "用 TypeScript 开发"，不要创建 "TS 是首选"

3. **冲突重复**：相同主题但观点矛盾
   - 示例：已有 "preference: 用 TS"，不要创建 "preference: 用 JS"
   - 如有冲突，保留最新的（按时间戳）

## 📦 现有记忆（必须检查重复）

\`\`\`
${existingMemories.map(m =>
  `- [${m.kind}] ${m.subject}: ${m.content.slice(0, 60)}`
).join('\n')}
\`\`\`

## 📝 今日对话流

\`\`\`
${transcript}
\`\`\`

## 🎨 Few-shot 示例

### 示例 1：值得提取
对话："决定了，还是用 RPC 模式而不是 TUI，这样启动快且没有 ctx stale 问题"
提取：{
  "kind": "decision",
  "subject": "rpc-vs-tui",
  "content": "用 RPC 模式而不是 TUI（启动快且无 ctx stale）",
  "reasoning": "设计决策，跨时间有用，有明确理由",
  "tags": ["architecture", "performance"],
  "confidence": 0.95
}

### 示例 2：不值得提取
对话："今天修复了一个 bug，原因是变量名写错了"
不提取：临时 bug 修复，不是通用经验

### 示例 3：值得提取
对话："我总是习惯用 TypeScript 开发新项目，避免类型错误"
提取：{
  "kind": "preference",
  "subject": "use-typescript",
  "content": "总是用 TypeScript 开发新项目，避免类型错误",
  "reasoning": "长期偏好，明确原因，可复用",
  "tags": ["typescript", "preference"],
  "confidence": 0.85
}

### 示例 4：不应该提取（重复）
现有记忆：[preference] use-typescript: 总是用 TypeScript 开发新项目
对话："我通常用 TypeScript，因为类型安全"
不提取：与现有记忆语义重复

### 示例 5：值得提取
对话："错误处理必须记录日志，不能静默失败"
提取：{
  "kind": "constraint",
  "subject": "error-handling-must-log",
  "content": "错误处理必须记录日志，不能静默失败",
  "reasoning": "硬约束，明确要求，可复用",
  "tags": ["error-handling", "constraint"],
  "confidence": 0.95
}

### 示例 6：不应该提取（不确定）
对话："可能应该用 TypeScript，但不太确定"
不提取：包含不确定表述，置信度不足

### 示例 7：不应该提取（临时）
对话："这个项目的数据库连接字符串是 mongodb://localhost:27017"
不提取：特定配置，不是通用原则

## 🎯 提取任务

1. 通读对话流
2. 标记所有候选点（按时间顺序）
3. 对每个候选点，检查是否与现有记忆重复
4. 去重后，按重要性排序
5. **最多选择 5 条最值得的**
6. 如果没有值得提取的，返回空数组 []

## 📤 输出格式

返回 JSON 数组，**最多 5 条**：

\`\`\`json
[
  {
    "kind": "decision|preference|constraint|fact|build|reflection|definition|idea",
    "subject": "英文短键（2-4 个词，小写，用 - 连接）",
    "content": "简洁陈述（< 150 字）",
    "reasoning": "为什么值得记住（< 100 字）",
    "tags": ["tag1", "tag2", "tag3"],
    "confidence": 0.0-1.0
  }
]
\`\`\`

**重要**：
- 只返回 JSON，不要有其他文字
- 如果没有值得提取的，返回 \`[]\`
- 严格按照以上格式，不要有额外字段
- 置信度要真实反映确定性（不要为了通过检查而虚高）`;

async function distillWithPureLLM({ transcript, existingMemories, pi }) {
  const prompt = DISTILL_PROMPT
    .replace('${existingMemories.map(...)}', JSON.stringify(existingMemories, null, 2))
    .replace('${transcript}', transcript);

  const result = await pi.prompt(prompt);

  // 提取 JSON
  const jsonMatch = result.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('LLM 未返回有效的 JSON');
  }

  const candidates = JSON.parse(jsonMatch[0]);

  // 强制限制数量
  if (candidates.length > 5) {
    log(`[distiller] LLM 返回 ${candidates.length} 条，截断为 5 条`);
    candidates.length = 5;
  }

  return candidates;
}
```

---

## 3. 质量控制：拒绝重复

### 重复检查流程

```javascript
async function checkDuplicateStrict(candidate, existingMemories) {
  const SIMILARITY_THRESHOLD = 0.9;  // 提高到 0.9

  // 1. 完全相同 subject + kind
  const exactMatch = existingMemories.find(m =>
    m.subject === candidate.subject &&
    m.kind === candidate.kind &&
    m.status === 'active'
  );

  if (exactMatch) {
    return {
      isDuplicate: true,
      type: 'exact',
      existingId: exactMatch.id,
      existingContent: exactMatch.content,
      reason: `已有相同的 [${exactMatch.kind}] ${exactMatch.subject}`,
    };
  }

  // 2. 语义相似度（如果已有 embedding）
  if (candidate.embedding && embedder) {
    const similar = existingMemories
      .filter(m => m.embedding && m.status === 'active')
      .map(m => ({
        memory: m,
        similarity: cosineSimilarity(candidate.embedding, m.embedding),
      }))
      .filter(s => s.similarity >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity);

    if (similar.length > 0) {
      const mostSimilar = similar[0];
      return {
        isDuplicate: true,
        type: 'semantic',
        similarity: mostSimilar.similarity,
        existingId: mostSimilar.memory.id,
        existingContent: mostSimilar.memory.content,
        reason: `与现有记忆语义相似 (${(mostSimilar.similarity * 100).toFixed(1)}%)`,
      };
    }
  }

  // 3. 文本相似度（备用）
  const textSimilar = existingMemories
    .filter(m => m.status === 'active')
    .map(m => ({
      memory: m,
      similarity: textSimilarity(candidate.content, m.content),
    }))
    .filter(s => s.similarity >= 0.85)  // 文本相似度阈值稍低
    .sort((a, b) => b.similarity - a.similarity);

  if (textSimilar.length > 0) {
    return {
      isDuplicate: true,
      type: 'text',
      similarity: textSimilar[0].similarity,
      existingId: textSimilar[0].memory.id,
      existingContent: textSimilar[0].memory.content,
      reason: `与现有记忆文本相似 (${(textSimilar[0].similarity * 100).toFixed(1)}%)`,
    };
  }

  return { isDuplicate: false };
}

// 文本相似度（简单版）
function textSimilarity(text1, text2) {
  const set1 = new Set(text1.toLowerCase().split(/\s+/));
  const set2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

// Cosine 相似度
function cosineSimilarity(vec1, vec2) {
  let dot = 0, norm1 = 0, norm2 = 0;
  for (let i = 0; i < Math.min(vec1.length, vec2.length); i++) {
    dot += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  return dot / (Math.sqrt(norm1) * Math.sqrt(norm2) + 1e-12);
}
```

### 冲突检查

```javascript
async function checkConflict(candidate, existingMemories) {
  // 检查同 subject 但内容相反
  const sameSubject = existingMemories.filter(m =>
    m.subject === candidate.subject &&
    m.status === 'active'
  );

  const opposites = [
    ['用', '不用'],
    ['选择', '放弃'],
    ['喜欢', '不喜欢'],
    ['要', '不要'],
    ['必须', '不能'],
  ];

  for (const existing of sameSubject) {
    for (const [pos, neg] of opposites) {
      if (candidate.content.includes(pos) && existing.content.includes(neg)) {
        return {
          hasConflict: true,
          existingId: existing.id,
          existingContent: existing.content,
          newContent: candidate.content,
          conflictType: 'opposite',
        };
      }
      if (candidate.content.includes(neg) && existing.content.includes(pos)) {
        return {
          hasConflict: true,
          existingId: existing.id,
          existingContent: existing.content,
          newContent: candidate.content,
          conflictType: 'opposite',
        };
      }
    }
  }

  return { hasConflict: false };
}
```

### 完整验证流程

```javascript
async function validateCandidate(candidate, existingMemories) {
  const errors = [];

  // 1. 格式验证
  if (!candidate.kind || !MEMORY_KINDS.includes(candidate.kind)) {
    errors.push('kind 非法');
  }
  if (!candidate.subject || candidate.subject.length > 50) {
    errors.push('subject 格式错误');
  }
  if (!candidate.content || candidate.content.length < 5 || candidate.content.length > 500) {
    errors.push('content 长度不合适');
  }
  if (typeof candidate.confidence !== 'number' || candidate.confidence < 0 || candidate.confidence > 1) {
    errors.push('confidence 必须是 0-1 之间');
  }

  if (errors.length > 0) {
    return { valid: false, reason: errors.join('; ') };
  }

  // 2. 重复检查（最重要！）
  const duplicateCheck = await checkDuplicateStrict(candidate, existingMemories);
  if (duplicateCheck.isDuplicate) {
    return {
      valid: false,
      reason: duplicateCheck.reason,
      duplicateInfo: duplicateCheck,
    };
  }

  // 3. 冲突检查
  const conflictCheck = await checkConflict(candidate, existingMemories);
  if (conflictCheck.hasConflict) {
    // 冲突不是错误，而是需要 supersede
    return {
      valid: true,
      needsSupersede: true,
      supersedeIds: [conflictCheck.existingId],
    };
  }

  // 4. 置信度阈值
  const thresholds = {
    decision: 0.85,
    constraint: 0.85,
    preference: 0.8,
    fact: 0.8,
    build: 0.75,
    reflection: 0.7,
    definition: 0.75,
    idea: 0.65,
  };

  const threshold = thresholds[candidate.kind] || 0.7;
  if (candidate.confidence < threshold) {
    return {
      valid: false,
      reason: `置信度过低 (${candidate.confidence.toFixed(2)} < ${threshold})`,
    };
  }

  return { valid: true };
}
```

---

## 4. 完整蒸馏流程

```javascript
async function distillNow({ reason = 'scheduled', channelId = null, manualArgs = null } = {}) {
  const day = new Date().toISOString().slice(0, 10);
  const log = opts.log || (() => {});

  log(`[distiller] 开始蒸馏 (${reason}): ${day}`);

  // === 1. 收集数据 ===
  const journalEvents = journal.readDay(day);

  if (journalEvents.length < 5) {
    log(`[distiller] journal 太空，跳过`);
    return { ok: true, count: 0, reason: 'journal too empty' };
  }

  const transcript = journal.feedForDistillation(day);
  log(`[distiller] transcript 长度: ${transcript.length} 字符`);

  // === 2. 获取现有记忆（查重用） ===
  const existingQuery = await memoryStore.query({
    status: 'active',
    limit: 50,  // 只用最近的 50 条做查重
  });
  const existingMemories = existingQuery.items;
  log(`[distiller] 现有记忆: ${existingMemories.length} 条`);

  // === 3. LLM 蒸馏 ===
  log(`[distiller] 调用 LLM 蒸馏...`);
  const candidates = await distillWithPureLLM({
    transcript,
    existingMemories,
    pi: opts.pi,
  });

  if (candidates.length === 0) {
    log(`[distiller] LLM 返回空结果`);
    return { ok: true, count: 0, reason: 'no candidates from LLM' };
  }

  log(`[distiller] LLM 返回 ${candidates.length} 条候选`);

  // === 4. 计算 embedding（用于语义查重） ===
  if (embedder) {
    for (const candidate of candidates) {
      try {
        candidate.embedding = await embedder.embed(
          `${candidate.subject}\n${candidate.content}`
        );
      } catch (e) {
        log(`[distiller] embedding 失败: ${e.message}`);
      }
    }
  }

  // === 5. 验证候选 ===
  log(`[distiller] 验证候选...`);
  const validated = [];
  const rejected = [];

  for (const candidate of candidates) {
    const validation = await validateCandidate(candidate, existingMemories);

    if (validation.valid) {
      validated.push({
        ...candidate,
        needsSupersede: validation.needsSupersede,
        supersedeIds: validation.supersedeIds || [],
      });
    } else {
      rejected.push({
        ...candidate,
        reason: validation.reason,
      });
      log(`[distiller] ❌ 拒绝: ${candidate.subject} - ${validation.reason}`);
    }
  }

  if (validated.length === 0) {
    log(`[distiller] 所有候选被拒绝`);
    return { ok: true, count: 0, reason: 'all candidates rejected', rejected };
  }

  // 再次限制数量（验证后可能更少）
  const finalCandidates = validated.slice(0, 5);
  log(`[distiller] 最终候选: ${finalCandidates.length} 条`);

  // === 6. 处理 supersede ===
  for (const candidate of finalCandidates) {
    if (candidate.needsSupersede && candidate.supersedeIds.length > 0) {
      for (const oldId of candidate.supersedeIds) {
        await memoryStore.revoke({ id: oldId, reason: '被新版本替代' });
        log(`[distiller] 🔄 supersede: ${oldId} -> ${candidate.subject}`);
      }
    }
  }

  // === 7. 批量 upsert ===
  log(`[distiller] 批量 upsert...`);
  const results = [];

  for (const candidate of finalCandidates) {
    try {
      const result = await memoryStore.upsert({
        kind: candidate.kind,
        scope: 'user',
        subject: candidate.subject,
        content: candidate.content,
        contentBody: `**原因**: ${candidate.reasoning}\n\n**来源**: 蒸馏 (${reason})`,
        tags: candidate.tags || [],
        source: { kind: 'distiller', ref: `journal:${day}` },
        confidence: candidate.confidence,
      });

      results.push({ ...result, candidate });
      log(`[distiller] ✅ [${candidate.kind}] ${candidate.subject}`);
    } catch (e) {
      log(`[distiller] ❌ upsert 失败: ${e.message}`);
    }
  }

  // === 8. 后处理 ===
  // 更新统计
  updateDistillationStats({
    count: results.length,
    reason,
    candidatesCount: candidates.length,
    rejectedCount: rejected.length,
  });

  // 同步到 Discord
  for (const result of results) {
    await mirror.apply({ action: 'created', entry: result });
  }

  // 发送总结
  const summary = buildSummary(results, rejected, reason);
  await postSummary(summary);

  return {
    ok: true,
    count: results.length,
    results,
    rejected,
    summary,
  };
}

function buildSummary(results, rejected, reason) {
  const lines = [
    `🧠 **记忆蒸馏完成** (${reason})`,
    '',
    `✅ 提取 ${results.length} 条:`,
    ...results.map(r => `  - [${r.kind}] \`${r.subject}\``),
    '',
  ];

  if (rejected.length > 0) {
    lines.push(`❌ 拒绝 ${rejected.length} 条:`);
    rejected.slice(0, 3).forEach(r => {
      lines.push(`  - \`${r.subject}\`: ${r.reason.slice(0, 50)}...`);
    });
    if (rejected.length > 3) {
      lines.push(`  - ... 还有 ${rejected.length - 3} 条`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function postSummary(summary) {
  try {
    await discord.send(cfg.channels.memory, summary);
  } catch (e) {
    log(`[distiller] 发送总结失败: ${e.message}`);
  }
}
```

---

## 5. 效果评估

### 访问率统计

```javascript
async function updateAccessStats(memoryId) {
  const meta = memoryStore.readMeta(memoryId);
  if (!meta) return;

  meta.accessCount = (meta.accessCount || 0) + 1;
  meta.lastAccessedAt = new Date().toISOString();

  memoryStore.upsert(meta);
}

async function getAccessStats() {
  const query = await memoryStore.query({ status: 'active', limit: 1000 });
  const memories = query.items;

  const total = memories.length;
  const accessed = memories.filter(m => (m.accessCount || 0) > 0).length;
  const avgAccess = memories.reduce((sum, m) => sum + (m.accessCount || 0), 0) / total;

  const byKind = {};
  for (const m of memories) {
    if (!byKind[m.kind]) {
      byKind[m.kind] = { total: 0, accessed: 0, avgAccess: 0 };
    }
    byKind[m.kind].total++;
    if (m.accessCount > 0) {
      byKind[m.kind].accessed++;
      byKind[m.kind].avgAccess += m.accessCount;
    }
  }

  // 计算平均值
  for (const kind of Object.keys(byKind)) {
    byKind[kind].avgAccess =
      byKind[kind].avgAccess / byKind[kind].accessed || 0;
  }

  return {
    total,
    accessed,
    accessRate: accessed / total,
    avgAccess,
    byKind,
  };
}
```

### Emoji 反馈收集

```javascript
async function collectEmojiFeedback() {
  const mirrorMap = loadMirrorMap();
  const feedback = [];

  for (const [memoryId, mirror] of Object.entries(mirrorMap)) {
    try {
      const channel = await discord.client.channels.fetch(mirror.channelId);
      const message = await channel.messages.fetch(mirror.messageId);

      const reactions = message.reactions.cache;
      const emojiFeedback = [];

      if (reactions.has('✅')) {
        emojiFeedback.push('positive');
      }
      if (reactions.has('❌')) {
        emojiFeedback.push('negative');
      }
      if (reactions.has('🤔')) {
        emojiFeedback.push('needs_review');
      }

      if (emojiFeedback.length > 0) {
        feedback.push({ memoryId, emojis: emojiFeedback });
      }
    } catch (e) {
      // 忽略错误（消息可能已删除）
    }
  }

  return feedback;
}
```

### 定期效果报告

```javascript
async function generateDistillationReport() {
  const accessStats = await getAccessStats();
  const feedback = await collectEmojiFeedback();
  const distillStats = getDistillationStats();

  const positiveCount = feedback.filter(f => f.emojis.includes('positive')).length;
  const negativeCount = feedback.filter(f => f.emojis.includes('negative')).length;
  const totalFeedback = feedback.length;

  const report = {
    timestamp: new Date().toISOString(),

    // 蒸馏统计
    distillation: {
      totalDistilled: distillStats.totalDistilled,
      avgPerDay: distillStats.avgPerDay,
      avgCandidates: distillStats.avgCandidates,
      avgRejected: distillStats.avgRejected,
    },

    // 访问统计
    access: {
      totalMemories: accessStats.total,
      accessedMemories: accessStats.accessed,
      accessRate: accessStats.accessRate,
      avgAccessCount: accessStats.avgAccess,
      byKind: accessStats.byKind,
    },

    // 反馈统计
    feedback: {
      totalFeedback,
      positiveCount,
      negativeCount,
      positiveRate: totalFeedback > 0 ? positiveCount / totalFeedback : 0,
      negativeRate: totalFeedback > 0 ? negativeCount / totalFeedback : 0,
    },

    // 质量指标
    quality: {
      duplicateRate: distillStats.duplicateRate || 0,
      conflictRate: distillStats.conflictRate || 0,
      lowAccessRate: 1 - accessStats.accessRate,
    },

    // 建议
    recommendations: generateRecommendations(accessStats, feedback, distillStats),
  };

  return report;
}

function generateRecommendations(accessStats, feedback, distillStats) {
  const recommendations = [];

  // 低访问率
  if (accessStats.accessRate < 0.3) {
    recommendations.push({
      type: 'warning',
      message: `访问率过低 (${(accessStats.accessRate * 100).toFixed(1)}%)，考虑检查蒸馏质量`,
    });
  }

  // 高负反馈率
  const negativeRate = feedback.length > 0 ?
    feedback.filter(f => f.emojis.includes('negative')).length / feedback.length : 0;
  if (negativeRate > 0.2) {
    recommendations.push({
      type: 'warning',
      message: `负反馈率过高 (${(negativeRate * 100).toFixed(1)}%)，需要优化蒸馏规则`,
    });
  }

  // 高重复率
  if (distillStats.duplicateRate > 0.3) {
    recommendations.push({
      type: 'info',
      message: `重复率较高 (${(distillStats.duplicateRate * 100).toFixed(1)}%)，已通过查重机制过滤`,
    });
  }

  // 按类型分析
  for (const [kind, stats] of Object.entries(accessStats.byKind)) {
    if (stats.accessed > 0 && stats.avgAccess < 2) {
      recommendations.push({
        type: 'info',
        message: `${kind} 类型平均访问次数较低 (${stats.avgAccess.toFixed(1)})`,
      });
    }
  }

  return recommendations;
}

// 每周生成报告（周日 00:00）
sched.register({
  id: 'distillation-report',
  hour: 0, minute: 0, dayOfWeek: 0, tzOffsetHours: 8,
  run: async () => {
    const report = await generateDistillationReport();
    const reportText = formatReport(report);

    await discord.send(cfg.channels.system, reportText);
    await writeFileSync(
      join(dataDir, 'memory', 'reports', `report-${dateKey()}.json`),
      JSON.stringify(report, null, 2)
    );
  },
});
```

---

## 6. 实施清单

### Week 1: 基础实现
- [ ] 实现 `distillNow()` 核心函数
- [ ] 实现纯 LLM 蒸馏（最终版 Prompt）
- [ ] 实现重复检查（阈值 0.9）
- [ ] 实现冲突检查
- [ ] 实现验证流程

### Week 2: 混合时机
- [ ] 实现每日 23:30 定时蒸馏
- [ ] 实现实时触发条件
- [ ] 实现手动触发 `!distill` 命令
- [ ] 实现速率限制

### Week 3: 质量控制
- [ ] 实现访问率统计
- [ ] 实现 Emoji 反馈收集
- [ ] 实现定期效果报告
- [ ] 实现统计指标更新

### Week 4: 优化迭代
- [ ] 根据初期效果调整 Prompt
- [ ] 优化查重阈值
- [ ] 优化置信度阈值
- [ ] 添加更多 few-shot 示例

---

## 7. 配置文件

```json
{
  "distillation": {
    "schedule": {
      "enabled": true,
      "hour": 23,
      "minute": 30,
      "timezone": "Asia/Shanghai"
    },
    "realtime": {
      "enabled": true,
      "conditions": [
        {
          "name": "高频对话",
          "check": "last10Messages.candidates >= 3",
          "cooldown": 1800000
        },
        {
          "name": "重要对话",
          "check": "last5Messages.includesKeyword",
          "cooldown": 600000
        },
        {
          "name": "长时间对话",
          "check": "consecutiveMessages >= 20",
          "cooldown": 1800000
        }
      ]
    },
    "manual": {
      "command": "!distill",
      "rateLimit": {
        "maxPerHour": 3,
        "maxPerDay": 10
      }
    },
    "limits": {
      "maxCandidates": 5,
      "minJournalLength": 5,
      "similarityThreshold": 0.9
    },
    "thresholds": {
      "decision": 0.85,
      "constraint": 0.85,
      "preference": 0.8,
      "fact": 0.8,
      "build": 0.75,
      "reflection": 0.7,
      "definition": 0.75,
      "idea": 0.65
    }
  }
}
```

---

**文档版本**: 1.0
**最后更新**: 2024-07-19
**维护者**: zhangsan