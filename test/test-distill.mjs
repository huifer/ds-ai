// 测试蒸馏核心逻辑
import { createMemoryStore } from './src/memory-store.mjs';
import { createMemoryJournal } from './src/memory-journal.mjs';
import { createMemoryDistiller } from './src/memory-distiller.mjs';
import { createEmbedder } from './src/embedder.mjs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

async function test() {
  console.log('=== 蒸馏测试 ===');

  // 1. 初始化
  console.log('\n[1] 初始化记忆系统...');
  const embedder = await createEmbedder({ log: console.log });
  const memoryStore = await createMemoryStore({ rootDir: ROOT, embedder, log: console.log });
  const memoryJournal = createMemoryJournal({ memoryStore, log: console.log });
  const memoryDistiller = createMemoryDistiller({
    memoryStore,
    journal: memoryJournal,
    embedder,
    log: console.log,
  });

  console.log('✅ 记忆系统初始化完成');

  // 2. 检查今日 journal
  const today = new Date().toISOString().slice(0, 10);
  console.log(`\n[2] 检查今日 journal (${today})...`);
  const events = memoryJournal.readDay(today);
  console.log(`✅ Journal 事件数: ${events.length}`);

  if (events.length === 0) {
    console.log('⚠️ 今日 journal 为空，无法测试蒸馏');
    console.log('\n提示：需要在 #主入口 有一些对话才能测试蒸馏');
    return;
  }

  // 3. 显示 transcript 片段
  const transcript = memoryJournal.feedForDistillation(today);
  console.log(`\n[3] Transcript 长度: ${transcript.length} 字符`);
  console.log('\nTranscript 前 500 字:');
  console.log(transcript.slice(0, 500));
  console.log('...');

  // 4. 检查现有记忆
  console.log(`\n[4] 检查现有记忆...`);
  const existingQuery = await memoryStore.query({
    status: 'active',
    limit: 50,
  });
  console.log(`✅ 现有记忆数: ${existingQuery.items.length}`);

  if (existingQuery.items.length > 0) {
    console.log('\n现有记忆（前 5 条）:');
    existingQuery.items.slice(0, 5).forEach(m => {
      console.log(`  - [${m.kind}] ${m.subject}: ${m.content.slice(0, 40)}...`);
    });
  }

  // 5. 测试干运行（不实际调用 LLM）
  console.log('\n[5] 测试干运行（dry-run）...');
  const dryRunResult = await memoryDistiller.distillDay(today, {
    onDistill: true,
  });

  console.log(`✅ 干运行完成`);
  console.log(`  - 模式: ${dryRunResult.mode}`);
  console.log(`  - 长度: ${dryRunResult.transcript?.length} 字符`);

  console.log('\n=== 测试完成 ===');
  console.log('\n💡 下一步：');
  console.log('  1. 在 #主入口 发送 `!distill` 测试实际蒸馏');
  console.log('  2. 等待明天 23:30 自动蒸馏');
}

test().catch(e => {
  console.error('❌ 测试失败:', e);
  process.exit(1);
});