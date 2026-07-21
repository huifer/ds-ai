// ~/pi-discord-agents/src/dreaming/budget.mjs
// 每日 token 预算控制(默认 5,000,000 / 天)。
//
// 设计:
//   - 按日期 key,自然 reset(UTC+8 当天)
//   - 持久化到 .dreams/budget.json,跨进程重启不丢
//   - 预算超限不报错,只标记 isOver,留给 caller 决定怎么处理
//   - 读 / 写都用 atomic rename,避免半文件状态

import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS } from './paths.mjs';

function todayKey(tzOffsetHours = 8) {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const tzMs = utcMs + tzOffsetHours * 3600_000;
  const d = new Date(tzMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const TMP = PATHS.budgetFile + '.tmp';

async function readState() {
  try {
    const txt = await readFile(PATHS.budgetFile, 'utf8');
    return JSON.parse(txt);
  } catch {
    return { dateKey: null, tokensIn: 0, tokensOut: 0 };
  }
}

async function writeState(state) {
  await writeFile(TMP, JSON.stringify(state, null, 2), 'utf8');
  await rename(TMP, PATHS.budgetFile);
}

export function createBudget({ dailyLimit = 5_000_000, tzOffsetHours = 8, log = () => {} } = {}) {
  let currentDate = todayKey(tzOffsetHours);
  let state = { dateKey: currentDate, tokensIn: 0, tokensOut: 0 };

  // 启动时读盘
  readState().then((persisted) => {
    // 同一天才恢复;跨天丢弃
    if (persisted.dateKey === currentDate) state = persisted;
    log(`[budget] 加载 ${state.tokensIn + state.tokensOut} tokens (${state.dateKey})`);
  }).catch(() => {});

  function rolloverIfNeeded() {
    const t = todayKey(tzOffsetHours);
    if (t !== currentDate) {
      log(`[budget] 日期切换 ${currentDate} → ${t},清零`);
      currentDate = t;
      state = { dateKey: t, tokensIn: 0, tokensOut: 0 };
      writeState(state).catch(() => {});
    }
  }

  function total() {
    return state.tokensIn + state.tokensOut;
  }

  function remaining() {
    rolloverIfNeeded();
    return Math.max(0, dailyLimit - total());
  }

  function isOver() {
    rolloverIfNeeded();
    return total() >= dailyLimit;
  }

  async function record({ tokensIn = 0, tokensOut = 0 }) {
    rolloverIfNeeded();
    state.tokensIn += tokensIn;
    state.tokensOut += tokensOut;
    try { await writeState(state); } catch (e) {
      log('[budget] 写盘失败(非致命):', e.message);
    }
    return { total: total(), remaining: remaining(), over: isOver() };
  }

  async function snapshot() {
    rolloverIfNeeded();
    return {
      dateKey: state.dateKey,
      tokensIn: state.tokensIn,
      tokensOut: state.tokensOut,
      total: total(),
      dailyLimit,
      remaining: remaining(),
      over: isOver(),
    };
  }

  return {
    record,
    remaining,
    isOver,
    snapshot,
    get dailyLimit() { return dailyLimit; },
  };
}