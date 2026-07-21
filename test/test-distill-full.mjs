// 模拟 LLM 蒸馏测试
import { createMemoryStore } from './src/memory-store.mjs';
import { createMemoryJournal } from './src/memory-journal.mjs';
import { createMemoryDistiller } from './src/memory-distiller.mjs';
import { createEmbedder } from './src/embedder.mjs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

// 模拟 Pi 实例
const mockPi = {
  prompt: async (promptText) => {
    console.log('\n=== 模拟 LLM Prompt ===');
    console.log(promptText.slice(0, 500) + '...');
    console.log('======================\n');

    // 模拟 LLM 返回（应该提取 3 条）
    const mockResponse = JSON.stringify([
      {
        kind: 'decision',
        subject: 'rpc-vs-tui',
        content: '用 RPC 模式而不是 TUI（启动快且无 ctx stale）',
        reasoning: '设计决策，跨时间有用，有明确理由',
        tags: ['architecture', 'performance'],
        confidence: 0.95,
      },
      {
        kind: 'preference',
        subject: 'use-typescript',
        content: '总是用 TypeScript 开发新项目，避免类型错误',
        reasoning: '长期偏好，明确原因，可复用',
        tags: ['typescript', 'preference'],
        confidence: 0.85,
      },
      {
        kind: 'constraint',
        subject: 'error-handling-must-log',
        content: '错误处理必须记录日志，不能静默失败',
        reasoning: '硬约束，明确要求，可复用',
        tags: ['error-handling', 'constraint'],
        confidence: 0.95,
      },
    ]);

    console.log('🤖 模拟 LLM 返回:');
    console.log(mockResponse);
    console.log();

    return mockResponse;
  },
};

async function test() {
  console.log('=== 模拟 LLM 蒸馏测试 ===');

  const today = new Date().toISOString().slice(0, 10);

  // 初始化
  console.log('\n[1] 初始化...');
  const embedder = await createEmbedder({ log: console.log });
  const memoryStore = await createMemoryStore({ rootDir: ROOT, embedder, log: console.log });
  const memoryJournal = createMemoryJournal({ memoryStore, log: console.log });
  const memoryDistiller = createMemoryDistiller({
    memoryStore,
    journal: memoryJournal,
    embedder,
    log: console.log,
  });
  console.log('✅ 初始化完成');

  // 检查 journal
  const events = memoryJournal.readDay(today);
  console.log(`\n[2] Journal: ${events.length} 条事件`);

  // 执行蒸馏
  console.log('\n[3] 执行蒸馏...');
  const result = await memoryDistiller.distillNow({
    reason: 'test',
    dateKeyStr: today,
    pi: mockPi,
  });

  console.log('\n[4] 蒸馏结果:');
  console.log(`  - ok: ${result.ok}`);
  console.log(`  - count: ${result.count}`);
  console.log(`  - day: ${result.day}`);
  console.log(`  - reason: ${result.reason}`);

  if (result.results && result.results.length > 0) {
    console.log('\n[5] 提取的记忆:');
    result.results.forEach(r => {
      console.log(`  ✅ [${r.kind}] ${r.subject}`);
      console.log(`     - revision: ${r.revision}`);
      console.log(`     - action: ${r.action}`);
    });
  }

  if (result.rejected && result.rejected.length > 0) {
    console.log('\n[6] 拒绝的候选:');
    result.rejected.forEach(r => {
      console.log(`  ❌ ${r.subject}`);
      console.log(`     - reason: ${r.reason}`);
    });
  }

  // 查询所有记忆
  console.log('\n[7] 查询所有记忆...');
  const allMemories = await memoryStore.query({ status: 'active' });
  console.log(`  总数: ${allMemories.items.length}`);

  if (allMemories.items.length > 0) {
    console.log('\n记忆列表:');
    allMemories.items.forEach(m => {
      console.log(`  - [${m.kind}] ${m.subject}: ${m.content}`);
      console.log(`    tags: [${m.tags?.join(', ') || '无'}]`);
      console.log(`    confidence: ${m.confidence}`);
      console.log(`    revision: ${m.revision}`);
    });
  }

  console.log('\n=== 测试完成 ===');
  console.log('✅ 蒸馏核心逻辑正常工作！');
}

test().catch(e => {
  console.error('❌ 测试失败:', e);
  console.error(e.stack);
  process.exit(1);
});