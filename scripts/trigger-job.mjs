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

const OPPORTUNITY_CHANNEL_KEYS = {
  opportunity: 'CH_OPPORTUNITY',
  build: 'CH_BUILD',
  ideas: 'CH_IDEAS',
  memory: 'CH_MEMORY',
};

function opportunityOutputPath(topic, dateKey) {
  const slug = String(topic).toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'topic';
  return resolve(ROOT, 'data', 'opportunity', `${dateKey}-${slug}.md`);
}

async function sendLongDiscord(channel, fullText, prefix = '') {
  const MAX = 1900;
  let rest = prefix + fullText;
  const ids = [];
  while (rest.length > 0) {
    let cut = rest.length;
    if (rest.length > MAX) {
      cut = rest.lastIndexOf('\n\n', MAX);
      if (cut < MAX * 0.5) cut = rest.lastIndexOf('\n', MAX);
      if (cut < MAX * 0.5) cut = MAX;
    }
    const more = rest.length > cut;
    const body = rest.slice(0, cut) + (more ? '\n\n' : '');
    const sent = await channel.send(body);
    ids.push(sent.id);
    rest = rest.slice(cut).replace(/^\n+/, '');
    if (rest.length > 0) await new Promise((r) => setTimeout(r, 250));
  }
  return ids;
}

async function publishOpportunityFile({ env, topic, dateKey, channelCategory, outputPath }) {
  if (!existsSync(outputPath)) return { published: false, reason: `brief 不存在: ${outputPath}` };
  const envKey = OPPORTUNITY_CHANNEL_KEYS[channelCategory];
  const channelId = env[envKey];
  if (!channelId) return { published: false, reason: `${envKey} 未配置` };

  const { Client, GatewayIntentBits, ChannelType } = await import('discord.js');
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  try {
    await client.login(env.DISCORD_TOKEN);
    const channel = await client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error(`目标不是文字频道: ${channelId}`);
    }
    const content = readFileSync(outputPath, 'utf8');
    const prefix = `💡 **【机会 · ${topic} · ${dateKey}】**\n\n`;
    const messageIds = await sendLongDiscord(channel, content, prefix);

    if (env.CH_ENTRY && env.CH_ENTRY !== channelId) {
      const entry = await client.channels.fetch(env.CH_ENTRY);
      if (entry?.type === ChannelType.GuildText) {
        await entry.send(`✅ 机会发现完成：<#${channelId}>\n本地 brief：\`${outputPath.replace(`${ROOT}/`, '')}\``);
      }
    }
    return { published: true, channelId, messageIds };
  } finally {
    await client.destroy();
  }
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
  const { runTokenUsageJob, handleUsageCommand } = await import('../src/jobs/token-usage.mjs');

  // ---- token 用量任务:不走 Pi,直接在当前进程调 ccusage + ECharts 渲染 PNG 推 Discord ----
  if (kind === 'usage' || kind === 'trend') {
    const sub = process.argv[3] || '';
    const { Client, GatewayIntentBits, ChannelType } = await import('discord.js');
    const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
    await client.login(env.DISCORD_TOKEN);
    const chId = env.CH_USAGE || env.CH_TREND || env.CH_SYSTEM;
    if (!chId) { console.error('❌ .env 缺 CH_USAGE/CH_TREND/CH_SYSTEM'); process.exit(1); }
    const channel = await client.channels.fetch(chId);
    if (!channel || channel.type !== ChannelType.GuildText) { console.error('❌ channel not text'); process.exit(1); }
    const discord = {
      send: async (cid, text) => {
        const c = await client.channels.fetch(cid);
        const MAX = 1900;
        if (text.length <= MAX) { await c.send(text); return; }
        let rest = text;
        while (rest.length > 0) {
          if (rest.length <= MAX) { await c.send(rest); break; }
          let cut = rest.lastIndexOf('\n\n', MAX);
          if (cut < MAX * 0.5) cut = rest.lastIndexOf('\n', MAX);
          if (cut < MAX * 0.5) cut = MAX;
          await c.send(rest.slice(0, cut));
          rest = rest.slice(cut).replace(/^\n+/, '');
          await new Promise((r) => setTimeout(r, 250));
        }
      },
      client,
      sendPng: async (cid, pngBuffer, caption) => {
        const c = await client.channels.fetch(cid);
        await c.send({ content: caption, files: [{ attachment: pngBuffer, name: 'token-usage.png' }] });
      },
    };
    const cfg = { channels: { usage: env.CH_USAGE, trend: env.CH_TREND, system: env.CH_SYSTEM, entry: env.CH_ENTRY } };
    if (sub && !/^\d+$/.test(sub)) {
      log(`[trigger] usage 子命令: ${sub}`);
      const r = await handleUsageCommand({ args: sub, discord, log, cfg });
      log(`reply: ${r?.reply || '(无)'}`);
    } else {
      const days = parseInt(sub || env.USAGE_DAYS || env.TREND_DAYS || '14', 10) || 14;
      log(`[trigger] usage 详细报告: ${days}d → #${env.CH_USAGE || env.CH_TREND ? '用量' : '系统'}`);
      await runTokenUsageJob({ dateKey, days, pi: null, discord, log, channelId: chId });
    }
    await client.destroy();
    log('👋 done');
    process.exit(0);
  }

  let prompt;
  let jobNameSuffix = dateKey;
  let opportunityMeta = null;
  const baseExts = [
    join(ROOT, 'extensions', 'discord-tools.mjs'),
    join(ROOT, 'extensions', 'file-tools.mjs'),
  ];
  const opportunityExt = join(ROOT, 'extensions', 'discover-tools.mjs');
  const exts = (kind === 'opportunity' || kind === 'discover')
    ? [join(ROOT, 'extensions', 'file-tools.mjs'), opportunityExt]
    : baseExts;

  if (kind === 'rss') {
    prompt = buildRssPrompt({ dateKey });
  } else if (kind === 'daily') {
    prompt = buildDailySummaryPrompt({ dateKey });
  } else if (kind === 'opportunity' || kind === 'discover') {
    if (!extraArg || !extraArg.trim()) {
      throw new Error(`${kind} 模式必须传 topic: node scripts/trigger-job.mjs ${kind} "<topic>"`);
    }
    const topic = extraArg;
    const requestedCategory = args[1] || 'opportunity';
    const channelCategory = requestedCategory === 'discover' ? 'opportunity' : requestedCategory;
    const envKey = OPPORTUNITY_CHANNEL_KEYS[channelCategory];
    if (!envKey || !env[envKey]) {
      throw new Error(`机会目标频道未配置或不支持: ${requestedCategory}`);
    }
    prompt = buildOpportunityPrompt({ topic, dateKey, channelCategory });
    const slug = String(topic).toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    jobNameSuffix = `${dateKey}-${slug}`;
    opportunityMeta = {
      topic,
      dateKey,
      channelCategory,
      outputPath: opportunityOutputPath(topic, dateKey),
    };
    log(`${kind} topic="${topic}" → channel=${channelCategory} output=${opportunityMeta.outputPath}`);
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
      ...exts.flatMap((p) => ['--extension', p]),
      '--session-dir', join(ROOT, 'sessions'),
      '--name', `trigger-${kind}-${jobNameSuffix}`,
    ],
  });

  let assistantBuffer = '';
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
      assistantBuffer = '';
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

  const TIMEOUT_MS = opportunityMeta ? 4 * 60_000 : 30 * 60_000;
  let taskError = null;
  try {
    log(`注入 prompt (${prompt.length} chars)`);
    await pi.prompt(prompt);
    await pi.waitForIdle(TIMEOUT_MS);
    log('任务已 settled');
  } catch (e) {
    taskError = e;
    log(`Pi 任务未正常 settled: ${e.message}`);
  } finally {
    log('任务结束,关闭 Pi…');
    await pi.stop().catch((e) => log(`关闭 Pi 失败: ${e.message}`));
  }

  if (opportunityMeta) {
    try {
      const published = await publishOpportunityFile({ env, ...opportunityMeta });
      if (!published.published) throw new Error(published.reason);
      log(`机会 brief 已可靠推送 channel=${published.channelId} messages=${published.messageIds.length}`);
      // Pi 只要成功写出了 brief,即使模型在最后一步超时,任务仍然有可交付产物。
      taskError = null;
    } catch (e) {
      taskError = taskError || e;
      log(`机会 brief 推送失败: ${e.message}`);
    }
  }

  if (taskError) throw taskError;
  log('👋 done');
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
