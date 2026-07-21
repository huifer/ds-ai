// ~/pi-discord-agents/src/runtime/skill-loader.mjs
// SkillLoader：按 Agent 显式加载 Skill。
// 不全局可见；frontmatter 索引；缓存加载结果。

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

export class SkillLoader {
  constructor({ root }) {
    this.root = root;
    this.cache = new Map();   // path -> { name, frontmatter, body, loadedAt }
    this.loaded = new Set();  // skill names already warmed up
  }

  load(skillPath) {
    if (this.cache.has(skillPath)) return this.cache.get(skillPath);
    const abs = resolve(this.root, skillPath);
    if (!existsSync(abs)) {
      throw new Error(`skill not found: ${skillPath}`);
    }
    const raw = readFileSync(abs, 'utf8');
    const { frontmatter, body } = parseFrontmatter(raw);
    const record = {
      name: frontmatter.name ?? deriveName(skillPath),
      path: skillPath,
      frontmatter,
      body,
      loadedAt: new Date().toISOString(),
    };
    this.cache.set(skillPath, record);
    return record;
  }

  loadMany(skillPaths) {
    return skillPaths.map((p) => this.load(p));
  }

  resolveForAgent(agentDef) {
    return agentDef.skills.map((s) => this.load(s));
  }

  warmup() {
    // 启动时由 AgentManager 调一次，预热常用 Skill。
    // 按需加载：调用方在 registerAgent 时 load 所需 Skill，不主动枚举全部。
  }
}

function parseFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: {}, body: text };
  const end = text.indexOf('\n---', 3);
  if (end < 0) return { frontmatter: {}, body: text };
  const yaml = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\n/, '');
  const frontmatter = {};
  for (const line of yaml.split('\n')) {
    const m = line.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
    if (!m) continue;
    frontmatter[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return { frontmatter, body };
}

function deriveName(skillPath) {
  const parts = skillPath.split('/');
  return parts[parts.length - 1] || 'skill';
}
