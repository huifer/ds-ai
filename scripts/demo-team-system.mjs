#!/usr/bin/env node
// ~/pi-discord-agents/scripts/demo-team-system.mjs
// Agent Team 系统演示

import {
  Agent,
  Team,
  TeamTask,
  TeamEngine,
  SubagentManager,
  TEAM_TEMPLATES,
  createTeam,
  AGENT_TYPES,
  COLLABORATION_MODES,
  TASK_STATES,
} from '../src/runtime/team/index.mjs';

import {
  SessionKey,
  LayeredSessionManager,
  INTENT_TYPES,
} from '../src/runtime/session/index.mjs';

console.log(`
╔══════════════════════════════════════════════════════════════╗
║         🤖 Agent Team System Demo                           ║
║         基于 Agent Team 理念的多 Agent 协作框架              ║
╚══════════════════════════════════════════════════════════════╝
`);

// ============ 1. Session 隔离演示 ============

console.log('\n📋 1. 多层 Session 隔离系统');
console.log('─'.repeat(50));

const sessionManager = new LayeredSessionManager({
  rootDir: '/tmp/demo-sessions',
  log: () => {},
});

// 创建频道级 Session
const channelSession = sessionManager.getOrCreate({
  channelId: 'discord-general',
  userId: 'user-123',
});

// 创建项目级 Session
const projectSession = sessionManager.getOrCreate({
  channelId: 'discord-general',
  userId: 'user-123',
  projectId: 'PROJECT-X',
});

// 创建任务级 Session
const taskSession = sessionManager.getOrCreate({
  channelId: 'discord-general',
  userId: 'user-123',
  projectId: 'PROJECT-X',
  taskId: 'TASK-001',
  intentType: INTENT_TYPES.CODE_REVIEW,
});

console.log('频道级:', channelSession.key);
console.log('项目级:', projectSession.key);
console.log('任务级:', taskSession.key);
console.log('层级关系:', SessionKey.getLevel(taskSession.key));
console.log('公共父级:', SessionKey.getCommonParent([projectSession.key, taskSession.key]));

// ============ 2. Team 模板演示 ============

console.log('\n📋 2. Team 模板');
console.log('─'.repeat(50));

// 内容团队
const contentTeam = createTeam(TEAM_TEMPLATES.CONTENT);
console.log(`\n📝 内容团队: ${contentTeam.name}`);
console.log(`   成员数: ${contentTeam.agents.size}`);
for (const [id, agent] of contentTeam.agents) {
  console.log(`   - ${agent.name} (${agent.type}): ${agent.skills.join(', ')}`);
}
console.log(`   工作流: ${contentTeam.workflow.length} 步`);
for (const step of contentTeam.workflow) {
  console.log(`     ${step.step}. ${step.agent}`);
}

// 开发团队
const devTeam = createTeam(TEAM_TEMPLATES.DEVELOPMENT);
console.log(`\n💻 开发团队: ${devTeam.name}`);
console.log(`   工作流:`);
for (const step of devTeam.workflow) {
  if (step.agents) {
    console.log(`     ${step.step}. ${step.agents.join(' ‖ ')} (并行)`);
  } else {
    console.log(`     ${step.step}. ${step.agent}`);
  }
}

// ============ 3. 任务分配演示 ============

console.log('\n📋 3. 任务分配');
console.log('─'.repeat(50));

const task = new TeamTask({
  id: 'task-demo-1',
  type: 'content-creation',
  description: '创建一篇技术博客文章',
  requiredSkills: ['writing', 'copywriting'],
  priority: 'high',
});

console.log(`创建任务: ${task.id}`);
console.log(`  描述: ${task.description}`);
console.log(`  优先级: ${task.priority}`);
console.log(`  状态: ${task.state}`);

// 分配给内容撰写 Agent
contentTeam.assignTask(task, 'content-writer');
console.log(`\n分配给: content-writer`);
console.log(`  状态: ${task.state}`);
console.log(`  执行者: ${task.assignedTo}`);

// 完成任务
contentTeam.completeTask(task.id, { output: '# 技术博客\n\n这是文章内容...' });
console.log(`\n完成任务`);
console.log(`  状态: ${task.state}`);
console.log(`  结果: ${task.result.output.slice(0, 50)}...`);

// ============ 4. Subagent 管理演示 ============

console.log('\n📋 4. Subagent 生命周期管理');
console.log('─'.repeat(50));

const subagentManager = new SubagentManager({
  rootDir: '/tmp/demo-subagents',
  log: console.log,
  maxSubagents: 5,
});

// 创建临时 Subagent
const subagent1 = subagentManager.create({
  name: '数据分析 Agent',
  parentId: 'team-1',
  agentType: 'worker',
  skills: ['data-analysis', 'statistics'],
});

console.log(`\n创建 Subagent: ${subagent1.name}`);
console.log(`  ID: ${subagent1.id}`);
console.log(`  技能: ${subagent1.skills.join(', ')}`);
console.log(`  状态: ${subagent1.state}`);

// 启动
subagent1.start('session-sub-1');
console.log(`  启动后状态: ${subagent1.state}`);

// 统计
const stats = subagentManager.getStats();
console.log(`\nSubagent 统计:`);
console.log(`  总数: ${stats.total}`);
console.log(`  按类型:`, stats.byType);

subagentManager.shutdown();

// ============ 5. Team Engine 演示 ============

console.log('\n📋 5. Team Engine (Mock 模式)');
console.log('─'.repeat(50));

// 创建简单的 Team
const simpleTeam = new Team({
  id: 'demo-team',
  name: '演示团队',
  agents: [
    new Agent({ id: 'planner', name: '规划师', type: AGENT_TYPES.LEADER, skills: ['planning'] }),
    new Agent({ id: 'executor', name: '执行者', type: AGENT_TYPES.WORKER, skills: ['coding'] }),
    new Agent({ id: 'reviewer', name: '审核员', type: AGENT_TYPES.REVIEWER, skills: ['review'] }),
  ],
  workflow: [
    { step: 1, agent: 'planner' },
    { step: 2, agent: 'executor' },
    { step: 3, agent: 'reviewer' },
  ],
});

// 创建 Engine
const engine = new TeamEngine({
  rootDir: '/tmp/demo-engine',
  piBridge: null, // Mock 模式
  log: console.log,
});

// 注册 Team
engine.registerTeam(simpleTeam);
console.log(`\n注册 Team: ${simpleTeam.name}`);
console.log(`  Agents: ${simpleTeam.agents.size}`);
console.log(`  工作流: ${simpleTeam.workflow.length} 步`);

// 执行任务
const task2 = new TeamTask({
  id: 'task-demo-2',
  type: 'development',
  description: '开发新功能模块',
  requiredSkills: ['coding'],
});

const execution = await engine.execute({
  teamId: 'demo-team',
  task: task2,
  mode: COLLABORATION_MODES.SEQUENTIAL,
});

console.log(`\n执行结果:`);
console.log(`  ID: ${execution.id}`);
console.log(`  状态: ${execution.state}`);
console.log(`  耗时: ${(new Date(execution.completedAt) - new Date(execution.startedAt))}ms`);

// ============ 总结 ============

console.log('\n' + '═'.repeat(60));
console.log('📊 Agent Team 系统演示完成');
console.log('═'.repeat(60));
console.log(`
已演示功能:
  ✅ 6 维度 Session 隔离 (channel/user/project/task/intent/agent)
  ✅ 3 层 Session 级别 (channel/project/task)
  ✅ 3 种预定义 Team 模板 (开发/销售/内容)
  ✅ 4 种协作模式 (sequential/parallel/hierarchical/fan-out-in)
  ✅ Subagent 生命周期管理
  ✅ Team Engine 任务编排
  ✅ Intent 自动推断

下一步:
  🚀 集成到 entry-bot.mjs
  🚀 连接 Pi Bridge 实现真实 LLM 调用
  🚀 添加更多 Team 模板
`);
