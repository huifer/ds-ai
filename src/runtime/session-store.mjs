// ~/pi-discord-agents/src/runtime/session-store.mjs
// SessionStore：按 SessionKey 派生路径，JSONL 追加。

import { mkdirSync, appendFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

export class SessionStore {
  constructor({ root, baseDir = 'data/agent-runtime/sessions', idleTtlMinutes = 60 }) {
    this.root = root;
    this.baseDir = resolve(root, baseDir);
    this.idleTtlMinutes = idleTtlMinutes;
    this.writers = new Map(); // path -> { stream, ref }
  }

  pathFor(sessionKey) {
    const safe = sessionKey.replace(/[^a-zA-Z0-9:_.-]/g, '_');
    const hash = createHash('sha1').update(sessionKey).digest('hex').slice(0, 12);
    return resolve(this.baseDir, safe, `${hash}.jsonl`);
  }

  async append(sessionKey, record) {
    const path = this.pathFor(sessionKey);
    await this.ensureDir(path);
    const line = JSON.stringify({ at: new Date().toISOString(), session: sessionKey, ...record }) + '\n';
    appendFileSync(path, line, 'utf8');
  }

  async ensureDir(path) {
    const dir = resolve(path, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  async flush() {
    // 当前实现使用 appendFileSync 立即落盘，无需 flush。
  }

  // 回收 idle 超过 TTL 的 Session
  reap() {
    if (!existsSync(this.baseDir)) return [];
    const removed = [];
    const now = Date.now();
    walk(this.baseDir, (file) => {
      const stat = statSync(file);
      const ageMin = (now - stat.mtimeMs) / 60000;
      if (ageMin > this.idleTtlMinutes) {
        unlinkSync(file);
        removed.push(file);
      }
    });
    return removed;
  }
}

function walk(dir, visit) {
  const stat = statSync(dir);
  if (stat.isFile()) {
    visit(dir);
    return;
  }
  for (const name of readdirSync(dir)) {
    walk(join(dir, name), visit);
  }
}
