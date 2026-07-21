// 一次性创建 7 个 Category 与全部子 Channel。
// 幂等：已存在则跳过。
// 用法：node scripts/discord_create_channels.mjs [--dry-run] [--config path]
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits } = require('discord.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const path = resolve(ROOT, '.env');
  if (!existsSync(path)) throw new Error(`.env not found at ${path}`);
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    config: (() => {
      const i = args.indexOf('--config');
      return i >= 0 ? resolve(args[i + 1]) : resolve(ROOT, 'agent-core/content/discord-structure.md');
    })(),
  };
}

function parseStructure(path) {
  if (!existsSync(path)) throw new Error(`structure file not found: ${path}`);
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  const categories = [];
  let current = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const m = line.match(/^## (\d{2}) · (.+)$/);
    if (m) {
      current = { title: m[1], name: m[2].trim(), position: parseInt(m[1], 10), channels: [] };
      categories.push(current);
      continue;
    }
    if (!current) continue;
    if (!line.startsWith('|')) continue;
    if (/^\|\s*[-:|\s]+\|\s*$/.test(line)) continue; // 分隔行
    const ch = line.match(/^\|\s*`?#?([^` |]+)`?\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/);
    if (!ch) continue;
    const [, rawName, topic, usage] = ch;
    const name = rawName.replace(/^#/, '').trim();
    if (!name) continue;
    if (/^[-:]+$/.test(name)) continue;
    if (['Channel','名称','Topic','用途','Templates','Type','Source','Stars','Forks'].includes(name)) continue;
    current.channels.push({ name, topic: topic.trim() || null, usage: usage.trim() || null });
  }
  return categories;
}

const { dryRun, config } = parseArgs();
const env = loadEnv();
const token = env.DISCORD_TOKEN;
const guildId = env.GUILD_ID;
if (!token || !guildId) {
  console.error('Missing DISCORD_TOKEN or GUILD_ID in .env');
  process.exit(1);
}

const categories = parseStructure(config);
console.log(`Plan: ${categories.length} categories`);
for (const c of categories) console.log(`  ${c.title} ${c.name} (${c.channels.length} channels)`);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});
await client.login(token);
const guild = await client.guilds.fetch(guildId);

const existing = await guild.channels.fetch();
const byName = new Map();
for (const ch of existing.values()) {
  if (ch.type === ChannelType.GuildCategory) byName.set(`cat:${ch.name}`, ch);
  else byName.set(`ch:${ch.parentId ?? 'none'}:${ch.name}`, ch);
}

let createdCats = 0, createdChs = 0, skipped = 0;
async function ensureCategory(cat) {
  const key = `cat:${cat.name}`;
  if (byName.has(key)) {
    console.log(`  · category exists: ${cat.name}`);
    return byName.get(key);
  }
  if (dryRun) {
    console.log(`  + [dry-run] create category: ${cat.name}`);
    return { id: `dry-${cat.title}`, name: cat.name };
  }
  const ch = await guild.channels.create({
    name: cat.name,
    type: ChannelType.GuildCategory,
    topic: null,
    position: cat.position,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
    ],
    reason: 'pi-discord-agents: structured group',
  });
  byName.set(key, ch);
  createdCats += 1;
  console.log(`  + category created: ${cat.name} -> ${ch.id}`);
  return ch;
}

for (const cat of categories) {
  const catCh = await ensureCategory(cat);
  for (const ch of cat.channels) {
    const key = `ch:${catCh.id}:${ch.name}`;
    if (byName.has(key)) {
      console.log(`    · channel exists: #${ch.name}`);
      skipped += 1;
      continue;
    }
    if (dryRun) {
      console.log(`    + [dry-run] create channel: #${ch.name}`);
      continue;
    }
    const created = await guild.channels.create({
      name: ch.name,
      type: ChannelType.GuildText,
      parent: catCh.id,
      topic: ch.topic || null,
      reason: 'pi-discord-agents: structured channel',
    });
    byName.set(key, created);
    createdChs += 1;
    console.log(`    + channel created: #${ch.name} -> ${created.id}`);
  }
}

console.log(`\nDone. created ${createdCats} categories, ${createdChs} channels, skipped ${skipped} (dryRun=${dryRun}).`);
await client.destroy();
