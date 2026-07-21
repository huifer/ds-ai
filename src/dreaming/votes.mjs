// ~/pi-discord-agents/src/dreaming/votes.mjs
// 「遐思」Discord 投票数据持久化。
//
// 数据结构:
//   {
//     "<artifactId>": {
//       up: number,
//       down: number,
//       star: number,
//       voters: { "<userId>": "up" | "down" | "star" }
//     }
//   }

import { readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PATHS } from './paths.mjs';

async function loadVotes() {
  try {
    const txt = await readFile(PATHS.votesFile, 'utf8');
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

async function saveVotes(votes) {
  mkdirSync(dirname(PATHS.votesFile), { recursive: true });
  const tmp = PATHS.votesFile + '.tmp';
  await writeFile(tmp, JSON.stringify(votes, null, 2), 'utf8');
  await rename(tmp, PATHS.votesFile);
}

export function createVotes({ log = () => {} } = {}) {
  // 进程内缓存(避免每次都读盘)
  let cache = null;

  async function get(artifactId) {
    if (!cache) cache = await loadVotes();
    return cache[artifactId] || { up: 0, down: 0, star: 0, voters: {} };
  }

  /**
   * 投票(每个用户对每个 artifact 只能投一种)。
   * 重复点同一按钮 → 取消投票。
   * 点不同按钮 → 切换。
   */
  async function vote({ artifactId, userId, kind }) {
    if (!cache) cache = await loadVotes();
    if (!cache[artifactId]) cache[artifactId] = { up: 0, down: 0, star: 0, voters: {} };
    const v = cache[artifactId];
    const prev = v.voters[userId];

    // 先撤销旧票
    if (prev && prev !== kind) {
      v[prev] = Math.max(0, v[prev] - 1);
    }

    // 切换 / 取消
    if (prev === kind) {
      // 重复点 → 取消
      delete v.voters[userId];
      v[kind] = Math.max(0, v[kind] - 1);
    } else {
      v.voters[userId] = kind;
      v[kind] = (v[kind] || 0) + 1;
    }

    try { await saveVotes(cache); } catch (e) {
      log('[votes] 写盘失败(非致命):', e.message);
    }
    return { ok: true, current: v, toggledOff: prev === kind };
  }

  async function all() {
    if (!cache) cache = await loadVotes();
    return cache;
  }

  return { get, vote, all };
}