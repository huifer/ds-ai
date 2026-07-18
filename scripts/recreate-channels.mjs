#!/usr/bin/env node
// scripts/recreate-channels.mjs
// 一次性:删掉 #📰 资讯 + #🌙 每日总结,重建(不带 @everyone deny,Bot 才能发)
import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
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
  if (!existsSync(ENV_PATH)) { console.error(`❌ .env 不存在`); process.exit(1); }
  const env = parseEnv(readFileSync(ENV_PATH, 'utf8'));
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(env.DISCORD_TOKEN);
  console.log(`✅ 已登录: ${client.user.tag}`);

  const guild = await client.guilds.fetch(env.GUILD_ID);
  console.log(`✅ Guild: ${guild.name}`);

  const targets = [
    { name: '资讯', topic: 'RSS hub · 每天 12:00(北京时间)推送行业资讯,基于 ~/summary/ 画像筛选', envKey: 'CH_RSS' },
    { name: '每日总结', topic: '每天 23:00(北京时间)汇总今天 .workbuddy / .zcode / .pi / .gemini / .kiro / .claude 干了啥', envKey: 'CH_DAILY' },
  ];

  const updates = {};
  for (const t of targets) {
    const oldId = env[t.envKey];
    if (oldId) {
      try {
        const old = await client.channels.fetch(oldId);
        if (old) {
          await old.delete();
          console.log(`🗑️  删 #${t.name} (${oldId})`);
        }
      } catch (e) {
        console.log(`⚠️  删 #${t.name} (${oldId}) 失败:${e.message}(可能已不存在)`);
      }
    }
    // 不带 permissionOverwrites,让 server-level perms 接管
    const ch = await guild.channels.create({
      name: t.name,
      type: ChannelType.GuildText,
      topic: t.topic,
    });
    console.log(`✨ 建 #${t.name} (${ch.id})`);
    updates[t.envKey] = ch.id;
  }

  writeEnvKv(ENV_PATH, updates);
  console.log(`\n✅ .env 已更新:`);
  for (const [k, v] of Object.entries(updates)) console.log(`   ${k}=${v}`);

  await client.destroy();
  console.log(`\n👋 完成。无需重启 daemon(它下次 tick 会读新 env),直接试 \`node scripts/trigger-job.mjs rss\``);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });