// ~/pi-discord-agents/src/config.mjs
// 配置加载:读取 ~/pi-discord-agents/.env,并统一校验所有运行时频道。
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');
const ENV_PATH = resolve(ROOT, '.env');

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

const CHANNEL_ENV_KEYS = [
  'CH_ENTRY', 'CH_MEMORY', 'CH_IDEAS', 'CH_BUILD',
  'CH_SYSTEM', 'CH_RSS', 'CH_DAILY', 'CH_GH', 'CH_USAGE',
  'CH_OPPORTUNITY', 'CH_XIASI',
];

function isSnowflake(value) {
  return /^\d{17,20}$/.test(String(value || ''));
}

export function loadConfig() {
  if (!existsSync(ENV_PATH)) {
    return { ok: false, error: `.env 不存在,模板在: ${ROOT}/.env.example` };
  }
  const env = parseEnvText(readFileSync(ENV_PATH, 'utf8'));

  const token = env.DISCORD_TOKEN;
  if (!token) return { ok: false, error: '.env 缺 DISCORD_TOKEN' };

  const missing = CHANNEL_ENV_KEYS.filter((key) => !env[key]);
  if (missing.length) {
    return { ok: false, error: `.env 缺少频道配置: ${missing.join(', ')}` };
  }

  const invalidReq = CHANNEL_ENV_KEYS.filter((key) => !isSnowflake(env[key]));
  if (invalidReq.length) {
    return { ok: false, error: `必需频道 ID 格式错误: ${invalidReq.join(', ')}` };
  }

  // 企业/扩展频道：任何 CH_* 一旦配置就必须是合法 snowflake，否则启动即拒。
  // 避免 channel-map.mjs / approval.mjs 在运行时静默读到畸形频道 ID（原仅校验 11 个必需频道）。
  const allChKeys = Object.keys(env).filter((k) => k.startsWith('CH_'));
  const invalidExt = allChKeys.filter((k) => !isSnowflake(env[k]));
  if (invalidExt.length) {
    return { ok: false, error: `频道 ID 格式错误: ${invalidExt.join(', ')}` };
  }

  const usageChannel = env.CH_USAGE;
  const opportunityChannel = env.CH_OPPORTUNITY;

  return {
    ok: true,
    _env: env,
    value: {
      token,
      allowedUserIds: (env.ALLOWED_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
      guildId: env.GUILD_ID || '',
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
        opportunity: opportunityChannel,
        xiasi:       env.CH_XIASI || '',
        fileCollection: env.CH_FILE_COLLECTION || '',
      },
      labels: {
        entry:       '📝',
        memory:      '🧠',
        ideas:       '✨',
        build:       '🔨',
        system:      '🛠',
        rss:         '📰',
        daily:       '🌙',
        gh:          '🎯',
        usage:       '📊',
        opportunity: '💡',
        xiasi:       '🌙',
      },
      usageDays: parseInt(env.USAGE_DAYS || '14', 10) || 14,
      // 「遐思」配置 — 由 dreaming/config.mjs 进一步规范化
      dreamingRaw: {
        channelId: env.CH_XIASI || '',
        enabled: env.XIASI_ENABLED || 'false',
        silent: env.XIASI_SILENT || 'false',
        types: env.XIASI_TYPES || 'lian-zhu,gui-cang,ming-tai',
        dailyTokenBudget: env.XIASI_DAILY_TOKEN_BUDGET || '5000000',
        feedContext: env.XIASI_FEED_CONTEXT || 'false',
        tzOffsetHours: parseInt(env.XIASI_TZ_OFFSET || '8', 10) || 8,
      },
    },
  };
}

export const PATHS = {
  root: ROOT,
  env: ENV_PATH,
  log: resolve(ROOT, 'logs', 'orchestrator.log'),
};
