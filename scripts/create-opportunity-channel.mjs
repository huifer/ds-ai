#!/usr/bin/env node
// scripts/create-opportunity-channel.mjs
// 一次性:在 GUILD 里建 #💡 机会 频道,自动写 CH_OPPORTUNITY=<id> 到 .env
//
// 为什么要这个频道:
//   - #机会统一承载历史 Discover 信号和新的深度机会调研
//   - #资讯只承载每日 RSS 新闻流
//   - 内容形态:深度调研 + SaaS/App 创业灵感(不是新闻流)

import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');
const ENV_PATH = resolve(ROOT, '.env');

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

function upsertEnvKv(path, kv) {
  let text = existsSync(path) ? readFileSync(path, 'utf8') : '';
  for (const [k, v] of Object.entries(kv)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    if (re.test(text)) text = text.replace(re, `${k}=${v}`);
    else text += (text.endsWith('\n') || text === '' ? '' : '\n') + `${k}=${v}\n`;
  }
  writeFileSync(path, text, { mode: 0o600 });
}

async function main() {
  if (!existsSync(ENV_PATH)) {
    console.error(`❌ .env 不存在: ${ENV_PATH}`);
    process.exit(1);
  }
  const env = parseEnv(readFileSync(ENV_PATH, 'utf8'));
  const token = env.DISCORD_TOKEN;
  const guildId = env.GUILD_ID;
  if (!token || !guildId) {
    console.error('❌ .env 缺 DISCORD_TOKEN 或 GUILD_ID');
    process.exit(1);
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });
  await client.login(token);
  console.log(`✅ 已登录: ${client.user.tag}`);

  const guild = await client.guilds.fetch(guildId);
  console.log(`✅ Guild: ${guild.name}`);

  const existing = await guild.channels.fetch();
  const CHANNEL_NAME = '机会';
  let opportunityChannel = existing.find((c) => c && c.name === CHANNEL_NAME);

  if (opportunityChannel) {
    console.log(`♻️  #${CHANNEL_NAME} 已存在: ${opportunityChannel.id}`);
  } else {
    opportunityChannel = await guild.channels.create({
      name: CHANNEL_NAME,
      type: ChannelType.GuildText,
      topic: '💡 机会发现 · !opportunity <topic> 触发的深度调研 + SaaS/App 创业灵感 · 完整机会 brief 的唯一输出频道',
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.SendMessages],
        },
      ],
    });
    console.log(`✨ 已创建 #${CHANNEL_NAME} (${opportunityChannel.id})`);
  }

  // 写回 .env
  upsertEnvKv(ENV_PATH, { CH_OPPORTUNITY: opportunityChannel.id });
  console.log(`\n✅ 已写入 .env:`);
  console.log(`   CH_OPPORTUNITY=${opportunityChannel.id}`);

  await client.destroy();
  console.log(`\n👋 完成。下一步:重启 daemon 让新频道生效`);
  console.log(`   launchctl kickstart -k "gui/$(id -u)/com.zhangsan.pi-discord-agents"`);
  console.log(`\n然后在 Discord 主入口频道敲:`);
  console.log(`   !opportunity AI coding agents`);
  console.log(`\n完成后 brief 会自动推到 #💡 机会`);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });