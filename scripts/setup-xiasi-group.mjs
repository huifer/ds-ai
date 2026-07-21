#!/usr/bin/env node
// ~/pi-discord-agents/scripts/setup-xiasi-group.mjs
// 「遐思」Discord Group 一键建群脚本。
//
// 用法:
//   node scripts/setup-xiasi-group.mjs              实际创建
//   node scripts/setup-xiasi-group.mjs --dry-run    只打印计划,不创建
//   node scripts/setup-xiasi-group.mjs --force      删旧重建(谨慎)
//
// 行为:
//   1. 读 .env 拿 GUILD_ID + DISCORD_TOKEN
//   2. bot 登录,检查是否有 MANAGE_CHANNELS 权限(没有就给出明确报错)
//   3. 检查是否已存在 "🌙 遐思" category:
//      - 存在 + 没传 --force → 复用,在它下面确保 3 个子频道存在
//      - 不存在 → 全新创建
//   4. 子频道:
//        📜-夜游记    主推送(取代 CH_XIASI)
//        🗳-投票      Discord 按钮交互(PR4 投票回流)
//        🗂-产物档案  artifact 查询(PR4 !xiasi archive)
//   5. 自动把 📜-夜游记 的 ID 写进 .env 的 CH_XIASI
//   6. 打印总结

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, GatewayIntentBits, ChannelType, PermissionsBitField } from 'discord.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(ROOT, '.env');

const CATEGORY_NAME = '🌙 遐思';
const CHILDREN = [
  {
    name: '📜-夜游记',
    topic: 'Xiasi main feed: dream results, weekly, monthly',
    envKey: 'CH_XIASI',
  },
  {
    name: '🗳-投票',
    topic: 'Xiasi voting: reactions and feedback',
    envKey: null, // 暂不写 .env,留给 PR4
  },
  {
    name: '🗂-产物档案',
    topic: 'Xiasi archive: artifact storage and queries',
    envKey: null,
  },
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

function serializeEnv(envObj, originalText) {
  // 保留原顺序 + 注释 + 空行,只覆盖/追加指定的 KEY
  const lines = originalText.split('\n');
  const updatedKeys = new Set();
  const out = lines.map((line) => {
    const m = line.match(/^([A-Z0-9_]+)\s*=/);
    if (!m) return line;
    const key = m[1];
    if (Object.prototype.hasOwnProperty.call(envObj, key)) {
      updatedKeys.add(key);
      return `${key}=${envObj[key]}`;
    }
    return line;
  });
  // 追加未出现的 key
  for (const [k, v] of Object.entries(envObj)) {
    if (!updatedKeys.has(k)) {
      out.push(`${k}=${v}`);
      updatedKeys.add(k);
    }
  }
  return out.join('\n');
}

function log(...a) { console.log('[setup-xiasi]', ...a); }
function die(msg, code = 1) { console.error('❌', msg); process.exit(code); }

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force  = args.includes('--force');

  if (!existsSync(ENV_PATH)) die(`.env 不存在: ${ENV_PATH}`);
  const envText = readFileSync(ENV_PATH, 'utf8');
  const env = parseEnv(envText);

  const token = env.DISCORD_TOKEN;
  if (!token) die('.env 缺 DISCORD_TOKEN');

  log(`dry-run=${dryRun} force=${force}`);

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });
  await client.login(token);
  await new Promise((res) => client.once('ready', res));

  // 推断 guild:优先用 .env,否则用 bot 所在的唯一 guild
  let guildId = env.GUILD_ID;
  if (!guildId) {
    const guilds = await client.guilds.fetch();
    const list = Array.from(guilds.values());
    if (list.length === 0) die('bot 不在任何 guild 里,请先把 bot 拉进服务器');
    if (list.length > 1) {
      const ids = list.map((g) => `${g.name}=${g.id}`).join(', ');
      die(`.env 缺 GUILD_ID,且 bot 在多个 guild 里,无法自动选择:${ids}`);
    }
    guildId = list[0].id;
    log(`自动检测到唯一 guild:${list[0].name} (${guildId})`);
  }

  const guild = await client.guilds.fetch(guildId);
  log(`已登录 bot=${client.user.tag} · guild=${guild.name}`);

  // ---- 权限检查 ----
  const me = await guild.members.fetchMe();
  const perms = me.permissions;
  if (!perms.has(PermissionsBitField.Flags.ManageChannels)) {
    die(`bot 在 guild "${guild.name}" 缺少 ManageChannels 权限。请在 Discord 服务器设置 → 角色 → 找到 bot 角色 → 勾选 Manage Channels,然后重跑。`);
  }
  log(`权限 OK · ManageChannels ✓`);

  // ---- 查/建 category ----
  let category = await findCategory(client, guild, CATEGORY_NAME);

  if (category && force && !dryRun) {
    log(`--force:删除旧 category "${category.name}" (${category.id})`);
    const ch = await client.channels.fetch(category.id);
    await ch.delete('「遐思」setup --force 重建');
    category = null;
  }

  if (!category) {
    log(`创建 category "${CATEGORY_NAME}"`);
    if (!dryRun) {
      const created = await guild.channels.create({
        name: CATEGORY_NAME,
        type: ChannelType.GuildCategory,
        reason: '「遐思」Group 首次创建',
      });
      category = { id: created.id, name: created.name, type: created.type };
      log(`✓ category 已创建:${category.id}`);
    } else {
      category = { id: '(dry-run)', name: CATEGORY_NAME, type: ChannelType.GuildCategory };
    }
  } else {
    log(`复用已有 category:${category.id}`);
  }

  // ---- 建子频道 ----
  const created = {};
  for (let i = 0; i < CHILDREN.length; i++) {
    const spec = CHILDREN[i];
    let child = await findChild(client, guild, spec.name, category.id);

    if (child && force && !dryRun) {
      log(`--force:删除旧 channel "${spec.name}"`);
      const ch = await client.channels.fetch(child.id);
      await ch.delete('「遐思」setup --force 重建');
      child = null;
    }

    if (!child) {
      log(`创建子频道 #${spec.name}`);
      if (!dryRun) {
        const c = await guild.channels.create({
          name: spec.name,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: spec.topic,
          reason: '「遐思」子频道',
        });
        child = { id: c.id, name: c.name, parentId: c.parentId };
        log(`✓ #${child.name}:${child.id}`);
      } else {
        child = { id: `(dry-run-${i})`, name: spec.name, parentId: category.id };
      }
    } else {
      log(`复用已有 #${spec.name}:${child.id}`);
    }
    created[spec.name] = child;
  }

  // ---- 写 .env ----
  const nightLog = created[CHILDREN[0].name];
  const newEnv = {};
  if (!env.GUILD_ID && !dryRun) {
    newEnv.GUILD_ID = guildId;
  }
  if (nightLog?.id && !nightLog.id.startsWith('(dry-run')) {
    newEnv.CH_XIASI = nightLog.id;
  }

  if (Object.keys(newEnv).length > 0) {
    if (!dryRun) {
      const updated = serializeEnv(newEnv, envText);
      writeFileSync(ENV_PATH, updated, 'utf8');
      log(`✓ .env 已更新:${Object.entries(newEnv).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    } else {
      log(`(dry-run) 计划写入 .env:${JSON.stringify(newEnv)}`);
    }
  } else {
    log('无 .env 更新');
  }

  // ---- 总结 ----
  console.log('\n=== 「遐思」Group 状态 ===');
  console.log(`Category: ${category.name} (${category.id})`);
  for (const spec of CHILDREN) {
    const c = created[spec.name];
    console.log(`  └─ #${c.name}  ${c.id}${spec.envKey ? '  → .env ' + spec.envKey : ''}`);
  }
  console.log('========================\n');

  if (dryRun) {
    console.log('(dry-run 完成,未做任何修改。去掉 --dry-run 实际执行)');
  } else {
    console.log('✅ 完成。');
    console.log('下一步:设置 .env 里的 XIASI_ENABLED=true,然后 restart entry-bot。');
  }

  await client.destroy();
}

async function findCategory(client, guild, name) {
  const channels = await guild.channels.fetch();
  for (const [, c] of channels) {
    if (c.type === ChannelType.GuildCategory && c.name === name) {
      return { id: c.id, name: c.name, type: c.type };
    }
  }
  return null;
}

async function findChild(client, guild, name, parentId) {
  const channels = await guild.channels.fetch();
  for (const [, c] of channels) {
    if (c.type === ChannelType.GuildText && c.name === name && c.parentId === parentId) {
      return { id: c.id, name: c.name, parentId: c.parentId };
    }
  }
  return null;
}

main().catch((e) => die(e.stack || e.message));