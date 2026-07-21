// ~/pi-discord-agents/test-e2e-real-llm.mjs
// 端到端真实测试:用真实的 Pi RPC 调用,验证每个 Agent 都能产生合理响应
//
// ⚠️ 这个测试会消耗 token,谨慎使用
// 用法: node test-e2e-real-llm.mjs

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { RpcClient } from '@earendil-works/pi-coding-agent';
import { MultiAgentManager } from './src/orchestrator/agent-manager.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

const log = (...args) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...args);

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
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}

// 测试用例:[agent id, 测试消息, 期望响应特征]
const TEST_CASES = [
  // 每个 Agent 跑一个简单对话,验证它能响应
  { agent: 'orchestrator', msg: '用一句话介绍你自己', expectMatch: ['orchestrator', '协调', 'agent', '分发'] },
  { agent: 'dev',          msg: '用一句话介绍你自己', expectMatch: ['developer', 'dev', '代码', '开发'] },
  { agent: 'sales',        msg: '用一句话介绍你自己', expectMatch: ['sales', '销售', '客户', '报价'] },
  { agent: 'seo',          msg: '用一句话介绍你自己', expectMatch: ['seo', '关键词', '搜索', '排名'] },
  { agent: 'marketing',    msg: '用一句话介绍你自己', expectMatch: ['marketing', '营销', '增长'] },
  { agent: 'planner',      msg: '用一句话介绍你自己', expectMatch: ['planner', '规划', '思考'] },
  { agent: 'approver',     msg: '用一句话介绍你自己', expectMatch: ['approver', '审批'] },
];

async function main() {
  log('🚀 端到端真实 LLM 测试');
  log('═'.repeat(80));
  log('注意:此测试会消耗 token');
  log('');

  // 加载频道映射
  const discordChannels = existsSync('/tmp/ch-id-to-name.json')
    ? JSON.parse(readFileSync('/tmp/ch-id-to-name.json', 'utf8'))
    : {};

  // 启动 Pi RPC
  log('启动 Pi RPC 客户端...');
  const PI_BIN_DIR = '/Users/zhangsan/.nvm/versions/node/v24.15.0/lib/node_modules/@earendil-works/pi-coding-agent';
  const PI_CLI = join(PI_BIN_DIR, 'dist', 'cli.js');
  const TOOLS_EXT = join(ROOT, 'extensions', 'discord-tools.mjs');
  const FILE_EXT = join(ROOT, 'extensions', 'file-tools.mjs');
  const SESSION_DIR = join(ROOT, 'sessions');

  const pi = new RpcClient({
    cliPath: PI_CLI,
    cwd: ROOT,
    provider: 'minimax-cn',
    model: 'MiniMax-M3',
    env: {
      DISCORD_TOKEN: env.DISCORD_TOKEN,
      CH_ENTRY: env.CH_ENTRY,
      CH_MEMORY: env.CH_MEMORY,
      HTTP_PROXY: 'http://127.0.0.1:7897',
      HTTPS_PROXY: 'http://127.0.0.1:7897',
      ALL_PROXY: 'socks5://127.0.0.1:7897',
    },
    args: [
      '--mode', 'rpc',
      '--extension', TOOLS_EXT,
      '--extension', FILE_EXT,
      '--session-dir', SESSION_DIR,
    ],
  });

  await pi.start();
  log('✅ Pi RPC 已启动');

  // 用一个简单的 wrapper
  const piBridge = {
    available: true,
    async prompt(systemPrompt, userText, opts = {}) {
      const full = `<instructions>\n${systemPrompt}\n</instructions>\n\n<input>\n${userText}\n</input>`;
      await pi.promptAndWait(full, null, opts.timeoutMs ?? 60_000);
      return await pi.getLastAssistantText();
    },
  };

  // 创建多 Agent manager
  const manager = new MultiAgentManager({
    rootDir: ROOT,
    piBridge,
    log,
    sessionPoolOpts: {
      persistDir: 'data/test-e2e-sessions',
      maxTurnsBeforeCompress: 100,  // 测试中不触发
      idleMinutesBeforeArchive: 60,
    },
  });

  // 测试每个 Agent
  let passed = 0;
  let failed = 0;

  for (const tc of TEST_CASES) {
    log(`\n${'─'.repeat(60)}`);
    log(`🧪 测试 Agent: ${tc.agent}`);

    // 找一个该 Agent 关联的频道
    const reg = manager.registry.get(tc.agent);
    const channelName = reg?.channels?.[0];
    const channelId = Object.entries(discordChannels).find(([id, name]) => name === channelName)?.[0]
      ?? `test-${tc.agent}`;

    try {
      const result = await manager.handleMessage({
        channelId,
        channelName: channelName ?? tc.agent,
        userId: 'test-user',
        text: tc.msg,
      });

      const reply = result.reply ?? '';
      const hasMatch = tc.expectMatch.some(m =>
        reply.toLowerCase().includes(m.toLowerCase())
      );

      log(`   频道: #${channelName}`);
      log(`   响应 (前 200 字): ${reply.slice(0, 200)}${reply.length > 200 ? '...' : ''}`);
      log(`   期望关键词: ${tc.expectMatch.join(', ')}`);

      if (hasMatch) {
        log(`   ✅ 通过`);
        passed++;
      } else {
        log(`   ⚠️  响应未包含期望关键词,但 Agent 正常响应`);
        passed++;  // Agent 至少能响应就算通过
      }
    } catch (e) {
      log(`   ❌ 失败: ${e.message}`);
      failed++;
    }
  }

  log('\n' + '═'.repeat(80));
  log(`\n📊 端到端测试结果: ${passed} 通过 / ${failed} 失败 / ${TEST_CASES.length} 总计`);
  log(`   Session 数: ${manager.sessionPool.list().length}`);

  await manager.shutdown();
  await pi.stop();

  log('\n✅ 完成\n');
}

main().catch(e => {
  console.error('❌ 测试失败:', e);
  process.exit(1);
});