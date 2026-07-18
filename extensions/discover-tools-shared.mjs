// extensions/discover-tools-shared.mjs
// 数据采集层(零 key)。AI 推理全部留在 Pi agent 自己的上下文里。

import { spawn } from 'node:child_process';

const HN_BASE = 'https://hn.algolia.com/api/v1';
const REDDIT_BASE = 'https://old.reddit.com';
const DEFAULT_TIMEOUT_MS = 20_000;

async function httpText(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'pi-discord-bridge/discover-tools' },
    });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status} ${r.statusText}`, url };
    return { ok: true, data: await r.text() };
  } catch (e) {
    return { ok: false, error: e?.name === 'AbortError' ? 'timeout' : (e?.message || String(e)), url };
  } finally {
    clearTimeout(timer);
  }
}

async function httpJson(url, opts) {
  const r = await httpText(url, opts);
  if (!r.ok) return r;
  try { return { ok: true, data: JSON.parse(r.data) }; }
  catch (e) { return { ok: false, error: `JSON parse failed: ${(e?.message || String(e)).slice(0, 100)}`, url }; }
}

function spawnStdin(cmd, args, stdinData, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ ok: false, code: -1, stdout, stderr: stderr + '\n[timeout]' });
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, code: -1, stdout, stderr: stderr + '\n' + (e.message || String(e)) }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ ok: code === 0, code, stdout, stderr }); });
    child.stdin.write(stdinData);
    child.stdin.end();
  });
}

export async function hnAlgoliaSearch(query, { minPoints = 50, hitsPerPage = 20 } = {}) {
  const url = `${HN_BASE}/search?query=${encodeURIComponent(query)}&tags=story&numericFilters=points%3E%3D${minPoints}&hitsPerPage=${hitsPerPage}`;
  const r = await httpJson(url);
  if (!r.ok) return { ok: false, source: 'hn', error: r.error };
  const hits = (r.data.hits || []).map(h => ({
    id: h.objectID,
    title: h.title || h.story_title || '(untitled)',
    points: h.points || 0,
    comments: h.num_comments || 0,
    engagement: (h.points || 0) + (h.num_comments || 0),
    created_at: (h.created_at || '').slice(0, 10),
    author: h.author || '?',
    hn_url: `https://news.ycombinator.com/item?id=${h.objectID}`,
    external_url: h.url || null,
  }));
  hits.sort((a, b) => b.engagement - a.engagement);
  return { ok: true, source: 'hn', count: hits.length, hits };
}

export async function hnGetItem(itemId, { maxDepth = 4, maxComments = 30 } = {}) {
  const url = `${HN_BASE}/items/${itemId}`;
  const r = await httpJson(url);
  if (!r.ok) return { ok: false, source: 'hn_item', error: r.error, id: itemId };
  function walk(node, depth = 0) {
    if (depth > maxDepth) return null;
    if (!node || node.type !== 'comment') return null;
    return {
      id: node.id, author: node.author || '[deleted]',
      text: stripHtml(node.text || ''),
      created_at: (node.created_at || '').slice(0, 10),
      depth, child_count: (node.children || []).length,
    };
  }
  function flatten(node, depth = 0, acc = []) {
    const me = walk(node, depth);
    if (me) acc.push(me);
    if (acc.length >= maxComments) return acc;
    for (const c of node.children || []) { flatten(c, depth + 1, acc); if (acc.length >= maxComments) break; }
    return acc;
  }
  const comments = flatten(r.data).slice(0, maxComments);
  return {
    ok: true, source: 'hn_item', id: itemId,
    title: r.data.title || '(untitled)',
    points: r.data.points || 0, comments: comments.length,
    hn_url: `https://news.ycombinator.com/item?id=${itemId}`,
    comments_data: comments,
  };
}

function stripHtml(s) {
  const fence = '\n```\n';
  return s
    .replace(/<p>/g, '\n').replace(/<\/p>/g, '')
    .replace(/&#x2F;/g, '/').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/<a [^>]*>/g, '').replace(/<\/a>/g, '')
    .replace(/<i>/g, '').replace(/<\/i>/g, '')
    .replace(/<pre>/g, fence).replace(/<\/pre>/g, fence)
    .replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

export async function githubRepoSearch(query, { limit = 15 } = {}) {
  const ghQuery = `query { search(query: "${query.replace(/"/g, '\\"')}", type: REPOSITORY, first: ${limit}) {
    nodes { ... on Repository {
      nameWithOwner description stargazerCount url pushedAt primaryLanguage { name }
    } }
  } }`;
  try {
    const payload = JSON.stringify({ query: ghQuery });
    const r = await spawnStdin('gh', ['api', 'graphql', '--input', '-'], payload);
    if (!r.ok) return { ok: false, source: 'github', error: `gh exit ${r.code}: ${(r.stderr || '').slice(0, 300)}` };
    const json = JSON.parse(r.stdout);
    if (json.errors) return { ok: false, source: 'github', error: json.errors.map(e => e.message).join('; ') };
    const repos = (json?.data?.search?.nodes || []).filter(Boolean);
    const enriched = repos.map(r => ({
      name: r.nameWithOwner,
      description: (r.description || '').slice(0, 140),
      stars: r.stargazerCount || 0,
      language: r.primaryLanguage?.name || null,
      pushed_at: (r.pushedAt || '').slice(0, 10),
      url: r.url,
    }));
    enriched.sort((a, b) => b.stars - a.stars);
    return { ok: true, source: 'github', count: enriched.length, repos: enriched };
  } catch (e) {
    return { ok: false, source: 'github', error: e?.message || String(e) };
  }
}

export async function redditRssTop(subreddit, { limit = 15, sort = 'top', time = 'month' } = {}) {
  const url = `${REDDIT_BASE}/r/${encodeURIComponent(subreddit)}/${sort}.rss?t=${time}&limit=${limit}`;
  const r = await httpText(url, { timeoutMs: 15_000 });
  if (!r.ok) return { ok: false, source: 'reddit', error: r.error, subreddit };
  const xml = r.data;
  const entries = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRe.exec(xml)) && entries.length < limit) {
    const body = m[1];
    const title = (body.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '?';
    const link = (body.match(/<link[^>]+href="([^"]+)"/) || [])[1] || '';
    const updated = (body.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1] || '';
    entries.push({
      title: decodeXmlEntities(title.trim()).slice(0, 200),
      url: link, updated: updated.slice(0, 10),
    });
  }
  return { ok: true, source: 'reddit', subreddit, count: entries.length, posts: entries };
}

function decodeXmlEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

export async function probeAvailableSources() {
  return Promise.all([
    hnAlgoliaSearch('test', { minPoints: 1, hitsPerPage: 1 }).then(r => ({ source: 'hn', ok: r.ok })),
    githubRepoSearch('test', { limit: 1 }).then(r => ({ source: 'github', ok: r.ok })),
    redditRssTop('ClaudeCode', { limit: 1 }).then(r => ({ source: 'reddit', ok: r.ok, error: r.ok ? null : r.error })),
  ]);
}
