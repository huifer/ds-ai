// ~/pi-discord-agents/src/config.mjs
// 配置加载:优先 ~/.pi-discord-agents/.env,fallback 到 ~/.pi-discord-agents/config.json
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
    // 简单值:去掉首尾引号
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

export function loadConfig() {
  if (!existsSync(ENV_PATH)) {
    return { ok: false, error: `.env 不存在,模板在: ${ROOT}/.env.example` };
  }
  const env = parseEnvText(readFileSync_(ENV_PATH));

  const token = env.DISCORD_TOKEN;
  const entryChannelId = env.CH_ENTRY;
  if (!token) return { ok: false, error: '.env 缺 DISCORD_TOKEN' };
  if (!entryChannelId) return { ok: false, error: '.env 缺 CH_ENTRY(主入口 channel ID)' };

  return {
    ok: true,
    value: {
      token,
      allowedUserIds: (env.ALLOWED_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
      guildId: env.GUILD_ID || '',
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
        memory:  '🧠',
        ideas:   '✨',
        build:   '🔨',
        journal: '🌿',
        signal:  '📡',
        system:  '🛠',
      },
      // 智能路由:类别关键词命中 → 对应 channel
      routing: {
        memory:  ['preference','always','never','prefer','rule','constraint','target','version','framework','language','language preference','constraint:','rule:','禁用','禁止','不要','总是','永远','偏好','约束','原则'],
        ideas:   ['idea','灵感','点子','imagine','wouldn','t be cool','what if','hack','wish','未来','设想','设想一下','我有个想法','突发奇想'],
        build:   ['build','deploy','code','error','bug','fix','commit','push','pr','merge','branch','version','library','package','config','架构','架构选型','实现','部署','代码','报错','修复','bug','提交','合并','分支','版本','库','包','配置'],
        journal: ['feel','mood','sleep','tired','happy','sad','angry','anxious','reflect','thoughts','today','was a','心情','心境','失眠','累','开心','难过','生气','焦虑','反思','感悟','日记','今天','一日','状态'],
      },
      // system prompt 注入
      routerSystemPrompt: env.ROUTER_SYSTEM_PROMPT || null,
    },
  };
}

function readFileSync_(p) {
  return readFileSync(p, 'utf8');
}

export const PATHS = {
  root: ROOT,
  env: ENV_PATH,
  log: resolve(ROOT, 'logs', 'orchestrator.log'),
};
