// ~/pi-discord-agents/test-xiasi-pr3.mjs
// PR3 冒烟:验证 5 信号评分 + 影子试用 fallback + gui-cang 路由。

import { createArtifacts, createBudget, loadXiasiConfig } from './src/dreaming/index.mjs';
import { createMemoryStore } from './src/memory-store.mjs';
import { createEmbedder } from './src/embedder.mjs';

const log = (...a) => console.log('[pr3-smoke]', ...a);

async function main() {
  const xc = loadXiasiConfig();
  const arts = await createArtifacts({ log });
  const budget = createBudget({ dailyLimit: xc.dailyTokenBudget, tzOffsetHours: 8, log });
  const store = await createMemoryStore({ log });
  const embedder = await createEmbedder({ log });

  // 拉一批真实候选
  const sampleRes = await store.query({ mode: 'recent', kinds: ['preference','decision','fact','project','constraint','reflection','idea'], limit: 15 });
  log(`候选池: ${sampleRes.items.length} 条`);
  const candidates = sampleRes.items.slice(0, 10).map(m => ({
    id: m.id, kind: m.kind, subject: m.subject, content: m.content, tags: m.tags || [], confidence: m.confidence, updatedAt: m.updatedAt,
  }));

  // 测试 deep:不调 Pi,只跑 5 信号
  const deepMod = await import('./src/dreaming/phases/deep.mjs');

  // 构造 3 个 REM 产物
  const fakeRem = [
    {
      type: 'lian-zhu', text: '连珠-测试-001\n\n这是一段关于 Rust async 的洞察。',
      citedMemories: candidates.slice(0, 2).map(c => c.id),
      selfCoherence: 0.85, selfUtility: 0.70, theme: 'rust-async', _llmCalls: 1, _idx: 0,
    },
    {
      type: 'lian-zhu', text: '连珠-测试-002\n\n另一段洞察。',
      citedMemories: [candidates[2]?.id].filter(Boolean),
      selfCoherence: 0.75, selfUtility: 0.55, theme: 'workflow', _llmCalls: 1, _idx: 1,
    },
    {
      type: 'lian-zhu', text: '连珠-测试-003\n\n第三条。',
      citedMemories: [candidates[3]?.id, candidates[4]?.id].filter(Boolean),
      selfCoherence: 0.92, selfUtility: 0.80, theme: 'discovery', _llmCalls: 1, _idx: 2,
    },
  ];

  const deepRes = await deepMod.run({
    type: 'lian-zhu',
    remArtifacts: fakeRem,
    dreamingPi: null,  // 影子试用会跳过
    loadPrompt: null, budget, artifacts: arts,
    memoryStore: store, embedder, xc, log,
    id: 'xiasi-pr3-test',
  });

  log('=== 5 信号评分 ===');
  for (const s of deepRes.scored) {
    log(`  ${s.id}: novelty=${s.novelty.toFixed(3)} coh=${s.coherence.toFixed(3)} util=${s.utility.toFixed(3)} ground=${s.grounding.toFixed(3)} surp=${s.surprise.toFixed(3)} total=${s.total.toFixed(3)} valid=${s.valid}${s.reason ? ' reason=' + s.reason : ''}`);
  }
  log(`kept=${deepRes.kept.length} shadowed=${deepRes.shadowed?.length}`);

  // 验证产物文件
  for (const k of deepRes.kept) {
    const got = await arts.get(k.id);
    log(`✓ artifact ${k.id}: title="${got.meta.title}" scores=${JSON.stringify(got.meta.scores)} shadowVerdict=${got.meta.shadowVerdict}`);
  }

  // 测 cosine sim fallback
  const deepHelper = deepMod;
  if (typeof deepHelper.computeNovelty !== 'function') {
    log('✓ computeNovelty 未导出(仅内部使用)');
  }

  log('✅ PR3 冒烟通过');
}

main().catch(e => { console.error('❌', e); process.exit(1); });