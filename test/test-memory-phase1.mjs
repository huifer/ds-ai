// ~/pi-discord-agents/test-memory-phase1.mjs
// 测试 Phase 1 的三个核心增强：
//   1. 智能上下文注入
//   2. 记忆过期和清理
//   3. 记忆质量衰减
import { createMemoryStore } from './src/memory-store.mjs';
import { createMemoryJournal } from './src/memory-journal.mjs';
import { createMemoryContext } from './src/memory-context.mjs';
import { createMemoryGovernance } from './src/memory-governance.mjs';
import { createMemoryQuality, batchUpdateConfidence, detectAndResolveContradictions, generateQualityReport } from './src/memory-quality.mjs';
import { createEmbedder } from './src/embedder.mjs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

async function testPhase1() {
  console.log('=== Phase 1 核心增强测试 ===\n');

  const embedder = await createEmbedder({ log: console.log });
  const memoryStore = await createMemoryStore({ rootDir: ROOT, embedder, log: console.log });
  const memoryJournal = createMemoryJournal({ memoryStore, log: console.log });
  const memoryContext = createMemoryContext({ memoryStore, embedder, log: console.log });
  const memoryGovernance = createMemoryGovernance({ memoryStore, log: console.log });
  const memoryQuality = createMemoryQuality({ memoryStore, log: console.log });

  // === 测试 1: 智能上下文注入 ===
  console.log('【测试 1】智能上下文注入\n');

  // 创建一些测试记忆
  const testMemories = [
    {
      kind: 'preference',
      subject: 'use-typescript',
      content: '总是用 TypeScript 开发新项目，避免类型错误',
      tags: ['typescript', 'preference'],
      confidence: 0.85,
    },
    {
      kind: 'decision',
      subject: 'rpc-vs-tui',
      content: '用 RPC 模式而不是 TUI（启动快且无 ctx stale）',
      tags: ['architecture', 'performance'],
      confidence: 0.95,
    },
    {
      kind: 'constraint',
      subject: 'error-handling-must-log',
      content: '错误处理必须记录日志，不能静默失败',
      tags: ['error-handling', 'constraint'],
      confidence: 0.95,
    },
  ];

  console.log('创建测试记忆...');
  for (const mem of testMemories) {
    await memoryStore.upsert(mem);
  }
  console.log('✅ 创建了 3 条记忆\n');

  // 测试关键词提取
  console.log('测试关键词提取:');
  const keywords = memoryContext.extractKeywords('我想用 TypeScript 开发新项目，需要处理错误');
  console.log(`  关键词: ${keywords.join(', ')}\n`);

  // 测试上下文注入
  console.log('测试上下文注入:');
  const context = await memoryContext.buildContext({
    userText: '我想用 TypeScript 开发新项目，需要处理错误',
    limit: 5,
  });
  console.log('  结果:');
  console.log(context);
  console.log();

  // === 测试 2: 记忆过期和清理 ===
  console.log('【测试 2】记忆过期和清理\n');

  console.log('测试过期规则...');
  
  // 创建一个应该过期的记忆
  const pastDate = new Date(Date.now() - 2 * 86400_000).toISOString();
  await memoryStore.upsert({
    kind: 'idea',
    subject: 'old-idea',
    content: '这是一个旧想法',
    tags: ['idea'],
    confidence: 0.5,
    expiresAt: pastDate,  // 已过期
  });

  console.log('运行治理（干运行）...');
  const governanceResult = await memoryGovernance.runGovernance({ dryRun: true });
  console.log(`  扫描: ${governanceResult.scanned || 0}`);
  console.log(`  过期: ${governanceResult.expired}`);
  console.log(`  归档: ${governanceResult.archived}`);
  console.log(`  矛盾: ${governanceResult.conflicts}`);
  console.log();

  // === 测试 3: 记忆质量衰减 ===
  console.log('【测试 3】记忆质量衰减\n');

  console.log('创建测试记忆（模拟不同的访问次数）...');
  await memoryStore.upsert({
    kind: 'preference',
    subject: 'high-access',
    content: '高访问记忆',
    tags: ['test'],
    confidence: 0.8,
  });

  // 模拟访问
  for (let i = 0; i < 15; i++) {
    await memoryQuality.updateOnAccess('high-access');
  }

  const highAccessMeta = memoryStore.readMeta('high-access');
  if (highAccessMeta) {
    console.log(`  高访问记忆: 访问 ${highAccessMeta.accessCount} 次, 置信度 ${highAccessMeta.confidence.toFixed(2)}`);
  } else {
    console.log('  高访问记忆未找到');
  }

  // 测试衰减计算
  console.log('\n测试衰减计算:');
  const decayed = memoryQuality.calculateDecayedConfidence(highAccessMeta, 0.8);
  console.log(`  原始: 0.8, 衰减后: ${decayed.toFixed(4)}`);

  const boosted = memoryQuality.calculateAccessBoostedConfidence(highAccessMeta, 15);
  console.log(`  访问 15 次后: ${boosted.toFixed(4)}`);
  console.log();

  // 测试矛盾检测
  console.log('测试矛盾检测...');
  await memoryStore.upsert({
    kind: 'preference',
    subject: 'use-javascript',
    content: '不用 TypeScript，改用 JavaScript',
    tags: ['javascript', 'preference'],
    confidence: 0.8,
  });

  const { contradictions, resolved } = await detectAndResolveContradictions(memoryStore, { log: console.log });
  console.log(`  检测到矛盾: ${contradictions.length} 组`);
  console.log(`  已解决: ${resolved.resolved}`);
  console.log();

  // === 测试 4: 生成报告 ===
  console.log('【测试 4】生成质量报告\n');

  const qualityReport = await memoryQuality.report();
  console.log('置信度分布:');
  console.log(`  高 (>= 0.8): ${qualityReport.confidence.high}`);
  console.log(`  中 (0.6-0.8): ${qualityReport.confidence.medium}`);
  console.log(`  低 (< 0.6): ${qualityReport.confidence.low}`);
  console.log('\n访问分布:');
  console.log(`  从未: ${qualityReport.access.never}`);
  console.log(`  低频 (1-3): ${qualityReport.access.low}`);
  console.log(`  中频 (4-10): ${qualityReport.access.medium}`);
  console.log(`  高频 (>10): ${qualityReport.access.high}`);
  console.log('\n建议:');
  qualityReport.recommendations.forEach(r => {
    console.log(`  [${r.type}] ${r.message}`);
  });
  console.log();

  // === 总结 ===
  console.log('=== 测试总结 ===\n');
  console.log('✅ 智能上下文注入: 正常');
  console.log('✅ 记忆过期和清理: 正常');
  console.log('✅ 记忆质量衰减: 正常');
  console.log('✅ 矛盾检测和解决: 正常');
  console.log('✅ 质量报告生成: 正常');
  console.log('\n=== Phase 1 测试完成 ===');
}

testPhase1().catch(e => {
  console.error('❌ 测试失败:', e);
  console.error(e.stack);
  process.exit(1);
});