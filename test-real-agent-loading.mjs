// ~/pi-discord-agents/test-real-agent-loading.mjs
// 测试从 agent-core/agents/registry.json 真实加载所有 agent + 验证 skill 指令完整

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AgentRegistry } from './src/orchestrator/agent-registry.mjs';

const log = (...args) => console.log(...args);

console.log('\n🧪 真实 Agent 加载测试\n');
console.log('═'.repeat(80));

// ---- 加载 Discord 频道 ID→name 映射 ----
const discordChannels = existsSync('/tmp/ch-id-to-name.json')
  ? JSON.parse(readFileSync('/tmp/ch-id-to-name.json', 'utf8'))
  : {};

// ---- 加载 .env ----
const envText = readFileSync('.env', 'utf8');
for (const raw of envText.split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

// ---- 初始化 registry ----
const registry = new AgentRegistry({ rootDir: process.cwd(), log });

// 从 registry.json 加载(包含真实 skill/memory/tools)
const loaded = registry.loadFromRegistryJson();

// 注入频道 ID→name 映射(再 resolve channels)
registry.bindChannelIds(discordChannels);
console.log(`✅ 从 registry.json 加载 ${loaded} 个 agent\n`);

// ---- 测试 1: 所有 agent 是否正确加载 ----
console.log('📋 测试 1: Agent 列表完整性\n');
const all = registry.list({ includeHidden: false });
console.log(`   加载了 ${all.length} 个 agent:`);
for (const a of all) {
  console.log(`   ${a.emoji} ${a.displayName.padEnd(20)} (${a.id.padEnd(20)}) - ${a.skills.length} skills, ${a.channels.length} channels`);
}

// ---- 测试 2: 频道映射 ----
console.log('\n📋 测试 2: 频道 → Agent 映射\n');
const tested = ['软件开发', '销售线索', 'seo-geo', '主入口', '总控台', '📜-夜游记'];
for (const ch of tested) {
  const agent = registry.getByChannel(ch);
  if (agent) {
    const def = registry.get(agent);
    console.log(`   ✅ #${ch.padEnd(20)} → ${def.emoji} ${def.displayName}`);
  } else {
    console.log(`   ❌ #${ch.padEnd(20)} → 未映射`);
  }
}

// ---- 测试 3: Skill 加载 ----
console.log('\n📋 测试 3: 真实 Skill 文件加载\n');

const testSkills = [
  { agent: 'sales', skill: 'lead-capture' },
  { agent: 'sales', skill: 'qualification' },
  { agent: 'pm', skill: 'project-bootstrap' },
  { agent: 'coding', skill: 'react-demo' },
  { agent: 'solution', skill: 'prd-v01' },
  { agent: 'finance', skill: 'invoice-request' },
];

let skillLoaded = 0;
let skillFailed = 0;

for (const tc of testSkills) {
  const loaded = registry.loadSkillInstructions(tc.agent, tc.skill);
  if (loaded) {
    console.log(`   ✅ ${tc.agent}/${tc.skill}: ${loaded.body.length} 字符`);
    skillLoaded++;
  } else {
    console.log(`   ❌ ${tc.agent}/${tc.skill}: 加载失败`);
    skillFailed++;
  }
}

// ---- 测试 4: 加载所有 skill 文件,验证完整性 ----
console.log('\n📋 测试 4: 所有 Skill 文件可加载性\n');

let totalSkills = 0;
let okSkills = 0;
const brokenSkills = [];

for (const a of registry.list({ includeHidden: false })) {
  for (const skillPath of a.skillPaths ?? []) {
    totalSkills++;
    try {
      registry.skillLoader.load(skillPath);
      okSkills++;
    } catch (e) {
      brokenSkills.push({ agent: a.id, skillPath, error: e.message });
    }
  }
}

console.log(`   总 skill 文件: ${totalSkills}`);
console.log(`   成功加载: ${okSkills}`);
console.log(`   加载失败: ${brokenSkills.length}`);

if (brokenSkills.length > 0) {
  console.log(`\n   失败的 skill:`);
  for (const b of brokenSkills.slice(0, 10)) {
    console.log(`     - ${b.agent}: ${b.skillPath} (${b.error})`);
  }
  if (brokenSkills.length > 10) {
    console.log(`     ... 还有 ${brokenSkills.length - 10} 个`);
  }
}

// ---- 测试 5: Memory scope 权限 ----
console.log('\n📋 测试 5: Memory Scope 权限\n');

const scopeTests = [
  { agent: 'sales', action: 'read', scope: 'sales', expect: true },
  { agent: 'sales', action: 'read', scope: 'coding', expect: false },
  { agent: 'sales', action: 'write', scope: 'sales', expect: true },
  { agent: 'sales', action: 'write', scope: 'coding', expect: false },
  { agent: 'dev', action: 'read', scope: 'coding', expect: true },
  { agent: 'dev', action: 'write', scope: 'coding', expect: true },
  { agent: 'dev', action: 'read', scope: 'finance', expect: false },
  { agent: 'chief', action: 'read', scope: 'agent-internal', expect: true },
  { agent: 'chief', action: 'write', scope: 'agent-internal', expect: true },
];

let scopeOk = 0;
for (const t of scopeTests) {
  const ok = t.action === 'read'
    ? registry.canReadScope(t.agent, t.scope)
    : registry.canWriteScope(t.agent, t.scope);
  const status = ok === t.expect ? '✅' : '❌';
  if (ok === t.expect) scopeOk++;
  console.log(`   ${status} ${t.agent} ${t.action} ${t.scope}: ${ok} (期望 ${t.expect})`);
}

// ---- 测试 6: 完整 system prompt 生成 ----
console.log('\n📋 测试 6: System Prompt 生成\n');

const salesDef = registry.get('sales');
console.log(`   ${salesDef.emoji} ${salesDef.displayName} systemPrompt:`);
console.log('   ' + '─'.repeat(60));
console.log(salesDef.systemPrompt.split('\n').map(l => '   ' + l).join('\n'));

// ---- 测试 7: 类别分组 ----
console.log('\n📋 测试 7: 按 Category 分组\n');
const groups = registry.groupByCategory();
for (const [cat, agents] of Object.entries(groups)) {
  console.log(`   📂 ${cat} (${agents.length} 个)`);
  for (const a of agents) {
    console.log(`      ${a.emoji} ${a.displayName} - ${a.skills.length} skills`);
  }
}

// ---- 总结 ----
console.log('\n' + '═'.repeat(80));
console.log(`\n📊 测试结果:`);
console.log(`   Agent 加载: ${loaded}/19 个(来自 registry.json)`);
console.log(`   Skill 加载: ${okSkills}/${totalSkills} 个文件`);
console.log(`   Skill 测试: ${skillLoaded}/${testSkills.length} 个场景`);
console.log(`   Scope 权限: ${scopeOk}/${scopeTests.length} 个测试`);
console.log(`\n✅ 真实 Agent 加载测试完成\n`);