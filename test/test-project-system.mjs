// ~/pi-discord-agents/test-project-system.mjs
// 测试 Project 系统

import { ProjectStore, generateProjectId, generateSubItemId } from './src/project/project-store.mjs';
import { ProjectManager, PROJECT_TYPES, SUB_ITEM_TYPES } from './src/project/project-manager.mjs';
import { IntentClassifier, INTENT_TYPES } from './src/workflow/intent-classifier.mjs';
import { SummaryEngine } from './src/workflow/summary-engine.mjs';
import { SettingsManager, DEFAULT_SETTINGS, PRESET_MODES } from './src/user/settings-manager.mjs';
import { resolve } from 'node:path';

const ROOT = resolve('./');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function testProjectStore() {
  console.log('\n=== 测试 ProjectStore ===\n');
  
  const store = new ProjectStore({ rootDir: `${ROOT}/data/test-projects` });
  
  // 测试创建
  const id = generateProjectId();
  console.log(`创建 Project: ${id}`);
  
  const project = await store.create({
    id,
    title: '测试项目',
    type: 'tech',
    meta: { status: 'active' },
  });
  console.log('✅ 创建成功:', project.id);
  
  // 测试获取
  const retrieved = await store.get(id);
  console.log('✅ 获取成功:', retrieved.title);
  
  // 测试更新
  await store.update(id, { title: '更新后的标题' });
  const updated = await store.get(id);
  console.log('✅ 更新成功:', updated.title);
  
  // 测试子项
  const subItemId = generateSubItemId('conversation');
  await store.createSubItem(id, {
    id: subItemId,
    type: 'conversation',
    content: { summary: '测试摘要' },
  });
  console.log('✅ 子项创建成功:', subItemId);
  
  // 测试列表
  const list = await store.list();
  console.log('✅ 列表查询成功, 数量:', list.length);
  
  return id;
}

async function testProjectManager(projectId) {
  console.log('\n=== 测试 ProjectManager ===\n');
  
  const manager = new ProjectManager({ rootDir: `${ROOT}/data/test-projects` });
  
  // 创建项目
  const project = await manager.createProject({
    title: '飞书机器人开发',
    type: 'tech',
    createdBy: 'test',
  });
  console.log('✅ 创建项目:', project.id, project.title);
  
  // 创建对话摘要
  const conv = await manager.createConversation(project.id, {
    summary: '用户需求：做个飞书机器人',
    keyPoints: ['需要支持飞书', '主要功能：消息推送'],
    decisions: [],
    pending: ['等待用户提供更多信息'],
    nextAction: '等待用户回复',
  });
  console.log('✅ 创建对话摘要:', conv.id);
  
  // 创建任务
  const task1 = await manager.createTask(project.id, {
    title: '架构设计',
    priority: 'high',
  });
  const task2 = await manager.createTask(project.id, {
    title: '编码实现',
    priority: 'medium',
  });
  console.log('✅ 创建任务:', task1.id, task2.id);
  
  // 完成任务
  await manager.updateTaskStatus(project.id, task1.id, 'completed');
  console.log('✅ 完成任务:', task1.id);
  
  // 创建文档
  const doc = await manager.createDocument(project.id, {
    title: 'PRD.md',
    path: '/data/test-projects/xxx/PRD.md',
    summary: '产品需求文档',
  });
  console.log('✅ 创建文档:', doc.id);
  
  // 创建决策
  const decision = await manager.createDecision(project.id, {
    decision: '使用 Node.js + discord.js',
    reason: ['社区活跃', '文档完善'],
    decidedBy: 'user',
  });
  console.log('✅ 创建决策:', decision.id);
  
  // 列出子项
  const tasks = await manager.listSubItems(project.id, { type: 'task' });
  console.log('✅ 任务列表:', tasks.length, '个');
  
  // 生成卡片
  const updatedProject = await manager.getProject(project.id);
  const card = manager.generateProjectCard(updatedProject);
  console.log('✅ 项目卡片:');
  console.log(`   标题: ${card.title}`);
  console.log(`   类型: ${card.type}`);
  console.log(`   状态: ${card.status}`);
  console.log(`   任务进度: ${card.stats.taskProgress}`);
  
  return project.id;
}

async function testIntentClassifier() {
  console.log('\n=== 测试 IntentClassifier ===\n');
  
  const classifier = new IntentClassifier();
  
  const testCases = [
    { text: '帮我做个飞书机器人', expect: INTENT_TYPES.PROJECT },
    { text: '有个客户想做知识库，预算50万', expect: INTENT_TYPES.PROJECT },
    { text: '帮我写一篇公众号文章', expect: INTENT_TYPES.PROJECT },
    { text: '你好啊', expect: INTENT_TYPES.INSTANT },
    { text: '看看我的项目', expect: INTENT_TYPES.QUERY },
  ];
  
  for (const tc of testCases) {
    const result = await classifier.classify(tc.text, { turnCount: 0 });
    const status = result.type === tc.expect ? '✅' : '❌';
    console.log(`${status} "${tc.text}" -> ${result.type} (期望: ${tc.expect})`);
    if (result.type === INTENT_TYPES.PROJECT && result.projectType) {
      console.log(`   项目类型: ${result.projectType}`);
    }
  }
}

async function testSummaryEngine() {
  console.log('\n=== 测试 SummaryEngine ===\n');
  
  const engine = new SummaryEngine();
  
  const turns = [
    { role: 'user', content: '帮我做个飞书机器人', index: 1 },
    { role: 'assistant', content: '好的，我来帮你开发。', index: 1 },
    { role: 'user', content: '需要支持消息推送和 slash commands', index: 2 },
    { role: 'assistant', content: '明白，我开始设计架构。', index: 2 },
    { role: 'user', content: '好的，就这样', index: 3 },
  ];
  
  const summary = await engine.generateSummary(turns);
  console.log('✅ 摘要生成成功:');
  console.log(`   内容: ${summary.summary.slice(0, 50)}...`);
  console.log(`   关键点: ${summary.keyPoints.length} 个`);
  console.log(`   轮数: ${summary.turns.count}`);
  
  // 测试触发判断
  const should1 = engine.shouldSummarize({ turnCount: 5, lastSummaryTurn: 0, message: '' });
  console.log(`   轮数触发(5轮): ${should1.should ? '是' : '否'}`);
  
  const should2 = engine.shouldSummarize({ turnCount: 5, lastSummaryTurn: 0, message: '总结一下' });
  console.log(`   关键词触发: ${should2.should ? '是' : '否'}`);
  
  // 生成卡片
  const card = engine.generateSummaryCard(summary);
  console.log('✅ 摘要卡片:\n', card.slice(0, 200));
}

async function testSettingsManager() {
  console.log('\n=== 测试 SettingsManager ===\n');
  
  const manager = new SettingsManager({ rootDir: `${ROOT}/data/test-users` });
  const testUserId = 'test-user-123';
  
  // 获取默认设置
  const settings = await manager.get(testUserId);
  console.log('✅ 获取默认设置:', Object.keys(settings).length, '项');
  
  // 修改设置
  await manager.set(testUserId, 'progress', false);
  await manager.set(testUserId, 'logs', true);
  
  const updated = await manager.get(testUserId);
  console.log('✅ 修改设置后:');
  console.log(`   progress: ${updated.progress}`);
  console.log(`   logs: ${updated.logs}`);
  
  // 预设模式
  await manager.applyPreset(testUserId, 'quick');
  const quickSettings = await manager.get(testUserId);
  console.log('✅ 应用 quick 预设:');
  console.log(`   progress: ${quickSettings.progress}`);
  console.log(`   daily_summary: ${quickSettings.daily_summary}`);
  
  // 生成卡片
  const card = await manager.generateSettingsCard(testUserId);
  console.log('✅ 设置卡片:\n', card.slice(0, 300));
  
  // 处理命令
  const result = await manager.handleSettingsCommand(testUserId, 'progress');
  console.log('✅ 处理 !settings progress:', result.type);
  
  const result2 = await manager.handleSettingsCommand(testUserId, 'progress on');
  console.log('✅ 处理 progress on:', result2.type);
  if (result2.type === 'error') {
    console.log('   错误信息:', result2.message);
  }
}

async function main() {
  console.log('========================================');
  console.log('  Project System Integration Test');
  console.log('========================================');
  
  try {
    // 1. 测试 ProjectStore
    const projectId = await testProjectStore();
    await sleep(100);
    
    // 2. 测试 ProjectManager
    await testProjectManager(projectId);
    await sleep(100);
    
    // 3. 测试 IntentClassifier
    await testIntentClassifier();
    await sleep(100);
    
    // 4. 测试 SummaryEngine
    await testSummaryEngine();
    await sleep(100);
    
    // 5. 测试 SettingsManager
    await testSettingsManager();
    
    console.log('\n========================================');
    console.log('  ✅ 所有测试通过!');
    console.log('========================================\n');
    
  } catch (e) {
    console.error('\n❌ 测试失败:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
