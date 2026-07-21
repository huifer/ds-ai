// ~/pi-discord-agents/src/dreaming/phases/rem.mjs
// REM 阶段 — 让 Pi 在 Light 阶段候选上做主题反思(PR2 真实现)。
//
// 职责:
//   1. 按 type 选 prompt 模板(本 PR 只支持 lian-zhu)
//   2. 拼装 REM prompt,注入 lightCtx 数据
//   3. 调 dreamingPi.dreamPrompt(),拿回产物文本
//   4. 从产物里提取 JSON,规范化成 remArtifacts[]
//
// PR2 简化:
//   - 单次 LLM 调用(不开 followUp 链)
//   - 不做影子试用(留给 PR3)
//   - 只支持 lian-zhu(其他 type PR3+ 加)
//
// 输出元素 schema:
//   {
//     text: string,             // 洞察正文(2-4 段)
//     citedMemories: string[],  // 引用的记忆 ID
//     selfCoherence: number,    // Pi 自评 0-1
//     selfUtility: number,      // Pi 自评 0-1
//     theme: string,            // 主题(可选)
//     type: string,
//     _llmCalls: number,
//   }

import { renderPrompt } from '../prompts.mjs';

function extractJson(text) {
  // 尝试多种策略提取 JSON
  // 1. 整段是 JSON 数组
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try { return JSON.parse(trimmed); } catch {}
  }
  // 2. ```json ... ``` 围栏
  const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch {}
  }
  // 3. 找第一个 [ ... ] 完整数组
  const arrStart = text.indexOf('[');
  const arrEnd   = text.lastIndexOf(']');
  if (arrStart >= 0 && arrEnd > arrStart) {
    try { return JSON.parse(text.slice(arrStart, arrEnd + 1)); } catch {}
  }
  // 4. 找第一个 { ... } 完整对象
  const objStart = text.indexOf('{');
  const objEnd   = text.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) {
    try { return JSON.parse(text.slice(objStart, objEnd + 1)); } catch {}
  }
  return null;
}

export async function run({
  type,
  theme,
  lightCtx,
  dreamingPi,
  loadPrompt,
  budget,
  perDreamLLMCalls,
  xc,
  log = () => {},
  id,
} = {}) {
  // ---- 边界条件 ----
  if (!lightCtx?.hasCandidates) {
    log(`[rem:${type}] 跳过 — 无候选记忆`);
    return [];
  }
  if (!lightCtx?.candidates?.length) {
    log(`[rem:${type}] 跳过 — 候选数组空`);
    return [];
  }
  // type 路由
  const SUPPORTED = ['lian-zhu', 'ming-tai', 'gui-cang'];
  if (!SUPPORTED.includes(type)) {
    log(`[rem:${type}] PR3 暂不支持 ${type} (支持: ${SUPPORTED.join(', ')})`);
    return [];
  }

  // ---- 选 prompt 文件 ----
  const promptFile = `rem-${type === 'ming-tai' ? 'ming-tai' : type === 'gui-cang' ? 'gui-cang' : 'lian-zhu'}`;
  const template = await loadPrompt(promptFile + '.txt');

  // ---- 拼装 prompt ----
  // 候选清单(简化:只给 id + subject + content 截断)
  const candidatesBlock = lightCtx.candidates
    .slice(0, 20)
    .map((c, i) => `[${i + 1}] id=${c.id} | kind=${c.kind} | subject=${c.subject}\n${c.content?.slice(0, 250) || ''}`)
    .join('\n\n');

  const recentDreams = (await import('../artifacts.mjs'))
    .createArtifacts ? null : null; // 暂不依赖,简化

  const vars = {
    TYPE_CN: type === 'ming-tai' ? '明台' : '连珠',
    MOOD: lightCtx.mood?.mood || 'neutral',
    MOOD_DESC: JSON.stringify(lightCtx.mood || {}),
    JOURNAL_TEXT: lightCtx.journalText || '_(本周暂无对话)_',
    CANDIDATES_BLOCK: candidatesBlock,
    CANDIDATE_COUNT: String(lightCtx.candidates.length),
    THEME: theme || '_(自主选)_',
  };

  const prompt = renderPrompt(template, vars);

  log(`[rem:${type}] prompt 长度 ${prompt.length},候选 ${lightCtx.candidates.length}`);

  // ---- 调 Pi ----
  let dreamRes;
  try {
    dreamRes = await dreamingPi.dreamPrompt(prompt, {
      dreamId: id,
      dreamType: type,
      timeoutMs: 8 * 60 * 1000, // 8 分钟,留余量给 deep
    });
  } catch (e) {
    log(`[rem:${type}] dreamingPi 调用失败: ${e.message}`);
    throw e;
  }

  // ---- 记账 token ----
  const u = dreamRes.usage || {};
  const tokensIn  = u.input_tokens  || u.inputTokens  || u.tokensIn  || 0;
  const tokensOut = u.output_tokens || u.outputTokens || u.tokensOut || 0;
  if (budget && tokensIn + tokensOut > 0) {
    try { await budget.record({ tokensIn, tokensOut }); } catch {}
  }
  log(`[rem:${type}] tokens in=${tokensIn} out=${tokensOut} text=${dreamRes.text.length}`);

  // ---- 解析产物 ----
  const parsed = extractJson(dreamRes.text);
  if (!parsed) {
    log(`[rem:${type}] 产物无法解析为 JSON,原样记录`);
    return [{
      type,
      text: dreamRes.text.slice(0, 4000),
      citedMemories: [],
      selfCoherence: 0,
      selfUtility: 0,
      theme: null,
      _llmCalls: 1,
      _parseError: true,
    }];
  }

  // ---- 规范化 ----
  // 接受 { insights: [...] } 或  [...] 直接数组
  const rawList = Array.isArray(parsed) ? parsed : (parsed.insights || []);
  if (!Array.isArray(rawList)) {
    log(`[rem:${type}] 产物 JSON 不是数组,fallback`);
    return [];
  }

  const artifacts = rawList
    .filter((it) => it && typeof it === 'object')
    .map((it, idx) => {
      const cited = Array.isArray(it.citedMemories)
        ? it.citedMemories.filter(s => typeof s === 'string')
        : [];
      const supersedes = Array.isArray(it.supersedes)
        ? it.supersedes.filter(s => typeof s === 'string')
        : [];
      const text = String(it.text || it.insight || it.content || '').slice(0, 4000);
      return {
        type,
        text,
        citedMemories: cited,
        supersedes,
        selfCoherence: clamp01(it.selfCoherence ?? it.coherence ?? 0),
        selfUtility:   clamp01(it.selfUtility   ?? it.utility   ?? 0),
        theme: typeof it.theme === 'string' ? it.theme.slice(0, 80) : null,
        _llmCalls: 1,
        _idx: idx,
      };
    })
    .filter((a) => a.text.length > 0);

  log(`[rem:${type}] 解析出 ${artifacts.length} 个候选`);
  return artifacts;
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}