#!/usr/bin/env node
// src/rss-fetcher.mjs
// RSS hub 抓取器 —— 被 Pi Agent 通过 bash 调用(不挂 Pi extension,够用就好)
//
// 用法:
//   node src/rss-fetcher.mjs                      # 抓所有 enabled 源,过滤 24h,输出 JSON 到 stdout
//   node src/rss-fetcher.mjs --layer=cloudflare   # 只抓某一层
//   node src/rss-fetcher.mjs --window=48          # 拉宽到 48h(用于补抓)
//   node src/rss-fetcher.mjs --max=5              # 每个源最多 5 条
//   node src/rss-fetcher.mjs --raw                # 输出原始 fetch 结果(不解析)
//   node src/rss-fetcher.mjs --timeout=8000       # 自定义超时(ms)
//
// 输出格式(JSON 到 stdout):
//   {
//     "generatedAt": "2026-07-18T03:00:00.000Z",
//     "windowHours": 24,
//     "stats": { "total": 42, "ok": 41, "failed": 1, "items": 187 },
//     "sources": [
//       { "name": "...", "url": "...", "layer": "cloudflare", "ok": true, "items": [...], "error": null },
//       ...
//     ]
//   }
//
// 故意不引入 fast-xml-parser 等依赖,纯 regex + Date.parse,够用就好。
// 不引 curl,直接用 Node 内置 fetch(Node 18+,实测 24.15)。
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CFG_PATH = resolve(ROOT, 'config', 'rss-sources.json');

// ---- args ----
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? 'true'];
    })
);

// ---- load config ----
function loadConfig() {
  if (!existsSync(CFG_PATH)) throw new Error(`配置文件不存在: ${CFG_PATH}`);
  return JSON.parse(readFileSync(CFG_PATH, 'utf8'));
}

// ---- HTTP fetch(Node 内置,带超时 + maxBytes + UA + 自动重试)----
async function fetchWithLimit(url, { timeoutMs = 15000, maxBytes = 2_000_000, userAgent = 'pi-discord-agents/2.0', retries = 1 } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const r = await fetchOnce(url, { timeoutMs, maxBytes, userAgent });
    if (r.ok) return r;
    lastErr = r.error;
    // 4xx(除 408/429)不重试,是源本身的错
    if (/^HTTP 4\d\d/.test(r.error) && !/408|429/.test(r.error)) return r;
    if (attempt < retries) {
      // 退避 500ms * (attempt+1)
      await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
    }
  }
  return { ok: false, error: lastErr };
}

async function fetchOnce(url, { timeoutMs, maxBytes, userAgent }) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        'Accept-Encoding': 'gzip, deflate',
      },
      redirect: 'follow',
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
    }
    // Content-Length 预检(如果服务端给了)
    const cl = parseInt(res.headers.get('content-length') || '0', 10);
    if (cl && cl > maxBytes) {
      return { ok: false, error: `Content-Length ${cl} > maxBytes ${maxBytes}` };
    }
    // 流式读,边读边累计字节,超限 abort
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch {}
        return { ok: false, error: `body > maxBytes ${maxBytes}` };
      }
      chunks.push(value);
    }
    // 解码(Node fetch 自动处理 gzip / br / deflate)
    const body = new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks));
    return { ok: true, body, bytes: total, contentType: res.headers.get('content-type') || '' };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'aborted' : (e.message || 'fetch failed').slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

// ---- RSS 2.0 解析 ----
function parseRss2(xml) {
  const items = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const get = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const rm = block.match(r);
      if (!rm) return '';
      return decodeEntities(rm[1].trim());
    };
    const link = get('link') || extractHref(block, 'link') || extractHref(block, 'guid');
    const pubDate = get('pubDate') || get('dc:date') || get('date');
    const title = get('title');
    const desc = get('description') || get('content:encoded') || get('summary');
    const author = get('author') || get('dc:creator');
    if (!title) continue;
    items.push({
      title: stripTags(title),
      url: link,
      publishedAt: pubDate,
      description: stripTags(desc).slice(0, 500),
      author: stripTags(author),
    });
  }
  return items;
}

// ---- Atom 解析 ----
function parseAtom(xml) {
  const items = [];
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = entryRe.exec(xml))) {
    const block = m[1];
    const get = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const rm = block.match(r);
      if (!rm) return '';
      return decodeEntities(rm[1].trim());
    };
    // Atom link 可能是 <link href="..."/> 或 <link>...</link>
    const linkMatch = block.match(/<link[^>]*?href=["']([^"']+)["'][^>]*\/?>/i);
    const link = linkMatch ? linkMatch[1] : get('link');
    const updated = get('updated') || get('published');
    const title = get('title');
    const summary = get('summary') || get('content');
    const author = get('name'); // <author><name>...</name></author>
    if (!title) continue;
    items.push({
      title: stripTags(title),
      url: link,
      publishedAt: updated,
      description: stripTags(summary).slice(0, 500),
      author: stripTags(author),
    });
  }
  return items;
}

function parseFeed(xml) {
  // 自动判别 RSS 2.0 / Atom
  if (/<feed[\s>]/i.test(xml)) return parseAtom(xml);
  if (/<rss[\s>]/i.test(xml)) return parseRss2(xml);
  // fallback: 都试一下
  return [...parseRss2(xml), ...parseAtom(xml)];
}

// ---- 工具:HTML 实体解码 + 去标签 ----
function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&amp;/g, '&');
}
function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
function extractHref(block, tag) {
  const r = new RegExp(`<${tag}[^>]*?href=["']([^"']+)["']`, 'i');
  const m = block.match(r);
  return m ? m[1] : '';
}

// ---- 时间过滤 ----
function withinWindow(iso, windowHours) {
  if (!iso) return true; // 没时间戳的保留(总比丢了强)
  const t = Date.parse(iso);
  if (isNaN(t)) return true;
  const cutoff = Date.now() - windowHours * 3600_000;
  return t >= cutoff;
}

// ---- 并发执行 ----
async function pMap(items, mapper, concurrency = 4) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await mapper(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

// ---- main ----
async function main() {
  const cfg = loadConfig();
  const fetchCfg = cfg.fetch || {};
  const concurrency = parseInt(args.concurrency || fetchCfg.concurrency || 4, 10);
  const timeoutMs = parseInt(args.timeout || fetchCfg.timeoutMs || 15000, 10);
  const maxBytes = parseInt(args.maxbytes || fetchCfg.maxBytesPerFeed || 2_000_000, 10);
  const windowHours = parseFloat(args.window || fetchCfg.windowHours || 24);
  const maxPerFeed = parseInt(args.max || fetchCfg.maxItemsPerFeed || 8, 10);
  const onlyLayer = args.layer;
  const rawOnly = args.raw === 'true';

  // 过滤源
  let sources = (cfg.sources || []).filter((s) => s.enabled !== false);
  if (onlyLayer) sources = sources.filter((s) => s.layer === onlyLayer);

  // 并发抓
  const t0 = Date.now();
  const results = await pMap(sources, async (s) => {
    const fetched = await fetchWithLimit(s.url, {
      timeoutMs,
      maxBytes: s.maxBytes || maxBytes,
      userAgent: fetchCfg.userAgent,
    });
    if (!fetched.ok) return { name: s.name, url: s.url, layer: s.layer, ok: false, error: fetched.error, items: [] };
    if (rawOnly) {
      return {
        name: s.name, url: s.url, layer: s.layer, ok: true,
        bytes: fetched.bytes, contentType: fetched.contentType,
        head: fetched.body.slice(0, 800),
      };
    }
    const allItems = parseFeed(fetched.body);
    const filtered = allItems
      .filter((it) => withinWindow(it.publishedAt, windowHours))
      .slice(0, maxPerFeed);
    return {
      name: s.name, url: s.url, layer: s.layer, ok: true,
      bytes: fetched.bytes, contentType: fetched.contentType,
      totalItems: allItems.length, keptItems: filtered.length,
      items: filtered,
    };
  }, concurrency);

  // 汇总
  const ok = results.filter((r) => r.ok).length;
  const failed = results.length - ok;
  const items = results.reduce((sum, r) => sum + (r.items?.length || 0), 0);
  const output = {
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - t0,
    windowHours,
    stats: { total: results.length, ok, failed, items },
    sources: results,
  };
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  process.stderr.write(`[rss-fetcher] ${results.length} sources · ${ok} ok · ${failed} failed · ${items} items · ${output.elapsedMs}ms\n`);
  process.exit(failed > 0 && ok === 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(2);
});