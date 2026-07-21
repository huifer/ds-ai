// ~/pi-discord-agents/src/dreaming/config.mjs
// 「遐思」配置加载 — 从 .env 读 CH_XIASI 等,带默认值。
//
// 配置项说明:
//   CH_XIASI                  Discord #遐思 频道 ID(必填,用户需在 Discord 创建并填到 .env)
//   XIASI_ENABLED             true/false,默认 false(opt-in,关闭时所有功能静默)
//   XIASI_SILENT              true = 只推完成/失败,不推开始(默认 false)
//   XIASI_DAILY_TOKEN_BUDGET  每日 token 上限,默认 5_000_000
//   XIASI_FEED_CONTEXT        是否让 artifacts 反向参与 memory-context 检索(默认 false)
//   XIASI_TYPES               逗号分隔,允许跑的 type;默认 lian-zhu,gui-cang,ming-tai
import { TYPES } from './paths.mjs';
import { existsSync, readFileSync } from 'node:fs';
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

function loadDotenvFallback() {
  if (!existsSync(ENV_PATH)) return {};
  try { return parseEnvText(readFileSync(ENV_PATH, 'utf8')); } catch { return {}; }
}

export function loadXiasiConfig({ env = process.env } = {}) {
  // process.env 优先,.env 兜底(让 standalone 脚本也能跑)
  const dotenv = loadDotenvFallback();
  const merged = { ...dotenv, ...env };

  const channelId = merged.CH_XIASI || '';
  const enabledRaw = (merged.XIASI_ENABLED || 'false').toLowerCase();
  const silentRaw  = (merged.XIASI_SILENT || 'false').toLowerCase();

  const typesRaw = merged.XIASI_TYPES || 'lian-zhu,gui-cang,ming-tai';
  const types = typesRaw.split(',').map(s => s.trim()).filter(Boolean)
    .filter(t => TYPES[t]);

  const dailyBudget = parseInt(merged.XIASI_DAILY_TOKEN_BUDGET || '5000000', 10) || 5_000_000;
  const feedContext = (merged.XIASI_FEED_CONTEXT || 'false').toLowerCase() === 'true';
  const tzOffsetHours = parseInt(merged.XIASI_TZ_OFFSET || '8', 10) || 8;

  // 增强配置
  const goodDreamEnabled = (merged.XIASI_GOOD_DREAM_ENABLED || 'false').toLowerCase() === 'true';
  const nightmareMitigation = (merged.XIASI_NIGHTMARE_MITIGATION || 'true').toLowerCase() === 'true';
  const nightmareThreshold = parseFloat(merged.XIASI_NIGHTMARE_THRESHOLD || '-0.2');
  const dreamToMemory = (merged.XIASI_DREAM_TO_MEMORY || 'false').toLowerCase() === 'true';
  const qualityThreshold = parseFloat(merged.XIASI_QUALITY_THRESHOLD || '0.60');
  const voteFeedback = (merged.XIASI_VOTE_FEEDBACK || 'false').toLowerCase() === 'true';
  const selfImprove = (merged.XIASI_SELF_IMPROVE || 'false').toLowerCase() === 'true';

  return {
    enabled: enabledRaw === 'true',
    silent: silentRaw === 'true',
    channelId,
    types,
    dailyTokenBudget: dailyBudget,
    feedContext,
    tzOffsetHours,
    // 增强配置
    goodDreamEnabled,
    nightmareMitigation,
    nightmareThreshold,
    dreamToMemory,
    qualityThreshold,
    voteFeedback,
    selfImprove,
  };
}

// 给 logging 用
export function describeXiasiConfig(xc) {
  return [
    `enabled=${xc.enabled}`,
    `silent=${xc.silent}`,
    `channel=${xc.channelId || '(none)'}`,
    `types=${xc.types.join(',')}`,
    `budget=${xc.dailyTokenBudget.toLocaleString()} tokens/day`,
    `feedContext=${xc.feedContext}`,
    `goodDream=${xc.goodDreamEnabled}`,
    `nightmare=${xc.nightmareMitigation}`,
    `dreamToMemory=${xc.dreamToMemory}`,
  ].join(' · ');
}