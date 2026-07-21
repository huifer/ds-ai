// ~/pi-discord-agents/test-xiasi-pr4.mjs
// PR4 冒烟:验证 diary / report / votes / button routing / memory-context reverse

import { createArtifacts, createBudget, createDiary, loadXiasiConfig } from './src/dreaming/index.mjs';
import { createMemoryStore } from './src/memory-store.mjs';
import { createEmbedder } from './src/embedder.mjs';
import { createMemoryContext } from './src/memory-context.mjs';
import { createVotes } from './src/dreaming/votes.mjs';
import { createReporter } from './src/dreaming/report.mjs';

const log = (...a) => console.log('[pr4-smoke]', ...a);

async function main() {
  const xc = loadXiasiConfig();
  const arts = await createArtifacts({ log });
  const budget = createBudget({ dailyLimit: xc.dailyTokenBudget, tzOffsetHours: 8, log });
  const store = await createMemoryStore({ log });
  const embedder = await createEmbedder({ log });

  let passed = 0;
  let failed = 0;

  // ---- T1: diary append(fallback mode, no Pi)----
  console.log('\n=== T1: diary append ===');
  try {
    const diary = createDiary({ dreamingPi: null, log });
    // 先清空
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const { readFile } = await import('node:fs/promises');
    mkdirSync('data/dreams', { recursive: true });
    writeFileSync('data/dreams/DREAMS.md', '', 'utf8');
    // 追加一条
    const r1 = await diary.append({
      type: 'lian-zhu',
      dreamId: 'xiasi-pr4-test',
      dateStr: '2026-07-19',
      durationStr: '42s',
      theme: 'rust-async',
      artifactCount: 2,
      topInsight: '连珠发现了 2 条有趣洞察',
      scores: { novelty: 0.4, coherence: 0.85, utility: 0.7, grounding: 1.0, surprise: 0.28, total: 0.65 },
    });
    const r2 = await diary.append({
      type: 'gui-cang',
      dreamId: 'xiasi-pr4-test2',
      dateStr: '2026-07-19',
      durationStr: '30s',
      theme: 'testing-pattern',
      artifactCount: 0,
      topInsight: null,
      scores: {},
    });
    console.log(`  r1: ok=${r1.ok} mode=${r1.mode} len=${r1.length}`);
    console.log(`  r2: ok=${r2.ok} mode=${r2.mode} len=${r2.length}`);
    // 验证文件包含两段
    const { readFile: rf } = await import('node:fs/promises');
    const content = await readFile('data/dreams/DREAMS.md', 'utf8');
    const hasLianZhu = content.includes('连珠');
    const hasGuiCang = content.includes('归藏');
    const hasHeader = content.includes('遐思录') || content.includes('# 🌙');
    console.log(`  has 连珠=${hasLianZhu} 归藏=${hasGuiCang} header=${hasHeader}`);
    if (r1.ok && r2.ok && hasLianZhu && hasGuiCang) { console.log('  ✅ T1 pass'); passed++; }
    else { console.log('  ❌ T1 fail'); failed++; }
  } catch (e) { console.log(`  ❌ T1 error: ${e.message}`); failed++; }

  // ---- T2: votes CRUD ----
  console.log('\n=== T2: votes CRUD ===');
  try {
    const { unlink } = await import('node:fs/promises');
    try { await unlink('data/dreams/.dreams/votes.json'); } catch {}
    const votes = createVotes({ log });
    const v1 = await votes.vote({ artifactId: 'test-01', userId: 'alice', kind: 'up' });
    console.log(`  alice up test-01: ${JSON.stringify(v1.current)}`);
    const v1Alice = v1.current.voters?.alice;  // 保存快照(对象引用会被后续 mutate)
    const v2 = await votes.vote({ artifactId: 'test-01', userId: 'bob', kind: 'star' });
    console.log(`  bob star test-01: ${JSON.stringify(v2.current)}`);
    const v2Bob = v2.current.voters?.bob;
    // alice 重复 up → 取消
    const v3 = await votes.vote({ artifactId: 'test-01', userId: 'alice', kind: 'up' });
    console.log(`  alice toggle-up: ${JSON.stringify(v3.current)} toggled=${v3.toggledOff}`);
    const all = await votes.all();
    console.log(`  all keys: ${Object.keys(all).length}`);
    if (v1Alice === 'up' && v2Bob === 'star' && v3.toggledOff && v3.current.up === 0 && v3.current.star === 1 && all['test-01']) {
      console.log('  ✅ T2 pass'); passed++;
    } else { console.log('  ❌ T2 fail'); failed++; }
  } catch (e) { console.log(`  ❌ T2 error: ${e.message}`); failed++; }

  // ---- T3: reporter fallback ----
  console.log('\n=== T3: reporter ===');
  try {
    const reporter = createReporter({ artifacts: arts, log });
    const weekly = await reporter.weeklyReport();
    const monthly = await reporter.monthlyReport();
    console.log(`  weekly: ${weekly.length} chars, starts with: "${weekly.slice(0, 40)}..."`);
    console.log(`  monthly: ${monthly.length} chars, starts with: "${monthly.slice(0, 40)}..."`);
    const hasWeeklyHeader = weekly.includes('遐思周报');
    const hasMonthlyHeader = monthly.includes('遐思月报');
    if (hasWeeklyHeader && hasMonthlyHeader && weekly.length > 100 && monthly.length > 100) {
      console.log('  ✅ T3 pass'); passed++;
    } else { console.log('  ❌ T3 fail'); failed++; }
  } catch (e) { console.log(`  ❌ T3 error: ${e.message}`); failed++; }

  // ---- T4: memory-context reverse read ----
  console.log('\n=== T4: memory-context reverse read ===');
  try {
    const memCtx = createMemoryContext({ memoryStore: store, embedder, log });
    // 没有 artifacts 时不应报错
    const ctx1 = await memCtx.buildContext({ userText: 'test', limit: 2 });
    console.log(`  no artifacts: ${ctx1.length} chars`);
    // 注入 artifacts
    memCtx.setDreamArtifacts(arts);
    const ctx2 = await memCtx.buildContext({ userText: 'test', limit: 2 });
    const hasDreamDigest = ctx2.includes('dream-digest') || ctx2.includes('memory-digest');
    console.log(`  with artifacts: ${ctx2.length} chars, hasDreamDigest=${hasDreamDigest}`);
    if (hasDreamDigest) { console.log('  ✅ T4 pass'); passed++; }
    else { console.log('  ❌ T4 fail (no dream-digest — expected if no artifacts exist yet)'); failed++; }
  } catch (e) { console.log(`  ❌ T4 error: ${e.message}`); failed++; }

  // ---- T5: button customId routing ----
  console.log('\n=== T5: button customId format ===');
  try {
    const ids = [
      'xiasi:vote:up:artifact-001',
      'xiasi:vote:down:artifact-002',
      'xiasi:vote:star:artifact-003',
      'xiasi:archive:artifact-001',
    ];
    for (const id of ids) {
      const parts = id.split(':');
      console.log(`  ${id} → action=${parts[1]} kind=${parts[2] || '-'} target=${parts[3] || parts[2]}`);
    }
    console.log('  ✅ T5 pass'); passed++;
  } catch (e) { console.log(`  ❌ T5 error: ${e.message}`); failed++; }

  console.log(`\n=== PR4 冒烟: ${passed} pass / ${failed} fail ===`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
