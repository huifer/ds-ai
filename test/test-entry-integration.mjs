// ~/pi-discord-agents/test-entry-integration.mjs
// 集成测试 - 验证新模块与 entry-bot 的集成

import { resolve } from 'node:path';

const ROOT = resolve('./');

// 模拟 entry-bot 的初始化和命令处理流程

async function test() {
  console.log('========================================');
  console.log('  Entry Integration Test');
  console.log('========================================\n');

  // 动态导入模块（模拟 entry-bot 的导入）
  const { ProjectManager } = await import('./src/project/project-manager.mjs');
  const { IntentClassifier, INTENT_TYPES } = await import('./src/workflow/intent-classifier.mjs');
  const { SummaryEngine } = await import('./src/workflow/summary-engine.mjs');
  const { SettingsManager } = await import('./src/user/settings-manager.mjs');
  const { EntryIntegrator } = await import('./src/workflow/entry-integrator.mjs');

  console.log('✅ 模块导入成功\n');

  // 测试 EntryIntegrator
  console.log('=== 测试 EntryIntegrator ===\n');

  // 模拟 Discord 消息
  const mockDiscord = {
    send: async (channelId, text) => {
      console.log(`[Discord] 发送到 ${channelId}:`);
      console.log(text?.slice(0, 100) + (text?.length > 100 ? '...' : ''));
      return true;
    },
  };

  const integrator = new EntryIntegrator({
    rootDir: ROOT,
    discord: mockDiscord,
    log: console.log,
  });

  // 模拟消息对象
  const makeMsg = (content, userId = 'test-user') => ({
    content,
    author: { id: userId, username: 'test' },
    channelId: '123456',
    threadId: null,
  });

  // 测试 1: !project 命令
  console.log('测试 1: !project 命令');
  const msg1 = makeMsg('!project');
  const result1 = await integrator.handleMessage(msg1, {
    channelId: '123456',
    threadId: null,
    userId: 'test-user',
  });
  console.log(`结果类型: ${result1?.reply ? '有回复' : '无回复'}`);
  console.log('');

  // 测试 2: !project list 命令
  console.log('测试 2: !project list 命令');
  const msg2 = makeMsg('!project list');
  const result2 = await integrator.handleMessage(msg2, {
    channelId: '123456',
    threadId: null,
    userId: 'test-user',
  });
  console.log(`结果类型: ${result2?.reply ? '有回复' : '无回复'}`);
  console.log('');

  // 测试 3: !settings 命令
  console.log('测试 3: !settings 命令');
  const msg3 = makeMsg('!settings');
  const result3 = await integrator.handleMessage(msg3, {
    channelId: '123456',
    threadId: null,
    userId: 'test-user',
  });
  console.log(`结果类型: ${result3?.reply ? '有回复' : '无回复'}`);
  console.log('');

  // 测试 4: 触发 Project 创建
  console.log('测试 4: 触发 Project 创建');
  const msg4 = makeMsg('帮我做个飞书机器人');
  const result4 = await integrator.handleMessage(msg4, {
    channelId: '123456',
    threadId: null,
    userId: 'test-user',
  });
  console.log(`项目创建: ${result4?.shouldCreateProject ? '是' : '否'}`);
  console.log(`回复内容: ${result4?.reply?.slice(0, 100) || '(无)'}...`);
  console.log('');

  // 测试 5: 继续对话（同一 session）
  console.log('测试 5: 继续对话');
  const msg5 = makeMsg('需要支持消息推送和指令处理');
  const result5 = await integrator.handleMessage(msg5, {
    channelId: '123456',
    threadId: null,
    userId: 'test-user',
  });
  console.log(`结果类型: ${result5?.projectResult?.projectId ? '项目已关联' : '无项目'}`);
  console.log('');

  // 测试 6: !quick 命令
  console.log('测试 6: !quick 命令');
  const msg6 = makeMsg('!quick');
  const result6 = await integrator.handleMessage(msg6, {
    channelId: '123456',
    threadId: null,
    userId: 'test-user',
  });
  console.log(`结果: ${result6?.reply?.slice(0, 50)}`);
  console.log('');

  // 测试 7: !summary 命令
  console.log('测试 7: !summary 命令');
  const msg7 = makeMsg('!summary');
  const result7 = await integrator.handleMessage(msg7, {
    channelId: '123456',
    threadId: null,
    userId: 'test-user',
  });
  console.log(`结果类型: ${result7?.reply ? '有回复' : '无回复'}`);
  console.log('');

  console.log('========================================');
  console.log('  ✅ 集成测试完成');
  console.log('========================================\n');
}

test().catch(e => {
  console.error('测试失败:', e.message);
  console.error(e.stack);
  process.exit(1);
});
