// ~/pi-discord-agents/test-distill-manual.mjs
// 手动测试记忆蒸馏（无需 daemon）

import { createMemoryStore } from './src/memory-store.mjs';
import { createMemoryDistiller } from './src/memory-distiller.mjs';
import { createMemoryJournal } from './memory-journal.mjs';
import { createEmbedder } from './embedder.mjs';

console.log('=== 测试记忆蒸馏 ===\n');

// 初始化
const embedder = await createEmbedder({ log: console.log });
const memoryStore = await createMemoryStore({
  rootDir: '/Users/zhangsan/pi-discord-agents',
  embedder,
  log: console.log,
});
const memoryJournal = createMemoryJournal({ memoryStore, log: console.log });
const memoryDistiller = createMemoryDistiller({
  memoryStore,
  journal: memoryJournal,
  embedder,
  log: console.log,
});

console.log('✅ 初始化完成\n');

// 创建测试 journal
const testJournal = {
  append: (e) => {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...e }) + '\n';
    appendFileSync(join(memoryStore.getStoreDir(), '..', 'journal', '2026-07-19.jsonl'), line, 'utf8');
  },
};

testJournal.append({
  type: 'user_message',
  channelId: '1527730710410956841',
  messageId: `test_${Date.now()}`,
  author: 'zhangsan',
  content: '测试：我决定用 RPC 模式而不是 TUI，这样启动更快且没有 ctx stale 问题',
});
testJournal.append({
  type: 'user_message',
  channelId: '1527730710410956841',
  messageId: `test_${Date.now()}`,
  author: 'zhangsan',
  content: '测试：我总是习惯用 TypeScript 开发新项目，避免类型错误',
});
testJournal.append({
  type: 'user_message',
  channelId: '1527730710410956841',
  messageId: `test_${Date.now()}`,
  author: 'zhangsan',
  content: '测试：错误处理必须记录日志，不能静默失败',
});

console.log('✅ 创建测试 journal\n');

// 模拟 LLM
const mockPi = {
  prompt: async (promptText) => {
    // 返回 3 条候选
    return JSON.stringify([
      {
        kind: 'preference',
        subject: 'use-typescript',
        content: '总是用 TypeScript 开发新项目，避免类型错误',
        reasoning: '长期偏好，明确原因，可复用',
        tags: ['typescript', 'preference'],
        confidence: 0.85,
      },
      {
        kind: 'decision',
        subject: 'rpc-vs-tui',
        content: '用 RPC 模式而不是 TUI（启动快且无 ctx stale）',
        reasoning: '设计决策，跨时间有用，有明确理由',
        tags: ['architecture', 'performance'],
        confidence: 0.95,
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
  },
};

console.log('\n=== 测试 1: 智能上下文注入 ===');
const context = await memoryContext.buildContext({
  userText: '我想用 TypeScript 开发新项目，需要处理错误',
  limit: 5,
});
console.log('结果:');
console.log(context);
console.log();

console.log('=== 测试 2: 蒸馏流程 ===');
console.log('注入 3 条候选记忆（模拟 LLM）:');

// 模拟 LLM 返回
const mockCandidates = [
  {
    kind: 'preference',
    subject: 'use-typescript',
    content: '总是用 TypeScript 开发新项目，避免类型错误',
    reasoning: '长期偏好，明确原因，可复用',
    tags: ['typescript', 'preference'],
    confidence: 0.85,
  },
  {
    kind: 'decision',
    subject: 'rpc-vs-tui',
    content: '用 RPC 模式而不是 TUI（启动快且无 ctx stale）',
    reasoning: '设计决策，跨时间有用，有明确理由',
    tags: ['architecture', 'performance'],
    confidence: 0.95,
  },
  {
    kind: 'constraint',
    subject: 'error-handling-must-log',
    content: '错误处理必须记录日志，不能静默失败',
    reasoning: '硬约束，明确要求，可复用',
    tags: ['error-handling', 'constraint'],
    confidence: 0.95,
  },
];

const result = await memoryDistiller.distillNow({
  reason: 'test',
  dateKeyStr: new Date().toISOString().slice(0, 10),
  pi: mockPi,
});

console.log('蒸馏结果:');
console.log('ok:', result.ok);
console.log('count:', result.count);
console.log('results 数量:', result.results?.length || 0);
console.log('rejected 数量:', result.rejected?.length || 0);

if (result.results && result.results.length > 0) {
  console.log('\n提取的记忆:');
  for (const r of result.results) {
    console.log(`  ✅ [${r.kind}] ${r.subject}: ${r.content.slice(0, 50)}...`);
    console.log(`     - tags: ${r.tags?.join(', ') || '无'}`);
    console.log(`     - confidence: ${r.confidence}`);
  }
}

if (!result.ok) {
  console.log('错误:', result.reason);
}

console.log('\n=== 测试完成 ===');