#!/usr/bin/env node
// ~/pi-discord-agents/scripts/reorganize-channels.mjs
// 频道分组整理 + 删除默认频道
//
// 用法:
//   node scripts/reorganize-channels.mjs              实际执行
//   node scripts/reorganize-channels.mjs --dry-run    只打印计划
//
// 做什么:
//   1. 删除 Discord 默认创建的: #Text Channels, #Voice Channels, #General
//   2. 将所有频道分到合适的 Category 下:
//      - 🏠 对话与记忆:  主入口, 记忆库, 灵感, 工程
//      - 📊 自动推送:    资讯, 每日总结, 用量, 每日任务, GitHub
//      - 💡 机会发现:    机会
//      - 🛠 系统管理:    系统
//      - 🌙 遐思:        (已存在,不动)
//   3. 未归类的 #通用 如果不存在就跳过,存在也不删(手动创建的)

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, GatewayIntentBits, ChannelType, PermissionsBitField } from 'discord.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(ROOT, '.env');

// ---- 分组定义 ----
const GROUPS = [
  {
    category: '🏠 对话与记忆',
    channels: ['主入口', '记忆库', '灵感', '工程'],
  },
  {
    category: '📊 自动推送',
    channels: ['资讯', '每日总结', '用量', '每日任务', 'GitHub'],
  },
  {
    category: '💡 机会发现',
    channels: ['机会'],
  },
  {
    category: '🛠 系统管理',
    channels: ['系统'],
  },
];

// ---- 要删除的频道 ----
const TO_DELETE = [
  'Text Channels',
  'Voice Channels',
  'General',
];

function parseEnv(text) {
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function log(...a) { console.log('[reorganize]', ...a); }
function die(msg) { console.error('❌', msg); process.exit(1); }

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (!existsSync(ENV_PATH)) die(`.env 不存在: ${ENV_PATH}`);
  const env = parseEnv(readFileSync(ENV_PATH, 'utf8'));
  const token = env.DISCORD_TOKEN;
  const guildId = env.GUILD_ID;
  if (!token || !guildId) die('.env 缺 DISCORD_TOKEN 或 GUILD_ID');

  log(`dry-run=${dryRun}`);
  log(`guild=${guildId}`);

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });
  await client.login(token);
  await new Promise((res) => client.once('ready', res));

  const guild = await client.guilds.fetch(guildId);
  log(`已登录 bot=${client.user.tag} · guild=${guild.name}`);

  // 权限检查
  const me = await guild.members.fetchMe();
  if (!me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    die(`bot 缺少 ManageChannels 权限`);
  }
  log('权限 OK ✓');

  // 获取所有频道
  const allChannels = await guild.channels.fetch();
  const channelMap = new Map();
  for (const [id, ch] of allChannels) {
    if (ch && 'name' in ch) channelMap.set(ch.name, ch);
  }

  // ---- Step 1: 删除默认频道 ----
  log('\n━━━ Step 1: 删除默认频道 ━━━');
  for (const name of TO_DELETE) {
    const ch = channelMap.get(name);
    if (ch) {
      log(`  删除 #${name} (${ch.id})`);
      if (!dryRun) {
        await ch.delete('reorganize: 删除 Discord 默认频道');
        channelMap.delete(name);
      }
    } else {
      log(`  #${name} 不存在,跳过`);
    }
  }

  // ---- Step 2: 创建 Category 并移动频道 ----
  log('\n━━━ Step 2: 分组整理 ━━━');

  // 先建所有 category
  const categoryMap = new Map();
  for (const group of GROUPS) {
    const catName = group.category;
    // 检查是否已存在
    let existing = null;
    for (const [, ch] of allChannels) {
      if (ch && ch.name === catName && ch.type === ChannelType.GuildCategory) {
        existing = ch;
        break;
      }
    }

    if (existing) {
      log(`  复用已有 category: ${catName} (${existing.id})`);
      categoryMap.set(catName, existing);
    } else {
      log(`  创建 category: ${catName}`);
      if (!dryRun) {
        const created = await guild.channels.create({
          name: catName,
          type: ChannelType.GuildCategory,
          reason: 'reorganize: 频道分组整理',
        });
        categoryMap.set(catName, created);
        log(`    ✓ ${created.id}`);
      }
    }
  }

  // 移动频道到对应 category
  for (const group of GROUPS) {
    const cat = categoryMap.get(group.category);
    if (!cat) continue;

    log(`\n  📂 ${group.category}:`);
    for (const chName of group.channels) {
      const ch = channelMap.get(chName);
      if (!ch) {
        log(`    ✗ #${chName} 不存在,跳过`);
        continue;
      }
      if (ch.parentId === cat.id) {
        log(`    = #${chName} 已在 ${group.category} 下,跳过`);
        continue;
      }
      log(`    ↳ 移动 #${chName} → ${group.category}`);
      if (!dryRun) {
        await ch.setParent(cat.id, { reason: 'reorganize: 频道分组' });
      }
    }
  }

  // ---- Step 3: 总结 ----
  log('\n━━━ Step 3: 最终结构 ━━━');
  const updatedChannels = await guild.channels.fetch();

  // 按 category 分组打印
  const categories = new Map(); // categoryId -> { name, children: [] }
  const uncategorized = [];

  for (const [id, ch] of updatedChannels) {
    if (!ch || !('name' in ch)) continue;
    if (ch.type === ChannelType.GuildCategory) {
      if (!categories.has(id)) categories.set(id, { name: ch.name, children: [] });
      else categories.get(id).name = ch.name;
    }
  }
  for (const [id, ch] of updatedChannels) {
    if (!ch || !('name' in ch)) continue;
    if (ch.type === ChannelType.GuildCategory) continue;
    if (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildVoice) {
      if (ch.parentId && categories.has(ch.parentId)) {
        categories.get(ch.parentId).children.push(`#${ch.name} (${ch.id})`);
      } else {
        uncategorized.push(`#${ch.name} (${ch.id})`);
      }
    }
  }

  for (const [, cat] of categories) {
    console.log(`\n  📂 ${cat.name}`);
    for (const child of cat.children) {
      console.log(`    └─ ${child}`);
    }
  }
  if (uncategorized.length) {
    console.log('\n  📂 (未分组)');
    for (const ch of uncategorized) {
      console.log(`    └─ ${ch}`);
    }
  }

  console.log('');

  if (dryRun) {
    console.log('(dry-run 完成,未做任何修改。去掉 --dry-run 实际执行)');
  } else {
    console.log('✅ 频道整理完成。');
  }

  await client.destroy();
}

main().catch((e) => die(e.stack || e.message));
