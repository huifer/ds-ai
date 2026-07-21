#!/usr/bin/env node
// ~/pi-discord-agents/scripts/smoke-test.mjs
// 不连 Discord,只测 Pi RPC + extension 链路。
// 用法:node scripts/smoke-test.mjs "你是谁?"
import { spawn } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { RpcClient } from '@earendil-works/pi-coding-agent';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PI_BIN_DIR = '/Users/zhangsan/.nvm/versions/node/v24.15.0/lib/node_modules/@earendil-works/pi-coding-agent';
const PI_CLI = join(PI_BIN_DIR, 'dist', 'cli.js');

// 读 .env
function loadEnv() {
  const envPath = join(ROOT, '.env');
  const out = {};
  if (!existsSync(envPath)) return out;
  for (const raw of readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv();
const userMsg = process.argv[2] || '你是?请用一句话回答。';

console.log('[smoke] 启动 Pi RPC...');
const client = new RpcClient({
  cliPath: PI_CLI,
  cwd: ROOT,
  provider: 'minimax-cn',
  model: 'MiniMax-M3',
  env: {
    DISCORD_TOKEN: env.DISCORD_TOKEN,
    CH_ENTRY: env.CH_ENTRY,
    CH_MEMORY: env.CH_MEMORY,
    CH_IDEAS: env.CH_IDEAS,
    CH_BUILD: env.CH_BUILD,
    CH_SYSTEM: env.CH_SYSTEM,
    CH_RSS: env.CH_RSS,
    CH_DAILY: env.CH_DAILY,
    CH_GH: env.CH_GH,
    CH_USAGE: env.CH_USAGE || env.CH_TREND,
    CH_TREND: env.CH_TREND || env.CH_USAGE,
    CH_OPPORTUNITY: env.CH_OPPORTUNITY,
  },
  args: [
    '--mode', 'rpc',
    '--extension', join(ROOT, 'extensions', 'discord-tools.mjs'),
    '--session-dir', join(ROOT, 'sessions'),
    '--name', `smoke-${Date.now()}`,
  ],
});

let buffer = '';
let messageCount = 0;
client.onEvent((ev) => {
  if (ev.type === 'message_update' && ev.message?.role === 'assistant') {
    const d = ev.assistantMessageEvent;
    if (d?.type === 'text_delta') {
      process.stdout.write(d.delta);
      buffer += d.delta;
    }
  }
  if (ev.type === 'message_end' && ev.message?.role === 'assistant') messageCount++;
  if (ev.type === 'tool_execution_end' && ev.toolName?.startsWith('discord_')) {
    console.error(`\n[smoke] 工具调用: ${ev.toolName}`);
  }
  if (ev.type === 'extension_error') console.error(`\n[smoke] extension error: ${ev.error}`);
});

await client.start();
console.log('[smoke] Pi 已启动,发送 prompt...');

await client.prompt(userMsg);
console.log('\n[smoke] waiting for idle...');
await client.waitForIdle(30000);
console.log(`\n[smoke] 完成 · assistant messages: ${messageCount} · 输出长度: ${buffer.length}`);

await client.stop();
console.log('[smoke] 已退出');
