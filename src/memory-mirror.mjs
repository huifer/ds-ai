// ~/pi-discord-agents/src/memory-mirror.mjs
// 把 memory 同步到 #记忆库 频道:每条 memory 对应一条 Discord 消息,
// create / update / revoke 都做对应操作,而不是简单 append。
//
// 频道是 read mirror,不是 source of truth;权威源是 data/memory/store/<id>/{meta.json,content.md}。
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_MESSAGE_LEN = 1900;

export function createMemoryMirror({ memoryStore, discord, channelId, label = '🧠', log = () => {} } = {}) {
  let activeChannel = channelId;
  let activeLabel = label;

  function setChannel(id, lbl) {
    activeChannel = id;
    if (lbl) activeLabel = lbl;
  }

  function formatBody(entry, { revokedReason = null } = {}) {
    const tags = entry.tags && entry.tags.length ? `\n· tags: ${entry.tags.join(', ')}` : '';
    const exp = entry.expiresAt ? `\n· expires: ${formatDate(entry.expiresAt)}` : '';
    const source = entry.source ? `\n· source: ${entry.source.kind || 'user'}${entry.source.ref ? ` · ${entry.source.ref}` : ''}` : '';
    const footer = `\n· rev=${entry.revision || 1} · ${formatDate(entry.updatedAt)}`;
    let body = `${activeLabel} [${entry.kind}] **${entry.subject}**\n${entry.content}${tags}${exp}${source}${footer}`;
    if (revokedReason) body += `\n\n> ⛔ 已撤销: ${revokedReason}`;
    if (body.length > MAX_MESSAGE_LEN) {
      body = body.slice(0, MAX_MESSAGE_LEN - 20) + '\n…(已截断)';
    }
    return body;
  }

  // 频道-消息映射存到 data/memory/mirror.json (避免每次扫库)
  const MIRROR_INDEX = join(memoryStore.getStoreDir(), '..', 'mirror.json');

  function loadMirrorMap() {
    if (!existsSync(MIRROR_INDEX)) return {};
    try { return JSON.parse(readFileSync(MIRROR_INDEX, 'utf8')); } catch { return {}; }
  }
  function saveMirrorMap(m) {
    writeFileSync(MIRROR_INDEX, JSON.stringify(m, null, 2) + '\n', 'utf8');
  }
  function setMirror(memoryId, channelId, messageId) {
    const m = loadMirrorMap();
    m[memoryId] = { channelId, messageId, mirroredAt: new Date().toISOString() };
    saveMirrorMap(m);
  }
  function getMirror(memoryId) {
    return loadMirrorMap()[memoryId] || null;
  }
  function deleteMirror(memoryId) {
    const m = loadMirrorMap();
    delete m[memoryId];
    saveMirrorMap(m);
  }

  async function apply({ action, entry, reason = null } = {}) {
    if (!activeChannel) {
      log('[memory-mirror] 未配置 channelId,跳过');
      return { ok: false, reason: 'channelId 未配置' };
    }
    if (!discord) {
      log('[memory-mirror] 未配置 discord client,跳过');
      return { ok: false, reason: 'discord 未配置' };
    }
    if (!entry) return { ok: false, reason: 'entry 必填' };

    if (action === 'created') {
      const body = formatBody(entry);
      try {
        const sent = await discord.send(activeChannel, body);
        if (sent && sent.id) {
          setMirror(entry.id, activeChannel, sent.id);
          return { ok: true, action, messageId: sent.id };
        }
        return { ok: false, reason: 'send 返回空' };
      } catch (e) {
        log(`[memory-mirror] created 失败: ${e.message}`);
        return { ok: false, reason: e.message };
      }
    }

    if (action === 'updated') {
      let existing = getMirror(entry.id);
      if (!existing && entry.supersedes && entry.supersedes.length) {
        for (const oldId of entry.supersedes) {
          const m = getMirror(oldId);
          if (m) { existing = m; break; }
        }
      }
      if (!existing) return apply({ action: 'created', entry, reason });
      if (existing.memoryId && existing.memoryId !== entry.id) {
        deleteMirror(existing.memoryId);
      }
      const body = formatBody(entry);
      try {
        const channel = await discord.client.channels.fetch(existing.channelId);
        if (!channel) {
          log(`[memory-mirror] 找不到 channel ${existing.channelId}`);
          return { ok: false, reason: 'channel 找不到' };
        }
        const msg = await channel.messages.fetch(existing.messageId);
        if (!msg) {
          deleteMirror(entry.id);
          return apply({ action: 'created', entry, reason });
        }
        if (typeof msg.edit !== 'function') {
          deleteMirror(entry.id);
          return apply({ action: 'created', entry, reason });
        }
        await msg.edit(body);
        setMirror(entry.id, existing.channelId, msg.id);
        return { ok: true, action, messageId: msg.id };
      } catch (e) {
        log(`[memory-mirror] updated 失败: ${e.message}`);
        return { ok: false, reason: e.message };
      }
    }

    if (action === 'revoked') {
      let existing = getMirror(entry.id);
      if (!existing && entry.supersedes && entry.supersedes.length) {
        for (const oldId of entry.supersedes) {
          const m = getMirror(oldId);
          if (m) { existing = m; break; }
        }
      }
      if (!existing) return { ok: true, action, reason: 'no mirror,skip' };
      const body = formatBody(entry, { revokedReason: reason || 'no reason' });
      try {
        const channel = await discord.client.channels.fetch(existing.channelId);
        if (channel) {
          const msg = await channel.messages.fetch(existing.messageId).catch(() => null);
          if (msg) {
            if (typeof msg.react === 'function') {
              try { await msg.react('⛔'); } catch {}
            }
            if (typeof msg.edit === 'function') {
              try { await msg.edit(body); } catch (e) { log(`[memory-mirror] edit revoked 失败: ${e.message}`); }
            }
          }
        }
        deleteMirror(entry.id);
        return { ok: true, action, reason: 'mark revoked' };
      } catch (e) {
        log(`[memory-mirror] revoked 失败: ${e.message}`);
        return { ok: false, reason: e.message };
      }
    }

    return { ok: false, reason: `未知 action: ${action}` };
  }

  async function reconcile({ batch = 20 } = {}) {
    if (!activeChannel || !discord) return { ok: false, reason: '未配置' };
    const result = { created: 0, updated: 0, revoked: 0, kept: 0, errors: 0 };
    const { readdirSync, statSync } = await import('node:fs');
    const storeDir = memoryStore.getStoreDir();
    let dirs = [];
    try { dirs = readdirSync(storeDir); } catch { return result; }
    // 清理已不存在的 mirror
    const mirrorMap = loadMirrorMap();
    for (const [id, m] of Object.entries(mirrorMap)) {
      const metaPath = join(storeDir, id, 'meta.json');
      if (!existsSync(metaPath)) {
        deleteMirror(id);
        continue;
      }
      const meta = memoryStore.readMeta(id);
      if (meta && meta.status === 'revoked') {
        deleteMirror(id);
        continue;
      }
    }
    // 补发缺失的
    for (const id of dirs) {
      const meta = memoryStore.readMeta(id);
      if (!meta) continue;
      if (meta.status !== 'active') continue;
      if (new Date(meta.updatedAt) < new Date(Date.now() - 30 * 86400_000)) continue;
      const m = getMirror(id);
      if (m) {
        result.kept += 1;
      } else {
        const r = await apply({ action: 'created', entry: meta });
        if (r.ok) result.created += 1; else result.errors += 1;
        if (result.created % batch === 0) await new Promise((r) => setTimeout(r, 250));
      }
    }
    return result;
  }

  return { apply, reconcile, setChannel, formatBody, getMirror, setMirror, deleteMirror };
}

function formatDate(d) {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
