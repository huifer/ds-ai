// ~/pi-discord-agents/test-xiasi-smoke.mjs
// PR1 冒烟测试:导入 dreaming 包 + 跑 artifacts/budget/locks/dreamer.status()。

import {
  createArtifacts,
  createBudget,
  loadXiasiConfig,
  describeXiasiConfig,
  PATHS,
  TYPES,
  ALL_TYPES,
} from './src/dreaming/index.mjs';

function log(...a) { console.log('[smoke]', ...a); }

async function main() {
  // 1. config
  process.env.XIASI_ENABLED = 'true';
  process.env.XIASI_DAILY_TOKEN_BUDGET = '5000000';
  const xc = loadXiasiConfig();
  log('config:', describeXiasiConfig(xc));
  if (!xc.enabled) throw new Error('enabled 没生效');

  // 2. budget
  const budget = createBudget({ dailyLimit: xc.dailyTokenBudget, tzOffsetHours: 8, log });
  const s1 = await budget.snapshot();
  log('budget initial:', JSON.stringify(s1));
  await budget.record({ tokensIn: 100, tokensOut: 200 });
  const s2 = await budget.snapshot();
  log('budget after record:', JSON.stringify(s2));
  if (s2.total !== 300) throw new Error('budget record 算错');

  // 3. artifacts
  const arts = await createArtifacts({ log });
  const today = arts.todayKey();
  const sampleId = `xiasi-${today}-lian-zhu-smoke01`;
  await arts.create({
    type: 'lian-zhu',
    meta: {
      id: sampleId,
      type: 'lian-zhu',
      title: '冒烟测试产物',
      createdAt: new Date().toISOString(),
      scores: { novelty: 0.5, coherence: 0.6, utility: 0.4, grounding: 0.7, surprise: 0.2, total: 0.5 },
    },
    body: '## 测试内容\n这是一条 smoke test artifact。\n',
  });
  const got = await arts.get(sampleId);
  log('artifact fetched:', got?.meta?.id, 'type=', got?.type);
  if (!got) throw new Error('artifact get 失败');

  const list = await arts.listMeta({ limit: 5 });
  log('listMeta count:', list.length, 'first:', list[0]?.id);

  await arts.archive(sampleId);
  const got2 = await arts.get(sampleId);
  log('archived:', got2?.meta?.archived === true);

  const summaries = await arts.recentSummaries({ limit: 3 });
  log('recentSummaries:', summaries.length);

  // 4. paths
  log('paths.dreamsRoot:', PATHS.dreamsRoot);
  log('paths.diary:', PATHS.diary);
  log('types:', ALL_TYPES.join(','), 'count=' + ALL_TYPES.length);

  // 5. locks
  const locks = await import('./src/dreaming/locks.mjs');
  const r1 = await locks.acquireLock('smoke-test-lock');
  if (!r1) throw new Error('lock 1 失败');
  log('lock 1 acquired');
  const r2 = await locks.acquireLock('smoke-test-lock');
  if (r2 !== null) throw new Error('lock 2 应该返回 null(被锁住)');
  log('lock 2 correctly rejected');
  await r1();
  const r3 = await locks.acquireLock('smoke-test-lock');
  if (!r3) throw new Error('lock 3 应该成功(已释放)');
  await r3();
  log('lock 3 acquired and released');

  // 6. dreamer.status()(不需要 Pi)
  //    用 mock 调用,验证 dreamer.run 在空 phase 下能走完
  const { createDreamer } = await import('./src/dreaming/dreamer.mjs');
  const dreamer = await createDreamer({
    cfg: {
      dreaming: {
        ...xc,
        channelId: '',  // 没 channel,不推送
      },
      channels: {},
    },
    dreamingPi: null,  // 占位,不调 LLM
    discord: null,
    memoryStore: null,
    journal: null,
    embedder: null,
    artifacts: arts,
    budget,
    log,
  });

  // 跑一次 lian-zhu(占位 phase 会快速返回)
  const runRes = await dreamer.run({ type: 'lian-zhu', triggeredBy: 'manual' });
  log('dreamer.run result:', JSON.stringify(runRes));
  if (!runRes.ok) throw new Error('dreamer.run 应该成功(占位)');

  // 状态
  const st = await dreamer.status({ limit: 5 });
  log('dreamer.status:', JSON.stringify(st, null, 2));

  log('✅ 所有冒烟测试通过');
}

main().catch((e) => {
  console.error('❌ 冒烟失败:', e);
  process.exit(1);
});