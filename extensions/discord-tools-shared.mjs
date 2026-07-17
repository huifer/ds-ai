// ~/pi-discord-agents/extensions/discord-tools-shared.mjs
// 工具层共享:env → cfg 解析 + 延迟初始化的 Discord client。
//
// 设计:
//   - Pi 子进程从环境变量里读 config(token / channel IDs)
//     这些 env 由 entry-bot 在 spawn 前设置好
//   - client 是惰性单例:第一次工具调用时 login,后续复用
//   - 走 .env 同一份文件,跟 entry-bot 保持一致
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');
const ENV_PATH = resolve(ROOT, '.env');

// 读 .env —— 简单行解析,不引外部依赖
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
  // 优先 env(由 entry-bot 显式传),fallback 到 .env 直读
  const env = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    CH_ENTRY: process.env.CH_ENTRY,
    CH_MEMORY: process.env.CH_MEMORY,
    CH_IDEAS: process.env.CH_IDEAS,
    CH_BUILD: process.env.CH_BUILD,
    CH_JOURNAL: process.env.CH_JOURNAL,
    CH_SIGNAL: process.env.CH_SIGNAL,
    CH_SYSTEM: process.env.CH_SYSTEM,
  };
  for (const k of Object.keys(env)) {
    if (!env[k] && existsSync(ENV_PATH)) {
      const file = parseEnvText(readFileSync(ENV_PATH, 'utf8'));
      for (const kk of Object.keys(env)) if (!env[kk] && file[kk]) env[kk] = file[kk];
      break;
    }
  }
  cachedCfg = {
    token: env.DISCORD_TOKEN,
    channels: {
      entry:   env.CH_ENTRY,
      memory:  env.CH_MEMORY,
      ideas:   env.CH_IDEAS,
      build:   env.CH_BUILD,
      journal: env.CH_JOURNAL,
      signal:  env.CH_SIGNAL,
      system:  env.CH_SYSTEM,
    },
    labels: {
      memory: '🧠', ideas: '✨', build: '🔨',
      journal: '🌿', signal: '📡', system: '🛠',
    },
  };
  return cachedCfg;
}

// 把 (category 或 channel_id) 解析成 channelId
export function resolveChannelId(args, cfg, fallback = 'entry') {
  if (args.channel_id) return args.channel_id;
  const cat = args.category || fallback;
  return cfg.channels?.[cat] || cfg.channels?.entry;
}

// ---- 懒加载 Discord client(工具层自己持有) ----
let clientPromise = null;
let dynamicImport = null;
async function getDiscord() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { Client, GatewayIntentBits } = await import('discord.js');
      const cfg = getCfg();
      const c = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
        ],
      });
      c.once('ready', () => {
        // 用 console 输出,Pi 子进程的 stderr 进 orchestrator 日志
        console.error(`[discord-tools] 已登录 🌟 ${c.user.tag}`);
      });
      await c.login(cfg.token);
      return { client: c, cfg };
    })().catch((e) => {
      clientPromise = null;  // 下次重试
      throw e;
    });
  }
  return clientPromise;
}
export { getDiscord };
