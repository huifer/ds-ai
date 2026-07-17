#!/usr/bin/env node
// scripts/create-channels.mjs
// 一次性脚本:在 GUILD 里创建 📰 资讯 + 🌙 每日总结 两个 channel
// 频道建好后把 ID 打印出来,手动(或脚本末尾自动)写入 .env
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

function writeEnvKv(path, kv) {
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

  // 检查已存在的同名 channel(避免重复创建)
  const existing = await guild.channels.fetch();
  const findByName = (name) => existing.find((c) => c && c.name === name);

  const targets = [
    { name: '资讯', topic: 'RSS hub · 每天 12:00(北京时间)推送行业资讯,基于 ~/summary/ 画像筛选' },
    { name: '每日总结', topic: '每天 23:00(北京时间)汇总今天 .workbuddy / .zcode / .pi / .gemini / .kiro / .claude 干了啥' },
  ];

  const results = {};
  for (const t of targets) {
    const existingCh = findByName(t.name);
    if (existingCh) {
      console.log(`♻️  已存在 #${t.name} (${existingCh.id})`);
      results[t.name === '资讯' ? 'CH_RSS' : 'CH_DAILY'] = existingCh.id;
      continue;
    }
    const ch = await guild.channels.create({
      name: t.name,
      type: ChannelType.GuildText,
      topic: t.topic,
      permissionOverwrites: [
        // 限制只有 bot + 白名单用户能读写(其他人只读)
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.SendMessages],
        },
      ],
    });
    console.log(`✨ 已创建 #${t.name} (${ch.id})`);
    results[t.name === '资讯' ? 'CH_RSS' : 'CH_DAILY'] = ch.id;
  }

  // 写回 .env
  writeEnvKv(ENV_PATH, results);
  console.log(`\n✅ 已写入 .env:`);
  for (const [k, v] of Object.entries(results)) console.log(`   ${k}=${v}`);

  await client.destroy();
  console.log(`\n👋 完成。下一步:重启 daemon → launchctl kickstart -k "gui/$(id -u)/com.zhangsan.pi-discord-agents"`);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });