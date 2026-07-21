// ~/pi-discord-agents/src/dreaming/report.mjs
// 「遐思」周报 / 月报生成。
//
// 设计:
//   - 周报:每周日 08:00 触发,统计本周梦境 + 主题云 + 投票
//   - 月报:每月 1 号 08:00 触发,加关系图(mermaid)
//   - 主题云:mermaid graph LR,主题大小按出现频次
//   - 风格:有"晨间反思"质感,不冷冰冰

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS } from './paths.mjs';

const TYPE_LABEL = {
  'lian-zhu': '连珠',
  'gui-cang': '归藏',
  'ming-tai': '明台',
};

const TYPE_EMOJI = {
  'lian-zhu': '🚀',
  'gui-cang': '🌊',
  'ming-tai': '☁️',
};

function pad2(n) { return String(n).padStart(2, '0'); }

function todayKey(tzOffsetHours = 8) {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const tzMs = utcMs + tzOffsetHours * 3600_000;
  const d = new Date(tzMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function shiftDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86400_000);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

async function loadRunsInRange({ from, to }) {
  const out = [];
  let cur = from;
  while (cur <= to) {
    const dir = join(PATHS.runsDir, cur);
    try {
      const files = await readdir(dir);
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        try {
          const r = JSON.parse(await readFile(join(dir, f), 'utf8'));
          out.push(r);
        } catch {}
      }
    } catch {}
    cur = shiftDate(cur, 1);
  }
  return out;
}

async function loadVotes() {
  try {
    const txt = await readFile(PATHS.votesFile, 'utf8');
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

function aggregateStats(runs) {
  const stats = {
    totalRuns: runs.length,
    completed: runs.filter(r => r.status === 'completed').length,
    failed: runs.filter(r => r.status === 'failed').length,
    byType: {},
    byTheme: {},
    totalTokens: 0,
    totalArtifacts: 0,
    topArtifacts: [],
  };

  for (const r of runs) {
    stats.byType[r.type] = stats.byType[r.type] || { count: 0, completed: 0 };
    stats.byType[r.type].count++;
    if (r.status === 'completed') stats.byType[r.type].completed++;

    stats.totalTokens += r.tokens?.total || 0;
    stats.totalArtifacts += r.artifacts?.length || 0;
  }
  return stats;
}

function buildMermaidThemeCloud(themes) {
  // themes: { themeName: count }
  const entries = Object.entries(themes).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (!entries.length) return '_本周暂无主题_';

  let g = '```mermaid\ngraph LR\n';
  let nodeId = 0;
  const nodes = new Map();
  for (const [name, count] of entries) {
    const id = `t${nodeId++}`;
    const safeName = name.replace(/[^\w一-龥-]/g, '_').slice(0, 20);
    const size = count >= 3 ? ':::.big' : count >= 2 ? ':::.mid' : ':::.small';
    nodes.set(name, { id, label: `${safeName}<br/>×${count}`, size });
    g += `  ${id}["${safeName}<br/>×${count}"]${size}\n`;
  }
  g += '```';
  return g;
}

function buildMermaidRelationship(artifacts) {
  // artifacts: [{id, theme, citedMemories}]
  if (!artifacts.length) return '_暂无关系图_';

  const nodes = new Map();
  let edges = '';
  let nodeId = 0;

  for (const a of artifacts.slice(0, 20)) {
    const t = (a.theme || '?').replace(/[^\w一-龥-]/g, '_').slice(0, 15);
    if (!nodes.has(t)) {
      const id = `t${nodeId++}`;
      nodes.set(t, id);
    }
  }

  let g = '```mermaid\ngraph LR\n';
  for (const [name, id] of nodes) {
    g += `  ${id}["${name}"]\n`;
  }
  // 简化:同主题之间互相连接(示意)
  const ids = Array.from(nodes.values());
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      g += `  ${ids[i]} --- ${ids[j]}\n`;
    }
  }
  g += '```';
  return g;
}

function renderWeeklyReport({ stats, themes, topArtifacts, votes, fromDate, toDate, mermaidCloud }) {
  const lines = [];
  lines.push(`# 📊 遐思周报 · ${fromDate} → ${toDate}`);
  lines.push('');
  lines.push(`**本周概况:**`);
  lines.push(`- 运行 ${stats.totalRuns} 次 · 完成 ${stats.completed} · 失败 ${stats.failed}`);
  lines.push(`- 产物 ${stats.totalArtifacts} 条 · 消耗 ${stats.totalTokens.toLocaleString()} tokens`);
  lines.push('');

  lines.push(`**按类型:**`);
  for (const [type, s] of Object.entries(stats.byType)) {
    lines.push(`- ${TYPE_EMOJI[type] || '·'} ${TYPE_LABEL[type] || type} × ${s.count} (完成 ${s.completed})`);
  }
  lines.push('');

  if (themes && Object.keys(themes).length) {
    lines.push(`**主题云:**`);
    lines.push(mermaidCloud);
    lines.push('');
  }

  if (topArtifacts.length) {
    lines.push(`**top 产物:**`);
    for (const a of topArtifacts.slice(0, 5)) {
      const title = a.title || a.id;
      const v = votes[a.id] || {};
      const voteStr = v.up || v.down || v.star ? ` · 👍${v.up||0} 👎${v.down||0} ⭐${v.star||0}` : '';
      lines.push(`- 「${title}」 · 评分 ${a.scores?.total?.toFixed(2) || '?'}${voteStr}`);
    }
    lines.push('');
  }

  lines.push(`*—— 由「遐思」系统自动生成*`);
  return lines.join('\n');
}

function renderMonthlyReport({ stats, themes, artifacts, topArtifacts, votes, yearMonth, mermaidRelationship }) {
  const lines = [];
  lines.push(`# 🌕 遐思月报 · ${yearMonth}`);
  lines.push('');
  lines.push(`**本月概况:**`);
  lines.push(`- 运行 ${stats.totalRuns} 次 · 完成 ${stats.completed} · 失败 ${stats.failed}`);
  lines.push(`- 产物 ${stats.totalArtifacts} 条 · 消耗 ${stats.totalTokens.toLocaleString()} tokens`);
  lines.push('');

  lines.push(`**按类型:**`);
  for (const [type, s] of Object.entries(stats.byType)) {
    lines.push(`- ${TYPE_EMOJI[type] || '·'} ${TYPE_LABEL[type] || type} × ${s.count} (完成 ${s.completed})`);
  }
  lines.push('');

  if (themes && Object.keys(themes).length) {
    lines.push(`**主题云:**`);
    for (const [t, c] of Object.entries(themes).sort((a,b)=>b[1]-a[1]).slice(0, 10)) {
      lines.push(`- ${t} × ${c}`);
    }
    lines.push('');
  }

  if (mermaidRelationship) {
    lines.push(`**主题关系:**`);
    lines.push(mermaidRelationship);
    lines.push('');
  }

  if (topArtifacts.length) {
    lines.push(`**top 5 产物:**`);
    for (const a of topArtifacts.slice(0, 5)) {
      const title = a.title || a.id;
      const v = votes[a.id] || {};
      lines.push(`- 「${title}」 · 评分 ${a.scores?.total?.toFixed(2) || '?'}${v.up ? ` · 👍${v.up}` : ''}`);
    }
    lines.push('');
  }

  lines.push(`*—— 由「遐思」系统自动生成*`);
  return lines.join('\n');
}

export function createReporter({ artifacts = null, log = () => {}, tzOffsetHours = 8 } = {}) {
  async function collectArtifactsInRange(from, to) {
    const all = [];
    const types = ['lian-zhu', 'gui-cang', 'ming-tai'];
    for (const t of types) {
      try {
        const list = await artifacts.listMeta({ type: t, limit: 200 });
        for (const m of list) {
          if (!m.createdAt) continue;
          const date = m.createdAt.slice(0, 10);
          if (date >= from && date <= to) all.push({ ...m, _type: t });
        }
      } catch {}
    }
    all.sort((a, b) => (b.scores?.total || 0) - (a.scores?.total || 0));
    return all;
  }

  async function weeklyReport({ endDate = todayKey(tzOffsetHours) } = {}) {
    const fromDate = shiftDate(endDate, -6);
    const runs = await loadRunsInRange({ from: fromDate, to: endDate });
    const stats = aggregateStats(runs);

    const allArts = await collectArtifactsInRange(fromDate, endDate);
    const themes = {};
    for (const a of allArts) {
      if (a.theme) themes[a.theme] = (themes[a.theme] || 0) + 1;
    }
    const votes = await loadVotes();

    const mermaidCloud = buildMermaidThemeCloud(themes);

    return renderWeeklyReport({
      stats, themes, topArtifacts: allArts, votes,
      fromDate, toDate: endDate, mermaidCloud,
    });
  }

  async function monthlyReport({ endDate = todayKey(tzOffsetHours) } = {}) {
    const [y, m] = endDate.split('-').map(Number);
    const fromDate = `${y}-${pad2(m)}-01`;
    const runs = await loadRunsInRange({ from: fromDate, to: endDate });
    const stats = aggregateStats(runs);

    const allArts = await collectArtifactsInRange(fromDate, endDate);
    const themes = {};
    for (const a of allArts) {
      if (a.theme) themes[a.theme] = (themes[a.theme] || 0) + 1;
    }
    const votes = await loadVotes();

    const mermaidRelationship = buildMermaidRelationship(allArts);

    return renderMonthlyReport({
      stats, themes, artifacts: allArts,
      topArtifacts: allArts, votes,
      yearMonth: endDate.slice(0, 7),
      mermaidRelationship,
    });
  }

  return { weeklyReport, monthlyReport };
}