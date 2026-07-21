// ~/pi-discord-agents/test-team-engine.mjs
// Team Engine 测试

import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { AgentRegistry } from './src/orchestrator/agent-registry.mjs';
import { SessionPool } from './src/orchestrator/session-pool.mjs';
import { MultiAgentManager } from './src/orchestrator/agent-manager.mjs';
import { TeamEngine, TEAMS } from './src/orchestrator/team-engine.mjs';

const log = (...args) => console.log(...args);

console.log('\n🤝 Team Engine 测试\n');
console.log('═'.repeat(80));

// Mock piBridge - 不实际调用 LLM,只返回模拟响应
const mockPiBridge = {
  available: true,
  async prompt(systemPrompt, userText, opts) {
    return `[Mock ${Date.now()}] ${userText.slice(0, 80)}`;
  },
};

const registry = new AgentRegistry({ rootDir: process.cwd(), log });
registry.loadFromRegistryJson();

const pool = new SessionPool({
  rootDir: process.cwd(),
  log: () => {},
  persistDir: 'data/test-team-sessions',
});

const manager = new MultiAgentManager({
  rootDir: process.cwd(),
  piBridge: mockPiBridge,
  log,
  sessionPoolOpts: {
    persistDir: 'data/test-team-sessions',
  },
});

const engine = new TeamEngine({
  registry,
  sessionPool: pool,
  multiAgentManager: manager,
  log,
});

// ---- 测试 1: 列出所有 team ----
console.log('\n📋 测试 1: 列出所有 Team\n');
const teams = engine.listTeams();
for (const t of teams) {
  console.log(`   🤝 ${t.id}`);
  console.log(`      ${t.description}`);
  console.log(`      步骤: ${t.steps.join(' → ')}`);
  if (t.finalApproval) console.log(`      最终审批: ${t.finalApproval}`);
  console.log('');
}

// ---- 测试 2: 匹配 team 命令 ----
console.log('\n📋 测试 2: 命令匹配\n');
const testInputs = [
  '!lead-to-contract 客户ABC',
  '!idea-to-publish 灵感XYZ',
  '!pr-full-cycle 项目TEST',
  '!sales-deep-dive 客户ABC',
  '!incident-response 支付服务异常',
  '!lead new 客户ABC', // 普通命令,不匹配
];

for (const text of testInputs) {
  const m = engine.match(text);
  if (m) {
    console.log(`   ✅ "${text}" → ${m.team.id} (参数: ${m.args[0].slice(0, 30)})`);
  } else {
    console.log(`   ❌ "${text}" → 不匹配`);
  }
}

// ---- 测试 3: 执行简化 team ----
console.log('\n📋 测试 3: 执行 Team (mock LLM)\n');

// 先清空 team-execution 历史
const execDir = 'data/team-execution';
if (existsSync(execDir)) {
  rmSync(execDir, { recursive: true, force: true });
}

const result = await engine.execute({
  teamId: 'lead-to-contract',
  originalInput: '客户 ABC 公司,需要 AI Agent 平台,预算 50 万',
  userId: 'test-user',
  channelId: 'test-channel',
});

console.log(`\n   执行结果:`);
console.log(`   ID: ${result.id}`);
console.log(`   状态: ${result.status}`);
console.log(`   步骤数: ${result.stepResults.length}`);
console.log(`   耗时: ${((new Date(result.completedAt) - new Date(result.startedAt)) / 1000).toFixed(1)}s`);

console.log(`\n   各步骤:`);
for (const r of result.stepResults) {
  console.log(`   - 步骤 ${r.stepNum}: ${r.label ?? `${r.agent}/${r.skill}`} → ${r.status}`);
  if (r.result?.reply) {
    console.log(`     输出: ${r.result.reply.slice(0, 80)}...`);
  }
  if (r.error) console.log(`     错误: ${r.error.slice(0, 80)}`);
}

// ---- 测试 4: 查看执行历史 ----
console.log('\n📋 测试 4: 执行历史\n');
const history = engine.listExecutions({ limit: 5 });
for (const h of history) {
  console.log(`   ${h.id} (${h.teamId}): ${h.status} (${h.stepResults.length} 步骤)`);
}

// ---- 测试 5: 验证持久化 ----
console.log('\n📋 测试 5: 持久化验证\n');
if (existsSync('data/team-execution')) {
  const files = readdirSync('data/team-execution');
  console.log(`   已持久化 ${files.length} 个 team 执行记录`);
  if (files.length > 0) {
    const firstFile = readFileSync(`data/team-execution/${files[0]}`, 'utf8');
    const data = JSON.parse(firstFile);
    console.log(`   样例 (${files[0]}):`);
    console.log(`     teamId: ${data.teamId}`);
    console.log(`     status: ${data.status}`);
    console.log(`     stepResults: ${data.stepResults.length}`);
  }
}

pool.shutdown();
await manager.shutdown();

console.log('\n' + '═'.repeat(80));
console.log('\n✅ Team Engine 测试完成\n');