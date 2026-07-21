// ~/pi-discord-agents/extensions/discord-tools-shared.mjs
// 工具层共享:env → cfg 解析 + 延迟初始化的 Discord client。
//
// Pi 子进程优先读取 entry-bot 显式传入的环境变量,缺失项再从项目 .env 补齐。
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');
const ENV_PATH = resolve(ROOT, '.env');

export const DISCORD_CHANNEL_CATEGORIES = [
  'entry', 'memory', 'ideas', 'build', 'system',
  'rss', 'daily', 'gh', 'usage', 'trend', 'opportunity', 'discover',
];

const ENV_KEYS = [
  'DISCORD_TOKEN',
  'CH_ENTRY', 'CH_MEMORY', 'CH_IDEAS', 'CH_BUILD',
  'CH_SYSTEM', 'CH_RSS', 'CH_DAILY', 'CH_GH',
  'CH_USAGE', 'CH_TREND', 'CH_OPPORTUNITY',
];

function parseEnvText(text) {
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

let cachedCfg = null;
export function getCfg() {
  if (cachedCfg) return cachedCfg;

  const fileEnv = existsSync(ENV_PATH)
    ? parseEnvText(readFileSync(ENV_PATH, 'utf8'))
    : {};
  const env = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key] || fileEnv[key] || '']),
  );

  const usageChannel = env.CH_USAGE || env.CH_TREND;
  const opportunityChannel = env.CH_OPPORTUNITY;
  const discoverChannel = opportunityChannel;

  cachedCfg = {
    token: env.DISCORD_TOKEN,
    channels: {
      entry:       env.CH_ENTRY,
      memory:      env.CH_MEMORY,
      ideas:       env.CH_IDEAS,
      build:       env.CH_BUILD,
      system:      env.CH_SYSTEM,
      rss:         env.CH_RSS,
      daily:       env.CH_DAILY,
      gh:          env.CH_GH,
      usage:       usageChannel,
      trend:       env.CH_TREND || usageChannel,
      opportunity: opportunityChannel,
      discover:    discoverChannel,
    },
    labels: {
      entry: '📝', memory: '🧠', ideas: '✨', build: '🔨',
      system: '🛠', rss: '📰',
      daily: '🌙', gh: '🎯', usage: '📊', trend: '📊',
      opportunity: '💡', discover: '💡',
    },
  };
  return cachedCfg;
}

// 把 category 或 channel_id 解析成 channelId。
// 显式传入未知/未配置 category 时返回 null,绝不静默回退到 #主入口。
export function resolveChannelId(args = {}, cfg, fallback = 'entry') {
  if (args.channel_id) return args.channel_id;

  if (args.category) {
    let category = args.category;
    // !discover 是命令别名;新内容统一进入 #机会。
    if (category === 'discover' && cfg.channels?.opportunity) category = 'opportunity';
    return cfg.channels?.[category] || null;
  }

  return cfg.channels?.[fallback] || cfg.channels?.entry || null;
}

// ---- 懒加载 Discord client(工具层自己持有) ----
let clientPromise = null;
async function getDiscord() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { Client, GatewayIntentBits } = await import('discord.js');
      const cfg = getCfg();
      if (!cfg.token) throw new Error('DISCORD_TOKEN 未配置');
      const c = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
        ],
      });
      c.once('ready', () => {
        console.error(`[discord-tools] 已登录 🌟 ${c.user.tag}`);
      });
      await c.login(cfg.token);
      return { client: c, cfg };
    })().catch((e) => {
      clientPromise = null;
      throw e;
    });
  }
  return clientPromise;
}
export { getDiscord };
