// ~/pi-discord-agents/src/memory-store.mjs
// 文件系统版长期记忆存储:JSON 元数据 + MD 正文 + 独立向量索引。
//
// 设计:
//   data/memory/
//     index.json          全局轻量索引(快速启动 / 列表)
//     store/mem_<id>/
//       meta.json         机器读:kind/scope/tags/status/revision/embedding
//       content.md        人读:带 YAML frontmatter 的 Markdown
//     vector/index.json   向量索引(简化的 HNSW + brute-force cosine)
//     journal/            原始对话流(自动 capture)
//
// 关键不变量:
//   - meta.json 是权威,程序永远只读 meta.json
//   - content.md 是给人看的(你能在 VSCode 直接编辑)
//   - 两者写时一起更新,失败时回滚(meta 先写,content 写完才标 index 同步)
//   - index.json 是缓存,启动时如果不一致就 rebuild

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');
const MEMORY_DIR = resolve(ROOT, 'data', 'memory');
const STORE_DIR = join(MEMORY_DIR, 'store');
const VECTOR_FILE = join(MEMORY_DIR, 'vector', 'index.json');
const INDEX_FILE = join(MEMORY_DIR, 'index.json');

export const MEMORY_KINDS = [
  'preference', 'fact', 'decision', 'constraint',
  'project', 'context', 'todo', 'reflection', 'definition',
  'idea', 'build',
];

export const PROMPT_INJECTION_KINDS = new Set([
  'preference', 'fact', 'decision', 'constraint',
  'project', 'context', 'reflection', 'definition',
  'idea', 'build',
]);

// 启动时对整个子系统做目录初始化
function ensureDirs() {
  mkdirSync(STORE_DIR, { recursive: true });
  mkdirSync(join(MEMORY_DIR, 'vector'), { recursive: true });
  mkdirSync(join(MEMORY_DIR, 'journal'), { recursive: true });
  mkdirSync(join(MEMORY_DIR, 'snapshots'), { recursive: true });
  if (!existsSync(INDEX_FILE)) writeFileSync(INDEX_FILE, '[]\n', 'utf8');
  if (!existsSync(VECTOR_FILE)) writeFileSync(VECTOR_FILE, JSON.stringify({ vectors: [], version: 1 }) + '\n', 'utf8');
}

function nowIso() { return new Date().toISOString(); }

function safeId(subject) {
  // subject -> safe filename: ts-vs-js -> ts_vs_js
  return String(subject || 'memory')
    .toLowerCase()
    .replace(/[^a-z0-9一-龥_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'memory';
}

function memDir(id) { return join(STORE_DIR, id); }
function metaFile(id) { return join(memDir(id), 'meta.json'); }
function contentFile(id) { return join(memDir(id), 'content.md'); }

function atomicWriteJson(file, obj) {
  const tmp = `${file}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  renameSync(tmp, file);
}

function atomicWriteText(file, text) {
  const tmp = `${file}.tmp.${process.pid}`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, file);
}

function readIndex() {
  try {
    return JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeIndex(list) {
  atomicWriteJson(INDEX_FILE, list);
}

function buildIndexFromDisk() {
  // 扫描 store 目录,生成新的 index
  const list = [];
  for (const id of readdirSync(STORE_DIR)) {
    const metaPath = metaFile(id);
    if (!existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
      list.push(metaToIndexEntry(meta));
    } catch {}
  }
  list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  writeIndex(list);
  return list;
}

function metaToIndexEntry(meta) {
  // index 里只放轻量元数据,content 单独读
  const e = { ...meta };
  delete e.embedding; // 不放到 index,太大
  return e;
}

function syncIndexOne(meta) {
  const list = readIndex().filter((m) => m.id !== meta.id);
  list.push(metaToIndexEntry(meta));
  list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  writeIndex(list);
}

function syncIndexRemove(id) {
  const list = readIndex().filter((m) => m.id !== id);
  writeIndex(list);
}

// ---- MD 渲染 ----
function renderContentMarkdown(meta, content) {
  const fm = [
    '---',
    `id: ${meta.id}`,
    `kind: ${meta.kind}`,
    `scope: ${meta.scope}`,
    `subject: ${meta.subject}`,
    `tags: [${(meta.tags || []).join(', ')}]`,
    `confidence: ${meta.confidence ?? 0.9}`,
    `status: ${meta.status}`,
    `revision: ${meta.revision}`,
    meta.supersedes && meta.supersedes.length ? `supersedes: [${meta.supersedes.join(', ')}]` : null,
    `createdAt: ${meta.createdAt}`,
    `updatedAt: ${meta.updatedAt}`,
    meta.expiresAt ? `expiresAt: ${meta.expiresAt}` : null,
    meta.source ? `source: ${JSON.stringify(meta.source)}` : null,
    '---',
  ].filter(Boolean).join('\n');
  const title = content.title || meta.subject;
  const body = content.body || '';
  const changes = (content.changeLog || []).map((c) =>
    `- **${c.at}** revision ${c.revision}: ${c.note}`
  ).join('\n');
  return `${fm}\n\n# ${title}\n\n${body}\n\n## 变更记录\n${changes || '_(无)_\_'}\n`;
}

function parseContentMarkdown(text) {
  // 解析 YAML frontmatter
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { frontmatter: {}, body: text };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (!k) continue;
    if (v.startsWith('[') && v.endsWith(']')) {
      fm[k] = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    } else if (v === 'true' || v === 'false') {
      fm[k] = v === 'true';
    } else if (!Number.isNaN(Number(v)) && /^-?\d+(\.\d+)?$/.test(v)) {
      fm[k] = Number(v);
    } else {
      fm[k] = v.replace(/^["']|["']$/g, '');
    }
  }
  return { frontmatter: fm, body: m[2] };
}

// ---- 核心 API ----
export async function createMemoryStore({ rootDir = ROOT, embedder = null, log = () => {} } = {}) {
  const memoryDir = resolve(rootDir, 'data', 'memory');
  const storeDir = join(memoryDir, 'store');
  const vectorFile = join(memoryDir, 'vector', 'index.json');
  const indexFile = join(memoryDir, 'index.json');

  function ensureDirsLocal() {
    mkdirSync(storeDir, { recursive: true });
    mkdirSync(join(memoryDir, 'vector'), { recursive: true });
    mkdirSync(join(memoryDir, 'journal'), { recursive: true });
    mkdirSync(join(memoryDir, 'snapshots'), { recursive: true });
    if (!existsSync(indexFile)) writeFileSync(indexFile, '[]\n', 'utf8');
    if (!existsSync(vectorFile)) writeFileSync(vectorFile, JSON.stringify({ vectors: [], version: 1 }) + '\n', 'utf8');
  }
  ensureDirsLocal();

  // ---- 工具 ----
  function readIndexLocal() {
    try { return JSON.parse(readFileSync(indexFile, 'utf8')); } catch { return []; }
  }
  function writeIndexLocal(list) { atomicWriteJson(indexFile, list); }

  function atomicWriteJsonLocal(file, obj) {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp.${process.pid}`;
    writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
    renameSync(tmp, file);
  }
  function atomicWriteTextLocal(file, text) {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp.${process.pid}`;
    writeFileSync(tmp, text, 'utf8');
    renameSync(tmp, file);
  }

  function findActiveBySubject(subject, kind, scope = 'user') {
    // 简单扫 store(几万条个人记忆 O(n) 没问题)
    if (!existsSync(storeDir)) return null;
    for (const id of readdirSync(storeDir)) {
      const metaPath = join(storeDir, id, 'meta.json');
      if (!existsSync(metaPath)) continue;
      try {
        const m = JSON.parse(readFileSync(metaPath, 'utf8'));
        if (m.status === 'active' && m.subject === subject && m.kind === kind && m.scope === scope) return { id, meta: m };
      } catch {}
    }
    return null;
  }

  function loadMeta(id) {
    const p = join(storeDir, id, 'meta.json');
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8'));
  }

  function saveMeta(meta) {
    atomicWriteJsonLocal(join(storeDir, meta.id, 'meta.json'), meta);
  }

  function loadContent(id) {
    const p = join(storeDir, id, 'content.md');
    if (!existsSync(p)) return null;
    return readFileSync(p, 'utf8');
  }

  function saveContent(meta, content) {
    atomicWriteTextLocal(join(storeDir, meta.id, 'content.md'), renderContentMarkdown(meta, content));
  }

  function syncIndexOneLocal(meta) {
    const list = readIndexLocal().filter((m) => m.id !== meta.id);
    const entry = { ...meta };
    delete entry.embedding;
    list.push(entry);
    list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    writeIndexLocal(list);
  }

  function syncIndexRemoveLocal(id) {
    const list = readIndexLocal().filter((m) => m.id !== id);
    writeIndexLocal(list);
  }

  // ---- 向量索引(简化版:暴力 cosine + 列表) ----
  function loadVectorIndex() {
    try { return JSON.parse(readFileSync(vectorFile, 'utf8')); } catch { return { vectors: [], version: 1 }; }
  }
  function saveVectorIndex(idx) {
    atomicWriteJsonLocal(vectorFile, idx);
  }
  function vectorAdd(id, embedding) {
    if (!Array.isArray(embedding) || !embedding.length) return;
    const idx = loadVectorIndex();
    const filtered = idx.vectors.filter((v) => v.id !== id);
    filtered.push({ id, embedding, updatedAt: nowIso() });
    saveVectorIndex({ ...idx, vectors: filtered });
  }
  function vectorRemove(id) {
    const idx = loadVectorIndex();
    const filtered = idx.vectors.filter((v) => v.id !== id);
    if (filtered.length === idx.vectors.length) return;
    saveVectorIndex({ ...idx, vectors: filtered });
  }
  function vectorSearch(queryVec, candidates, limit) {
    if (!Array.isArray(queryVec) || !queryVec.length) return [];
    return candidates.map((id) => {
      const v = loadVectorIndex().vectors.find((x) => x.id === id);
      if (!v) return { id, score: 0 };
      return { id, score: cosine(queryVec, v.embedding) };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  }
  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
  }

  // ---- upsert ----
  async function upsert({
    kind, scope = 'user', subject, content, contentBody = null,
    tags = [], source = null, expiresAt = null, confidence = 0.9,
  } = {}) {
    if (!kind || !MEMORY_KINDS.includes(kind)) {
      throw new Error(`memory.upsert: 非法 kind=${kind}`);
    }
    if (!subject || !String(subject).trim()) throw new Error('memory.upsert: subject 必填');
    if (!content || !String(content).trim()) throw new Error('memory.upsert: content 必填');

    // 生成 id(subject 已有就用老的 id,保持稳定)
    const existing = findActiveBySubject(subject, kind, scope);
    const id = existing ? existing.id : `mem_${Date.now()}_${safeId(subject)}`;
    const now = nowIso();
    const oldMeta = existing ? existing.meta : null;

    // 计算 embedding
    let embedding = null;
    if (embedder) {
      try {
        const out = await embedder.embed(`${subject}\n${content}`);
        if (Array.isArray(out) && out.length) embedding = out;
      } catch (e) {
        log(`[memory] embedder 失败: ${e.message || e}`);
      }
    }

    // 变更记录
    const changeLog = oldMeta ? (() => {
      try {
        const prev = loadContent(oldMeta.id);
        if (!prev) return [];
        const parsed = parseContentMarkdown(prev);
        const changes = [];
        const m = parsed.body.match(/## 变更记录\n([\s\S]*?)$/);
        if (m) {
          for (const line of m[1].split('\n')) {
            const em = line.match(/^- \*\*(.+?)\*\* revision (\d+):\s*(.+)$/);
            if (em) changes.push({ at: em[1], revision: parseInt(em[2], 10), note: em[3] });
          }
        }
        return changes;
      } catch { return []; }
    })() : [];

    changeLog.push({
      at: now,
      revision: (oldMeta?.revision || 0) + 1,
      note: `修订(从 ${oldMeta ? `revision ${oldMeta.revision}` : '无'} 到 revision ${(oldMeta?.revision || 0) + 1})`,
    });

    // 旧条目 superseded
    const supersedes = oldMeta ? Array.from(new Set([oldMeta.id, ...(oldMeta.supersedes || [])])) : [];
    if (oldMeta) {
      oldMeta.status = 'superseded';
      oldMeta.updatedAt = now;
      try { saveMeta(oldMeta); } catch (e) { log(`[memory] 旧条目 superseded 写失败: ${e.message}`); }
    }

    const meta = {
      id, kind, scope, subject, content,
      tags: Array.from(new Set(tags)),
      source, confidence,
      revision: (oldMeta?.revision || 0) + 1,
      supersedes,
      status: 'active',
      embedding,
      createdAt: oldMeta?.createdAt || now,
      updatedAt: now,
      expiresAt,
    };
    saveMeta(meta);
    saveContent(meta, {
      title: subject,
      body: contentBody || content,
      changeLog,
    });
    syncIndexOneLocal(meta);
    vectorAdd(id, embedding);
    return { id, action: oldMeta ? 'updated' : 'created', revision: meta.revision, supersedes, previousId: oldMeta?.id || null };
  }

  // ---- query ----
  async function query({
    kind, kinds, subject, tags, contains, scope, limit = 12,
    includeSuperseded = false, mode = 'hybrid',
    queryVector = null,
  } = {}) {
    if (!existsSync(storeDir)) return { items: [], total: 0, byKind: {}, mode };
    const all = readdirSync(storeDir).map((id) => {
      const metaPath = join(storeDir, id, 'meta.json');
      if (!existsSync(metaPath)) return null;
      try { return JSON.parse(readFileSync(metaPath, 'utf8')); } catch { return null; }
    }).filter(Boolean);
    const isActive = (m) => m.status === 'active';
    let match;
    if (includeSuperseded) {
      match = (m) => m.status !== 'active' && (m.scope === scope || !scope);
    } else {
      match = isActive;
    }
    const baseFilter = (m) => {
      if (!match(m)) return false;
      if (kind && m.kind !== kind) return false;
      if (kinds && kinds.length && !kinds.includes(m.kind)) return false;
      if (subject && m.subject !== subject) return false;
      if (scope && m.scope !== scope) return false;
      if (tags && tags.length && !tags.some((t) => (m.tags || []).includes(t))) return false;
      if (contains && !m.content.toLowerCase().includes(contains.toLowerCase())) return false;
      return true;
    };

    if (includeSuperseded) {
      const items = all.filter(baseFilter).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, limit);
      return { items, total: items.length, byKind: groupByKindLocal(items), mode: 'history' };
    }

    if (mode === 'recent') {
      const items = all.filter(baseFilter).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, limit);
      return { items, total: items.length, byKind: groupByKindLocal(items), mode };
    }

    if (mode === 'vector' && Array.isArray(queryVector) && queryVector.length) {
      const candidates = all.filter(baseFilter).map((m) => m.id);
      const scored = vectorSearch(queryVector, candidates, limit);
      const byId = new Map(all.map((m) => [m.id, m]));
      const items = scored.map((s) => ({ ...byId.get(s.id), score: s.score })).filter(Boolean);
      return { items, total: items.length, byKind: groupByKindLocal(items), mode };
    }

    if (mode === 'text' && contains) {
      const items = all.filter(baseFilter)
        .map((m) => ({ m, score: textScore(m, contains) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => ({ ...x.m, score: x.score }));
      return { items, total: items.length, byKind: groupByKindLocal(items), mode };
    }

    if (mode === 'hybrid' && contains) {
      let qvec = queryVector;
      if (!qvec && embedder) {
        try { qvec = await embedder.embed(contains); } catch {}
      }
      const candidates = all.filter(baseFilter);
      const fts = candidates
        .map((m) => ({ m, s: textScore(m, contains) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, limit);
      const ids = candidates.map((m) => m.id);
      const vecResults = Array.isArray(qvec) && qvec.length
        ? vectorSearch(qvec, ids, limit).map((v) => ({ m: candidates.find((c) => c.id === v.id), s: v.score })).filter((x) => x.m)
        : [];
      // RRF
      const K = 60;
      const merged = new Map();
      fts.forEach((x, i) => {
        const cur = merged.get(x.m.id) || { m: x.m, s: 0 };
        cur.s += 1 / (K + i + 1);
        merged.set(x.m.id, cur);
      });
      vecResults.forEach((x, i) => {
        const cur = merged.get(x.m.id) || { m: x.m, s: 0 };
        cur.s += 1 / (K + i + 1);
        merged.set(x.m.id, cur);
      });
      const items = [...merged.values()].sort((a, b) => b.s - a.s).slice(0, limit).map((x) => ({ ...x.m, score: x.s, _source: vecResults.find((y) => y.m.id === x.m.id) ? 'vector' : 'text' }));
      return { items, total: items.length, byKind: groupByKindLocal(items), mode };
    }

    // filter
    const items = all.filter(baseFilter).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, limit);
    return { items, total: items.length, byKind: groupByKindLocal(items), mode: 'filter' };
  }

  function textScore(meta, query) {
    const q = query.toLowerCase();
    let s = 0;
    if (meta.subject?.toLowerCase().includes(q)) s += 5;
    if (meta.content?.toLowerCase().includes(q)) s += 1;
    for (const t of meta.tags || []) if (String(t).toLowerCase().includes(q)) s += 2;
    return s;
  }

  function groupByKindLocal(items) {
    const m = {};
    for (const it of items) m[it.kind] = (m[it.kind] || 0) + 1;
    return m;
  }

  // ---- revoke ----
  async function revoke({ id, subject, scope, kind, reason = null } = {}) {
    if (!id && !subject) throw new Error('memory.revoke: 需要 id 或 subject');
    const targets = [];
    if (id) {
      const m = loadMeta(id);
      if (m && m.status === 'active') targets.push({ id, meta: m });
    } else {
      // 通过 subject + kind 找 active
      const all = existsSync(storeDir) ? readdirSync(storeDir) : [];
      for (const dir of all) {
        const m = loadMeta(dir);
        if (!m) continue;
        if (m.status !== 'active') continue;
        if (m.subject !== subject) continue;
        if (kind && m.kind !== kind) continue;
        if (scope && m.scope !== scope) continue;
        targets.push({ id: dir, meta: m });
      }
    }
    if (!targets.length) return { ok: false, count: 0, ids: [], entries: [] };
    const now = nowIso();
    for (const { id: tid, meta: tmeta } of targets) {
      tmeta.status = 'revoked';
      tmeta.updatedAt = now;
      if (reason) tmeta.revokedReason = reason;
      saveMeta(tmeta);
      syncIndexOneLocal(tmeta);
      vectorRemove(tid);
    }
    return { ok: true, count: targets.length, ids: targets.map((t) => t.id), entries: targets.map((t) => t.meta), reason };
  }

  // ---- buildContext ----
  async function buildContext({ userText = '', scope = null, kinds = null, limit = 8 } = {}) {
    const activeKinds = kinds && kinds.length ? kinds : [...PROMPT_INJECTION_KINDS];
    const r = await query({
      kinds: activeKinds,
      scope,
      contains: userText,
      limit: Math.max(20, limit * 4),
      mode: userText ? 'hybrid' : 'recent',
    });
    const items = r.items.slice(0, limit);
    if (!items.length) return '';
    const lines = ['<memory-digest>'];
    for (const it of items) {
      const tags = it.tags && it.tags.length ? ` · tags=${it.tags.join(',')}` : '';
      const exp = it.expiresAt ? ` · exp=${shortDate(it.expiresAt)}` : '';
      lines.push(`- [${it.kind}] ${it.subject} — ${truncate(it.content, 200)} (rev=${it.revision}${tags}${exp})`);
    }
    lines.push('</memory-digest>');
    return lines.join('\n');
  }

  // ---- compact ----
  async function compact({ keepActiveDays = 365, keepHistoricalDays = 90 } = {}) {
    const now = new Date();
    const histCutoff = new Date(now - keepHistoricalDays * 86400_000);
    const activeCutoff = new Date(now - keepActiveDays * 86400_000);
    let expired = 0, archived = 0, removed = 0;
    if (!existsSync(storeDir)) return { expired, archived, removed };
    for (const id of readdirSync(storeDir)) {
      const meta = loadMeta(id);
      if (!meta) continue;
      if (meta.status === 'active') {
        if (meta.expiresAt && new Date(meta.expiresAt) <= now) {
          meta.status = 'expired'; meta.updatedAt = nowIso();
          saveMeta(meta); syncIndexOneLocal(meta); expired++;
        } else if (meta.updatedAt && new Date(meta.updatedAt) <= activeCutoff) {
          meta.status = 'archived'; meta.updatedAt = nowIso();
          saveMeta(meta); syncIndexOneLocal(meta); archived++;
        }
      } else if (meta.status !== 'active' && meta.updatedAt && new Date(meta.updatedAt) <= histCutoff) {
        // 删除老的 superseded/revoked/expired/archived
        try {
          unlinkSync(join(storeDir, id, 'meta.json'));
        } catch {}
        try {
          unlinkSync(join(storeDir, id, 'content.md'));
        } catch {}
        try {
          const d = join(storeDir, id);
          if (existsSync(d) && readdirSync(d).length === 0) {
            // rmdir(d); // 不强制,留着
          }
        } catch {}
        syncIndexRemoveLocal(id);
        vectorRemove(id);
        removed++;
      }
    }
    return { expired, archived, removed };
  }

  // ---- stats ----
  async function stats() {
    const all = existsSync(storeDir) ? readdirSync(storeDir) : [];
    let total = 0, byKind = {};
    for (const id of all) {
      const m = loadMeta(id);
      if (!m) continue;
      total++;
      if (m.status === 'active') byKind[m.kind] = (byKind[m.kind] || 0) + 1;
    }
    const v = loadVectorIndex();
    return {
      total, byKind,
      vectorCount: v.vectors.length,
      lastUpdate: all.length ? (loadMeta(all[0])?.updatedAt || null) : null,
      kinds: MEMORY_KINDS,
      storeDir: storeDir,
    };
  }

  // ---- readContent(暴露给镜像/导入) ----
  function readContent(id) {
    return loadContent(id);
  }
  function readMeta(id) {
    return loadMeta(id);
  }
  function getVectorFile() { return vectorFile; }
  function getIndexFile() { return indexFile; }
  function getStoreDir() { return storeDir; }

  return {
    upsert, query, revoke, compact, buildContext, stats,
    readContent, readMeta,
    getVectorFile, getIndexFile, getStoreDir,
    vectorAdd, vectorRemove, vectorSearch,
    syncIndexOne: syncIndexOneLocal,
    syncIndexRemove: syncIndexRemoveLocal,
    buildIndex: buildIndexFromDisk,
    close: async () => {},
  };
}

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}
function shortDate(d) {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
