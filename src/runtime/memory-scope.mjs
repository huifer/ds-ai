// ~/pi-discord-agents/src/runtime/memory-scope.mjs
// MemoryScope：按 Scope 校验读 / 写权限。
// 存储格式：data/agent-runtime/memory/<scope>.jsonl

import { mkdirSync, existsSync, appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCOPES = [
  'company', 'founder', 'coding', 'current-project',
  'business', 'finance', 'sales', 'fde-knowledge', 'content',
  'industry', 'agent-internal',
];

export class MemoryScope {
  constructor({ root, baseDir = 'data/agent-runtime/memory' }) {
    this.root = root;
    this.baseDir = resolve(root, baseDir);
    this.scopes = new Set(SCOPES);
  }

  pathFor(scope) {
    if (!this.scopes.has(scope)) {
      throw new Error(`unknown memory scope: ${scope}`);
    }
    return resolve(this.baseDir, `${scope}.jsonl`);
  }

  canRead(scope, agentDef) {
    if (!this.scopes.has(scope)) return false;
    return (agentDef.memory?.readScopes ?? []).includes(scope);
  }

  canWrite(scope, agentDef) {
    if (!this.scopes.has(scope)) return false;
    return agentDef.memory?.writeScope === scope;
  }

  async read(scope, agentDef, { limit = 100 } = {}) {
    if (!this.canRead(scope, agentDef)) {
      throw new PermissionError(`agent ${agentDef.id} cannot read scope ${scope}`);
    }
    const path = this.pathFor(scope);
    if (!existsSync(path)) return [];
    const lines = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l));
  }

  async write(scope, agentDef, record) {
    if (!this.canWrite(scope, agentDef)) {
      throw new PermissionError(`agent ${agentDef.id} cannot write scope ${scope}`);
    }
    const path = this.pathFor(scope);
    const dir = resolve(path, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ at: new Date().toISOString(), agent: agentDef.id, ...record }) + '\n';
    appendFileSync(path, line, 'utf8');
  }
}

export class PermissionError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'PermissionError';
  }
}
