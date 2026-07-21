#!/usr/bin/env node
// scripts/test-integration.mjs
// RSS hub 集成测试 —— 端到端走 trigger-job,验证 Pi 能:
//   1) 读画像
//   2) 调 rss-fetcher
//   3) 生成 md
//   4) 落本地 + 推 Discord #rss
//
// 跑法:
//   node scripts/test-integration.mjs            # 跑 RSS(默认)
//   node scripts/test-integration.mjs daily        # 跑每日总结
//   node scripts/test-integration.mjs rss 60      # 60s 超时
//
// 不修改 daemon 的 scheduler,只启动一次性 Pi RPC。
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';

// 全局代理(同 entry-bot)
try { await import('global-agent').then(m => m.bootstrap()); } catch {}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PI_BIN_DIR = '/Users/zhangsan/.nvm/versions/node/v24.15.0/lib/node_modules/@earendil-works/pi-coding-agent';
const PI_CLI = join(PI_BIN_DIR, 'dist', 'cli.js');
const LOG_PATH = resolve(ROOT, 'logs', 'integration-test.log');

const kind = process.argv[2] || 'rss';
const timeoutSec = parseInt(process.argv[3] || '300', 10);

function log(...a) {
  const ts = new Date().toISOString().slice(11, 23);
  const m = `[test ${ts}] ${a.join(' ')}\n`;
  process.stdout.write(m);
  mkdirSync(resolve(ROOT, 'logs'), { recursive: true });
  try { appendFileSync(LOG_PATH, m); } catch {}
}

function parseEnv(text) {
  const out = {};
  for (const raw of text.split('\n')) {
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

const envPath = resolve(ROOT, '.env');
if (!existsSync(envPath)) {
  console.error(`❌ .env 不存在: ${envPath}`);
  process.exit(1);
}
const env = parseEnv(readFileSync(envPath, 'utf8'));

// 北京时间今天
const now = new Date();
const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
const tzMs = utcMs + 8 * 3600_000;
const d = new Date(tzMs);
const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;

log(`任务: ${kind} · 日期: ${dateKey} · 超时: ${timeoutSec}s`);

const { buildRssPrompt } = await import('../src/jobs/rss-daily.mjs');
const { buildDailySummaryPrompt } = await import('../src/jobs/daily-summary.mjs');
const prompt = kind === 'rss'
  ? buildRssPrompt({ dateKey })
  : kind === 'daily'
  ? buildDailySummaryPrompt({ dateKey })
  : (() => { throw new Error(`未知任务: ${kind}(只支持 rss / daily)`); })();

log(`prompt 大小: ${prompt.length} chars`);

// 启一次性 Pi
const { RpcClient } = await import('@earendil-works/pi-coding-agent');
const pi = new RpcClient({
  cliPath: PI_CLI,
  cwd: ROOT,
  provider: 'minimax-cn',
  model: 'MiniMax-M3',
  env: {
    ...process.env,
    DISCORD_TOKEN: env.DISCORD_TOKEN,
    CH_ENTRY: env.CH_ENTRY,
    CH_RSS: env.CH_RSS,
    CH_DAILY: env.CH_DAILY,
    CH_MEMORY: env.CH_MEMORY, CH_IDEAS: env.CH_IDEAS, CH_BUILD: env.CH_BUILD,
    CH_SYSTEM: env.CH_SYSTEM,
  },
  args: [
    '--mode', 'rpc',
    '--extension', join(ROOT, 'extensions/discord-tools.mjs'),
    '--extension', join(ROOT, 'extensions/file-tools.mjs'),
    '--session-dir', join(ROOT, 'sessions'),
    '--name', `test-${kind}-${dateKey}`,
  ],
});

let assistantChars = 0;
let toolCalls = 0;
let lastActivityAt = Date.now();

pi.onEvent((ev) => {
  lastActivityAt = Date.now();
  if (ev.type === 'message_update' && ev.message?.role === 'assistant') {
    const delta = ev.assistantMessageEvent;
    if (delta?.type === 'text_delta') {
      assistantChars += delta.delta.length;
      process.stdout.write(delta.delta);
    }
  }
  if (ev.type === 'message_end' && ev.message?.role === 'assistant') {
    log(`[Pi 输出累计 ${assistantChars} chars]`);
  }
  if (ev.type === 'tool_execution_start') {
    toolCalls++;
    log(`[tool] ${ev.toolName} 开始`);
  }
  if (ev.type === 'tool_execution_end') {
    log(`[tool] ${ev.toolName} 完成${ev.isError ? '(失败)' : ''}`);
  }
  if (ev.type === 'agent_end') {
    log('[agent] Pi 已结束本次任务');
  }
});

try {
  log('启动 Pi RPC 子进程...');
  await pi.start();
  await new Promise((r) => setTimeout(r, 800));
  log('注入 prompt');
  await pi.prompt(prompt);

  // 等任务完成或超时
  log(`等任务完成(超时 ${timeoutSec}s)...`);
  const TIMEOUT_MS = timeoutSec * 1000;
  let agentEnded = false;
  pi.onEvent((ev) => { if (ev.type === 'agent_end') agentEnded = true; });

  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    if (agentEnded) break;
    if (Date.now() - lastActivityAt > 60_000) {
      log('60 秒无活动,可能 hang');
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  log(`任务结束 · 用时 ${((Date.now() - start) / 1000).toFixed(1)}s · ${toolCalls} tool calls`);

  // 验证产物
  const mdPath = kind === 'rss'
    ? join(homedir(), 'pi-discord-agents/data/rss', `${dateKey}.md`)
    : join(homedir(), 'pi-discord-agents/data/daily-summary', `${dateKey}.md`);
  if (existsSync(mdPath)) {
    const sz = readFileSync(mdPath).length;
    log(`✅ md 已落盘: ${mdPath} (${sz} bytes)`);
  } else {
    log(`❌ md 未找到: ${mdPath}`);
  }
  await pi.stop();
  process.exit(0);
} catch (e) {
  log(`FATAL: ${e.message}`);
  await pi.stop().catch(() => {});
  process.exit(1);
}