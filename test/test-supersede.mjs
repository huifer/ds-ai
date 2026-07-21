// 测试冲突处理和 supersede
import { createMemoryStore } from './src/memory-store.mjs';
import { createMemoryJournal } from './src/memory-journal.mjs';
import { createMemoryDistiller } from './src/memory-distiller.mjs';
import { createEmbedder } from './src/embedder.mjs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

async function testSupersede() {
  console.log('=== 测试冲突处理和 Supersede ===');

  const today = new Date().toISOString().slice(0, 10);

  // 初始化
  const embedder = await createEmbedder({ log: console.log });
  const memoryStore = await createMemoryStore({ rootDir: ROOT, embedder, log: console.log });
  const memoryJournal = createMemoryJournal({ memoryStore, log: console.log });
  const memoryDistiller = createMemoryDistiller({
    memoryStore,
    journal: memoryJournal,
    embedder,
    log: console.log,
  });

  // 1. 先创建一个记忆
  console.log('\n[1] 创建初始记忆...');
  await memoryStore.upsert({
    kind: 'preference',
    scope: 'user',
    subject: 'use-typescript',
    content: '选择 TypeScript',
    tags: ['typescript', 'preference'],
    confidence: 0.8,
  });

  const initial = await memoryStore.query({ subject: 'use-typescript' });
  console.log(`  初始记忆: [${initial.items[0].kind}] ${initial.items[0].content}`);
  console.log(`  状态: ${initial.items[0].status}`);
  console.log(`  revision: ${initial.items[0].revision}`);

  // 2. 模拟 LLM 返回冲突的记忆（相同 subject，不同内容）
  console.log('\n[2] 模拟 LLM 返回冲突记忆...');
  const mockPi = {
    prompt: async (promptText) => {
      // 返回相同 subject 但内容相反
      const mockResponse = JSON.stringify([
        {
          kind: 'preference',
          subject: 'use-typescript',
          content: '不用 TypeScript，改用 JavaScript',
          reasoning: '改变了技术栈选择',
          tags: ['javascript', 'preference'],
          confidence: 0.9,
        },
      ]);

      console.log('  🤖 LLM 返回: [preference] use-typescript: 不用 TypeScript，改用 JavaScript');

      return mockResponse;
    },
  };

  // 3. 执行蒸馏
  console.log('\n[3] 执行蒸馏（应该 supersede 旧版本）...');
  const result = await memoryDistiller.distillNow({
    reason: 'test-supersede',
    dateKeyStr: today,
    pi: mockPi,
  });

  console.log(`  提取: ${result.count} 条`);

  // 4. 查询结果
  console.log('\n[4] 查询结果...');
  const allMemories = await memoryStore.query({ subject: 'use-typescript' });

  console.log(`  总数: ${allMemories.items.length}`);

  allMemories.items.forEach(m => {
    console.log(`  - [${m.kind}] ${m.content}`);
    console.log(`    状态: ${m.status}`);
    console.log(`    revision: ${m.revision}`);
    if (m.supersedes && m.supersedes.length > 0) {
      console.log(`    supersedes: ${m.supersedes.join(', ')}`);
    }
  });

  // 5. 检查状态
  const active = allMemories.items.filter(m => m.status === 'active');
  const superseded = allMemories.items.filter(m => m.status === 'superseded');

  console.log('\n[5] 状态检查:');
  console.log(`  active: ${active.length}`);
  console.log(`  superseded: ${superseded.length}`);

  if (active.length === 1 && superseded.length === 1) {
    console.log('\n✅ Supersede 成功！');
    console.log(`  旧版本: ${superseded[0].revision} (${superseded[0].status})`);
    console.log(`  新版本: ${active[0].revision} (${active[0].status})`);
  } else {
    console.log('\n❌ Supersede 失败');
  }

  console.log('\n=== 测试完成 ===');
}

testSupersede().catch(e => {
  console.error('❌ 测试失败:', e);
  console.error(e.stack);
  process.exit(1);
});