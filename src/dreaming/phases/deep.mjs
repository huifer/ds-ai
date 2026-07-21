// ~/pi-discord-agents/src/dreaming/phases/deep.mjs
// Deep 阶段 — 评分 + 写产物 + 影子试用(PR3 真实现)。
//
// 5 信号评分(完整版):
//   - Novelty (0.30): 1 - max(cosine(artifact_text, all_active_memories))
//   - Coherence (0.25): REM 阶段 Pi 自评
//   - Utility (0.20): REM 阶段 Pi 自评
//   - Grounding (0.15): 验证 cited_memories 真实性 + 数量
//   - Surprise (0.10): Novelty × Utility(非线性加成)
//
// 影子试用(Shadow Trial):
//   - 对 top-N 候选(默认 3,可通过 cfg 改)
//   - 跑一次 LLM,让 Pi 在 baseline vs candidate-informed 之间做对比
//   - verdict: helpful / neutral / harmful
//   - 写到 artifact frontmatter 里(shadowVerdict 字段)
//   - 不影响 score(报告用,便于后续 PR4 投票回流)
//
// PR3 简化:
//   - 影子试用只跑 1 次 LLM,在同一个 prompt 里完成对比(不是两次独立调用)
//   - Novelty fallback:embedder 不可用时为 0.5(中性值,不奖励也不惩罚)

import { renderPrompt } from '../prompts.mjs';

const TOP_N_FOR_SHADOW = 3;

// ---- 评分权重(自主设计)----
const WEIGHTS = {
  novelty:    0.30,
  coherence:  0.25,
  utility:    0.20,
  grounding:  0.15,
  surprise:   0.10,
};

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round3(n) { return Math.round(n * 1000) / 1000; }

function pad2(n) { return String(n).padStart(2, '0'); }
function todayKey(tzOffsetHours = 8) {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const tzMs = utcMs + tzOffsetHours * 3600_000;
  const d = new Date(tzMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

// 强校验:每个 ID 必须在 memoryStore 里真实存在
async function validateCites(citedMemories, memoryStore) {
  if (!citedMemories || citedMemories.length === 0) return { ok: false, reason: 'no-grounding', valid: [] };
  if (!memoryStore) return { ok: false, reason: 'no-memory-store', valid: [] };

  const valid = [];
  for (const id of citedMemories) {
    try {
      const meta = await memoryStore.readMeta(id);
      if (meta && meta.status === 'active') valid.push(id);
    } catch {}
  }
  if (valid.length === 0) return { ok: false, reason: 'hallucinated-cite', valid: [] };
  return { ok: true, reason: null, valid };
}

// ---- Novelty:embedder 计算 ----

async function computeNovelty(text, embedder, memoryStore, log = () => {}) {
  // Fallback:embedder 或 memoryStore 不可用 → 0.5
  if (!embedder || !memoryStore || !text) return 0.5;
  try {
    const vec = await embedder.embed(text.slice(0, 4000));
    // 跟所有 active 主记忆比 cosine sim
    const all = await memoryStore.query({ mode: 'recent', limit: 200 });
    let maxSim = 0;
    for (const m of all.items || []) {
      const c = cosineSim(vec, m.embedding);
      if (c > maxSim) maxSim = c;
    }
    return clamp01(1 - maxSim);
  } catch (e) {
    log(`[deep] Novelty 计算失败(降级为 0.5): ${e.message}`);
    return 0.5;
  }
}

function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den > 0 ? dot / den : 0;
}

// ---- 影子试用(只对 top-N 跑一次)----

async function runShadowTrial({ candidates, dreamingPi, dreamId, type, log = () => {} }) {
  if (!dreamingPi || !candidates.length) return candidates.map((c) => ({
    id: c.id, shadowVerdict: 'skipped', shadowReason: dreamingPi ? 'no-candidates' : 'no-pi',
  }));

  // 拼 prompt:让 Pi 同时评估 N 个候选 vs baseline
  const trialPrompt = renderShadowPrompt({ candidates, type });

  let text;
  try {
    const res = await dreamingPi.dreamPrompt(trialPrompt, {
      dreamId: `${dreamId}-shadow`,
      dreamType: `${type}-shadow`,
      timeoutMs: 5 * 60 * 1000,
    });
    text = res.text;
  } catch (e) {
    log(`[deep] 影子试用 LLM 失败: ${e.message}`);
    return candidates.map((c) => ({ id: c.id, shadowVerdict: 'skipped', shadowReason: 'llm-failed' }));
  }

  // 解析:期望 {"verdicts": [{"id": "xiasi-xxx", "verdict": "helpful", "reason": "..."}]}
  const parsed = extractJson(text);
  if (!parsed || !Array.isArray(parsed.verdicts)) {
    log(`[deep] 影子试用产物解析失败,跳过`);
    return candidates.map((c) => ({ id: c.id, shadowVerdict: 'skipped', shadowReason: 'parse-failed' }));
  }

  const verdictMap = new Map(parsed.verdicts.map((v) => [v.id, v]));
  return candidates.map((c) => {
    const v = verdictMap.get(c.id);
    if (!v) return { id: c.id, shadowVerdict: 'skipped', shadowReason: 'not-in-verdict' };
    return {
      id: c.id,
      shadowVerdict: ['helpful', 'neutral', 'harmful'].includes(v.verdict) ? v.verdict : 'neutral',
      shadowReason: String(v.reason || '').slice(0, 200),
    };
  });
}

function renderShadowPrompt({ candidates, type }) {
  const list = candidates.map((c, i) =>
    `[${i + 1}] id=${c.id} | theme=${c.theme || '?'} | preview="${c.text.slice(0, 150)}"`
  ).join('\n');

  return `你是「遐思」影子试用评估员。你的工作是对比"用 vs 不用"候选洞察时,Pi 回答老张问题的质量差异。

# 背景

这是 ${type} 类型(遐思)的 top-N 候选洞察。
现在让你扮演老张,问一个典型问题,然后回答"如果 Pi 的回答能用到这个候选洞察,会不会更好?"

# 典型问题

"最近我应该关注什么?有没有什么跨主题的信号?"

# 候选洞察列表

${list}

# 你的任务

对每个候选,想象 Pi 在 baseline(不参考它) vs candidate-informed(参考它)两种情况下的回答质量。
给每个候选一个 verdict:

- **helpful**:参考这个洞察后,Pi 的回答明显更具体 / 更连接 / 更有行动建议
- **neutral**:基本没差别,或两边都好/都差
- **harmful**:参考这个洞察反而让 Pi 的回答跑偏 / 产生幻觉 / 引入错误联想

只输出 JSON,不要任何额外解释:

\`\`\`json
{
  "verdicts": [
    {"id": "xiasi-xxx", "verdict": "helpful", "reason": "把 X 和 Y 连接起来了,baseline 答不到这个深度。"}
  ]
}
\`\`\`

# 边界条件

- 不要给所有都打 helpful — 那样没意义,只对真正差异大的给 helpful。
- reason 用中文,≤80 字,具体说差异在哪。
- 如果想不出明显差异,给 neutral。`;
}

function extractJson(text) {
  const trimmed = String(text || '').trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try { return JSON.parse(trimmed); } catch {}
  }
  const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch {} }
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s >= 0 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch {} }
  return null;
}

// ---- Body 渲染 ----

function buildBody({ meta, citedSummaries, remArtifact, shadow }) {
  const lines = [];
  lines.push(`# ${meta.title || '遐思产物'}`);
  lines.push('');
  if (citedSummaries.length) {
    lines.push('## 引用来源');
    for (const c of citedSummaries) {
      lines.push(`- **${c.id}** (${c.kind}) ${c.subject}: ${c.content.slice(0, 120)}${c.content.length > 120 ? '…' : ''}`);
    }
    lines.push('');
  }
  lines.push('## 洞察');
  lines.push('');
  lines.push(remArtifact.text);
  lines.push('');
  if (remArtifact.supersedes?.length) {
    lines.push(`## supersedes\n本条抽象了:${remArtifact.supersedes.join(', ')}\n`);
  }
  if (shadow && shadow.shadowVerdict && shadow.shadowVerdict !== 'skipped') {
    const icon = shadow.shadowVerdict === 'helpful' ? '✓' :
                 shadow.shadowVerdict === 'harmful' ? '✗' : '·';
    lines.push(`## 影子试用 ${icon} ${shadow.shadowVerdict}`);
    if (shadow.shadowReason) lines.push(`> ${shadow.shadowReason}`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  const s = meta.scores;
  lines.push(
    `**评分:** 新颖 ${s.novelty} · 连贯 ${s.coherence} · 实用 ${s.utility} · 扎根 ${s.grounding} · ✨惊喜 ${s.surprise} · **总分 ${s.total}**`
  );
  lines.push(`**类型:** ${meta.subSource} · **主题:** ${meta.theme || '_(无)_'}`);
  lines.push(`**生成时间:** ${meta.createdAt}`);
  return lines.join('\n');
}

function buildMeta({
  id, type, theme,
  remArtifact,
  novelty, coherence, utility, grounding, surprise, total,
  citedValid,
  shadow = null,
}) {
  return {
    id,
    type,
    theme: remArtifact.theme || theme || null,
    title: remArtifact.title || extractTitle(remArtifact.text) || null,
    createdAt: new Date().toISOString(),
    source: 'xiasi',
    subSource: type,
    selfCoherence: remArtifact.selfCoherence,
    selfUtility: remArtifact.selfUtility,
    citedMemories: remArtifact.citedMemories,
    supersedes: remArtifact.supersedes || [],
    citedValid,
    scores: {
      novelty: round3(novelty),
      coherence: round3(coherence),
      utility: round3(utility),
      grounding: round3(grounding),
      surprise: round3(surprise),
      total: round3(total),
    },
    weights: WEIGHTS,
    llmCalls: (remArtifact._llmCalls || 1) + (shadow ? 1 : 0),
    shadowVerdict: shadow?.shadowVerdict || null,
    shadowReason: shadow?.shadowReason || null,
    dreamId: id,
  };
}

function extractTitle(text) {
  if (!text) return null;
  // 取第一行(可能是 markdown # 标题)
  const first = text.split('\n').find(l => l.trim());
  if (!first) return null;
  return first.replace(/^#+\s*/, '').trim().slice(0, 80) || null;
}

// ---- 主入口 ----

export async function run({
  type,
  remArtifacts,
  dreamingPi,
  loadPrompt,    // PR3 保留接口(未来用),暂未使用
  budget,        // PR3 保留接口
  artifacts,
  memoryStore,
  embedder,
  xc,
  log = () => {},
  id,
} = {}) {
  log(`[deep:${type}] 输入 ${remArtifacts.length} 个候选`);

  if (!remArtifacts.length) {
    return { scored: [], kept: [], shadowed: [] };
  }

  const scored = [];
  const kept = [];
  const today = todayKey(xc.tzOffsetHours || 8);
  let seq = 0;

  // ---- 1. 先做 grounding 校验 + 算 5 信号 ----
  for (const rem of remArtifacts) {
    seq += 1;
    const artifactId = `${id}-${pad2(seq)}`;

    const validation = await validateCites(rem.citedMemories, memoryStore);
    const grounding = validation.ok ? Math.min(1, validation.valid.length / 2) : 0;

    const coherence = clamp01(rem.selfCoherence);
    const utility   = clamp01(rem.selfUtility);

    // Novelty(emb 计算)
    const novelty = validation.ok ? await computeNovelty(rem.text, embedder, memoryStore, log) : 0;

    // Surprise = Novelty × Utility(非线性,两者都高才能拿分)
    const surprise = novelty * utility;

    const total = (WEIGHTS.novelty   * novelty) +
                  (WEIGHTS.coherence * coherence) +
                  (WEIGHTS.utility   * utility) +
                  (WEIGHTS.grounding * grounding) +
                  (WEIGHTS.surprise  * surprise);

    scored.push({
      id: artifactId,
      novelty, coherence, utility, grounding, surprise, total,
      valid: validation.ok,
      reason: validation.reason,
    });
  }

  // 按 total 排序
  scored.sort((a, b) => b.total - a.total);

  // ---- 2. 影子试用:top-N ----
  const topN = scored.filter(s => s.valid).slice(0, TOP_N_FOR_SHADOW);
  const topNIds = new Set(topN.map(s => s.id));
  const shadowResults = await runShadowTrial({
    candidates: topN.map(s => {
      const rem = remArtifacts.find(r => s.id.endsWith(`-${pad2((r._idx ?? remArtifacts.indexOf(r)) + 1)}`));
      return {
        id: s.id,
        theme: rem?.theme || null,
        text: rem?.text || '',
      };
    }),
    dreamingPi,
    dreamId: id,
    type,
    log,
  });
  const shadowMap = new Map(shadowResults.map(r => [r.id, r]));
  log(`[deep:${type}] 影子试用:${shadowResults.length} 个 verdict`);

  // ---- 3. 写产物(只对 valid 的)----
  for (const s of scored) {
    if (!s.valid) {
      log(`[deep:${type}] 丢弃 ${s.id} reason=${s.reason}`);
      continue;
    }

    // 找到对应的 rem(优先 _idx 匹配,否则按序数)
    const seqNum = parseInt(s.id.split('-').pop(), 10);
    const rem = remArtifacts.find(r => r._idx === seqNum - 1) || remArtifacts[seqNum - 1];
    if (!rem) continue;

    // 拉引用记忆摘要
    const validCites = (await validateCites(rem.citedMemories, memoryStore)).valid;
    const citedSummaries = [];
    for (const cid of validCites) {
      try {
        const m = await memoryStore.readMeta(cid);
        if (m) citedSummaries.push({ id: cid, kind: m.kind, subject: m.subject, content: m.content || '' });
      } catch {}
    }

    const shadow = topNIds.has(s.id) ? shadowMap.get(s.id) : null;

    const meta = buildMeta({
      id: s.id, type, theme: null, remArtifact: rem,
      novelty: s.novelty, coherence: s.coherence, utility: s.utility,
      grounding: s.grounding, surprise: s.surprise, total: s.total,
      citedValid: validCites, shadow,
    });

    const body = buildBody({ meta, citedSummaries, remArtifact: rem, shadow });

    try {
      await artifacts.create({ type, meta, body });
      kept.push({ id: s.id, type, meta, body });
      const verdictTag = shadow ? ` shadow=${shadow.shadowVerdict}` : '';
      log(`[deep:${type}] ✓ ${s.id} score=${s.total.toFixed(3)}${verdictTag}`);
    } catch (e) {
      log(`[deep:${type}] 写产物失败 ${s.id}: ${e.message}`);
    }
  }

  kept.sort((a, b) => (b.meta?.scores?.total || 0) - (a.meta?.scores?.total || 0));

  log(`[deep:${type}] scored=${scored.length} kept=${kept.length} shadowed=${shadowResults.length}`);

  return { scored, kept, shadowed: shadowResults };
}