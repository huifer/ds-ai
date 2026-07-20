// ~/pi-discord-agents/test-command-router.mjs
// Command Router 完整测试

import { CommandRouter } from './src/orchestrator/command-router.mjs';
import { AgentRegistry } from './src/orchestrator/agent-registry.mjs';

const log = (...args) => console.log(...args);

const registry = new AgentRegistry({ log });
registry.loadFromRegistryJson();

const router = new CommandRouter({ agentRegistry: registry, log });

console.log('\n🎯 Command Router 测试\n');
console.log('═'.repeat(80));

// ---- 测试单 agent 命令 ----
const singleTests = [
  '!lead new 客户名=ABC 公司',
  '!lead list',
  '!lead qualify lead-123',
  '!quote draft',
  '!quote approve quote-456',
  '!pr new alias=test industry=AI requirement=做 demo',
  '!demo new prjId=123',
  '!state',
  '!memory list',
  '!publish rnd=abc platform=wechat',
  '!incident sev=high',
  '!qa plan',
  '!cs health customer-123',
  '!invoice request amount=10000',
  '!approve id=approval-001',
];

console.log('📋 单 Agent 命令路由:\n');
let passed = 0;
let failed = 0;

for (const text of singleTests) {
  const r = router.route(text);
  if (r && r.type === 'single') {
    console.log(`   ✅ ${text}`);
    console.log(`      → ${r.agent}/${r.skill}${r.approval ? ` (需审批: ${r.approval})` : ''}`);
    passed++;
  } else {
    console.log(`   ❌ ${text} → 未匹配`);
    failed++;
  }
}

// ---- 测试 team 命令 ----
console.log('\n📋 Team 命令路由:\n');

const teamTests = [
  '!lead-to-contract 客户ABC',
  '!idea-to-publish 灵感XYZ',
  '!pr-full-cycle 项目TEST',
];

for (const text of teamTests) {
  const r = router.route(text);
  if (r && r.type === 'team') {
    console.log(`   ✅ ${text}`);
    console.log(`      → Team: ${r.team.description}`);
    r.team.steps.forEach(s => {
      console.log(`         ${s.label} → ${s.agent}/${s.skill}`);
    });
    if (r.team.finalApproval) {
      console.log(`         ⚠️  最终审批: ${r.team.finalApproval}`);
    }
    passed++;
  } else {
    console.log(`   ❌ ${text} → 未匹配`);
    failed++;
  }
}

// ---- 列出所有命令 ----
console.log('\n📋 所有命令列表(按 agent 分类):\n');
const cmds = router.listCommands();
const byAgent = {};
for (const c of cmds) {
  if (!byAgent[c.agent]) byAgent[c.agent] = [];
  byAgent[c.agent].push(c);
}
for (const [agent, list] of Object.entries(byAgent).sort()) {
  console.log(`   🤖 ${agent} (${list.length} 个命令)`);
  for (const c of list) {
    const ap = c.approval ? ` ⚠️审批` : '';
    console.log(`      ${c.signature.padEnd(28)} - ${c.description}${ap}`);
  }
}

console.log('\n' + '═'.repeat(80));
console.log(`\n📊 测试结果: ${passed} 通过 / ${failed} 失败\n`);

process.exit(failed > 0 ? 1 : 0);