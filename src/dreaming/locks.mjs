// ~/pi-discord-agents/src/dreaming/locks.mjs
// 简单文件锁 — 用 mkdir 原子性实现,避免 dreaming 与 dreaming 之间重入。
//
// 用法:
//   const release = await acquireLock('xiasi-2026-07-20-01');
//   if (!release) { /* 已有人在跑这个 dream */ return; }
//   try { ... } finally { await release(); }

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS } from './paths.mjs';

export async function acquireLock(name, { ttlMs = 30 * 60 * 1000 } = {}) {
  const lockDir = join(PATHS.locksDir, `${name}.lock`);
  try {
    await mkdir(lockDir, { recursive: false });
    // 写 metadata(谁/什么时候拿的)
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(lockDir, 'meta.json'),
      JSON.stringify({ acquiredAt: new Date().toISOString(), ttlMs }, null, 2),
      'utf8');
    return async function release() {
      try { await rm(lockDir, { recursive: true, force: true }); } catch {}
    };
  } catch (e) {
    if (e.code === 'EEXIST') return null; // 已被别人锁住
    throw e;
  }
}

export async function isLocked(name) {
  try {
    const { stat } = await import('node:fs/promises');
    await stat(join(PATHS.locksDir, `${name}.lock`));
    return true;
  } catch {
    return false;
  }
}