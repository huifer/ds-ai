// ~/pi-discord-agents/src/dreaming/artifacts.mjs
// 「遐思」产物管理 — 读写 data/dreams/artifacts/<type>/<id>.md
//
// 关键不变量:
//   - 只读写 data/dreams/,绝不碰 data/memory/
//   - 每个 artifact 是独立 MD 文件,带 YAML frontmatter
//   - 写入用 atomic rename,避免半文件
//   - 反向只读打通由 cfg.feedContext 控制,本模块不关心

import { readFile, writeFile, rename, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS, TYPES, ALL_TYPES } from './paths.mjs';

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      meta[k] = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    } else if (v === 'true' || v === 'false') {
      meta[k] = v === 'true';
    } else if (!Number.isNaN(Number(v)) && /^-?\d+(\.\d+)?$/.test(v)) {
      meta[k] = Number(v);
    } else if (v.startsWith('{') || v.startsWith('[')) {
      // 嵌套对象 / 数组:尝试 JSON.parse
      try { meta[k] = JSON.parse(v); } catch { meta[k] = v.replace(/^["']|["']$/g, ''); }
    } else {
      meta[k] = v.replace(/^["']|["']$/g, '');
    }
  }
  return { meta, body: m[2] };
}

function stringifyFrontmatter(meta) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(meta)) {
    if (Array.isArray(v)) {
      // 数组元素全是字符串才走紧凑格式,否则 JSON
      if (v.every(x => typeof x === 'string')) lines.push(`${k}: [${v.join(', ')}]`);
      else lines.push(`${k}: ${JSON.stringify(v)}`);
    } else if (typeof v === 'number') {
      lines.push(`${k}: ${v}`);
    } else if (typeof v === 'boolean') {
      lines.push(`${k}: ${v}`);
    } else if (v !== null && typeof v === 'object') {
      // 嵌套对象:JSON 序列化(单行)
      lines.push(`${k}: ${JSON.stringify(v)}`);
    } else {
      lines.push(`${k}: "${String(v).replace(/"/g, '\\"')}"`);
    }
  }
  lines.push('---', '');
  return lines.join('\n');
}

function pad2(n) { return String(n).padStart(2, '0'); }

function todayKey(tzOffsetHours = 8) {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const tzMs = utcMs + tzOffsetHours * 3600_000;
  const d = new Date(tzMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export async function createArtifacts({ rootDir = PATHS.root, log = () => {} } = {}) {
  const artifactsRoot = join(rootDir, 'data', 'dreams', 'artifacts');

  // 启动时建子目录(防御性)
  for (const t of ALL_TYPES) {
    await mkdir(join(artifactsRoot, t), { recursive: true });
  }

  async function listMeta({ type, limit = 50 } = {}) {
    const types = type ? [type] : ALL_TYPES;
    const out = [];
    for (const t of types) {
      const dir = join(artifactsRoot, t);
      let entries;
      try { entries = await readdir(dir); } catch { continue; }
      for (const e of entries) {
        if (!e.endsWith('.md')) continue;
        try {
          const txt = await readFile(join(dir, e), 'utf8');
          const { meta } = parseFrontmatter(txt);
          if (meta?.id) out.push({ ...meta, _type: t });
        } catch {}
      }
    }
    out.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return out.slice(0, limit);
  }

  async function get(id) {
    for (const t of ALL_TYPES) {
      const file = join(artifactsRoot, t, `${id}.md`);
      try {
        const txt = await readFile(file, 'utf8');
        const { meta, body } = parseFrontmatter(txt);
        return { meta, body, type: t };
      } catch {}
    }
    return null;
  }

  async function create({ type, meta, body }) {
    if (!TYPES[type]) throw new Error(`unknown dream type: ${type}`);
    if (!meta?.id) throw new Error('artifact 需要 id');
    const dir = join(artifactsRoot, type);
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${meta.id}.md`);
    const tmp = file + '.tmp';
    const text = stringifyFrontmatter(meta) + '\n' + body + '\n';
    await writeFile(tmp, text, 'utf8');
    await rename(tmp, file);
    log(`[artifacts] 写入 ${type}/${meta.id}`);
    return { meta, body, type };
  }

  async function archive(id) {
    for (const t of ALL_TYPES) {
      const file = join(artifactsRoot, t, `${id}.md`);
      try {
        const txt = await readFile(file, 'utf8');
        const { meta } = parseFrontmatter(txt);
        meta.archived = true;
        meta.archivedAt = new Date().toISOString();
        const tmp = file + '.tmp';
        await writeFile(tmp, stringifyFrontmatter(meta) + '\n', 'utf8');
        await rename(tmp, file);
        return { ok: true, id, meta };
      } catch {}
    }
    return { ok: false, error: 'not found' };
  }

  async function recentSummaries({ limit = 7, excludeId = null } = {}) {
    const all = await listMeta({ limit: limit * 3 });
    const filtered = excludeId ? all.filter(a => a.id !== excludeId) : all;
    return filtered.slice(0, limit).map(a => ({
      id: a.id,
      type: a._type,
      title: a.title || '(无标题)',
      theme: a.theme || null,
      scores: a.scores || null,
      createdAt: a.createdAt,
    }));
  }

  return {
    listMeta,
    get,
    create,
    archive,
    recentSummaries,
    todayKey,
    TYPES,
    ALL_TYPES,
    artifactsRoot,
  };
}