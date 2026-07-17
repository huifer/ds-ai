#!/usr/bin/env node
// scripts/trigger-job.mjs
// 手动触发 RSS hub 或每日总结任务(立刻跑一次,跳过调度器等 12:00)
//
// 用法:
//   node scripts/trigger-job.mjs rss            # 立刻跑 RSS hub
//   node scripts/trigger-job.mjs daily           # 立刻跑每日总结
//   node scripts/trigger-job.mjs rss 2026-07-17  # 指定日期
//
// 实现:用 RpcClient 启一个一次性 Pi 子进程,prompt 注入,等 Pi 完成。
// 跑完后 Pi 自己会用 discord_post_message 推送到对应 channel。
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';

// 全局代理
try {
  const { bootstrap } = await import('global-agent');
  bootstrap();
} catch {}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PI_BIN_DIR = '/Users/zhangsan/.nvm/versions/node/v24.15.0/lib/node_modules/@earendil-works/pi-coding-agent';
const PI_CLI = join(PI_BIN_DIR, 'dist', 'cli.js');
const LOG_PATH = resolve(ROOT, 'logs', 'trigger.log');

const kind = process.argv[2] || 'rss';
const dateKey = process.argv[3] || (() => {
  // 北京时间今天
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const tzMs = utcMs + 8 * 3600_000;
  const d = new Date(tzMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
})();

function log(...a) {
  const ts = new Date().toISOString().slice(11, 23);
  const m = `[trigger ${ts}] ${a.join(' ')}\n`;
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

async function main() {
  const envPath = resolve(ROOT, '.env');
  if (!existsSync(envPath)) {
    console.error(`❌ .env 不存在: ${envPath}`);
    process.exit(1);
  }
  const env = parseEnv(readFileSync(envPath, 'utf8'));

  log(`任务类型: ${kind} · 日期: ${dateKey}`);

  const { buildRssPrompt } = await import('../src/jobs/rss-daily.mjs');
  const { buildDailySummaryPrompt } = await import('../src/jobs/daily-summary.mjs');
  const prompt = kind === 'rss'
    ? buildRssPrompt({ dateKey })
    : kind === 'daily'
    ? buildDailySummaryPrompt({ dateKey })
    : (() => { throw new Error(`未知任务: ${kind}(只支持 rss / daily)`); })();

  // 用 RpcClient 跑一次性 Pi
  const { RpcClient } = await import('@earendil-works/pi-coding-agent');
  const pi = new RpcClient({
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
      CH_JOURNAL: env.CH_JOURNAL,
      CH_SIGNAL: env.CH_SIGNAL,
      CH_SYSTEM: env.CH_SYSTEM,
      CH_RSS: env.CH_RSS,
      CH_DAILY: env.CH_DAILY,
    },
    args: [
      '--mode', 'rpc',
      '--extension', join(ROOT, 'extensions', 'discord-tools.mjs'),
      '--extension', join(ROOT, 'extensions', 'file-tools.mjs'),
      '--session-dir', join(ROOT, 'sessions'),
      '--name', `trigger-${kind}-${dateKey}`,
    ],
  });

  let assistantBuffer = '';
  let lastMessageLength = 0;
  pi.onEvent((ev) => {
    if (ev.type === 'message_update' && ev.message?.role === 'assistant') {
      const delta = ev.assistantMessageEvent;
      if (delta?.type === 'text_delta') {
        assistantBuffer += delta.delta;
        // 打印增量到 stdout,看 Pi 在干什么
        process.stdout.write(delta.delta);
      }
    }
    if (ev.type === 'message_end' && ev.message?.role === 'assistant') {
      log(`\n[Pi 输出 ${assistantBuffer.length} chars]`);
      lastMessageLength = assistantBuffer.length;
    }
    if (ev.type === 'tool_execution_end') {
      log(`[tool] ${ev.toolName} 完成`);
    }
    if (ev.type === 'agent_end') {
      log('[agent] Pi 已结束本次任务');
    }
  });

  log('启动 Pi RPC 子进程…');
  await pi.start();
  await new Promise((r) => setTimeout(r, 500));

  log(`注入 prompt (${prompt.length} chars)`);
  await pi.prompt(prompt);

  // 等任务完成:30 分钟超时,但通常 1~5 分钟结束
  const TIMEOUT_MS = 30 * 60_000;
  const POLL_MS = 5_000;
  const start = Date.now();
  let completed = false;
  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    // 简单判断:agent_end 事件触发后 + 5 秒没新输出认为完成
    if (lastMessageLength > 0 && Date.now() - start > 30_000) {
      // 兜底:超时主动退
    }
  }

  log(`任务结束,关闭 Pi…`);
  await pi.stop();
  log('👋 done');
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });