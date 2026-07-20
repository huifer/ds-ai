// ~/pi-discord-agents/test-routing-real.mjs
// 真实路由测试:模拟 Discord 消息,验证路由到正确的 Agent

import { readFileSync, existsSync } from 'node:fs';
import { AgentRegistry } from './src/orchestrator/agent-registry.mjs';
import { Router } from './src/orchestrator/router.mjs';
import { SessionPool } from './src/orchestrator/session-pool.mjs';

const log = (...args) => console.log(...args);

// 加载 .env
function loadEnv() {
  const text = readFileSync('.env', 'utf8');
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = loadEnv();
process.env.CH_ENTRY = env.CH_ENTRY;

// 加载真实频道映射
const discordChannels = JSON.parse(readFileSync('/tmp/ch-id-to-name.json', 'utf8'));

// 构造 ID→name 和 name→ID 双向映射
const idToName = discordChannels;
const nameToId = {};
for (const [id, name] of Object.entries(discordChannels)) nameToId[name] = id;

const registry = new AgentRegistry({ log });
registry.loadFromRegistryJson();
registry.bindChannelIds(discordChannels);

const pool = new SessionPool({
  rootDir: process.cwd(),
  log: () => {},
  persistDir: 'data/test-routing-sessions',
});

const router = new Router({ agentRegistry: registry, sessionPool: pool, log: () => {} });

// 真实场景测试用例
const testCases = [
  // [场景描述, channelName, message, expectedAgent]
  ['主入口问代码', '主入口', '帮我看看这段代码有没有 bug', 'dev'],
  ['主入口问销售', '主入口', '跟进下 ABC 公司这个客户', 'sales'],
  ['主入口问 SEO', '主入口', '分析下 "AI agent" 这个关键词的难度', 'seo'],
  ['主入口问营销', '主入口', '这个 campaign 转化率太低了', 'marketing'],
  ['主入口写推文', '主入口', '帮我写一段推文,关于新功能发布', 'domestic-editor'],
  ['主入口问英文', '主入口', 'draft a tweet about our launch', 'overseas-editor'],
  ['主入口闲聊', '主入口', '今天天气怎么样?', 'orchestrator'],
  ['主入口请求代码评审', '主入口', 'review my PR #123', 'dev'],

  // 业务频道直接路由
  ['开发频道问问题', '软件开发', '这个函数怎么优化?', 'dev'],
  ['销售频道跟进', '销售线索', '客户 ZZZ 需要联系', 'sales'],
  ['SEO 频道分析', 'seo-geo', '看下 "AGI" 的搜索量', 'seo'],
  ['审批频道批准', '审批中心', '批准这个申请', 'approver'],
  ['深度讨论频道', '深度讨论', '我们应该如何进入新市场?', 'planner', 'solution'], // 任选
  ['遐思频道', '📜-夜游记', '分析最近的对话', 'dreaming'],

  // 边角场景
  ['主入口混合', '主入口', '帮我写代码并发布到 Twitter', 'dev'], // 代码关键词权重高
  ['主入口特定', '主入口', 'audit 一下 LinkedIn 草稿', 'overseas-editor'],
];

let passed = 0;
let failed = 0;

console.log('\n🎯 真实路由测试\n');
console.log('═'.repeat(80));

for (const tc of testCases) {
  const [scenario, channelName, text, ...rest] = tc;
  const expected = rest.length === 1 ? rest[0] : rest;
  const channelId = nameToId[channelName] ?? 'unknown';

  const result = await router.route({
    channelId,
    channelName,
    userId: 'test-user',
    text,
  });

  const def = registry.get(result.agentId);
  const ok = Array.isArray(expected) ? expected.includes(result.agentId) : result.agentId === expected;
  const icon = ok ? '✅' : '⚠️';
  const conf = result.confidence.toFixed(2);

  console.log(`${icon} [${scenario}]`);
  console.log(`    #${channelName} | "${text.slice(0, 30)}"`);
  console.log(`    → ${def?.displayName ?? result.agentId} (置信度 ${conf}, ${result.reason})`);

  if (ok) {
    passed++;
  } else {
    failed++;
    console.log(`    ⚠️  期望: ${Array.isArray(expected) ? expected.join('/') : expected}, 实际: ${result.agentId}`);
  }
  console.log('');
}

console.log('═'.repeat(80));
console.log(`\n📊 测试结果: ${passed} 通过 / ${failed} 失败 / ${testCases.length} 总计\n`);

pool.shutdown();
process.exit(failed > 0 ? 1 : 0);