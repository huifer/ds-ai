// ~/pi-discord-agents/src/memory-context.mjs
// 智能记忆上下文注入：在对话中智能地选择和注入相关记忆
//
// 核心功能：
//   - 多维度检索（关键词 + 语义 + 时序）
//   - 多样性重排（避免同类记忆过多）
//   - 访问热度加权
//   - 长度控制
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

// 需要注入上下文的记忆类型
export const PROMPT_INJECTION_KINDS = [
  'preference', 'fact', 'decision', 'constraint',
  'project', 'context', 'reflection', 'definition', 'build',
];

// 不需要注入上下文的记忆类型
const NO_INJECTION_KINDS = [
  'idea', 'todo',
];

// 关键词提取
function extractKeywords(text, { maxKeywords = 10, minLength = 2 } = {}) {
  if (!text) return [];

  // 简单的关键词提取（中文 + 英文）
  const words = text
    .toLowerCase()
    .split(/[\s,，。！？!?、；;：:()（）\[\]【】""''「」]/)
    .filter(w => w.length >= minLength)
    .filter(w => !/^[0-9]+$/.test(w))  // 排除纯数字
    .filter(w => !/^(是|的|了|在|有|不|和|与|或|但|这|那|个|对|把|让|被|可以|应该)$/.test(w));  // 排除停用词

  // 统计词频
  const freq = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }

  // 按词频排序
  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);

  return sorted;
}

// 多样性重排：避免同类记忆过多
function diversifyByKind(memories, { maxPerKind = 2, limit } = {}) {
  if (memories.length <= limit) return memories.slice(0, limit);

  const kindGroups = {};
  for (const memory of memories) {
    const kind = memory.kind;
    if (!kindGroups[kind]) kindGroups[kind] = [];
    kindGroups[kind].push(memory);
  }

  const selected = [];
  const usedKinds = new Set();

  // 每种 kind 最多 maxPerKind 条
  for (const memory of memories) {
    const kind = memory.kind;
    const count = usedKinds.has(kind) ? kindGroups[kind].filter(m => selected.includes(m)).length : 0;

    if (count < maxPerKind) {
      selected.push(memory);
      usedKinds.add(kind);

      if (selected.length >= limit) break;
    }
  }

  return selected.slice(0, limit);
}

// 时序过滤：优先最新的
function filterByRecency(memories, { days = 90 } = {}) {
  const cutoff = new Date(Date.now() - days * 86400_000);

  return memories
    .filter(m => {
      if (!m.updatedAt) return true;
      return new Date(m.updatedAt) >= cutoff;
    })
    .sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });
}

// 访问热度加权
function weightByAccess(memories) {
  const maxAccess = Math.max(...memories.map(m => m.accessCount || 0), 1);

  return memories.map(memory => ({
    ...memory,
    accessWeight: ((memory.accessCount || 0) / maxAccess) * 0.2,  // 最多加 0.2 分
  }));
}

// 长度控制：格式化记忆，避免上下文过长
function formatWithLimit(memories, { maxTokens = 2000, avgTokensPerMemory = 80 } = {}) {
  const lines = [];
  let currentTokens = 0;
  const maxMemories = Math.floor(maxTokens / avgTokensPerMemory);

  const selected = memories.slice(0, maxMemories);

  for (const memory of selected) {
    const tags = memory.tags && memory.tags.length ? ` · tags=${memory.tags.join(',')}` : '';
    const exp = memory.expiresAt ? ` · exp=${shortDate(memory.expiresAt)}` : '';
    const access = (memory.accessCount || 0) > 0 ? ` · acc=${memory.accessCount}` : '';

    const line = `- [${memory.kind}] ${memory.subject} — ${truncate(memory.content, 120)}${tags}${exp}${access}`;

    const estimatedTokens = Math.ceil(line.length / 4);  // 粗略估算

    if (currentTokens + estimatedTokens > maxTokens) {
      lines.push(`... 还有 ${selected.length - lines.length} 条记忆未显示`);
      break;
    }

    lines.push(line);
    currentTokens += estimatedTokens;
  }

  return lines.join('\n');
}

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function shortDate(d) {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

// ===== 核心函数：buildContext =====

export function createMemoryContext({ memoryStore, embedder, log = () => {}, dreamArtifacts = null } = {}) {
  // 记录访问
  async function recordAccess(memoryIds) {
    if (!Array.isArray(memoryIds)) memoryIds = [memoryIds];

    for (const id of memoryIds) {
      try {
        const meta = memoryStore.readMeta(id);
        if (!meta) continue;

        meta.accessCount = (meta.accessCount || 0) + 1;
        meta.lastAccessedAt = new Date().toISOString();

        // 增量更新（不触发 supersedede）
        await memoryStore.syncIndexOne({ ...meta });
      } catch (e) {
        log(`[memory-context] 记录访问失败: ${e.message}`);
      }
    }
  }

  // 构建上下文
  async function buildContext({ userText = '', conversationHistory = [], limit = 8 } = {}) {
    if (!userText) {
      log('[memory-context] userText 为空，跳过');
      return '';
    }

    log(`[memory-context] 构建上下文: "${userText.slice(0, 50)}..."`);

    // 1. 提取关键词
    const keywords = extractKeywords(userText);
    log(`[memory-context] 关键词: ${keywords.join(', ')}`);

    // 2. 多维度检索
    const queryText = keywords.length > 0 ? keywords.join(' ') : userText;
    const queryResult = await memoryStore.query({
      kinds: PROMPT_INJECTION_KINDS,
      contains: keywords.length > 0 ? undefined : queryText,
      limit: Math.max(20, limit * 4),  // 多召回
      mode: keywords.length > 0 ? 'hybrid' : 'recent',
    });

    log(`[memory-context] 检索结果: ${queryResult.items.length} 条`);

    if (queryResult.items.length === 0) {
      log('[memory-context] 无相关记忆');
      return '';
    }

    // 3. 多样性重排（避免同类记忆过多）
    const diversified = diversifyByKind(queryResult.items, {
      maxPerKind: 2,
      limit: limit * 3,
    });

    // 4. 时序过滤（优先最新的）
    const recent = filterByRecency(diversified, { days: 90 });
    log(`[memory-context] 时序过滤后: ${recent.length} 条`);

    // 5. 访问热度加权
    const weighted = weightByAccess(recent);
    // 综合排序：accessWeight + similarity (如果有)
    const sorted = weighted.sort((a, b) => {
      const scoreA = (a.accessWeight || 0) + (a.score || 0);
      const scoreB = (b.accessWeight || 0) + (b.score || 0);
      return scoreB - scoreA;
    });

    // 6. 最终选择
    const selected = sorted.slice(0, limit);
    const selectedIds = selected.map(m => m.id);

    // 7. 格式化注入
    const formatted = formatWithLimit(selected, {
      maxTokens: 2000,
      avgTokensPerMemory: 80,
    });

    const digest = `<memory-digest>\n${formatted}\n</memory-digest>`;

    // 9. PR4 反向只读打通:追加梦境洞察(不写入主记忆,只读)
    let dreamDigest = '';
    if (dreamArtifacts) {
      try {
        const allArts = [];
        for (const t of ['lian-zhu', 'gui-cang', 'ming-tai']) {
          try {
            const items = await dreamArtifacts.listMeta({ type: t, limit: 10 });
            allArts.push(...items);
          } catch {}
        }
        if (allArts.length) {
          // 按评分排序,取 top-3
          allArts.sort((a, b) => (b.scores?.total || 0) - (a.scores?.total || 0));
          const top3 = allArts.slice(0, 3);
          const dreamLines = top3.map(a =>
            `- [${a.subSource || a.type}] ${a.title || '?'} · 评分 ${(a.scores?.total || 0).toFixed(2)} · ${a.text ? a.text.slice(0, 150) : '(无正文)'}`
          );
          dreamDigest = `<dream-digest>\n${dreamLines.join('\n')}\n</dream-digest>`;
          log(`[memory-context] 注入 ${top3.length} 条梦境洞察(${dreamDigest.length} 字符)`);
        }
      } catch (e) {
        log(`[memory-context] 梦境检索失败(非致命): ${e.message}`);
      }
    }

    const full = digest + (dreamDigest ? '\n\n' + dreamDigest : '');

    // 8. 记录访问
    await recordAccess(selectedIds);

    log(`[memory-context] 注入 ${selected.length} 条记忆${dreamDigest ? ' +3 条梦境洞察' : ''}，${full.length} 字符`);

    return full;
  }

  // 批量查询（用于 LLM 工具）
  async function queryMemories({ query, kind, tags, limit = 10 } = {}) {
    const result = await memoryStore.query({
      kind,
      tags: tags ? [tags] : undefined,
      contains: query,
      limit,
      mode: query ? 'hybrid' : 'recent',
    });

    // 记录访问
    await recordAccess(result.items.map(m => m.id));

    return result;
  }

  return {
    buildContext,
    queryMemories,
    recordAccess,
    extractKeywords,
    setDreamArtifacts(a) { dreamArtifacts = a; },
  };
}
