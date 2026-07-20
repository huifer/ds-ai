// ~/pi-discord-agents/test-team-e2e.mjs
// Team Engine 真实端到端测试: 用真实 LLM 跑一个完整 team

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RpcClient } from '@earendil-works/pi-coding-agent';
import { AgentRegistry } from './src/orchestrator/agent-registry.mjs';
import { SessionPool } from './src/orchestrator/session-pool.mjs';
import { TeamEngine } from './src/orchestrator/team-engine.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

const log = (...args) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...args);

// 加载 .env
const env = readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const m = line.trim().match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) acc[m[1]] = m[2];
  return acc;
}, {});
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}

const discordChannels = existsSync('/tmp/ch-id-to-name.json')
  ? JSON.parse(readFileSync('/tmp/ch-id-to-name.json', 'utf8'))
  : {};

async function main() {
  log('🚀 Team Engine 真实端到端测试');
  log('═'.repeat(80));

  // 启动 Pi RPC
  const PI_BIN_DIR = '/Users/zhangsan/.nvm/versions/node/v24.15.0/lib/node_modules/@earendil-works/pi-coding-agent';
  const PI_CLI = join(PI_BIN_DIR, 'dist', 'cli.js');
  const TOOLS_EXT = join(ROOT, 'extensions', 'discord-tools.mjs');
  const FILE_EXT = join(ROOT, 'extensions', 'file-tools.mjs');
  const SESSION_DIR = join(ROOT, 'sessions-team-e2e');

  const pi = new RpcClient({
    cliPath: PI_CLI,
    cwd: ROOT,
    provider: 'minimax-cn',
    model: 'MiniMax-M3',
    env: {
      DISCORD_TOKEN: env.DISCORD_TOKEN,
      CH_ENTRY: env.CH_ENTRY,
      HTTP_PROXY: 'http://127.0.0.1:7897',
      HTTPS_PROXY: 'http://127.0.0.1:7897',
      ALL_PROXY: 'socks5://127.0.0.1:7897',
    },
    args: ['--mode', 'rpc', '--extension', TOOLS_EXT, '--extension', FILE_EXT, '--session-dir', SESSION_DIR],
  });

  await pi.start();
  log('✅ Pi RPC 启动');

  const piBridge = {
    available: true,
    async prompt(systemPrompt, userText, opts) {
      const full = `<instructions>\n${systemPrompt}\n</instructions>\n\n<input>\n${userText}\n</input>`;
      await pi.promptAndWait(full, null, opts?.timeoutMs ?? 120_000);
      return await pi.getLastAssistantText();
    },
  };

  // 加载 registry
  const registry = new AgentRegistry({ rootDir: ROOT, log });
  registry.loadFromRegistryJson();
  registry.bindChannelIds(discordChannels);

  const pool = new SessionPool({
    rootDir: ROOT,
    log: () => {},
    persistDir: 'data/test-team-e2e-sessions',
    maxTurnsBeforeCompress: 50,
  });

  const engine = new TeamEngine({
    registry,
    sessionPool: pool,
    multiAgentManager: { piBridge },
    log,
    rootDir: ROOT,
  });

  log(`✅ 加载 ${registry.list().length} 个 agent`);

  // 跑一个简化的 lead-to-contract
  log('\n🤝 执行 Team: lead-to-contract (真实 LLM)');
  log('─'.repeat(80));

  const result = await engine.execute({
    teamId: 'lead-to-contract',
    originalInput: '客户 ABC 科技,联系人张总,需要 AI 客服系统,预算 30 万,30 天交付',
    userId: 'test-user',
    channelId: 'test-channel',
  });

  log('\n📊 Team 执行结果:');
  log(`   ID: ${result.id}`);
  log(`   状态: ${result.status}`);
  log(`   步骤数: ${result.stepResults.length}`);

  for (const r of result.stepResults) {
    log(`\n   ${r.label ?? `步骤 ${r.stepNum}`}:`);
    log(`     Agent/Skill: ${r.agent}/${r.skill}`);
    log(`     状态: ${r.status}`);
    if (r.result?.reply) {
      log(`     回复 (前 250 字):`);
      log('     ' + r.result.reply.slice(0, 250).replace(/\n/g, '\n     '));
    }
    if (r.error) log(`     ❌ ${r.error}`);
  }

  log('\n' + '═'.repeat(80));
  log(`\n✅ 状态: ${result.status}`);
  log(`📁 持久化: data/team-execution/${result.id}.json`);

  pool.shutdown();
  await pi.stop();
}

main().catch(e => {
  console.error('❌ 测试失败:', e);
  process.exit(1);
});