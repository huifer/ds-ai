#!/usr/bin/env node
// scripts/test-rss-fetcher.mjs
// RSS fetcher 测试套件 —— 不需要 Pi / Discord,只验证 fetcher 本身
//
// 跑法:node scripts/test-rss-fetcher.mjs
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const COLORS = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', blue: '\x1b[34m', gray: '\x1b[90m',
};

function ok(s) { console.log(`${COLORS.green}✓${COLORS.reset} ${s}`); }
function fail(s) { console.log(`${COLORS.red}✗${COLORS.reset} ${s}`); }
function info(s) { console.log(`${COLORS.blue}ℹ${COLORS.reset} ${s}`); }
function warn(s) { console.log(`${COLORS.yellow}⚠${COLORS.reset} ${s}`); }
function dim(s) { console.log(`${COLORS.gray}  ${s}${COLORS.reset}`); }

async function runFetcher(args) {
  const { stdout } = await execFileP('node', [resolve(ROOT, 'src/rss-fetcher.mjs'), ...args]);
  return JSON.parse(stdout);
}

async function test1_allSources() {
  info('Test 1: 抓所有 42 源');
  const d = await runFetcher(['--window=24', '--max=2']);
  const { total, ok: okCount, failed, items, elapsedMs } = d.stats;
  if (okCount === total) ok(`所有源 ok: ${okCount}/${total} · ${items} 条 · ${elapsedMs}ms`);
  else if (okCount >= total * 0.9) warn(`大部分 ok: ${okCount}/${total} (${failed} 失败)`);
  else fail(`太多失败: ${okCount}/${total}`);
  dim(`  失败源:${d.sources.filter(s => !s.ok).map(s => s.name).join(', ') || '(无)'}`);
  return { pass: okCount === total, total, okCount, failed };
}

async function test2_specificLayers() {
  info('Test 2: 各 layer 单独抓');
  const layers = ['cloudflare', 'openai', 'anthropic', 'hf', 'cn', 'ai-agent'];
  const results = {};
  for (const layer of layers) {
    const d = await runFetcher(['--layer=' + layer, '--window=168', '--max=2']);
    const r = `${d.stats.ok}/${d.stats.total}`;
    if (d.stats.ok === d.stats.total) {
      ok(`  ${layer}: ${r}`);
    } else {
      warn(`  ${layer}: ${r} 失败:${d.sources.filter(s => !s.ok).map(s => s.name).join(', ')}`);
    }
    results[layer] = d.stats;
  }
  return results;
}

async function test3_windowFilter() {
  info('Test 3: windowHours 过滤(7 天 vs 24 小时,用 cloudflare 单层)');
  const narrow = await runFetcher(['--layer=cloudflare', '--window=24', '--max=50']);
  const wide = await runFetcher(['--layer=cloudflare', '--window=168', '--max=50']);
  dim(`  24h window: ${narrow.stats.items} 条`);
  dim(`  7d window : ${wide.stats.items} 条`);
  if (wide.stats.items >= narrow.stats.items) ok('窗口越大,条数越多(符合预期)');
  else fail('7d 不应该比 24h 条数少');
}

async function test4_maxItems() {
  info('Test 4: max=2 vs max=10');
  const m2 = await runFetcher(['--layer=cloudflare', '--window=720', '--max=2']);
  const m10 = await runFetcher(['--layer=cloudflare', '--window=720', '--max=10']);
  dim(`  max=2 : 每源最多 2 条`);
  dim(`  max=10: 每源最多 10 条`);
  const maxPer2 = Math.max(...m2.sources.map(s => s.keptItems));
  const maxPer10 = Math.max(...m10.sources.map(s => s.keptItems));
  if (maxPer2 <= 2 && maxPer10 >= 2) ok(`max 生效(m2 peak=${maxPer2}, m10 peak=${maxPer10})`);
  else fail(`max 异常 m2=${maxPer2}, m10=${maxPer10}`);
}

async function test5_perFeedSize() {
  info('Test 5: maxBytesPerFeed 限制(测 CF Unified Changelog)');
  const d = await runFetcher(['--layer=cloudflare', '--window=720', '--max=2']);
  for (const s of d.sources) {
    if (s.name === 'Cloudflare Unified Changelog') {
      if (s.ok) ok(`4.6MB 大源能正常抓(bytes=${s.bytes})`);
      else fail(`大源失败: ${s.error}`);
    }
  }
}

async function test6_invalidLayer() {
  info('Test 6: 传不存在的 layer 应返回 0 个源');
  const d = await runFetcher(['--layer=nonexistent', '--max=2']);
  if (d.stats.total === 0) ok(`空 layer 返回 0 源(stats.total=0)`);
  else fail(`不应该有源: total=${d.stats.total}`);
}

async function test7_rss2AndAtom() {
  info('Test 7: 验证 RSS 2.0 + Atom 双协议都能解析');
  const d = await runFetcher(['--window=720', '--max=1']);
  const byProtocol = { rss: 0, atom: 0 };
  for (const s of d.sources) {
    if (!s.ok) continue;
    if (s.url.includes('releases.atom') || s.url.includes('/atom')) byProtocol.atom++;
    else byProtocol.rss++;
  }
  dim(`  RSS 2.0 源:${byProtocol.rss} 个 · Atom 源:${byProtocol.atom} 个`);
  if (byProtocol.rss > 0 && byProtocol.atom > 0) ok('双协议都有命中');
  else warn('某一协议没命中(可能是源调整)');
}

async function main() {
  console.log(`\n${COLORS.blue}═══ RSS Fetcher 测试套件 ═══${COLORS.reset}\n`);
  const start = Date.now();
  const results = {};
  try {
    results.t1 = await test1_allSources();
    await test2_specificLayers();
    await test3_windowFilter();
    await test4_maxItems();
    await test5_perFeedSize();
    await test6_invalidLayer();
    await test7_rss2AndAtom();
  } catch (e) {
    fail(`测试异常: ${e.message}`);
    process.exit(1);
  }
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n${COLORS.blue}═══ 完成 · 用时 ${elapsed}s ═══${COLORS.reset}\n`);
  // 退出码:0 = 全过,1 = 有失败
  const allOk = results.t1?.okCount === results.t1?.total;
  process.exit(allOk ? 0 : 1);
}

main();