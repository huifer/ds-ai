// ~/pi-discord-agents/test-xiasi-pr2.mjs
// PR2 冒烟:不调 Pi,只验证 light + deep 阶段(占位 rem 返回空)。
// 验证候选采样、情绪扫描、deep 校验、写产物都通。

import { createArtifacts, createBudget, loadXiasiConfig } from './src/dreaming/index.mjs';
import { createDreamer } from './src/dreaming/dreamer.mjs';
import { createMemoryStore } from './src/memory-store.mjs';

function log(...a) { console.log('[pr2-smoke]', ...a); }

async function main() {
  process.env.XIASI_ENABLED = 'true';
  process.env.CH_XIASI = '1528406524857159791';

  const xc = loadXiasiConfig();
  const budget = createBudget({ dailyLimit: xc.dailyTokenBudget, tzOffsetHours: 8, log });
  const arts = await createArtifacts({ log });

  // 拿真实 memoryStore
  const store = await createMemoryStore({ log });
  const stats = store.stats ? store.stats() : null;
  log(`memoryStore: ready · ${stats ? JSON.stringify(stats) : '(no stats)'}`);

  // Mock journal
  const mockJournal = {
    listDays: (n) => Array.from({ length: n }, (_, i) => ({ date: '2026-07-' + (19 - i) })),
    readDay: (date) => {
      if (date === '2026-07-19') return [
        { type: 'user_message', ts: '2026-07-19T10:00:00Z', content: '今天搞定了 async trait,有点累 😩 但还算顺利' },
        { type: 'user_message', ts: '2026-07-19T15:00:00Z', content: '咖啡喝多了,要切换到低因 ✨' },
        { type: 'assistant_message', ts: '2026-07-19T15:01:00Z', content: '好的,提醒你下午 4 点后别喝咖啡因' },
      ];
      return [];
    },
  };

  const dreamer = await createDreamer({
    cfg: { dreaming: { ...xc, channelId: '' }, channels: {} },
    dreamingPi: null,        // PR2 测试:用 mock,REM 会失败但 light/deep 仍跑
    discord: null,
    memoryStore: store,
    journal: mockJournal,
    embedder: null,
    artifacts: arts,
    budget,
    log,
  });

  // 跑一次 — 期望 light ok, rem 因为 null pi 失败,deep 跳过
  const res = await dreamer.run({ type: 'lian-zhu', triggeredBy: 'manual' });
  log('lian-zhu run result:', JSON.stringify(res, null, 2));

  // 直接调 phase 函数测试
  const lightMod = await import('./src/dreaming/phases/light.mjs');
  const lightCtx = await lightMod.collect({ type: 'lian-zhu', journal: mockJournal, memoryStore: store, log });
  log('light:', JSON.stringify({
    signals: lightCtx.signals,
    candidates: lightCtx.candidates.length,
    mood: lightCtx.mood,
    journalLen: lightCtx.journalText.length,
    sampleCandidate: lightCtx.candidates[0],
  }));

  // 测 deep 校验
  const deepMod = await import('./src/dreaming/phases/deep.mjs');
  const fakeRem = [
    {
      type: 'lian-zhu',
      text: '## 这是一条测试洞察\n\n(测试用)',
      citedMemories: lightCtx.candidates.slice(0, 2).map(c => c.id),  // 真实 ID,应该通过
      selfCoherence: 0.85,
      selfUtility: 0.70,
      theme: 'test',
      _llmCalls: 1,
    },
    {
      type: 'lian-zhu',
      text: '## 幻觉测试\n\n(应该是 invalid)',
      citedMemories: ['mem_fake_hallucinated_123'],
      selfCoherence: 0.5,
      selfUtility: 0.5,
      theme: 'test',
      _llmCalls: 1,
    },
    {
      type: 'lian-zhu',
      text: '## 空 cite 测试\n\n(应该是 invalid)',
      citedMemories: [],
      selfCoherence: 0.5,
      selfUtility: 0.5,
      theme: 'test',
      _llmCalls: 1,
    },
  ];
  const deepRes = await deepMod.run({
    type: 'lian-zhu',
    remArtifacts: fakeRem,
    dreamingPi: null, loadPrompt: null, budget, artifacts: arts,
    memoryStore: store, embedder: null, xc, log, id: 'xiasi-test-pr2',
  });
  log('deep:', JSON.stringify({
    scored: deepRes.scored.length,
    kept: deepRes.kept.length,
    scoredDetails: deepRes.scored.map(s => ({ id: s.id, valid: s.valid, reason: s.reason, total: s.total })),
    keptIds: deepRes.kept.map(k => k.id),
  }));

  if (deepRes.kept.length !== 1) throw new Error(`期望 kept=1,实际 ${deepRes.kept.length}`);
  if (!deepRes.kept[0].id.includes('-01')) throw new Error('kept ID 不对');

  log('✅ PR2 冒烟通过');
}

main().catch((e) => {
  console.error('❌ 失败:', e);
  process.exit(1);
});