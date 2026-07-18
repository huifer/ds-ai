#!/usr/bin/env node
// scripts/trigger-job.mjs
// 手动触发定时任务或偶发任务(立刻跑一次,跳过调度器等时间)
//
// 用法:
//   node scripts/trigger-job.mjs rss                                # 立刻跑 RSS hub
//   node scripts/trigger-job.mjs daily                              # 立刻跑每日总结
//   node scripts/trigger-job.mjs rss 2026-07-17                     # 指定日期
//   node scripts/trigger-job.mjs opportunity "AI coding agents"      # 偶发机会发现(默认推 #💡 机会)
//   node scripts/trigger-job.mjs opportunity "Cursor" build          # 推 #🔨 工程
//   node scripts/trigger-job.mjs discover "topic"                    # 兼容旧名(alias 到 opportunity)
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';

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
const args = process.argv.slice(3).filter((a) => a !== '--');
const extraArg = args[0];

function todayKeyBeijing() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const tzMs = utcMs + 8 * 3600_000;
  const d = new Date(tzMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

const dateKey = (kind === 'opportunity' || kind === 'discover')
  ? todayKeyBeijing()
  : (extraArg || todayKeyBeijing());

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
  const { buildOpportunityPrompt } = await import('../src/jobs/opportunity.mjs');

  let prompt;
  let jobNameSuffix = dateKey;
  const baseExts = [
    join(ROOT, 'extensions', 'discord-tools.mjs'),
    join(ROOT, 'extensions', 'file-tools.mjs'),
  ];
  const extsByKind = {
    opportunity: [join(ROOT, 'extensions', 'discover-tools.mjs')],
    discover: [join(ROOT, 'extensions', 'discover-tools.mjs')],   // alias
  };
  const exts = [...baseExts, ...(extsByKind[kind] || [])];

  if (kind === 'rss') {
    prompt = buildRssPrompt({ dateKey });
  } else if (kind === 'daily') {
    prompt = buildDailySummaryPrompt({ dateKey });
  } else if (kind === 'opportunity' || kind === 'discover') {
    if (!extraArg || !extraArg.trim()) {
      throw new Error(`${kind} 模式必须传 topic: node scripts/trigger-job.mjs ${kind} "<topic>"`);
    }
    const topic = extraArg;
    const channelCategory = args[1] || 'opportunity';
    prompt = buildOpportunityPrompt({ topic, dateKey, channelCategory });
    const slug = String(topic).toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    jobNameSuffix = `${dateKey}-${slug}`;
    log(`${kind} topic="${topic}" → channel=${channelCategory}`);
  } else {
    throw new Error(`未知任务: ${kind}(只支持 rss / daily / opportunity / discover)`);
  }

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
      CH_DISCOVER: env.CH_DISCOVER,
      CH_OPPORTUNITY: env.CH_OPPORTUNITY,
    },
    args: [
      '--mode', 'rpc',
      ...exts.flatMap((p) => ['--extension', p]),
      '--session-dir', join(ROOT, 'sessions'),
      '--name', `trigger-${kind}-${jobNameSuffix}`,
    ],
  });

  let assistantBuffer = '';
  let lastMessageLength = 0;
  pi.onEvent((ev) => {
    if (ev.type === 'message_update' && ev.message?.role === 'assistant') {
      const delta = ev.assistantMessageEvent;
      if (delta?.type === 'text_delta') {
        assistantBuffer += delta.delta;
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

  const TIMEOUT_MS = 30 * 60_000;
  const POLL_MS = 5_000;
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  log(`任务结束,关闭 Pi…`);
  await pi.stop();
  log('👋 done');
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
