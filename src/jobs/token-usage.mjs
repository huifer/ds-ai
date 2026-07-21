// src/jobs/token-usage.mjs
// Token 用量任务 —— 每天北京时间 12:30 触发
//
// 数据源(双源,ccusage 优先):
//   ① ccusage daily/session/monthly --json --offline
//      - LiteLLM 真实价格(跟真实账单对得上)
//      - 跨所有 agent(claude / pi / opencode / gemini / codex / ...)
//   ② 本地 sessions/*.jsonl(Pi 子进程自己留的,带 session_name 分类)
//
// 输出:
//   1. Discord #📊 用量  推送 ECharts 渲染的 PNG 大图(6 子图)
//   2. data/token-usage/YYYY-MM-DD.{md,png,svg}  本地落盘
//   3. md 文字报告(数据表)
//
// 实现要点:
//   - ECharts 5 SSR 模式(renderer: 'svg' + ssr: true),纯 Node.js 跑,不挂 DOM
//   - @resvg/resvg-js 把 SVG → PNG(纯 Rust 绑定,跨平台,无需 native canvas)
//   - PNG 直接用 discord.js 的 files: [Buffer] 发,不需要写本地
//   - 6 子图用 ECharts 的 grid 多坐标系一次画完(2x3)
//   - 主入口 `!usage` 命令,ccusage 实时,不走 LLM
//   - 调度器: 12:30 北京时间(daemon 启动时注册)

import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import * as echarts from 'echarts';
import { Resvg } from '@resvg/resvg-js';

const ROOT = resolve(homedir(), 'pi-discord-agents');
const SESSION_DIR = join(ROOT, 'sessions');
const DATA_DIR = join(ROOT, 'data', 'token-usage');
const CCUSAGE_BIN = process.env.CCUSAGE_BIN || '/Users/zhangsan/.bun/bin/ccusage';

export const USAGE_JOB_ID = 'token-usage';
export const USAGE_JOB_SCHEDULE = { hour: 12, minute: 30, tzOffsetHours: 8 };

// ---- 时间工具 ----
export function todayInTz(tzOffsetHours = 8, now = new Date()) {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const tzMs = utcMs + tzOffsetHours * 3600_000;
  const d = new Date(tzMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function tzMsOf(now, tzOffsetHours) {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  return utcMs + tzOffsetHours * 3600_000;
}

function ymdKeyOfTs(ts, tzOffsetHours) {
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return null;
  return todayInTz(tzOffsetHours, new Date(t));
}

// ---- ccusage 调用 ----
function execCapture(cmd, args, { timeoutMs = 30_000 } = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (c) => (out += c.toString()));
    p.stderr.on('data', (c) => (err += c.toString()));
    const t = setTimeout(() => { p.kill('SIGKILL'); rej(new Error(`timeout ${cmd} ${args.join(' ')}`)); }, timeoutMs);
    p.on('close', (code) => { clearTimeout(t); res({ code, out, err }); });
    p.on('error', (e) => { clearTimeout(t); rej(e); });
  });
}

export async function callCcusage(subcmd, extraArgs = []) {
  if (!existsSync(CCUSAGE_BIN)) {
    return { ok: false, reason: `ccusage not found at ${CCUSAGE_BIN}`, data: null };
  }
  try {
    const args = [subcmd, '--json', '--offline', ...extraArgs];
    const r = await execCapture(CCUSAGE_BIN, args, { timeoutMs: 60_000 });
    if (r.code !== 0) {
      return { ok: false, reason: `ccusage ${subcmd} exited ${r.code}: ${r.err.slice(0, 200)}`, data: null };
    }
    return { ok: true, data: JSON.parse(r.out) };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e), data: null };
  }
}

// ---- 数据模型 ----
function zeroBucket() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: 0, msgs: 0 };
}

function addBucket(map, key, delta) {
  if (!map.has(key)) map.set(key, zeroBucket());
  const b = map.get(key);
  for (const k of ['input', 'output', 'cacheRead', 'cacheWrite', 'total', 'cost', 'msgs']) {
    b[k] += delta[k] || 0;
  }
}

function ingestCcusageDaily(daily) {
  const byDay = new Map();
  const byModel = new Map();
  const byAgent = new Map();
  const byDayAgent = new Map();
  const byDayModel = new Map();
  const totals = zeroBucket();
  for (const r of daily) {
    const d = r.period;
    if (!d) continue;
    const dayBucket = {
      input: r.inputTokens || 0,
      output: r.outputTokens || 0,
      cacheRead: r.cacheReadTokens || 0,
      cacheWrite: r.cacheCreationTokens || 0,
      total: r.totalTokens || 0,
      cost: r.totalCost || 0,
      msgs: 0,
    };
    byDay.set(d, dayBucket);
    for (const k of Object.keys(totals)) totals[k] += dayBucket[k] || 0;
    if (r.metadata?.agents?.length) {
      const perAgentCost = (r.totalCost || 0) / r.metadata.agents.length;
      for (const ag of r.metadata.agents) {
        addBucket(byAgent, ag, { ...dayBucket, cost: perAgentCost });
        addBucket(byDayAgent, `${d}|${ag}`, { ...dayBucket, cost: perAgentCost });
      }
    }
    for (const m of (r.modelBreakdowns || [])) {
      const mb = {
        input: m.inputTokens || 0, output: m.outputTokens || 0,
        cacheRead: m.cacheReadTokens || 0, cacheWrite: m.cacheCreationTokens || 0,
        total: (m.inputTokens || 0) + (m.outputTokens || 0) + (m.cacheReadTokens || 0) + (m.cacheCreationTokens || 0),
        cost: m.cost || 0, msgs: 0,
      };
      addBucket(byModel, m.modelName, mb);
      addBucket(byDayModel, `${d}|${m.modelName}`, mb);
    }
  }
  return { byDay, byModel, byAgent, byDayAgent, byDayModel, totals };
}

function ingestCcusageSessions(sessions) {
  const byAgent = new Map();
  const byDayAgent = new Map();
  const byDayType = new Map();
  const totals = zeroBucket();
  for (const s of sessions || []) {
    const ag = s.agent || 'unknown';
    const ts = s.metadata?.lastActivity;
    if (!ts) continue;
    const d = ymdKeyOfTs(ts, 8);
    if (!d) continue;
    const b = {
      input: s.inputTokens || 0, output: s.outputTokens || 0,
      cacheRead: s.cacheReadTokens || 0, cacheWrite: s.cacheCreationTokens || 0,
      total: s.totalTokens || 0, cost: s.totalCost || 0, msgs: 1,
    };
    addBucket(byAgent, ag, b);
    addBucket(byDayAgent, `${d}|${ag}`, b);
    for (const k of Object.keys(totals)) totals[k] += b[k] || 0;
    const proj = s.metadata?.projectPath || '';
    const type = inferSessionTypeFromProject(proj, ag);
    addBucket(byDayType, `${d}|${type}`, b);
  }
  return { byAgent, byDayAgent, byDayType, totals };
}

function inferSessionTypeFromProject(proj, agent) {
  if (agent === 'pi' && proj.includes('pi-discord-agents')) return 'pi-bridge';
  if (agent === 'pi') return 'pi-other';
  if (agent === 'claude') {
    if (proj.includes('pi-discord-agents')) return 'claude-bridge';
    if (proj.includes('photoshoot')) return 'claude-photoshoot';
    return 'claude-other';
  }
  if (agent === 'opencode') return 'opencode-any';
  if (agent === 'codex') return 'codex-any';
  if (agent === 'gemini') return 'gemini-any';
  if (agent) return `${agent}-any`;
  return 'unknown';
}

function ingestLocalPiSessions({ days, tzOffsetHours = 8, now = new Date() }) {
  const tzNowMs = tzMsOf(now, tzOffsetHours);
  const tzStart = new Date(tzNowMs);
  tzStart.setUTCDate(tzStart.getUTCDate() - (days - 1));
  tzStart.setUTCHours(0, 0, 0, 0);
  const startUtcMs = tzStart.getTime() - tzOffsetHours * 3600_000;
  const byDayType = new Map();
  const totals = zeroBucket();
  let files = 0, msgs = 0, skipped = 0;
  if (!existsSync(SESSION_DIR)) return { byDayType, totals, files, msgs, skipped };
  for (const file of readdirSync(SESSION_DIR).filter((f) => f.endsWith('.jsonl'))) {
    const fp = join(SESSION_DIR, file);
    let mtime = 0;
    try { mtime = statSync(fp).mtimeMs; } catch { continue; }
    if (mtime < startUtcMs - 86400000) { skipped++; continue; }
    files++;
    let content; try { content = readFileSync(fp, 'utf8'); } catch { continue; }
    let sessionName = basename(file, '.jsonl');
    for (const line of content.split('\n').filter(Boolean)) {
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      if (ev.type === 'session_info' && ev.name) { sessionName = ev.name; continue; }
      if (ev.type !== 'message') continue;
      const m = ev.message;
      if (m?.role !== 'assistant') continue;
      msgs++;
      const ts = ev.timestamp || m.timestamp;
      if (!ts) continue;
      const t = new Date(ts).getTime();
      if (Number.isNaN(t) || t < startUtcMs || t > tzNowMs) continue;
      const u = m.usage || {};
      const b = {
        input: u.input || 0, output: u.output || 0,
        cacheRead: u.cacheRead || 0, cacheWrite: u.cacheWrite || 0,
        total: u.totalTokens || 0, cost: (u.cost?.total) || 0, msgs: 1,
      };
      const dayKey = ts.slice(0, 10);
      const type = classifyPiSessionName(sessionName);
      addBucket(byDayType, `${dayKey}|${type}`, b);
      for (const k of Object.keys(totals)) totals[k] += b[k] || 0;
    }
  }
  return { byDayType, totals, files, msgs, skipped };
}

function classifyPiSessionName(name) {
  if (!name) return 'pi-unknown';
  if (name.startsWith('trigger-rss')) return 'pi-trigger-rss';
  if (name.startsWith('trigger-daily')) return 'pi-trigger-daily';
  if (name.startsWith('trigger-usage')) return 'pi-trigger-usage';
  if (name.startsWith('trigger-')) return 'pi-trigger-other';
  if (name.startsWith('discord-bridge')) return 'pi-discord-bridge';
  if (name.startsWith('smoke')) return 'pi-smoke';
  if (name.startsWith('cli-')) return 'pi-cli';
  return 'pi-other';
}

export async function aggregateUsageData({ days = 14, tzOffsetHours = 8, now = new Date() } = {}) {
  const since = (() => {
    const tzNow = tzMsOf(now, tzOffsetHours);
    const tzStart = new Date(tzNow);
    tzStart.setUTCDate(tzStart.getUTCDate() - (days - 1));
    return todayInTz(tzOffsetHours, tzStart).replace(/-/g, '');
  })();
  const [daily, session, monthly] = await Promise.all([
    callCcusage('daily', ['--since', since]),
    callCcusage('session', ['--since', since]),
    callCcusage('monthly', []),
  ]);
  const meta = {
    source: 'hybrid', days,
    ccusageDaily: daily.ok, ccusageSession: session.ok, ccusageMonthly: monthly.ok,
    ccusageErrors: [daily, session, monthly].filter((r) => !r.ok).map((r) => r.reason),
  };
  const main = daily.ok
    ? ingestCcusageDaily(daily.data.daily || [])
    : { byDay: new Map(), byModel: new Map(), byAgent: new Map(), byDayAgent: new Map(), byDayModel: new Map(), totals: zeroBucket() };
  if (session.ok) {
    const sIngest = ingestCcusageSessions(session.data.session || []);
    main.byAgent = sIngest.byAgent;
    main.byDayAgent = sIngest.byDayAgent;
    meta.agentFromSession = true;
  }
  const local = ingestLocalPiSessions({ days, tzOffsetHours, now });
  meta.localFiles = local.files; meta.localMsgs = local.msgs; meta.localSkipped = local.skipped;
  const byDayType = local.byDayType;
  const monthlyData = monthly.ok ? (monthly.data.monthly || []) : [];
  const currentMonth = todayInTz(tzOffsetHours, now).slice(0, 7);
  const currentMonthRow = monthlyData.find((r) => r.period === currentMonth) || null;
  return { ...main, byDayType, monthlyData, currentMonth, currentMonthRow, meta };
}

export function fillDateRange(byDay, days, tzOffsetHours = 8, now = new Date()) {
  const tzNowMs = tzMsOf(now, tzOffsetHours);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(tzNowMs - i * 86400000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    out.push(key);
    if (!byDay.has(key)) byDay.set(key, zeroBucket());
  }
  return out;
}

// ---- 格式化 ----
function fmtNum(n) {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toString();
}
function fmtCost(n) {
  if (!Number.isFinite(n) || n === 0) return '$0';
  if (n < 0.01) return '$' + n.toFixed(4);
  if (n < 1) return '$' + n.toFixed(3);
  return '$' + n.toFixed(2);
}
function fmtPct(n) { return (n * 100).toFixed(1) + '%'; }

// ---- ECharts 渲染 ----
// 6 子图 3x2 网格,统一画在一张大画布上
// 画布尺寸 1920x1080 (1080P),适合 Discord / 大屏查看
// 布局: 顶部 KPI 条 + 中部 3x2 图表 + 底部数据表
export function buildEchartsOption({ dateKey, agg, days, tzOffsetHours = 8, now = new Date() }) {
  const dayKeys = fillDateRange(agg.byDay, days, tzOffsetHours, now);
  const dayLabels = dayKeys.map((d) => d.slice(5)); // MM-DD
  const t = agg.totals;
  const daysInRange = dayKeys.filter((d) => {
    const b = agg.byDay.get(d) || zeroBucket();
    return b.total > 0 || b.cost > 0;
  }).length;
  const avgCostPerDay = daysInRange ? t.cost / daysInRange : 0;
  const avgTokPerDay = daysInRange ? t.total / daysInRange : 0;
  const today = dayKeys[dayKeys.length - 1];
  const yesterday = dayKeys[dayKeys.length - 2] || null;
  const todayB = agg.byDay.get(today) || zeroBucket();
  const yesterdayB = yesterday ? (agg.byDay.get(yesterday) || zeroBucket()) : zeroBucket();
  const costDelta = yesterdayB.cost > 0 ? (todayB.cost - yesterdayB.cost) / yesterdayB.cost : null;
  const tokDelta = yesterdayB.total > 0 ? (todayB.total - yesterdayB.total) / yesterdayB.total : null;

  const agents = [...agg.byAgent.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const models = [...agg.byModel.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const topAgent = agents[0];
  const topModel = models[0];
  const monthRow = agg.currentMonthRow;
  const monthLine = monthRow
    ? `本月(${agg.currentMonth})累计: **${fmtCost(monthRow.totalCost)}** · ${fmtNum(monthRow.totalTokens)} tokens · agents=${(monthRow.metadata?.agents || []).join('/')}`
    : '本月数据未拉到';
  const dayOfMonthOfCurrent = (() => {
    const t = todayInTz(tzOffsetHours, now).split('-');
    return parseInt(t[2], 10);
  })();
  const daysInMonthOfCurrent = (() => {
    const [y, m] = agg.currentMonth.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  })();

  // 主题
  const THEME = {
    bg: '#0d1117',
    panel: '#161b22',
    border: '#30363d',
    grid: '#21262d',
    text: '#c9d1d9',
    textDim: '#8b949e',
    colors: ['#58a6ff', '#3fb950', '#d29922', '#f85149', '#a371f7', '#ff7b72', '#79c0ff', '#56d4dd', '#f0883e', '#bc8cff'],
  };

  // 1920x1080 画布布局:
  //   顶部 0-100px 标题 + 副标题
  //   100-220 KPI 4 卡(每卡 460x100)
  //   220-800 3x2 图表(每图 620x270,横向间距 20,纵向 20)
  //   800-1080 表格 + 今日vs昨日 (留 280px)
  //
  // 3x2 = 6 子图:
  //   [1] 每日 Token 堆叠     | [2] 每日 cost 折线   | [3] 跨 agent 堆叠
  //   [4] model 成本 Top 10   | [5] 今日 vs 昨日      | [6] 本月累计

  const baseGrid = { left: 60, right: 30, top: 32, bottom: 36, containLabel: true };

  // 每日 token 堆叠系列
  const tokenStackSeries = [
    { name: 'input', color: '#58a6ff' },
    { name: 'output', color: '#f85149' },
    { name: 'cacheRead', color: '#3fb950' },
    { name: 'cacheWrite', color: '#d29922' },
  ].map((s) => ({
    name: s.name,
    type: 'bar',
    stack: 'tokens',
    data: dayKeys.map((d) => (agg.byDay.get(d) || zeroBucket())[s.name] || 0),
    itemStyle: { color: s.color },
    barMaxWidth: 36,
  }));

  // 每日 cost 折线
  const costData = dayKeys.map((d) => (agg.byDay.get(d) || zeroBucket()).cost);
  // 跨 agent 堆叠(取 top 6 agents)
  const topAgents = agents.slice(0, 6).map((e) => e[0]);
  const agentStackSeries = topAgents.map((a, i) => ({
    name: a,
    type: 'bar',
    stack: 'agents',
    data: dayKeys.map((d) => {
      const k = `${d}|${a}`;
      const b = agg.byDayAgent.get(k);
      return b ? b.cost : 0;
    }),
    itemStyle: { color: THEME.colors[i % THEME.colors.length] },
    barMaxWidth: 30,
  }));
  // 按 model Top 10 横向条形
  const topModels = models.slice(0, 10);
  const modelData = topModels.map((m) => ({
    name: String(m[0]).replace('[pi] ', '').slice(0, 22),
    value: m[1].cost,
  }));

  return {
    backgroundColor: THEME.bg,
    textStyle: { color: THEME.text, fontFamily: 'PingFang SC,Helvetica,Arial,sans-serif' },
    title: {
      text: `Token 用量 · ${dateKey}`,
      subtext: `窗口 ${days}d · 数据源 ${agg.meta.source} · ccusage=${agg.meta.ccusageDaily ? 'daily✓' : 'daily✗'}/${agg.meta.ccusageSession ? 'session✓' : 'session✗'}/${agg.meta.ccusageMonthly ? 'monthly✓' : 'monthly✗'} · LiteLLM 真实价`,
      left: 30, top: 16,
      textStyle: { color: THEME.text, fontSize: 26, fontWeight: 600 },
      subtextStyle: { color: THEME.textDim, fontSize: 13 },
    },
    // 1920x1080 画布 — 3x2 布局,顶部 4 KPI,中部 6 子图,底部表格
    grid: [
      { left: 30, right: 1290, top: 200, bottom: 800, width: 600, height: 280, containLabel: true },
      { left: 660, right: 660, top: 200, bottom: 800, width: 600, height: 280, containLabel: true },
      { left: 1290, right: 30, top: 200, bottom: 800, width: 600, height: 280, containLabel: true },
      { left: 30, right: 1290, top: 520, bottom: 480, width: 600, height: 280, containLabel: true },
      { left: 660, right: 660, top: 520, bottom: 480, width: 600, height: 280, containLabel: true },
      { left: 1290, right: 30, top: 520, bottom: 480, width: 600, height: 280, containLabel: true },
    ],
    legend: [
      { data: tokenStackSeries.map((s) => s.name), top: 178, left: 30, textStyle: { color: THEME.text, fontSize: 11 }, itemWidth: 14, itemHeight: 10 },
      { data: topAgents, top: 498, left: 30, textStyle: { color: THEME.text, fontSize: 11 }, itemWidth: 14, itemHeight: 10 },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1c2128',
      borderColor: THEME.border,
      textStyle: { color: THEME.text, fontSize: 12 },
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    xAxis: [
      { gridIndex: 0, type: 'category', data: dayLabels, axisLine: { lineStyle: { color: THEME.border } }, axisLabel: { color: THEME.textDim, fontSize: 10 }, axisTick: { show: false } },
      { gridIndex: 1, type: 'category', data: dayLabels, axisLine: { lineStyle: { color: THEME.border } }, axisLabel: { color: THEME.textDim, fontSize: 10 }, axisTick: { show: false } },
      { gridIndex: 2, type: 'category', data: dayLabels, axisLine: { lineStyle: { color: THEME.border } }, axisLabel: { color: THEME.textDim, fontSize: 10 }, axisTick: { show: false } },
      { gridIndex: 3, type: 'value', axisLine: { show: false }, axisLabel: { color: THEME.textDim, fontSize: 10, formatter: (v) => fmtCost(v) }, splitLine: { lineStyle: { color: THEME.grid } } },
    ],
    yAxis: [
      { gridIndex: 0, type: 'value', axisLine: { show: false }, axisLabel: { color: THEME.textDim, fontSize: 10, formatter: (v) => fmtNum(v) }, splitLine: { lineStyle: { color: THEME.grid } } },
      { gridIndex: 1, type: 'value', axisLine: { show: false }, axisLabel: { color: THEME.textDim, fontSize: 10, formatter: (v) => fmtCost(v) }, splitLine: { lineStyle: { color: THEME.grid } } },
      { gridIndex: 2, type: 'value', axisLine: { show: false }, axisLabel: { color: THEME.textDim, fontSize: 10, formatter: (v) => fmtCost(v) }, splitLine: { lineStyle: { color: THEME.grid } } },
      { gridIndex: 3, type: 'category', data: modelData.map((d) => d.name).reverse(), axisLine: { lineStyle: { color: THEME.border } }, axisLabel: { color: THEME.text, fontSize: 11 }, axisTick: { show: false } },
    ],
    series: [
      ...tokenStackSeries.map((s) => ({ ...s, xAxisIndex: 0, yAxisIndex: 0 })),
      {
        name: 'cost (USD)',
        type: 'line',
        xAxisIndex: 1, yAxisIndex: 1,
        data: costData,
        smooth: true,
        symbol: 'circle', symbolSize: 7,
        lineStyle: { color: '#a371f7', width: 2.5 },
        itemStyle: { color: '#a371f7' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(163,113,247,0.4)' }, { offset: 1, color: 'rgba(163,113,247,0.05)' }] } },
        markPoint: { data: [{ type: 'max', name: 'max' }, { type: 'last', name: '今日' }], symbolSize: 50, label: { color: THEME.text, fontSize: 10, formatter: (p) => fmtCost(p.value) } },
      },
      ...agentStackSeries.map((s) => ({ ...s, xAxisIndex: 2, yAxisIndex: 2 })),
      {
        name: 'cost',
        type: 'bar',
        xAxisIndex: 3, yAxisIndex: 3,
        data: modelData.map((d) => d.value).reverse(),
        itemStyle: {
          color: (params) => {
            const colors = THEME.colors;
            return colors[params.dataIndex % colors.length];
          },
          borderRadius: [0, 4, 4, 0],
        },
        label: { show: true, position: 'right', color: THEME.text, fontSize: 11, formatter: (p) => fmtCost(p.value) },
        barMaxWidth: 22,
      },
    ],
    graphic: (() => {
      const items = [
        { left: 30, top: 156, text: '[1] 每日 Token 总量堆叠' },
        { left: 660, top: 156, text: '[2] 每日成本折线 (USD · LiteLLM 真实价)' },
        { left: 1290, top: 156, text: '[3] 每日 cost 按 agent 堆叠' },
        { left: 30, top: 498, text: '[4] 按 model 成本 Top 10 (USD)' },
        { left: 660, top: 498, text: '[5] 今日 vs 昨日' },
        { left: 1290, top: 498, text: '[6] 本月累计 vs 日均' },
      ];
      const out = items.map((it) => ({ type: 'text', left: it.left, top: it.top, style: { text: it.text, fill: THEME.text, fontSize: 14, fontWeight: 600 } }));

      // 顶部 4 个 KPI 卡(实时摘要)
      const kpiW = 450, kpiH = 70, kpiGap = 20;
      const kpiY = 80;
      const kpis = [
        { label: '总 token', value: fmtNum(t.total), sub: `in ${fmtNum(t.input)} / out ${fmtNum(t.output)}` },
        { label: '总 cost (LiteLLM 真实价)', value: fmtCost(t.cost), sub: `日均 ${fmtCost(avgCostPerDay)}` },
        { label: '本月累计', value: monthRow ? fmtCost(monthRow.totalCost) : '—', sub: monthRow ? `${monthRow.period} · 预测全月 ${fmtCost((monthRow.totalCost / Math.max(1, dayOfMonthOfCurrent)) * daysInMonthOfCurrent)}` : 'ccusage monthly 未拉到' },
        { label: '今日 vs 昨日', value: yesterday ? `${fmtCost(todayB.cost)} vs ${fmtCost(yesterdayB.cost)}` : fmtCost(todayB.cost), sub: yesterday && costDelta !== null ? `cost ${costDelta >= 0 ? '+' : ''}${fmtPct(costDelta)} · tokens ${tokDelta !== null ? (tokDelta >= 0 ? '+' : '') + fmtPct(tokDelta) : '—'}` : '首日无对比' },
      ];
      kpis.forEach((k, i) => {
        const x = 30 + i * (kpiW + kpiGap);
        out.push(
          { type: 'rect', shape: { x, y: kpiY, width: kpiW, height: kpiH, r: 6 }, style: { fill: THEME.panel, stroke: THEME.border } },
          { type: 'text', style: { text: k.label, x: x + 16, y: kpiY + 18, fill: THEME.textDim, fontSize: 11 } },
          { type: 'text', style: { text: k.value, x: x + 16, y: kpiY + 40, fill: THEME.text, fontSize: 20, fontWeight: 600 } },
          { type: 'text', style: { text: k.sub, x: x + 16, y: kpiY + 60, fill: THEME.textDim, fontSize: 10 } },
        );
      });

      // 底部数据表(近 7 天 + 主力 agent/model)
      const tableY = 820;
      const recentDays = dayKeys.slice(-7);
      const colW = 1860 / 8;
      out.push(
        { type: 'rect', shape: { x: 30, y: tableY, width: 1860, height: 230, r: 6 }, style: { fill: THEME.panel, stroke: THEME.border } },
        { type: 'text', style: { text: '每日明细 + 主力 · Daily Breakdown', x: 46, y: tableY + 20, fill: THEME.text, fontSize: 14, fontWeight: 600 } },
      );
      // header
      const headers = ['日期', 'input', 'output', 'cacheR', 'cacheW', 'total', 'cost', 'agents'];
      headers.forEach((h, i) => {
        out.push({ type: 'text', style: { text: h, x: 46 + i * colW, y: tableY + 50, fill: THEME.textDim, fontSize: 10, fontWeight: 600 } });
      });
      // rows
      recentDays.forEach((d, ri) => {
        const b = agg.byDay.get(d) || zeroBucket();
        const agentsOnDay = [];
        for (const [k, v] of agg.byDayAgent.entries()) {
          if (k.startsWith(d + '|') && v.cost > 0) agentsOnDay.push(k.split('|')[1]);
        }
        const cells = [d, fmtNum(b.input), fmtNum(b.output), fmtNum(b.cacheRead), fmtNum(b.cacheWrite), fmtNum(b.total), fmtCost(b.cost), agentsOnDay.join(',') || '—'];
        cells.forEach((c, i) => {
          out.push({ type: 'text', style: { text: c, x: 46 + i * colW, y: tableY + 70 + ri * 18, fill: i === 5 || i === 6 ? THEME.text : THEME.textDim, fontSize: 10, fontWeight: i === 5 || i === 6 ? 600 : 400 } });
        });
      });
      // 主力 agent/model 行
      const summaryLines = [
        `主力 agent: ${topAgent ? `${topAgent[0]} (cost 占 ${fmtPct(topAgent[1].cost / Math.max(0.0001, t.cost))})` : '—'}    主力 model: ${topModel ? `${topModel[0]} (cost 占 ${fmtPct(topModel[1].cost / Math.max(0.0001, t.cost))})` : '—'}`,
        `agents: ${agents.map((a) => `${a[0]} ${fmtCost(a[1].cost)}`).join('  ·  ')}`,
        `models: ${models.slice(0, 8).map((m) => `${m[0].replace('[pi] ', '').slice(0, 14)} ${fmtCost(m[1].cost)}`).join('  ·  ')}`,
      ];
      summaryLines.forEach((line, i) => {
        out.push({ type: 'text', style: { text: line, x: 46, y: tableY + 70 + recentDays.length * 18 + 8 + i * 16, fill: THEME.textDim, fontSize: 10 } });
      });
      return out;
    })(),
  };
}

// 渲染 SVG + PNG
export function renderUsageSVG(option) {
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    width: 1920, height: 1080,
    ssr: true,
  });
  chart.setOption(option);
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
}

export function svgToPng(svg, width = 1920) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: '#0d1117',
    font: {
      // macOS 自带中文字体,保证中文渲染不方块
      fontFiles: [
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/STHeiti Medium.ttc',
        '/System/Library/Fonts/STHeiti Light.ttc',
        '/Library/Fonts/Arial Unicode.ttf',
      ],
      loadSystemFonts: true,
      defaultFontFamily: 'PingFang SC',
    },
  });
  const png = resvg.render().asPng();
  return png;
}

export function renderUsagePNG(option) {
  const svg = renderUsageSVG(option);
  const png = svgToPng(svg);
  return { png, svg };
}

// ---- HTML 报告 (1920x1080) ----
// 独立 HTML 页面,用 ECharts 客户端渲染 + CSS grid 布局 + KPI cards + 数据表
// 本地落盘,浏览器打开看(Discord 仍推 PNG)
export function buildUsageHTML({ dateKey, agg, days, tzOffsetHours = 8, now = new Date() }) {
  const dayKeys = fillDateRange(agg.byDay, days, tzOffsetHours, now);
  const dayLabels = dayKeys.map((d) => d.slice(5));
  const t = agg.totals;
  const daysInRange = dayKeys.filter((d) => {
    const b = agg.byDay.get(d) || zeroBucket();
    return b.total > 0 || b.cost > 0;
  }).length;
  const avgCostPerDay = daysInRange ? t.cost / daysInRange : 0;
  const avgTokPerDay = daysInRange ? t.total / daysInRange : 0;
  const today = dayKeys[dayKeys.length - 1];
  const yesterday = dayKeys[dayKeys.length - 2] || null;
  const todayB = agg.byDay.get(today) || zeroBucket();
  const yesterdayB = yesterday ? (agg.byDay.get(yesterday) || zeroBucket()) : zeroBucket();
  const costDelta = yesterdayB.cost > 0 ? (todayB.cost - yesterdayB.cost) / yesterdayB.cost : null;
  const tokDelta = yesterdayB.total > 0 ? (todayB.total - yesterdayB.total) / yesterdayB.total : null;
  const monthRow = agg.currentMonthRow;
  const monthLine = monthRow
    ? `本月(${agg.currentMonth})累计: **${fmtCost(monthRow.totalCost)}** · ${fmtNum(monthRow.totalTokens)} tokens · agents=${(monthRow.metadata?.agents || []).join('/')}`
    : '本月数据未拉到';
  const agents = [...agg.byAgent.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const models = [...agg.byModel.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const topAgent = agents[0];
  const topModel = models[0];
  const dayOfMonthOfCurrent = (() => { const t = todayInTz(tzOffsetHours, now).split('-'); return parseInt(t[2], 10); })();
  const daysInMonthOfCurrent = (() => { const [y, m] = agg.currentMonth.split('-').map(Number); return new Date(y, m, 0).getDate(); })();

  // 为客户端 ECharts 准备 6 个图表的 options
  const tokenStackSeries = ['input', 'output', 'cacheRead', 'cacheWrite'].map((k, i) => ({
    name: k, type: 'bar', stack: 'tokens',
    data: dayKeys.map((d) => (agg.byDay.get(d) || zeroBucket())[k] || 0),
    itemStyle: { color: ['#58a6ff', '#f85149', '#3fb950', '#d29922'][i] },
    barMaxWidth: 28,
  }));
  const costData = dayKeys.map((d) => (agg.byDay.get(d) || zeroBucket()).cost);
  const topAgents = agents.slice(0, 6).map((e) => e[0]);
  const agentStackSeries = topAgents.map((a, i) => ({
    name: a, type: 'bar', stack: 'agents',
    data: dayKeys.map((d) => { const k = `${d}|${a}`; const b = agg.byDayAgent.get(k); return b ? b.cost : 0; }),
    itemStyle: { color: SVG_COLORS_HEX[i % SVG_COLORS_HEX.length] },
    barMaxWidth: 24,
  }));
  const topModels = models.slice(0, 10);
  const modelNames = topModels.map((m) => String(m[0]).replace('[pi] ', '').slice(0, 22));
  const modelValues = topModels.map((m) => m[1].cost);

  // 4 个主图表(简化版,在 HTML 里用 ECharts 渲染)
  // fmtNum / fmtCost 必须在 HTML 里 inline(浏览器里没这些 Node.js helper)
  const fmtNumJS = `function fmtNum(v){if(!isFinite(v))return '0';if(Math.abs(v)>=1e9)return (v/1e9).toFixed(2)+'B';if(Math.abs(v)>=1e6)return (v/1e6).toFixed(2)+'M';if(Math.abs(v)>=1e3)return (v/1e3).toFixed(1)+'K';return Math.round(v)+''}`;
  const fmtCostJS = `function fmtCost(v){if(!isFinite(v)||v===0)return '$0';if(v<0.01)return '$'+v.toFixed(4);if(v<1)return '$'+v.toFixed(3);return '$'+v.toFixed(2)}`;
  const chartOpts = {
    chart1: {
      tooltip: { trigger: 'axis' },
      legend: { data: tokenStackSeries.map((s) => s.name), textStyle: { color: '#c9d1d9' }, top: 6 },
      grid: { left: 50, right: 16, top: 40, bottom: 24 },
      xAxis: { type: 'category', data: dayLabels, axisLabel: { color: '#8b949e', fontSize: 10 }, axisLine: { lineStyle: { color: '#30363d' } } },
      yAxis: { type: 'value', axisLabel: { color: '#8b949e', fontSize: 10, formatter: 'fmtNum' }, splitLine: { lineStyle: { color: '#21262d' } }, axisLine: { show: false } },
      series: tokenStackSeries,
    },
    chart2: {
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 16, top: 16, bottom: 24 },
      xAxis: { type: 'category', data: dayLabels, axisLabel: { color: '#8b949e', fontSize: 10 }, axisLine: { lineStyle: { color: '#30363d' } } },
      yAxis: { type: 'value', axisLabel: { color: '#8b949e', fontSize: 10, formatter: 'fmtCost' }, splitLine: { lineStyle: { color: '#21262d' } }, axisLine: { show: false } },
      series: [{
        name: 'cost (USD)', type: 'line', data: costData, smooth: true, symbol: 'circle', symbolSize: 6,
        lineStyle: { color: '#a371f7', width: 2.5 }, itemStyle: { color: '#a371f7' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(163,113,247,0.4)' }, { offset: 1, color: 'rgba(163,113,247,0.05)' }] } },
        markPoint: { data: [{ type: 'max' }, { type: 'last' }], symbolSize: 36, label: { color: '#c9d1d9', fontSize: 9, formatter: 'fmtCost' } },
      }],
    },
    chart3: {
      tooltip: { trigger: 'axis' },
      legend: { data: topAgents, textStyle: { color: '#c9d1d9', fontSize: 9 }, top: 4 },
      grid: { left: 50, right: 16, top: 32, bottom: 24 },
      xAxis: { type: 'category', data: dayLabels, axisLabel: { color: '#8b949e', fontSize: 10 }, axisLine: { lineStyle: { color: '#30363d' } } },
      yAxis: { type: 'value', axisLabel: { color: '#8b949e', fontSize: 10, formatter: 'fmtCost' }, splitLine: { lineStyle: { color: '#21262d' } }, axisLine: { show: false } },
      series: agentStackSeries,
    },
    chart4: {
      tooltip: { trigger: 'axis' },
      grid: { left: 110, right: 80, top: 8, bottom: 8 },
      xAxis: { type: 'value', axisLabel: { color: '#8b949e', fontSize: 10, formatter: 'fmtCost' }, splitLine: { lineStyle: { color: '#21262d' } }, axisLine: { show: false } },
      yAxis: { type: 'category', data: modelNames.slice().reverse(), axisLabel: { color: '#c9d1d9', fontSize: 10 }, axisLine: { lineStyle: { color: '#30363d' } }, axisTick: { show: false } },
      // HTML 端 fmtNum/fmtCost 已通过 wireFormatter 注入,但 series.label 用 string 'fmtCost' 不被解析
      // 直接用真实 function 形式(HTML 端会通过 wireFormatter 替换为调用 window.fmtCost 的 lambda)
      series: [{
        name: 'cost', type: 'bar',
        data: modelValues.slice().reverse(),
        itemStyle: { color: (p) => SVG_COLORS_HEX[p.dataIndex % SVG_COLORS_HEX.length], borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', color: '#c9d1d9', fontSize: 10, formatter: 'fmtCost' },
        barMaxWidth: 18,
      }],
    },
  };
  // HTML 端 ECharts 5 axisLabel.formatter 支持 'fmtCost' 字符串查 window;
  // 但 series.label.formatter 不支持 — 需要在 HTML 端用 function 显式 wire
  // 已在 buildUsageHTML 的 <script> 里强制替换 s.label.formatter 为 (p) => window.fmtCost(p.value)

  // 构造每日明细表格行
  const tableRows = dayKeys.map((d) => {
    const b = agg.byDay.get(d) || zeroBucket();
    const agentsOnDay = [];
    for (const [k, v] of agg.byDayAgent.entries()) {
      if (k.startsWith(d + '|') && v.cost > 0) agentsOnDay.push(k.split('|')[1]);
    }
    const modelsOnDay = [];
    for (const [k, v] of agg.byDayModel.entries()) {
      if (k.startsWith(d + '|') && v.cost > 0.0001) modelsOnDay.push(k.split('|')[1].replace('[pi] ', ''));
    }
    return { d, b, agents: agentsOnDay.join(', ') || '—', models: modelsOnDay.length };
  });

  // 配色(只在前端 ECharts 里用,和上面 color 一致)
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Token 用量 · ${dateKey}</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<style>
  :root {
    --bg: #0d1117; --panel: #161b22; --border: #30363d; --grid: #21262d;
    --text: #c9d1d9; --text-dim: #8b949e; --accent: #58a6ff;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif; }
  body { padding: 24px; min-width: 1920px; }
  .container { width: 1920px; margin: 0 auto; }
  .header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 18px; }
  .header h1 { font-size: 26px; font-weight: 600; }
  .header .meta { color: var(--text-dim); font-size: 13px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 18px; }
  .kpi-card { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; }
  .kpi-label { color: var(--text-dim); font-size: 12px; margin-bottom: 6px; }
  .kpi-value { font-size: 26px; font-weight: 600; color: var(--text); line-height: 1.1; }
  .kpi-sub { color: var(--text-dim); font-size: 11px; margin-top: 4px; }
  .kpi-delta-up { color: #f85149; font-size: 11px; }
  .kpi-delta-down { color: #3fb950; font-size: 11px; }
  .chart-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-bottom: 18px; }
  .chart-card { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px 8px; }
  .chart-title { color: var(--text); font-size: 14px; font-weight: 600; margin-bottom: 8px; }
  .chart { width: 100%; height: 280px; }
  .table-card { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; }
  .table-title { color: var(--text); font-size: 14px; font-weight: 600; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--border); font-size: 12px; }
  th { color: var(--text-dim); font-weight: 500; text-transform: uppercase; font-size: 11px; }
  td { color: var(--text-dim); }
  td.num { font-variant-numeric: tabular-nums; color: var(--text); }
  td.cost { color: var(--text); font-weight: 600; }
  tr:hover td { color: var(--text); }
  .footer { text-align: center; color: var(--text-dim); font-size: 11px; margin-top: 24px; }
  .pill { display: inline-block; padding: 1px 6px; border-radius: 4px; background: #21262d; color: var(--text-dim); font-size: 10px; margin-right: 4px; }
  .summary-line { color: var(--text-dim); font-size: 12px; margin: 4px 0; }
  .summary-line strong { color: var(--text); font-weight: 500; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Token 用量 · ${dateKey}</h1>
    <div class="meta">窗口 ${days}d · 数据源 ${escapeHtml(agg.meta.source)} · ccusage=${agg.meta.ccusageDaily ? '<span class="pill">daily✓</span>' : '<span class="pill">daily✗</span>'}${agg.meta.ccusageSession ? '<span class="pill">session✓</span>' : '<span class="pill">session✗</span>'}${agg.meta.ccusageMonthly ? '<span class="pill">monthly✓</span>' : '<span class="pill">monthly✗</span>'} · LiteLLM 真实价</div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">总 token</div>
      <div class="kpi-value">${fmtNum(t.total)}</div>
      <div class="kpi-sub">input ${fmtNum(t.input)} / output ${fmtNum(t.output)} / cacheR ${fmtNum(t.cacheRead)} / cacheW ${fmtNum(t.cacheWrite)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">总 cost (LiteLLM 真实价)</div>
      <div class="kpi-value">${fmtCost(t.cost)}</div>
      <div class="kpi-sub">日均 ${fmtCost(avgCostPerDay)} / ${fmtNum(avgTokPerDay)} tokens</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">本月累计 (${escapeHtml(agg.currentMonth)})</div>
      <div class="kpi-value">${monthRow ? fmtCost(monthRow.totalCost) : '—'}</div>
      <div class="kpi-sub">${monthRow ? '第 ' + dayOfMonthOfCurrent + '/' + daysInMonthOfCurrent + ' 天 · 预测全月 ' + fmtCost((monthRow.totalCost / Math.max(1, dayOfMonthOfCurrent)) * daysInMonthOfCurrent) : 'ccusage monthly 未拉到'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">今日 (${today}) vs 昨日 (${yesterday || '—'})</div>
      <div class="kpi-value">${yesterday ? (fmtCost(todayB.cost) + '<br><span style="font-size:18px;color:var(--text-dim)">vs ' + fmtCost(yesterdayB.cost) + '</span>') : fmtCost(todayB.cost)}</div>
      <div class="kpi-sub">${yesterday && costDelta !== null ? ('cost <span class="' + (costDelta >= 0 ? 'kpi-delta-up' : 'kpi-delta-down') + '">' + (costDelta >= 0 ? '+' : '') + fmtPct(costDelta) + '</span> · tokens <span class="' + (tokDelta >= 0 ? 'kpi-delta-up' : 'kpi-delta-down') + '">' + (tokDelta !== null ? (tokDelta >= 0 ? '+' : '') + fmtPct(tokDelta) : '—') + '</span>') : '首日无对比'}</div>
    </div>
  </div>

  <div class="chart-grid">
    <div class="chart-card">
      <div class="chart-title">[1] 每日 Token 总量堆叠</div>
      <div id="chart1" class="chart"></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">[2] 每日成本折线 (USD · LiteLLM 真实价)</div>
      <div id="chart2" class="chart"></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">[3] 每日 cost 按 agent 堆叠</div>
      <div id="chart3" class="chart"></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">[4] 按 model 成本 Top 10 (USD)</div>
      <div id="chart4" class="chart"></div>
    </div>
  </div>

  <div class="table-card">
    <div class="table-title">每日明细 · Daily Breakdown (${dayKeys.length} 天)</div>
    <table>
      <thead><tr>
        <th>日期</th><th>input</th><th>output</th><th>cacheR</th><th>cacheW</th>
        <th>total</th><th>cost</th><th>agents</th><th>models</th>
      </tr></thead>
      <tbody>
        ${tableRows.map((r) => '<tr>'
          + '<td>' + r.d + '</td>'
          + '<td class="num">' + fmtNum(r.b.input) + '</td>'
          + '<td class="num">' + fmtNum(r.b.output) + '</td>'
          + '<td class="num">' + fmtNum(r.b.cacheRead) + '</td>'
          + '<td class="num">' + fmtNum(r.b.cacheWrite) + '</td>'
          + '<td class="num"><strong>' + fmtNum(r.b.total) + '</strong></td>'
          + '<td class="cost">' + fmtCost(r.b.cost) + '</td>'
          + '<td>' + escapeHtml(r.agents) + '</td>'
          + '<td>' + r.models + '</td>'
          + '</tr>').join('\n        ')}
      </tbody>
    </table>
    <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:24px;">
      <div>
        <div class="summary-line"><strong>主力 agent:</strong> ${topAgent ? (escapeHtml(topAgent[0]) + ' (cost 占 ' + fmtPct(topAgent[1].cost / Math.max(0.0001, t.cost)) + ')') : '—'}</div>
        <div class="summary-line"><strong>主力 model:</strong> ${topModel ? (escapeHtml(topModel[0]) + ' (cost 占 ' + fmtPct(topModel[1].cost / Math.max(0.0001, t.cost)) + ')') : '—'}</div>
      </div>
      <div>
        <div class="summary-line"><strong>所有 agent:</strong> ${agents.map((a) => escapeHtml(a[0]) + ' ' + fmtCost(a[1].cost)).join(' · ')}</div>
        <div class="summary-line"><strong>Top 8 models:</strong> ${models.slice(0, 8).map((m) => escapeHtml(m[0].replace('[pi] ', '').slice(0, 14)) + ' ' + fmtCost(m[1].cost)).join(' · ')}</div>
      </div>
    </div>
  </div>

  <div class="footer">自动生成 · data/token-usage/${dateKey}.html · ccusage: ${escapeHtml(CCUSAGE_BIN)}</div>
</div>

<script>
  window.fmtNum = (function () { var fn = function (v) { if (!isFinite(v)) return '0'; if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + 'B'; if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M'; if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return Math.round(v) + ''; }; return fn; })();
  window.fmtCost = (function () { var fn = function (v) { if (!isFinite(v) || v === 0) return '$0'; if (v < 0.01) return '$' + v.toFixed(4); if (v < 1) return '$' + v.toFixed(3); return '$' + v.toFixed(2); }; return fn; })();
  const opts = ${JSON.stringify(chartOpts)};
  // 替换字符串 formatter 为实际函数引用(更稳,递归遍历整个 option)
  const wireFormatter = (o) => {
    if (!o || typeof o !== 'object') return o;
    if (Array.isArray(o)) { o.forEach(wireFormatter); return o; }
    if (o.formatter === 'fmtNum') o.formatter = function (v) { return window.fmtNum(v); };
    else if (o.formatter === 'fmtCost') o.formatter = function (v) { return window.fmtCost(v); };
    // series label formatter:传 p 对象 { value, name, ... }
    else if (o.formatter === 'fmtCostP') o.formatter = function (p) { return window.fmtCost(p && p.value); };
    for (const k of Object.keys(o)) wireFormatter(o[k]);
    return o;
  };
  ['chart1', 'chart2', 'chart3', 'chart4'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const chart = echarts.init(el, 'dark', { renderer: 'canvas' });
    wireFormatter(opts[id]);
    // ECharts 5 series.label.formatter 字符串不会查 window,强制用 function
    if (opts[id].series) {
      opts[id].series.forEach(function (s) {
        if (s.label && typeof s.label.formatter === 'string' && s.label.formatter === 'fmtCost') {
          s.label.formatter = function (p) { return window.fmtCost(p && p.value); };
        }
        if (s.label && typeof s.label.formatter === 'string' && s.label.formatter === 'fmtNum') {
          s.label.formatter = function (p) { return window.fmtNum(p && p.value); };
        }
      });
    }
    chart.setOption(opts[id]);
    window.addEventListener('resize', () => chart.resize());
  });
</script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' })[c]);
}

const SVG_COLORS_HEX = ['#58a6ff', '#3fb950', '#d29922', '#f85149', '#a371f7', '#ff7b72', '#79c0ff', '#56d4dd', '#f0883e', '#bc8cff'];

// ---- md 报告(轻量,辅助 Discord 文字部分)----
export function buildReport({ dateKey, agg, days = 14, tzOffsetHours = 8, now = new Date() }) {
  const dayKeys = fillDateRange(agg.byDay, days, tzOffsetHours, now);
  const t = agg.totals;
  const daysInRange = dayKeys.filter((d) => {
    const b = agg.byDay.get(d) || zeroBucket();
    return b.total > 0 || b.cost > 0;
  }).length;
  const avgCostPerDay = daysInRange ? t.cost / daysInRange : 0;
  const avgTokPerDay = daysInRange ? t.total / daysInRange : 0;
  const today = dayKeys[dayKeys.length - 1];
  const yesterday = dayKeys[dayKeys.length - 2] || null;
  const todayB = agg.byDay.get(today) || zeroBucket();
  const yesterdayB = yesterday ? (agg.byDay.get(yesterday) || zeroBucket()) : zeroBucket();
  const costDelta = yesterdayB.cost > 0 ? (todayB.cost - yesterdayB.cost) / yesterdayB.cost : null;
  const tokDelta = yesterdayB.total > 0 ? (todayB.total - yesterdayB.total) / yesterdayB.total : null;
  const monthRow = agg.currentMonthRow;
  const monthLine = monthRow
    ? `本月(${agg.currentMonth})累计 **${fmtCost(monthRow.totalCost)}** · ${fmtNum(monthRow.totalTokens)} tokens · agents=${(monthRow.metadata?.agents || []).join('/')}`
    : '本月数据未拉到';
  const agents = [...agg.byAgent.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const models = [...agg.byModel.entries()].sort((a, b) => b[1].cost - a[1].cost);

  const lines = [];
  lines.push(`# 📊 Token 用量 · ${dateKey}`);
  lines.push('');
  lines.push(`> 窗口: **${dayKeys[0]} → ${dayKeys[dayKeys.length - 1]} (${days}d)** · 北京时间`);
  lines.push(`> 数据源: ${agg.meta.source} · ccusage 真实 LiteLLM 价格`);
  if (!agg.meta.ccusageDaily) lines.push(`> ⚠️ ccusage daily 失败: ${agg.meta.ccusageErrors.join(' | ')}`);
  lines.push('');
  lines.push(`## 摘要`);
  lines.push('');
  lines.push(`- **总 token**: ${fmtNum(t.total)}(input ${fmtNum(t.input)} / output ${fmtNum(t.output)} / cacheR ${fmtNum(t.cacheRead)} / cacheW ${fmtNum(t.cacheWrite)})`);
  lines.push(`- **总 cost** (LiteLLM 真实价): **${fmtCost(t.cost)}** · 日均 ${fmtCost(avgCostPerDay)} / ${fmtNum(avgTokPerDay)} tokens`);
  lines.push(`- **本月**: ${monthLine}`);
  if (yesterday) {
    lines.push(`- **今日(${today}) vs 昨日(${yesterday})**:`);
    lines.push(`  - cost: ${fmtCost(todayB.cost)} vs ${fmtCost(yesterdayB.cost)} ${costDelta !== null ? `(${costDelta >= 0 ? '+' : ''}${fmtPct(costDelta)})` : ''}`);
    lines.push(`  - tokens: ${fmtNum(todayB.total)} vs ${fmtNum(yesterdayB.total)} ${tokDelta !== null ? `(${tokDelta >= 0 ? '+' : ''}${fmtPct(tokDelta)})` : ''}`);
  }
  if (agents[0]) lines.push(`- **主力 agent**: ${agents[0][0]}(cost 占 ${fmtPct(agents[0][1].cost / Math.max(0.0001, t.cost))})`);
  if (models[0]) lines.push(`- **主力 model**: ${models[0][0]}(cost 占 ${fmtPct(models[0][1].cost / Math.max(0.0001, t.cost))})`);
  lines.push('');
  lines.push(`## 按 agent(累计 · LiteLLM 真实价)`);
  lines.push('');
  lines.push(`| Agent | total | cost | msgs |`);
  lines.push(`|---|---|---|---|`);
  for (const [a, b] of agents) lines.push(`| ${a} | ${fmtNum(b.total)} | **${fmtCost(b.cost)}** | ${b.msgs} |`);
  lines.push('');
  lines.push(`## 按 model(Top 15)`);
  lines.push('');
  lines.push(`| Model | total | cost | msgs |`);
  lines.push(`|---|---|---|---|`);
  for (const [m, b] of models.slice(0, 15)) lines.push(`| ${m} | ${fmtNum(b.total)} | **${fmtCost(b.cost)}** | ${b.msgs} |`);
  lines.push('');
  lines.push('---');
  lines.push(`_自动生成 · data/token-usage/${dateKey}.{md,png,svg} · ccusage: ${CCUSAGE_BIN}_`);
  return { md: lines.join('\n') };
}

// ---- 主入口命令:!usage ----
export async function handleUsageCommand({ args, discord, log, cfg }) {
  const sub = (args || '').trim().toLowerCase();
  const channelId = cfg?.channels?.usage || cfg?.channels?.trend || cfg?.channels?.system;
  let days = 14;
  if (/^\d+$/.test(sub)) days = parseInt(sub, 10);
  if (days > 90) days = 90;
  if (days < 1) days = 1;
  const tz = 8;
  const dateKey = todayInTz(tz);
  log?.(`[usage-cmd] sub=${sub || 'default'} days=${days} channel=${channelId}`);

  const special = ['today', 'month', 'model', 'agent', 'cost'];
  if (special.includes(sub)) {
    return runUsageSubcmd({ sub, channelId, dateKey, discord, log, cfg, days, tz });
  }

  const agg = await aggregateUsageData({ days, tzOffsetHours: tz });
  if (!agg.meta.ccusageDaily) {
    return { reply: `⚠️ ccusage 拉不到数据: ${agg.meta.ccusageErrors.join('; ')}\n请确认 \`${CCUSAGE_BIN}\` 存在` };
  }

  // 渲染 PNG + HTML
  const option = buildEchartsOption({ dateKey, agg, days, tzOffsetHours: tz });
  const { png, svg } = renderUsagePNG(option);
  const html = buildUsageHTML({ dateKey, agg, days, tzOffsetHours: tz });
  const { md } = buildReport({ dateKey, agg, days, tzOffsetHours: tz });

  // 落本地
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, `${dateKey}.svg`), svg, 'utf8');
  writeFileSync(join(DATA_DIR, `${dateKey}.png`), png);
  writeFileSync(join(DATA_DIR, `${dateKey}.html`), html, 'utf8');
  writeFileSync(join(DATA_DIR, `${dateKey}.md`), md, 'utf8');

  if (channelId && discord) {
    try {
      // 推 PNG(主图) + 文字 md(辅助)
      await sendPngAndText(discord, channelId, png, `📊 **Token 用量 · ${dateKey}** · ${days}d\n\n${md}`);
      log?.(`[usage-cmd] ✅ 推 #${channelId} (png=${png.length}B)`);
    } catch (e) {
      log?.(`[usage-cmd] 推失败: ${e?.message || e}`);
    }
  }
  const t = agg.totals;
  return {
    reply: `📊 Token 用量(${days}d)已推到 ${channelId ? `<#${channelId}>` : '#🛠 系统'}。\n总 cost: **${fmtCost(t.cost)}** · ${fmtNum(t.total)} tokens · 主力 agent: ${[...agg.byAgent.entries()].sort((a, b) => b[1].cost - a[1].cost)[0]?.[0] || '—'}`,
  };
}

async function runUsageSubcmd({ sub, channelId, dateKey, discord, log, cfg, days, tz }) {
  const [daily, session, monthly] = await Promise.all([
    callCcusage('daily', []), callCcusage('session', []), callCcusage('monthly', []),
  ]);
  if (!daily.ok) return { reply: `⚠️ ccusage daily 失败: ${daily.reason}` };
  const lines = [];
  const dArr = daily.data.daily || [];
  const todayRow = dArr.find((r) => r.period === dateKey) || null;
  if (sub === 'today') {
    const yesterdayKey = (() => { const d = new Date(tzMsOf(new Date(), tz) - 86400000); return todayInTz(tz, d); })();
    const yesterdayRow = dArr.find((r) => r.period === yesterdayKey) || null;
    const todayB = todayRow || { totalCost: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, metadata: { agents: [] } };
    const yesterdayB = yesterdayRow || { totalCost: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, metadata: { agents: [] } };
    const dCost = yesterdayB.totalCost > 0 ? (todayB.totalCost - yesterdayB.totalCost) / yesterdayB.totalCost : null;
    const dTok = yesterdayB.totalTokens > 0 ? (todayB.totalTokens - yesterdayB.totalTokens) / yesterdayB.totalTokens : null;
    lines.push(`## 📊 今日 vs 昨日`);
    lines.push('');
    lines.push(`| 指标 | 今日 (${dateKey}) | 昨日 (${yesterdayKey}) | Δ |`);
    lines.push(`|---|---|---|---|`);
    lines.push(`| **Cost** | **${fmtCost(todayB.totalCost)}** | ${fmtCost(yesterdayB.totalCost)} | ${dCost === null ? '—' : (dCost >= 0 ? '+' : '') + fmtPct(dCost)} |`);
    lines.push(`| Tokens | ${fmtNum(todayB.totalTokens)} | ${fmtNum(yesterdayB.totalTokens)} | ${dTok === null ? '—' : (dTok >= 0 ? '+' : '') + fmtPct(dTok)} |`);
    lines.push(`| Input | ${fmtNum(todayB.inputTokens)} | ${fmtNum(yesterdayB.inputTokens)} | — |`);
    lines.push(`| Output | ${fmtNum(todayB.outputTokens)} | ${fmtNum(yesterdayB.outputTokens)} | — |`);
    lines.push(`| Cache Read | ${fmtNum(todayB.cacheReadTokens)} | ${fmtNum(yesterdayB.cacheReadTokens)} | — |`);
    lines.push(`| Agents | ${(todayB.metadata?.agents || []).join(', ') || '—'} | ${(yesterdayB.metadata?.agents || []).join(', ') || '—'} | — |`);
  } else if (sub === 'month') {
    if (!monthly.ok) return { reply: `⚠️ ccusage monthly 失败: ${monthly.reason}` };
    const mArr = monthly.data.monthly || [];
    lines.push(`## 📊 本月累计 (${dateKey.slice(0, 7)})`);
    lines.push('');
    lines.push(`| 月份 | cost | tokens | agents | models |`);
    lines.push(`|---|---|---|---|---|`);
    for (const m of mArr) lines.push(`| ${m.period} | **${fmtCost(m.totalCost)}** | ${fmtNum(m.totalTokens)} | ${(m.metadata?.agents || []).join(',')} | ${(m.modelsUsed || []).length} |`);
  } else if (sub === 'model' || sub === 'agent' || sub === 'cost') {
    if (sub === 'agent' || sub === 'cost') {
      if (!session.ok) return { reply: `⚠️ ccusage session 失败: ${session.reason}` };
      const sessions = session.data.session || [];
      const byAgent = new Map();
      for (const s of sessions) {
        const ag = s.agent || 'unknown';
        if (!byAgent.has(ag)) byAgent.set(ag, zeroBucket());
        const b = byAgent.get(ag);
        b.input += s.inputTokens || 0; b.output += s.outputTokens || 0;
        b.cacheRead += s.cacheReadTokens || 0; b.cacheWrite += s.cacheCreationTokens || 0;
        b.total += s.totalTokens || 0; b.cost += s.totalCost || 0; b.msgs += 1;
      }
      const sorted = [...byAgent.entries()].sort((a, b) => b[1].cost - a[1].cost);
      lines.push(`## 📊 按 agent(累计 · LiteLLM 真实价)`);
      lines.push('');
      lines.push(`> 数据源: ccusage session`);
      lines.push('');
      lines.push(`| Agent | total | input | output | cacheR | cost | msgs |`);
      lines.push(`|---|---|---|---|---|---|---|`);
      for (const [a, b] of sorted) lines.push(`| ${a} | ${fmtNum(b.total)} | ${fmtNum(b.input)} | ${fmtNum(b.output)} | ${fmtNum(b.cacheRead)} | **${fmtCost(b.cost)}** | ${b.msgs} |`);
    } else {
      const byModel = new Map();
      for (const r of dArr) {
        for (const m of (r.modelBreakdowns || [])) {
          if (!byModel.has(m.modelName)) byModel.set(m.modelName, zeroBucket());
          const b = byModel.get(m.modelName);
          b.input += m.inputTokens || 0; b.output += m.outputTokens || 0;
          b.cacheRead += m.cacheReadTokens || 0; b.cacheWrite += m.cacheCreationTokens || 0;
          b.total = (b.total || 0) + (m.inputTokens || 0) + (m.outputTokens || 0) + (m.cacheReadTokens || 0) + (m.cacheCreationTokens || 0);
          b.cost += m.cost || 0; b.msgs += 1;
        }
      }
      const sorted = [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost);
      lines.push(`## 📊 按 model(${dArr.length} 天累计 · LiteLLM 真实价)`);
      lines.push('');
      lines.push(`| Model | total | cost | msgs |`);
      lines.push(`|---|---|---|---|`);
      for (const [m, b] of sorted.slice(0, 25)) lines.push(`| ${m} | ${fmtNum(b.total)} | **${fmtCost(b.cost)}** | ${b.msgs} |`);
    }
  }
  const md = lines.join('\n');
  if (channelId && discord) {
    try { await discord.send(channelId, `📊 **Token 用量 · ${sub}**\n\n${md}`); }
    catch (e) { log?.(`[usage-cmd] 推失败: ${e?.message || e}`); }
  }
  return { reply: `📊 ${sub} 视图已推到 ${channelId ? `<#${channelId}>` : '#🛠 系统'}` };
}

// ---- 调度器入口 ----
export async function runTokenUsageJob({ dateKey, days = 14, pi, discord, log, channelId = null, tzOffsetHours = 8 }) {
  const dk = dateKey || todayInTz(tzOffsetHours);
  log(`[token-usage] 触发 ${dk} · 窗口 ${days}d · channel=${channelId || 'none'}`);
  const agg = await aggregateUsageData({ days, tzOffsetHours });
  log(`[token-usage] ${agg.meta.source} · ccusageDaily=${agg.meta.ccusageDaily} session=${agg.meta.ccusageSession} monthly=${agg.meta.ccusageMonthly}`);
  if (!agg.meta.ccusageDaily && agg.totals.total === 0) {
    log(`[token-usage] 本地没数据,跳过`);
    return;
  }
  // 渲染 PNG
  const option = buildEchartsOption({ dateKey: dk, agg, days, tzOffsetHours });
  const { png, svg } = renderUsagePNG(option);
  const html = buildUsageHTML({ dateKey: dk, agg, days, tzOffsetHours });
  const { md } = buildReport({ dateKey: dk, agg, days, tzOffsetHours });
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, `${dk}.svg`), svg, 'utf8');
  writeFileSync(join(DATA_DIR, `${dk}.png`), png);
  writeFileSync(join(DATA_DIR, `${dk}.html`), html, 'utf8');
  writeFileSync(join(DATA_DIR, `${dk}.md`), md, 'utf8');
  log(`[token-usage] 落本地 ${dk}.{svg,png,html,md} · png=${png.length}B html=${html.length}B`);
  if (channelId && discord) {
    try {
      await sendPngAndText(discord, channelId, png, `📊 **Token 用量 · ${dk}** · ${days}d`);
      log(`[token-usage] ✅ 推 #${channelId}`);
    } catch (e) {
      log(`[token-usage] 推失败: ${e?.message || e}`);
    }
  } else if (pi) {
    const prompt = `📊 Token 用量\nnode ~/pi-discord-agents/scripts/usage-stats.mjs ${days} /tmp/usage.txt\n读 /tmp/usage.txt 后 write_file 到 data/token-usage/${dk}.md,discord_post_message category=usage 推送`;
    try { await pi.prompt(prompt); } catch (e) { log(`[token-usage] Pi 失败: ${e?.message || e}`); }
  }
}

// 推 PNG + 长文字(discord.js 客户端的 send 必须支持 files)
async function sendPngAndText(discord, channelId, pngBuffer, caption) {
  // 优先用 discord.sendPng(直接发图,带 caption)
  if (typeof discord.sendPng === 'function') {
    await discord.sendPng(channelId, pngBuffer, caption);
    return;
  }
  // 降级 1:discord.client + channels.fetch(直接用 discord.js)
  if (discord.client?.channels?.fetch) {
    const ch = await discord.client.channels.fetch(channelId);
    await ch.send({ content: caption, files: [{ attachment: pngBuffer, name: `token-usage-${todayInTz(8)}.png` }] });
    return;
  }
  // 降级 2:只用 text
  if (typeof discord.send === 'function') {
    await discord.send(channelId, caption);
    return;
  }
  throw new Error('discord instance 不知道怎么发消息');
}
