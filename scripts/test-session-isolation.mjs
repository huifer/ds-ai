#!/usr/bin/env node
// ~/pi-discord-agents/scripts/test-session-isolation.mjs
// 多层 Session 隔离系统测试

import { SessionKey, INTENT_TYPES, LayeredSessionManager } from '../src/runtime/session/index.mjs';

console.log('🧪 多层 Session 隔离系统测试\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || '断言失败');
}

// ============ 1. SessionKey 测试 ============

test('SessionKey - 基本构建', () => {
  const key = SessionKey.build({
    channelId: 'ch_001',
    userId: 'user_123',
  });
  assert(key === 'ch:ch_001::u:user_123', `期望 'ch:ch_001::u:user_123', 得到 '${key}'`);
});

test('SessionKey - 带项目', () => {
  const key = SessionKey.build({
    channelId: 'ch_001',
    userId: 'user_123',
    projectId: 'PRJ-001',
  });
  assert(key.includes('p:PRJ-001'), '应该包含项目 ID');
});

test('SessionKey - 带任务', () => {
  const key = SessionKey.build({
    channelId: 'ch_001',
    userId: 'user_123',
    projectId: 'PRJ-001',
    taskId: 'task_456',
  });
  assert(key.includes('t:task_456'), '应该包含任务 ID');
});

test('SessionKey - 完整维度', () => {
  const key = SessionKey.build({
    channelId: 'ch_001',
    userId: 'user_123',
    projectId: 'PRJ-001',
    taskId: 'task_456',
    intentType: INTENT_TYPES.CODE_REVIEW,
    agentId: 'dev',
  });
  assert(key.includes('i:review'), '应该包含意图');
  assert(key.includes('a:dev'), '应该包含 Agent');
});

test('SessionKey - 解析', () => {
  const parsed = SessionKey.parse('ch:ch_001::u:user_123::p:PRJ-001::a:dev');
  assert(parsed.channelId === 'ch_001', 'channelId');
  assert(parsed.userId === 'user_123', 'userId');
  assert(parsed.projectId === 'PRJ-001', 'projectId');
  assert(parsed.agentId === 'dev', 'agentId');
});

test('SessionKey - 层级检测', () => {
  assert(SessionKey.getLevel('ch:ch_001::u:user_123') === 'channel', '频道层');
  assert(SessionKey.getLevel('ch:ch_001::u:user_123::p:PRJ-001') === 'project', '项目层');
  assert(SessionKey.getLevel('ch:ch_001::u:user_123::t:task_456') === 'task', '任务层');
});

test('SessionKey - 意图推断', () => {
  assert(SessionKey.inferIntent('帮我看看这段代码') === INTENT_TYPES.CODE_REVIEW, '代码评审');
  assert(SessionKey.inferIntent('fix this bug') === INTENT_TYPES.BUG_FIX, 'Bug修复');
  assert(SessionKey.inferIntent('聊聊天气') === INTENT_TYPES.CHAT, '闲聊');
  assert(SessionKey.inferIntent('怎么部署到服务器') === INTENT_TYPES.QUERY, '查询');
});

// ============ 2. LayeredSessionManager 测试 ============

test('LayeredSessionManager - 创建频道级 Session', () => {
  const manager = new LayeredSessionManager({
    rootDir: `/tmp/test-sessions-${Date.now()}-1`,
    log: () => {},
  });
  
  const session = manager.getOrCreate({
    channelId: 'ch_001',
    userId: 'user_123',
  });
  
  assert(session.level === 'channel', '应该是频道级');
  assert(session.state === 'active', '应该是活跃状态');
});

test('LayeredSessionManager - 创建项目级 Session', () => {
  const manager = new LayeredSessionManager({
    rootDir: `/tmp/test-sessions-${Date.now()}-2`,
    log: () => {},
  });
  
  const session = manager.getOrCreate({
    channelId: 'ch_001',
    userId: 'user_123',
    projectId: 'PRJ-001',
  });
  
  assert(session.level === 'project', '应该是项目级');
});

test('LayeredSessionManager - 添加轮次', () => {
  const manager = new LayeredSessionManager({
    rootDir: `/tmp/test-sessions-${Date.now()}-3`,
    log: () => {},
  });
  
  const session = manager.getOrCreate({
    channelId: 'ch_001',
    userId: 'user_123',
  });
  
  const result = manager.addTurn(session.key, 'user', '你好', 100);
  
  assert(session.turns.length === 1, '应该有一轮');
  assert(session.tokenEstimate === 100, '应该计算 token');
  assert(result.compressed === false, '不应该压缩');
});

test('LayeredSessionManager - Session 隔离', () => {
  const manager = new LayeredSessionManager({
    rootDir: `/tmp/test-sessions-${Date.now()}-4`,
    log: () => {},
  });
  
  // 同一用户的不同项目
  const session1 = manager.getOrCreate({
    channelId: 'ch_001',
    userId: 'user_123',
    projectId: 'PRJ-001',
  });
  
  const session2 = manager.getOrCreate({
    channelId: 'ch_001',
    userId: 'user_123',
    projectId: 'PRJ-002',
  });
  
  // 添加内容到 session1
  manager.addTurn(session1.key, 'user', '项目1的内容', 50);
  
  // session2 应该没有 session1 的内容
  assert(session2.turns.length === 0, '不同项目的 Session 应该隔离');
  assert(session2 !== session1, '应该是不同的 Session');
});

test('LayeredSessionManager - 同一项目不同任务隔离', () => {
  const manager = new LayeredSessionManager({
    rootDir: `/tmp/test-sessions-${Date.now()}-5`,
    log: () => {},
  });
  
  const task1 = manager.getOrCreate({
    channelId: 'ch_001',
    userId: 'user_123',
    projectId: 'PRJ-001',
    taskId: 'task_001',
    intentType: INTENT_TYPES.TASK,
  });
  
  const task2 = manager.getOrCreate({
    channelId: 'ch_001',
    userId: 'user_123',
    projectId: 'PRJ-001',
    taskId: 'task_002',
    intentType: INTENT_TYPES.TASK,
  });
  
  // 确保 key 不同
  assert(task1.key !== task2.key, '不同任务的 key 应该不同');
  
  manager.addTurn(task1.key, 'user', '任务1的内容', 50);
  
  assert(task2.turns.length === 0, '不同任务的 Session 应该隔离');
});

test('LayeredSessionManager - 统计', () => {
  const manager = new LayeredSessionManager({
    rootDir: `/tmp/test-sessions-${Date.now()}-6`,
    log: () => {},
  });
  
  manager.getOrCreate({ channelId: 'ch_001', userId: 'user_1' });
  manager.getOrCreate({ channelId: 'ch_001', userId: 'user_2' });
  manager.getOrCreate({ channelId: 'ch_001', userId: 'user_3' });
  
  const stats = manager.getStats();
  
  assert(stats.total === 3, `应该有 3 个 Session, 得到 ${stats.total}`);
});

test('LayeredSessionManager - 意图更新', () => {
  const manager = new LayeredSessionManager({
    rootDir: `/tmp/test-sessions-${Date.now()}-7`,
    log: () => {},
  });
  
  const session = manager.getOrCreate({
    channelId: 'ch_001',
    userId: 'user_123',
  });
  
  manager.updateIntent(session.key, INTENT_TYPES.CODE_REVIEW);
  
  assert(session.layers.intent.type === INTENT_TYPES.CODE_REVIEW, '意图应该更新');
});

// ============ 3. 层级关系测试 ============

test('SessionKey - 父级检测', () => {
  const parent = SessionKey.build({
    channelId: 'ch_001',
    userId: 'user_123',
    projectId: 'PRJ-001',
  });
  
  const child = SessionKey.build({
    channelId: 'ch_001',
    userId: 'user_123',
    projectId: 'PRJ-001',
    taskId: 'task_001',
  });
  
  assert(SessionKey.isParentOf(parent, child), 'parent 应该是 child 的父级');
  assert(!SessionKey.isParentOf(child, parent), 'child 不应该是 parent 的父级');
});

test('SessionKey - 公共父级', () => {
  const key1 = SessionKey.build({
    channelId: 'ch_001',
    userId: 'user_123',
    projectId: 'PRJ-001',
    taskId: 'task_001',
    intentType: INTENT_TYPES.TASK,
  });
  
  const key2 = SessionKey.build({
    channelId: 'ch_001',
    userId: 'user_123',
    projectId: 'PRJ-001',
    taskId: 'task_002',
    intentType: INTENT_TYPES.TASK,
  });
  
  const parent = SessionKey.getCommonParent([key1, key2]);
  const parsed = SessionKey.parse(parent);
  
  assert(parsed.projectId === 'PRJ-001', '公共父级应该是项目级');
  assert(!parsed.taskId, '公共父级不应该有 taskId');
});

// ============ 结果汇总 ============

console.log('\n' + '═'.repeat(50));
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);

if (failed > 0) {
  console.log('\n❌ 有测试失败，请检查代码');
  process.exit(1);
} else {
  console.log('\n🌟 所有测试通过！Session 隔离系统已就绪。');
  console.log('\n📋 功能验证:');
  console.log('   ✅ 6 维度 Session Key');
  console.log('   ✅ 3 层 Session 级别 (channel/project/task)');
  console.log('   ✅ Intent 自动推断');
  console.log('   ✅ Session 完全隔离');
  console.log('   ✅ 公共父级检测');
  console.log('   ✅ 统计和监控');
}
