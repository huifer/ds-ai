// ~/pi-discord-agents/src/memory-distiller.mjs
// 纯 LLM 记忆蒸馏器:从对话中提取值得永久记住的信息
//
// 设计要点:
//   - 纯 LLM 策略,不用规则引擎
//   - 每次最多提取 5 条
//   - 严格的重复检查(相似度阈值 0.9)
//   - 质量优先,宁缺毋滥
//
// 触发时机:
//   - 每天 23:30 定时蒸馏
//   - 手动触发 !distill 命令
//   - (未来)高频对话实时触发
//
// 流程:
//   1. 收集当日 journal
//   2. 获取现有记忆列表(用于查重)
//   3. LLM 分析 + 提取候选
//   4. 严格验证(重复/冲突/格式/置信度)
//   5. 批量 upsert
//   6. 发送总结到 #记忆库
import { join, dirname } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const MEMORY_KINDS = [
  'preference', 'fact', 'decision', 'constraint',
  'project', 'context', 'todo', 'reflection', 'definition',
  'idea', 'build',
];

// 置信度阈值
const CONFIDENCE_THRESHOLDS = {
  decision: 0.85,
  constraint: 0.85,
  preference: 0.8,
  fact: 0.8,
  build: 0.75,
  reflection: 0.7,
  definition: 0.75,
  idea: 0.65,
  context: 0.7,
  project: 0.7,
  todo: 0.7,
};

// 相似度阈值
const SIMILARITY_THRESHOLD = 0.9;
const TEXT_SIMILARITY_THRESHOLD = 0.85;

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
2. **语义重复**：表达相同意思
3. **冲突重复**：相同主题但观点矛盾

## 📦 现有记忆（必须检查重复）
\`\`\`
{{EXISTING_MEMORIES}}
\`\`\`

## 📝 今日对话流
\`\`\`
{{TRANSCRIPT}}
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

export function createMemoryDistiller({ memoryStore, journal, embedder, discord, cfg, log = () => {} } = {}) {
  // === 辅助函数 ===

  function cosineSimilarity(vec1, vec2) {
    let dot = 0, norm1 = 0, norm2 = 0;
    for (let i = 0; i < Math.min(vec1.length, vec2.length); i++) {
      dot += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    return dot / (Math.sqrt(norm1) * Math.sqrt(norm2) + 1e-12);
  }

  function textSimilarity(text1, text2) {
    const set1 = new Set(text1.toLowerCase().split(/\s+/));
    const set2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  // === 重复检查 ===

  async function checkDuplicateStrict(candidate, existingMemories) {
    // 1. 完全相同 subject + kind
    const exactMatch = existingMemories.find(m =>
      m.subject === candidate.subject &&
      m.kind === candidate.kind &&
      m.status === 'active'
    );

    if (exactMatch) {
      // 检查内容是否相同
      if (exactMatch.content === candidate.content) {
        return {
          isDuplicate: true,
          type: 'exact',
          existingId: exactMatch.id,
          existingContent: exactMatch.content,
          reason: `已有完全相同的 [${exactMatch.kind}] ${exactMatch.subject}`,
        };
      } else {
        // 相同 subject + kind 但内容不同 → 不是重复，需要更新
        return {
          isDuplicate: false,
          needsUpdate: true,
          existingId: exactMatch.id,
          existingContent: exactMatch.content,
          newContent: candidate.content,
        };
      }
    }

    // 2. 语义相似度
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

    // 3. 文本相似度
    const textSimilar = existingMemories
      .filter(m => m.status === 'active')
      .map(m => ({
        memory: m,
        similarity: textSimilarity(candidate.content, m.content),
      }))
      .filter(s => s.similarity >= TEXT_SIMILARITY_THRESHOLD)
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

  // === 冲突检查 ===

  async function checkConflict(candidate, existingMemories) {
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

  // === 验证候选 ===

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
    const threshold = CONFIDENCE_THRESHOLDS[candidate.kind] || 0.7;
    if (candidate.confidence < threshold) {
      return {
        valid: false,
        reason: `置信度过低 (${candidate.confidence.toFixed(2)} < ${threshold})`,
      };
    }

    return { valid: true };
  }

  // === LLM 蒸馏 ===

  async function distillWithPureLLM({ transcript, existingMemories, pi }) {
    const existingMemoriesText = existingMemories
      .map(m => `- [${m.kind}] ${m.subject}: ${m.content.slice(0, 60)}${m.content.length > 60 ? '...' : ''}`)
      .join('\n');

    const prompt = DISTILL_PROMPT
      .replace('{{EXISTING_MEMORIES}}', existingMemoriesText || '(无现有记忆)')
      .replace('{{TRANSCRIPT}}', transcript);

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

  let optsPi = null;

  // === 核心蒸馏函数 ===

  async function distillNow({ reason = 'scheduled', dateKeyStr = null, pi = null } = {}) {
    const day = dateKeyStr || new Date().toISOString().slice(0, 10);

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
      limit: 50,
    });
    const existingMemories = existingQuery.items;
    log(`[distiller] 现有记忆: ${existingMemories.length} 条`);

    // === 3. LLM 蒸馏 ===
    if (!pi) {
      log(`[distiller] 缺少 pi 实例，跳过`);
      return { ok: false, count: 0, reason: 'no pi instance' };
    }
    log(`[distiller] 调用 LLM 蒸馏...`);
    const candidates = await distillWithPureLLM({
      transcript,
      existingMemories,
      pi,
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

    // 再次限制数量
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

    // === 8. 发送总结 ===
    if (results.length > 0 && discord && cfg?.channels?.memory) {
      const summary = buildSummary(results, rejected, reason);
      try {
        await discord.send(cfg.channels.memory, summary);
        log(`[distiller] 总结已发送到 #记忆库`);
      } catch (e) {
        log(`[distiller] 发送总结失败: ${e.message}`);
      }
    }

    return {
      ok: true,
      count: results.length,
      results,
      rejected,
      day,
      reason,
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

  // 兼容旧的 distillDay 接口
  async function distillDay(dateKeyStr = null, opts = {}) {
    if (opts.onDistill) {
      const day = dateKeyStr || new Date().toISOString().slice(0, 10);
      const transcript = journal.feedForDistillation(day);
      return { ok: true, day, transcript, count: 0, mode: 'dry-run' };
    }

    return distillNow({ reason: 'scheduled', dateKeyStr, pi: opts.pi });
  }

  function setPi(piInstance) {
    optsPi = piInstance;
  }

  function getPi() {
    return optsPi;
  }

  return {
    distillNow,
    distillDay,
    setPi,
    getPi,
  };
}
