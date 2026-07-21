// ~/pi-discord-agents/src/dreaming/phases/yu-yan.mjs
// yu-yan 预言阶段 — 反事实推理和情景模拟
//
// 职责:
//   1. 从候选记忆中提取关键决策
//   2. 生成反事实推理
//   3. 模拟未来情景
//   4. 识别潜在风险
//   5. 输出结构化的预言报告
//
// 三类预言:
//   1. 反事实推理 — 从过去学习
//   2. 情景模拟 — 预判未来
//   3. 风险预测 — 识别威胁

import { renderPrompt } from '../prompts.mjs';

/**
 * 从候选中提取决策类记忆
 */
function extractDecisions(candidates) {
  return candidates.filter(c =>
    c.kind === 'decision' ||
    c.kind === 'fact' ||
    c.tags?.includes('decision')
  );
}

/**
 * 从文本中提取 JSON
 */
function extractJson(text) {
  const trimmed = String(text || '').trim();
  
  // 直接是 JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try { return JSON.parse(trimmed); } catch {}
  }
  
  // ```json ... ```
  const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch {}
  }
  
  // 找第一个 { ... }
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s >= 0 && e > s) {
    try { return JSON.parse(text.slice(s, e + 1)); } catch {}
  }
  
  return null;
}

/**
 * 构建 yu-yan prompt
 */
function buildPrompt(lightCtx, type) {
  // 决策候选
  const decisionCandidates = extractDecisions(lightCtx.candidates);
  const candidatesBlock = (decisionCandidates.length > 0 ? decisionCandidates : lightCtx.candidates)
    .slice(0, 15)
    .map((c, i) => `[${i + 1}] id=${c.id} | kind=${c.kind} | ${c.subject}\n${(c.content || '').slice(0, 200)}`)
    .join('\n\n');

  const vars = {
    MOOD: lightCtx.mood?.mood || 'neutral',
    MOOD_DESC: JSON.stringify(lightCtx.mood || {}),
    JOURNAL_TEXT: lightCtx.journalText || '_(近期暂无对话)_',
    CANDIDATES_BLOCK: candidatesBlock,
    CANDIDATE_COUNT: String(lightCtx.candidates.length),
  };

  return renderPrompt('rem-yu-yan', vars);
}

/**
 * 将预言 JSON 转换为 artifact 格式
 */
function transformToArtifacts(parsed, type) {
  const artifacts = [];

  // 反事实推理
  if (parsed.counterfactuals && Array.isArray(parsed.counterfactuals)) {
    for (const cf of parsed.counterfactuals) {
      artifacts.push({
        type,
        text: formatCounterfactual(cf),
        citedMemories: cf.citedMemories || [],
        selfCoherence: 0.8,
        selfUtility: 0.75,
        selfPositivity: 0.6,  // 预防性洞察可能偏中性
        theme: `反事实:${cf.decision?.slice(0, 30) || 'unknown'}`,
        _subType: 'counterfactual',
      });
    }
  }

  // 情景模拟
  if (parsed.scenarios && Array.isArray(parsed.scenarios)) {
    for (const sc of parsed.scenarios) {
      artifacts.push({
        type,
        text: formatScenario(sc),
        citedMemories: sc.citedMemories || [],
        selfCoherence: 0.75,
        selfUtility: 0.70,
        selfPositivity: sc.opportunity ? 0.65 : 0.5,
        theme: `情景:${sc.trigger?.slice(0, 30) || 'unknown'}`,
        _subType: 'scenario',
      });
    }
  }

  // 风险预测
  if (parsed.risks && Array.isArray(parsed.risks)) {
    for (const risk of parsed.risks) {
      artifacts.push({
        type,
        text: formatRisk(risk),
        citedMemories: risk.citedMemories || [],
        selfCoherence: 0.85,
        selfUtility: risk.mitigation ? 0.75 : 0.5,
        selfPositivity: risk.mitigation ? 0.55 : 0.4,
        theme: `风险:${risk.description?.slice(0, 30) || 'unknown'}`,
        _subType: 'risk',
        _riskData: risk,
      });
    }
  }

  return artifacts;
}

/**
 * 格式化反事实推理
 */
function formatCounterfactual(cf) {
  const lines = [];
  lines.push(`## 反事实推理：${cf.decision || '未知决策'}`);
  lines.push('');
  lines.push(`**另一种选择：** ${cf.alternative || '未知'}`);
  lines.push('');
  lines.push(`**可能结果：**`);
  lines.push(cf.outcome || '（无法推演）');
  lines.push('');
  if (cf.lesson) {
    lines.push(`**教训：** ${cf.lesson}`);
  }
  return lines.join('\n');
}

/**
 * 格式化情景模拟
 */
function formatScenario(sc) {
  const lines = [];
  lines.push(`## 情景模拟：${sc.trigger || '未知事件'}`);
  lines.push('');
  lines.push(`**时间跨度：** ${sc.timeline || 'medium'}`);
  lines.push('');
  lines.push(`**影响：**`);
  lines.push(sc.impact || '（无法评估）');
  lines.push('');
  if (sc.opportunity) {
    lines.push(`**隐藏机会：** ${sc.opportunity}`);
  }
  return lines.join('\n');
}

/**
 * 格式化风险预测
 */
function formatRisk(risk) {
  const lines = [];
  lines.push(`## 风险预测：${risk.description || '未知风险'}`);
  lines.push('');
  lines.push(`**概率：** ${risk.probability || 'unknown'} | **影响：** ${risk.impact || 'unknown'}`);
  lines.push('');
  if (risk.mitigation) {
    lines.push(`**缓解措施：** ${risk.mitigation}`);
  }
  return lines.join('\n');
}

/**
 * 运行 yu-yan 预言
 */
export async function run({
  type,
  lightCtx,
  dreamingPi,
  loadPrompt,
  budget,
  xc,
  log = () => {},
  id,
} = {}) {
  // 检查类型
  if (type !== 'yu-yan') {
    log(`[yu-yan] 跳过 — 类型不匹配: ${type}`);
    return [];
  }

  // 检查候选
  if (!lightCtx?.candidates?.length) {
    log(`[yu-yan] 跳过 — 无候选`);
    return [];
  }

  log(`[yu-yan] 开始预言分析，候选数: ${lightCtx.candidates.length}`);

  // 构建 prompt
  const prompt = buildPrompt(lightCtx, type);
  log(`[yu-yan] prompt 长度: ${prompt.length}`);

  // 调用 Pi
  let dreamRes;
  try {
    dreamRes = await dreamingPi.dreamPrompt(prompt, {
      dreamId: id,
      dreamType: type,
      timeoutMs: 10 * 60 * 1000,  // 10 分钟
    });
  } catch (e) {
    log(`[yu-yan] 调用失败: ${e.message}`);
    throw e;
  }

  // 记账 token
  const u = dreamRes.usage || {};
  const tokensIn = u.input_tokens || u.inputTokens || u.tokensIn || 0;
  const tokensOut = u.output_tokens || u.outputTokens || u.tokensOut || 0;
  if (budget && tokensIn + tokensOut > 0) {
    try { await budget.record({ tokensIn, tokensOut }); } catch {}
  }
  log(`[yu-yan] tokens: in=${tokensIn} out=${tokensOut}`);

  // 解析
  const parsed = extractJson(dreamRes.text);
  if (!parsed) {
    log(`[yu-yan] 产物无法解析为 JSON`);
    return [{
      type,
      text: dreamRes.text.slice(0, 3000),
      citedMemories: [],
      selfCoherence: 0,
      selfUtility: 0,
      selfPositivity: 0,
      theme: 'parse-error',
      _parseError: true,
      _llmCalls: 1,
    }];
  }

  // 转换
  const artifacts = transformToArtifacts(parsed, type);
  log(`[yu-yan] 生成 ${artifacts.length} 条预言`);

  // 添加元数据
  return artifacts.map((a, idx) => ({
    ...a,
    _llmCalls: 1,
    _idx: idx,
  }));
}
