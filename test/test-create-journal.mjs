// 创建测试 journal 数据
import { createMemoryJournal } from './src/memory-journal.mjs';
import { createMemoryStore } from './src/memory-store.mjs';
import { createEmbedder } from './src/embedder.mjs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

async function createTestJournal() {
  console.log('=== 创建测试 journal 数据 ===');

  const today = new Date().toISOString().slice(0, 10);
  const embedder = await createEmbedder({ log: console.log });
  const memoryStore = await createMemoryStore({ rootDir: ROOT, embedder, log: console.log });
  const memoryJournal = createMemoryJournal({ memoryStore, log: console.log });

  // 创建一些模拟对话
  const testEvents = [
    // 值得蒸馏的
    {
      type: 'user_message',
      channelId: '1527730710410956841',
      messageId: 'msg_001',
      author: 'zhangsan',
      content: '我决定用 RPC 模式而不是 TUI，这样启动更快且没有 ctx stale 问题',
    },
    {
      type: 'assistant_message',
      channelId: '1527730710410956841',
      messageId: 'msg_002',
      content: '明白了，RPC 模式确实更稳定',
    },
    {
      type: 'user_message',
      channelId: '1527730710410956841',
      messageId: 'msg_003',
      author: 'zhangsan',
      content: '我总是习惯用 TypeScript 开发新项目，避免类型错误',
    },
    {
      type: 'user_message',
      channelId: '1527730710410956841',
      messageId: 'msg_004',
      author: 'zhangsan',
      content: '错误处理必须记录日志，不能静默失败',
    },
    // 不值得蒸馏的
    {
      type: 'user_message',
      channelId: '1527730710410956841',
      messageId: 'msg_005',
      author: 'zhangsan',
      content: '今天修复了一个 bug，原因是变量名写错了',
    },
    {
      type: 'user_message',
      channelId: '1527730710410956841',
      messageId: 'msg_006',
      author: 'zhangsan',
      content: '这个项目的数据库连接字符串是 mongodb://localhost:27017',
    },
    {
      type: 'user_message',
      channelId: '1527730710410956841',
      messageId: 'msg_007',
      author: 'zhangsan',
      content: '可能应该用 TypeScript，但不太确定',
    },
  ];

  console.log(`\n创建 ${testEvents.length} 条测试事件...`);

  for (const event of testEvents) {
    memoryJournal.append(event);
  }

  console.log('✅ 测试 journal 创建完成');

  // 验证
  const events = memoryJournal.readDay(today);
  console.log(`\n验证: ${events.length} 条事件`);

  const transcript = memoryJournal.feedForDistillation(today);
  console.log(`Transcript 长度: ${transcript.length} 字符`);
  console.log('\nTranscript:');
  console.log(transcript);

  console.log('\n✅ 完成！现在可以运行 `node test-distill.mjs` 测试蒸馏');
}

createTestJournal().catch(e => {
  console.error('❌ 创建失败:', e);
  process.exit(1);
});