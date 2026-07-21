// ~/pi-discord-agents/test-multi-agent.mjs
// 测试多 Agent 架构的核心模块,不依赖真实 LLM

import { AgentRegistry } from './src/orchestrator/agent-registry.mjs';
import { Router } from './src/orchestrator/router.mjs';
import { SessionPool } from './src/orchestrator/session-pool.mjs';
import { ContextCompressor, SimpleStrategy } from './src/orchestrator/context-compressor.mjs';
import { MultiAgentManager } from './src/orchestrator/agent-manager.mjs';

const log = (...args) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...args);

async function test1_registry() {
  console.log('\n========== 测试 1: Agent Registry ==========');
  const registry = new AgentRegistry({ log });
  registry.loadFromRegistryJson();

  const agents = registry.list();
  console.log(`✅ 注册了 ${agents.length} 个 Agent:`);
  agents.forEach(a => {
    console.log(`   ${a.emoji} ${a.displayName} (${a.id}) - 频道: ${a.channels?.length ?? 0} 个`);
  });

  // 测试频道查找
  console.log('\n频道→Agent 查找:');
  for (const ch of ['软件开发', '销售线索', 'seo-geo', '主快讯', '📜-夜游记']) {
    const aid = registry.getByChannel(ch);
    console.log(`   #${ch} → ${aid ? registry.get(aid)?.displayName : '(无)'}`);
  }

  // 按 category 分组
  console.log('\n按 Category 分组:');
  const groups = registry.groupByCategory();
  for (const [cat, list] of Object.entries(groups)) {
    console.log(`   📂 ${cat}: ${list.length} 个 Agent`);
  }
}

async function test2_session_pool() {
  console.log('\n========== 测试 2: Session Pool ==========');
  const pool = new SessionPool({
    rootDir: process.cwd(),
    log,
    maxTurnsBeforeCompress: 5,    // 测试用:5 轮触发
    maxTokensBeforeCompress: 5000,
    keepRecentTurns: 2,
    idleMinutesBeforeArchive: 60,
    persistDir: 'data/test-sessions',
  });

  const key = SessionPool.makeKey({
    channelId: 'ch_test',
    userId: 'user_test',
    agentId: 'dev',
  });
  console.log(`Session key: ${key}`);

  // 添加 7 轮对话,应该触发压缩(>5 轮)
  pool.getOrCreate({ channelId: 'ch_test', userId: 'user_test', agentId: 'dev' });

  for (let i = 1; i <= 7; i++) {
    const userText = `第 ${i} 轮: 测试消息,带一些中文和一些 English words.`;
    const replyText = `第 ${i} 轮回复:这是一些回复内容,有点长好测试 token 数估算`;

    const tokens = SessionPool.estimateTokens(userText);
    const r1 = await pool.addTurn(key, 'user', userText, tokens);
    const r2 = await pool.addTurn(key, 'assistant', replyText, tokens);

    console.log(`   轮 ${i}: tokens 估算=${tokens}, 压缩=${r2.compressed ? `✅ (${r2.reason})` : '否'}`);
  }

  // 检查 session 状态
  const list = pool.list();
  console.log(`\n当前 session 状态:`);
  console.log(JSON.stringify(list[0], null, 2));

  // 构建上下文
  const ctx = pool.buildContext(key);
  console.log(`\n构建的上下文 (${ctx.length} 字符):`);
  console.log(ctx.slice(0, 500));

  pool.shutdown();
}

async function test3_router() {
  console.log('\n========== 测试 3: Router ==========');
  const registry = new AgentRegistry({ log });
  registry.loadFromRegistryJson();

  const pool = new SessionPool({
    rootDir: process.cwd(),
    log,
    persistDir: 'data/test-sessions-router',
  });

  const router = new Router({ agentRegistry: registry, sessionPool: pool, log });

  const testCases = [
    { channelName: '软件开发', text: '帮我看看这段代码', expectAgent: 'dev' },
    { channelName: '销售线索', text: '跟进一下客户', expectAgent: 'sales' },
    { channelName: 'seo-geo', text: '分析下关键词难度', expectAgent: 'seo' },
    { channelName: '主入口', text: '帮我写一段推文', expectAgent: 'domestic-editor' },  // 关键词匹配
    { channelName: '主入口', text: 'review my PR', expectAgent: 'dev' },  // 关键词匹配
    { channelName: '主入口', text: '今天天气不错', expectAgent: 'orchestrator' },  // 默认
    { channelName: 'main-feed', text: 'tweet 一下这个', expectAgent: 'overseas-editor' },
  ];

  for (const tc of testCases) {
    const result = await router.route({
      channelId: 'ch_test_' + tc.channelName,
      channelName: tc.channelName,
      userId: 'user_test',
      text: tc.text,
    });
    const def = registry.get(result.agentId);
    const ok = result.agentId === tc.expectAgent ? '✅' : '⚠️ ';
    console.log(`   ${ok} #${tc.channelName} "${tc.text.slice(0, 20)}" → ${def?.displayName} (${result.reason})`);
  }

  pool.shutdown();
}

async function test4_compressor() {
  console.log('\n========== 测试 4: Context Compressor ==========');
  const pool = new SessionPool({
    rootDir: process.cwd(),
    log,
    maxTurnsBeforeCompress: 3,
    persistDir: 'data/test-sessions-compressor',
  });

  const compressor = new ContextCompressor({
    sessionPool: pool,
    strategy: new SimpleStrategy(),
    log,
  });

  const key = SessionPool.makeKey({
    channelId: 'ch_test_compress',
    userId: 'user_test',
    agentId: 'dev',
  });
  pool.getOrCreate({ channelId: 'ch_test_compress', userId: 'user_test', agentId: 'dev' });

  // 加 6 轮,应该触发 2 次压缩
  const conversations = [
    ['项目 A 在 2024-01-15 开始,预算是 50万', '好的,已记录项目 A'],
    ['客户要求 30 天交付,需要 3 个工程师', '已分配 3 个工程师'],
    ['李经理决定走敏捷开发,每周一迭代', '已切换到敏捷'],
    ['测试覆盖率需要达到 80%', '已设置覆盖率门槛'],
    ['今天上线 v2.1 版本', '已部署'],
    ['明天下午开评审会', '已预定会议室'],
  ];

  for (let i = 0; i < conversations.length; i++) {
    const [u, a] = conversations[i];
    await pool.addTurn(key, 'user', u, SessionPool.estimateTokens(u));
    const r = await pool.addTurn(key, 'assistant', a, SessionPool.estimateTokens(a));
    console.log(`   轮 ${i + 1}: ${r.compressed ? `✅ 已压缩 (${r.reason})` : '未压缩'}`);
  }

  // 强制再压一次
  const forced = await compressor.forceCompress(key);
  console.log(`\n强制压缩结果: ${JSON.stringify(forced)}`);

  // 查看最终状态
  const ctx = pool.buildContext(key);
  console.log(`\n最终上下文 (${ctx.length} 字符):`);
  console.log(ctx);

  pool.shutdown();
}

async function test5_full_flow() {
  console.log('\n========== 测试 5: 完整流程 (Mock LLM) ==========');

  // 创建一个 mock piBridge
  const mockPiBridge = {
    available: true,
    async prompt(systemPrompt, userText, opts) {
      // 模拟 LLM 响应
      log(`   [mock-pi] 收到 prompt (system: ${systemPrompt.length} 字符, user: ${userText.length} 字符)`);
      return `[Mock 回复] 这是对 "${userText.slice(0, 30)}..." 的回复`;
    },
  };

  const manager = new MultiAgentManager({
    rootDir: process.cwd(),
    piBridge: mockPiBridge,
    log,
    sessionPoolOpts: {
      persistDir: 'data/test-sessions-full',
      maxTurnsBeforeCompress: 4,
    },
  });

  // 处理来自不同频道的消息
  const messages = [
    { channelId: 'ch1', channelName: '软件开发', userId: 'u1', text: '这段代码怎么优化?' },
    { channelId: 'ch2', channelName: '销售线索', userId: 'u1', text: '跟进客户 ABC 公司' },
    { channelId: 'ch3', channelName: 'seo-geo', userId: 'u2', text: '分析关键词 "AI agent"' },
    { channelId: 'ch1', channelName: '软件开发', userId: 'u1', text: '继续,刚才那个 bug' },  // 同用户同频道
    { channelId: 'ch1', channelName: '软件开发', userId: 'u1', text: '另外,再帮我看看这个' },  // 话题切换
    { channelId: 'ch1', channelName: '软件开发', userId: 'u1', text: '还有别的建议吗?' },
  ];

  console.log('处理消息:');
  for (const msg of messages) {
    const r = await manager.handleMessage(msg);
    console.log(`   #${msg.channelName} "${msg.text.slice(0, 20)}..."`);
    console.log(`      → ${r.agentDisplayName} | session=${r.sessionKey.split(':').pop()}`);
    console.log(`      → ${r.reply.slice(0, 60)}`);
    if (r.compressed) console.log(`      ⚡ 触发压缩: ${r.compressionReason}`);
  }

  console.log('\n系统状态:');
  const status = manager.getStatus();
  console.log(`   Session 数: ${status.sessionCount}`);
  console.log(`   Token 总估算: ${status.totalTokenEstimate}`);
  console.log(`   调用次数: ${status.callCount}`);
  console.log(`   按 Agent 分布:`, status.sessionsByAgent);

  await manager.shutdown();
}

async function main() {
  console.log('🧪 多 Agent 架构测试\n');
  await test1_registry();
  await test2_session_pool();
  await test3_router();
  await test4_compressor();
  await test5_full_flow();
  console.log('\n✅ 所有测试通过\n');
}

main().catch(e => {
  console.error('❌ 测试失败:', e);
  process.exit(1);
});