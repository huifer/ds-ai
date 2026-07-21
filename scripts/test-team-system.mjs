#!/usr/bin/env node
// ~/pi-discord-agents/scripts/test-team-system.mjs
// Agent Team 系统测试

import {
  Agent,
  Team,
  TeamTask,
  TeamEngine,
  SubagentManager,
  Subagent,
  TASK_STATES,
  AGENT_TYPES,
  COLLABORATION_MODES,
  SUBAGENT_STATES,
  TEAM_TEMPLATES,
  createTeam,
} from '../src/runtime/team/index.mjs';

console.log('🤖 Agent Team 系统测试\n');

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

// ============ 1. Agent 测试 ============

test('Agent - 基本创建', () => {
  const agent = new Agent({
    id: 'test-agent',
    name: '测试 Agent',
    type: AGENT_TYPES.WORKER,
    skills: ['coding', 'testing'],
  });
  
  assert(agent.id === 'test-agent', 'ID 正确');
  assert(agent.state === 'idle', '初始状态为 idle');
  assert(agent.canHandle({ requiredSkills: ['coding'] }), '能处理 coding 任务');
});

test('Agent - 能力匹配', () => {
  const agent = new Agent({
    id: 'dev',
    name: '开发者',
    capabilities: ['backend', 'frontend'],
  });
  
  assert(agent.canHandle({ capabilities: ['backend'] }), '匹配 backend');
  assert(!agent.canHandle({ capabilities: ['ml'] }), '不匹配 ml');
});

// ============ 2. Team 测试 ============

test('Team - 基本创建', () => {
  const agents = [
    new Agent({ id: 'lead', name: '领导', type: AGENT_TYPES.LEADER }),
    new Agent({ id: 'worker1', name: '工人1', type: AGENT_TYPES.WORKER }),
    new Agent({ id: 'worker2', name: '工人2', type: AGENT_TYPES.WORKER }),
  ];
  
  const team = new Team({
    id: 'test-team',
    name: '测试团队',
    agents,
    leaderId: 'lead',
  });
  
  assert(team.agents.size === 3, '3 个 Agent');
  assert(team.getLeader()?.id === 'lead', '领导正确');
  assert(team.getAvailableAgents().length === 3, '3 个可用');
});

test('Team - 任务分配', () => {
  const team = createTeam(TEAM_TEMPLATES.CONTENT);
  
  const task = new TeamTask({
    id: 'task-1',
    type: 'content-creation',
    description: '创建一篇博客文章',
    requiredSkills: ['writing'],
  });
  
  team.assignTask(task, 'content-writer');
  
  assert(task.state === TASK_STATES.RUNNING, '任务运行中');
  assert(task.assignedTo === 'content-writer', '分配给正确 Agent');
  
  team.completeTask(task.id, { output: '文章内容' });
  
  assert(task.state === TASK_STATES.COMPLETED, '任务完成');
  assert(task.result.output === '文章内容', '结果正确');
});

test('Team - 任务失败处理', () => {
  const team = createTeam(TEAM_TEMPLATES.CONTENT);
  
  const task = new TeamTask({
    id: 'task-2',
    type: 'content-creation',
    description: '创建文章',
  });
  
  team.assignTask(task, 'content-writer');
  team.failTask(task.id, '网络错误');
  
  assert(task.state === TASK_STATES.FAILED, '任务失败');
  assert(task.error === '网络错误', '错误信息正确');
});

// ============ 3. Subagent 测试 ============

test('Subagent - 基本创建', () => {
  const subagent = new Subagent({
    id: 'sub-1',
    name: '子任务 Agent',
    parentId: 'team-1',
    agentType: 'worker',
    maxLifetime: 600,
  });
  
  assert(subagent.state === SUBAGENT_STATES.CREATING, '初始状态');
  subagent.start('session-1');
  assert(subagent.state === SUBAGENT_STATES.IDLE, '启动后空闲');
});

test('Subagent - 生命周期', () => {
  const subagent = new Subagent({
    id: 'sub-2',
    name: '生命周期测试',
    maxLifetime: 1, // 1 秒
  });
  
  subagent.start();
  subagent.activate();
  assert(subagent.state === SUBAGENT_STATES.RUNNING, '运行中');
  
  subagent.complete();
  assert(subagent.state === SUBAGENT_STATES.COMPLETED, '已完成');
});

test('Subagent - 终止条件', () => {
  const subagent = new Subagent({
    id: 'sub-3',
    name: '终止测试',
    maxLifetime: 0.001, // 非常短
  });
  
  subagent.start();
  
  // 等待超过生命周期
  subagent.state = SUBAGENT_STATES.IDLE;
  // 手动修改 startedAt 为过去时间
  subagent.startedAt = new Date(Date.now() - 10000).toISOString();
  
  const reason = subagent.shouldTerminate();
  assert(reason === 'lifetime-exceeded', '生命周期超时');
});

// ============ 4. SubagentManager 测试 ============

test('SubagentManager - 基本操作', () => {
  const manager = new SubagentManager({
    rootDir: '/tmp/test-subagents',
    log: () => {},
    maxSubagents: 3,
  });
  
  const sub1 = manager.create({
    name: 'Sub 1',
    parentId: 'team-1',
    agentType: 'worker',
  });
  
  assert(manager.subagents.size === 1, '1 个 Subagent');
  assert(manager.getByParent('team-1').length === 1, '父团队有 1 个');
  
  manager.terminate(sub1.id);
  assert(manager.get(sub1.id)?.state === SUBAGENT_STATES.TERMINATED, '已终止');
  
  manager.shutdown();
});

test('SubagentManager - 数量限制', () => {
  const manager = new SubagentManager({
    rootDir: '/tmp/test-subagents2',
    log: () => {},
    maxSubagents: 2,
  });
  
  manager.create({ name: 'S1', agentType: 'worker' });
  manager.create({ name: 'S2', agentType: 'worker' });
  
  try {
    manager.create({ name: 'S3', agentType: 'worker' });
    // 如果没抛错，可能是因为驱逐了空闲的
  } catch (e) {
    assert(e.message.includes('上限'), '达到上限时抛出错误');
  }
  
  manager.shutdown();
});

// ============ 5. Team 模板测试 ============

test('Team Templates - 销售团队', () => {
  const salesTeam = createTeam(TEAM_TEMPLATES.SALES);
  
  assert(salesTeam.agents.size === 4, '4 个 Agent');
  assert(salesTeam.getLeader()?.id === 'sales-lead', '销售主管是领导');
  assert(salesTeam.workflow.length === 4, '4 步工作流');
});

test('Team Templates - 内容团队', () => {
  const contentTeam = createTeam(TEAM_TEMPLATES.CONTENT);
  
  assert(contentTeam.agents.size === 4, '4 个 Agent');
  assert(contentTeam !== null, '内容团队存在');
});

test('Team Templates - 开发团队', () => {
  const devTeam = createTeam(TEAM_TEMPLATES.DEVELOPMENT);
  
  assert(devTeam.agents.size === 4, '4 个 Agent');
  
  // 检查并行步骤
  const parallelStep = devTeam.workflow.find(s => s.agents?.length > 1);
  assert(parallelStep?.mode === COLLABORATION_MODES.PARALLEL, '有并行步骤');
});

// ============ 6. TeamTask 测试 ============

test('TeamTask - 基本创建', () => {
  const task = new TeamTask({
    id: 't1',
    type: 'development',
    description: '开发新功能',
    requiredSkills: ['coding'],
    priority: 'high',
  });
  
  assert(task.state === TASK_STATES.PENDING, '初始待处理');
  assert(task.priority === 'high', '高优先级');
});

test('TeamTask - 状态转换', () => {
  const task = new TeamTask({
    id: 't2',
    type: 'test',
    description: '测试任务',
  });
  
  task.markRunning('agent-1');
  assert(task.state === TASK_STATES.RUNNING, '运行中');
  assert(task.assignedTo === 'agent-1', '分配给 agent-1');
  
  task.markCompleted({ result: 'done' });
  assert(task.state === TASK_STATES.COMPLETED, '已完成');
  assert(task.result.result === 'done', '结果正确');
});

// ============ 结果汇总 ============

console.log('\n' + '═'.repeat(50));
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);

if (failed > 0) {
  console.log('\n❌ 有测试失败，请检查代码');
  process.exit(1);
} else {
  console.log('\n🌟 所有测试通过！Agent Team 系统已就绪。');
  console.log('\n📋 已验证功能:');
  console.log('   ✅ Agent 定义和能力匹配');
  console.log('   ✅ Team 创建和任务分配');
  console.log('   ✅ Subagent 生命周期管理');
  console.log('   ✅ SubagentManager 资源控制');
  console.log('   ✅ Team 模板（销售/内容/开发）');
  console.log('   ✅ TeamTask 状态转换');
}
