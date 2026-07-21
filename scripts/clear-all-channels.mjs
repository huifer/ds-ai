// ~/pi-discord-agents/scripts/clear-all-channels.mjs
// 清空所有频道的历史消息（从 .env 读取所有 CH_* channel IDs）

import { Client, GatewayIntentBits } from 'discord.js';
import { appendFileSync } from 'node:fs';

const LOG_FILE = '/Users/zhangsan/pi-discord-agents/logs/clear-all.log';

function log(...args) {
  const ts = new Date().toISOString().slice(11, 19);
  const msg = `[clear-all ${ts}] ${args.join(' ')}\n`;
  process.stdout.write(msg);
  try { appendFileSync(LOG_FILE, msg); } catch {}
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function clearChannel(client, channelId, channelName) {
  let totalDeleted = 0;
  let lastId = null;
  let iterations = 0;
  const maxIterations = 100; // 防止无限循环

  while (iterations < maxIterations) {
    iterations++;
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        log(`  频道不存在: ${channelId}`);
        return totalDeleted;
      }

      const fetchOpts = { limit: 100 };
      if (lastId) fetchOpts.before = lastId;

      const messages = await channel.messages.fetch(fetchOpts);
      if (messages.size === 0) break;

      lastId = messages.lastKey();
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

      const recent = messages.filter(m => m.createdTimestamp > twoWeeksAgo);
      const old = messages.filter(m => m.createdTimestamp <= twoWeeksAgo);

      if (recent.size > 0) {
        await channel.bulkDelete(recent).catch(() => {});
        totalDeleted += recent.size;
        log(`  ✓ 批量删除 ${recent.size} 条（14天内）`);
      }

      for (const msg of old.values()) {
        await msg.delete().catch(() => {});
        totalDeleted++;
      }

      await delay(500);
    } catch (e) {
      log(`  ⚠️ ${e.message}`);
      await delay(1000);
      break;
    }
  }

  return totalDeleted;
}

async function main() {
  // 从 .env 读取所有 channel IDs
  const fs = await import('node:fs');
  const envContent = fs.readFileSync('/Users/zhangsan/pi-discord-agents/.env', 'utf8');
  const channelIds = new Set();

  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (key.startsWith('CH_') && /^\d{17,20}$/.test(val)) {
      channelIds.add(val);
    }
  }

  // 读取 token
  const token = envContent.match(/^DISCORD_TOKEN=(.+)$/m)?.[1]?.trim();
  if (!token) {
    log('❌ 未找到 DISCORD_TOKEN');
    process.exit(1);
  }

  log(`📋 共 ${channelIds.size} 个频道待清理`);

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  await client.login(token);
  log('✅ Discord 已登录');

  // 先获取所有频道名称
  const chNameMap = new Map();
  for (const chId of channelIds) {
    try {
      const ch = await client.channels.fetch(chId);
      if (ch) chNameMap.set(chId, ch.name);
    } catch {}
    await delay(100);
  }

  log(`📋 已获取 ${chNameMap.size} 个频道名称\n`);

  let grandTotal = 0;
  let successCount = 0;
  let failCount = 0;

  for (const chId of channelIds) {
    const name = chNameMap.get(chId) ?? chId;
    process.stdout.write(`[clear-all] 清理 #${name}... `);

    try {
      const deleted = await clearChannel(client, chId, name);
      grandTotal += deleted;
      successCount++;
      log(`✓ #${name}: ${deleted} 条消息已清空`);
      await delay(1000);
    } catch (e) {
      failCount++;
      log(`✗ #${name} 失败: ${e.message}`);
      await delay(2000);
    }
  }

  log(`\n🎉 完成！共清空 ${successCount} 个频道，删除 ${grandTotal} 条消息`);
  log(`   失败: ${failCount} 个频道`);

  await client.destroy();
  process.exit(0);
}

main().catch(e => {
  log(`❌ 致命错误: ${e.message}`);
  console.error(e);
  process.exit(1);
});
