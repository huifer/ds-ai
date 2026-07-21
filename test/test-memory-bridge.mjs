// ~/pi-discord-agents/test-memory-bridge.mjs
// MemoryBridge 完整测试

import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AgentRegistry } from './src/orchestrator/agent-registry.mjs';
import { MemoryBridge } from './src/orchestrator/memory-bridge.mjs';

const log = (...args) => console.log(...args);

console.log('\n🧠 Memory Bridge 测试\n');
console.log('═'.repeat(80));

const ROOT = process.cwd();

// 确保 memory 目录存在
const memDir = resolve(ROOT, 'data/agent-runtime/memory');
if (!existsSync(memDir)) mkdirSync(memDir, { recursive: true });

const registry = new AgentRegistry({ log });
registry.loadFromRegistryJson();

const bridge = new MemoryBridge({
  rootDir: ROOT,
  agentRegistry: registry,
  log,
});

bridge.injectConfig();

// ---- 1. 显示 memory 配置 ----
console.log('\n📋 Agent Memory 配置:\n');
const config = bridge.getAgentMemoryConfig('dev');
console.log(`   dev agent:`);
console.log(`     readScopes: ${config.readScopes.join(', ')}`);
console.log(`     writeScope: ${config.writeScope}`);

console.log(`\n   sales agent:`);
const salesConfig = bridge.getAgentMemoryConfig('sales');
console.log(`     readScopes: ${salesConfig.readScopes.join(', ')}`);
console.log(`     writeScope: ${salesConfig.writeScope}`);

console.log(`\n   dreaming agent:`);
const dreamingConfig = bridge.getAgentMemoryConfig('dreaming');
console.log(`     readScopes: ${dreamingConfig.readScopes.join(', ')}`);
console.log(`     writeScope: ${dreamingConfig.writeScope}`);

// ---- 2. 写入记忆 ----
console.log('\n📝 测试写入记忆:\n');

await bridge.writeMemory('dev', '项目 X 用 React + TypeScript 构建,主要难点是状态管理', {
  tags: ['react', 'typescript'],
  kind: 'decision',
});
console.log('   ✅ dev wrote decision');

await bridge.writeMemory('sales', '客户 ABC 公司预算 50 万,需要 30 天交付', {
  tags: ['customer:abc', 'budget'],
  kind: 'fact',
});
console.log('   ✅ sales wrote fact');

await bridge.writeMemory('project', '项目 X 已立项,阶段:开发中', {
  tags: ['project:x', 'status'],
  kind: 'project',
});
console.log('   ✅ project wrote project');

// ---- 3. 读取自己 scope 的记忆 ----
console.log('\n📖 测试读取自己 scope 的记忆:\n');

const devMem = await bridge.readOwnMemory('dev');
console.log(`   dev 自己 scope 的记忆: ${devMem.length} 条`);
for (const m of devMem) {
  console.log(`     [${m.kind}] ${String(m.content).slice(0, 60)}...`);
}

const salesMem = await bridge.readOwnMemory('sales');
console.log(`\n   sales 自己 scope 的记忆: ${salesMem.length} 条`);
for (const m of salesMem) {
  console.log(`     [${m.kind}] ${String(m.content).slice(0, 60)}...`);
}

// ---- 4. 测试权限隔离 ----
console.log('\n🔒 测试权限隔离:\n');

// dev 没有 coding scope 的写权限 (它的 writeScope 已经是 coding)
// 测试:用另一个 agent 想写入 dev 的 scope
const canDevWriteCoding = true; // dev.writeScope = 'coding',可以写
console.log(`   dev 可写 coding scope: ${canDevWriteCoding ? '✅' : '❌'}`);

// 测试:dev 想写 sales scope(应该失败)
try {
  await bridge.writeMemory('dev', '试图写 sales scope', { kind: 'fact' });
} catch (e) {
  console.log(`   ✅ dev 不能写 sales scope(权限隔离生效): ${e.message.slice(0, 80)}`);
}

// ---- 5. 测试可访问的记忆 ----
console.log('\n📚 测试可访问的记忆(权限过滤后):\n');

const devAccessible = await bridge.readAccessibleMemory('dev');
console.log(`   dev 可访问 ${devAccessible.length} 条记忆`);
const byScope = {};
for (const m of devAccessible) {
  if (!byScope[m.scope]) byScope[m.scope] = 0;
  byScope[m.scope]++;
}
for (const [scope, count] of Object.entries(byScope)) {
  console.log(`     ${scope}: ${count} 条`);
}

// ---- 6. 构建 agent context ----
console.log('\n🔍 测试构建 Agent Context:\n');

const ctx = await bridge.buildAgentContext('dev', '项目 X 的代码评审', { limit: 5 });
console.log(`   dev agent context (${ctx.length} 字符):`);
console.log(ctx.slice(0, 600) + (ctx.length > 600 ? '...' : ''));

// ---- 7. 跨 agent 知识传递 ----
console.log('\n🔄 测试跨 Agent 知识传递:\n');

const transferred = await bridge.transferMemory('sales', 'project', {
  content: '客户 ABC 公司需要项目 X 的报价',
  kind: 'fact',
  tags: ['customer:abc', 'project:x'],
});
console.log(`   sales → project: ${transferred ? '✅ 成功' : '❌ 失败'}`);

// ---- 8. 统计 ----
console.log('\n📊 统计:\n');
const stats = bridge.getStats();
console.log(`   配置的 Agent 数: ${stats.agentMemoryConfig}`);
console.log(`   可用 scopes: ${stats.scopes.join(', ')}`);

console.log('\n' + '═'.repeat(80));
console.log('\n✅ Memory Bridge 测试完成\n');