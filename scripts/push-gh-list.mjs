#!/usr/bin/env node
// scripts/push-gh-list.mjs
// 每日任务 to-do list 推送脚本
// 形态:
//   - 顶部 "今日待办"(huifer 未评论过的 open issue,checkbox 形态)
//   - 底部 "今日完成"(huifer 今天评论过的 issue,自动追踪)
//   - 高优先级在前,一般在后
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { readWatchFile } from '../src/gh-watch.mjs';

const execFileP = promisify(execFile);
const ROOT = resolve(homedir(), 'pi-discord-agents');
const ENV_FILE = ROOT + '/.env';
const WATCH_FILE = ROOT + '/data/gh-watch.json';

function parseEnv(text) {
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = parseEnv(readFileSync(ENV_FILE, 'utf8'));
const TOKEN = env.DISCORD_TOKEN;
const CH_GH = env.CH_GH;
if (!TOKEN || !CH_GH) {
  console.error('❌ .env 缺 DISCORD_TOKEN 或 CH_GH');
  process.exit(1);
}

async function ghExec(args) {
  const { stdout, stderr } = await execFileP('gh', args, { timeout: 30_000, maxBuffer: 50 * 1024 * 1024 });
  return { stdout, stderr };
}
async function sendDiscord(channelId, content) {
  const r = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bot ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!r.ok) throw new Error(`Discord API ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return await r.json();
}
async function sendLong(channelId, fullText, prefix = '') {
  const MAX = 1900;
  const body = prefix + fullText;
  if (body.length <= MAX) {
    const m = await sendDiscord(channelId, body);
    console.log(`✓ 推送完成: ${m.id} (${body.length} chars)`);
    return [m.id];
  }
  const ids = [];
  let rest = body;
  let chunkIdx = 1;
  const totalEst = Math.ceil(body.length / MAX);
  while (rest.length > 0) {
    let cut;
    if (rest.length <= MAX) { cut = rest.length; }
    else {
      cut = rest.lastIndexOf('\n\n', MAX);
      if (cut < MAX * 0.5) cut = rest.lastIndexOf('\n', MAX);
      if (cut < MAX * 0.5) cut = MAX;
    }
    const chunk = rest.slice(0, cut) + (rest.length > MAX ? `\n\n_(${chunkIdx}/${totalEst})_` : '');
    const m = await sendDiscord(channelId, chunk);
    ids.push(m.id);
    console.log(`✓ 推送片段 ${chunkIdx}/${totalEst}: ${m.id} (${chunk.length} chars)`);
    rest = rest.slice(cut).replace(/^\n+/, '');
    chunkIdx++;
    if (rest.length > 0) await new Promise(r => setTimeout(r, 300));
  }
  return ids;
}

function timeAgo(iso) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  return `${Math.floor(hrs / 24)} 天前`;
}

function dateKeyBeijing(d = new Date()) {
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60_000;
  const tzMs = utcMs + 8 * 3600_000;
  const x = new Date(tzMs);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
}

// 把 issue body / 评论里的 markdown 表格转成 Discord 能渲染的格式
// Discord 不支持 |---| 这种 markdown table 语法,会原样显示成乱码
// 策略: 检测到表格行(连续多行含 |---|)就用 ``` 代码块包,这样 Discord 会用等宽字体渲染,看起来像表格
//       同时去掉 # 标题前缀(避免 Discord 误认为是大标题)
function safeForDiscord(text, { maxLen = 1500 } = {}) {
  if (!text) return '';
  // 截断到 maxLen,保留换行
  let s = text.length > maxLen ? text.slice(0, maxLen) + '\n…(已截断)' : text;
  // 检测 markdown 表格: 至少一行包含 "|---" 或 "| ---" 分隔
  const hasMarkdownTable = /^\s*\|?\s*:?-+:?\s*\|/m.test(s) && s.split('\n').filter(l => l.includes('|')).length >= 2;
  if (hasMarkdownTable) {
    // 用 code block 包,Discord 会用等宽字体渲染,看起来就是表格
    return '```\n' + s + '\n```';
  }
  // 普通文本: 去掉 markdown 标题前缀(Discord 会把 # xxx 渲染成大字),换行保留
  return s.replace(/^#{1,6}\s+/gm, '');
}

async function main() {
  if (!existsSync(WATCH_FILE)) {
    console.error(`❌ 仓库池文件不存在: ${WATCH_FILE}`);
    process.exit(1);
  }
  const { repos } = readWatchFile(WATCH_FILE);
  console.log(`📋 仓库池: ${repos.length} 个 → ${repos.join(', ') || '(空)'}\n`);

  if (repos.length === 0) {
    await sendDiscord(CH_GH, '🎯 仓库池为空,今天跳过。\n\n用 `!watch add owner/repo` 添加(在 #主入口)');
    return;
  }

  const { stdout: userOut } = await ghExec(['api', 'user', '--jq', '.login']);
  const huifer = userOut.trim();
  console.log(`👤 当前用户: ${huifer}\n`);

  const todayKey = dateKeyBeijing();
  console.log(`📅 今日(北京时间): ${todayKey}\n`);

  const todoHigh = [];
  const todoNormal = [];
  const completedToday = [];

  for (const repo of repos) {
    console.log(`→ 拉取 ${repo} ...`);
    const { stdout } = await ghExec([
      'issue', 'list', '--repo', repo, '--state', 'open', '--limit', '50',
      '--json', 'number,title,state,createdAt,updatedAt,author,labels,comments,url,body',
    ]);
    const issues = JSON.parse(stdout || '[]');
    console.log(`  共 ${issues.length} 条 open issue`);

    const PRIORITY = ['good first issue', 'help wanted', 'enhancement', 'bug'];
    issues.sort((a, b) => {
      const ap = PRIORITY.findIndex(p => (a.labels||[]).map(l=>l.name||l).includes(p));
      const bp = PRIORITY.findIndex(p => (b.labels||[]).map(l=>l.name||l).includes(p));
      const aw = ap === -1 ? 999 : ap;
      const bw = bp === -1 ? 999 : bp;
      if (aw !== bw) return aw - bw;
      return Date.parse(b.updatedAt||0) - Date.parse(a.updatedAt||0);
    });

    let unchecked = 0;
    for (const it of issues) {
      if (unchecked >= 20) {
        console.log(`  ⚠️ 已检查 20 条,后面的 issue 不再详查`);
        break;
      }
      unchecked++;
      try {
        const { stdout: detailOut } = await ghExec([
          'issue', 'view', String(it.number), '--repo', repo, '--json', 'comments',
        ]);
        const detail = JSON.parse(detailOut || '{}');
        const comments = detail.comments || [];

        const todayHuiferComments = comments.filter(c =>
          c.author?.login === huifer && c.createdAt?.startsWith(todayKey)
        );
        if (todayHuiferComments.length > 0) {
          completedToday.push({
            repo, number: it.number, title: it.title,
            commentTime: todayHuiferComments[0].createdAt,
            commentPreview: safeForDiscord(todayHuiferComments[0].body || '', { maxLen: 800 }),
            url: it.url,
          });
          continue;
        }

        const anyHuiferComment = comments.some(c => c.author?.login === huifer);
        if (anyHuiferComment) continue;

        const labels = (it.labels||[]).map(l => l.name || l).filter(Boolean);
        const mentionsHuifer = !!it.body && it.body.includes(`@${huifer}`);
        const isHigh = mentionsHuifer || labels.some(l => PRIORITY.includes(l));

        const item = {
          repo, number: it.number, title: it.title,
          author: it.author?.login || '',
          labels, commentCount: comments.length,
          mentionsHuifer, updatedAt: it.updatedAt,
          url: it.url, bodyPreview: safeForDiscord(it.body || '', { maxLen: 1200 }),
        };
        if (isHigh) todoHigh.push(item);
        else todoNormal.push(item);
      } catch (e) {
        console.log(`  ✗ #${it.number} 拿评论失败: ${e.message}`);
      }
    }
  }

  const totalTodo = todoHigh.length + todoNormal.length;
  console.log(`\n📊 汇总:`);
  console.log(`  🔥 高优先级: ${todoHigh.length} 条`);
  console.log(`  📋 一般:      ${todoNormal.length} 条`);
  console.log(`  ✓ 今日完成: ${completedToday.length} 条\n`);

  function todoLine(item) {
    const labelsStr = item.labels.length ? ` [${item.labels.join(', ')}]` : '';
    const mentionTag = item.mentionsHuifer ? ' **@ 你**' : '';
    const head = `- [ ] \`${item.repo}#${item.number}\` ${item.title}${labelsStr}${mentionTag}\n  · 作者 @${item.author} · ${item.commentCount} 条评论 · 更新 ${timeAgo(item.updatedAt)}\n  · <${item.url}>`;
    // body 里有 markdown 表格/长内容时,附加在下面(code block 包)
    if (item.bodyPreview && item.bodyPreview.trim()) {
      return `${head}\n${item.bodyPreview}`;
    }
    return head;
  }
  function doneLine(c) {
    const head = `- [x] \`${c.repo}#${c.number}\` ${c.title}\n  · 完成于 ${c.commentTime.slice(11, 16)}\n  · <${c.url}>`;
    if (c.commentPreview && c.commentPreview.trim()) {
      return `${head}\n${c.commentPreview}`;
    }
    return head;
  }

  let md = `# 🎯 今日待办 · ${todayKey}

> 每天 10:00(北京时间)推送 · 数据源: \`data/gh-watch.json\`(${repos.length} 个仓库)
> 原则:自动从仓库池里的 open issue 抽"huifer 未评论过"的 + 追踪"今日 huifer 评论过"的

## 📊 概览

- 待办总数: **${totalTodo}** 条(${todoHigh.length} 🔥 高 + ${todoNormal.length} 📋 一般)
- 今日已完成: **${completedToday.length}** 条
- 涉及仓库: ${repos.length} 个
${totalTodo > 0 ? `- 高优占比: ${(todoHigh.length / totalTodo * 100).toFixed(0)}%` : ''}

## 🔥 高优先级(今天就处理)

${todoHigh.length === 0 ? '_暂无_\n' : todoHigh.map(todoLine).join('\n') + '\n'}

## 📋 一般待办

${todoNormal.length === 0 ? '_暂无_\n' : todoNormal.map(todoLine).join('\n') + '\n'}

## ✅ 今日已完成

${completedToday.length === 0 ? '_今日 huifer 还没评论任何 issue_\n' : completedToday.map(doneLine).join('\n') + '\n'}

## 🛠 命令

- \`!watch add owner/repo\` — 加仓库到监控池(#主入口)
- \`!watch remove owner/repo\` — 从池里移除
- \`!watch list\` — 看仓库池
- 在 issue 上点 ☐ 勾选后,明天会被算到"今日完成"

---
_数据源:gh api · 自动生成_
`;

  const dataDir = ROOT + '/data/gh';
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const mdPath = `${dataDir}/${todayKey}.md`;
  writeFileSync(mdPath, md, 'utf8');
  console.log(`✓ 落盘: ${mdPath} (${md.length} chars)\n`);

  console.log(`📤 推到 #每日任务 (${CH_GH}) ...`);
  const prefix = `🎯 **【今日待办 · ${todayKey}】** · 待办 ${totalTodo} (🔥 ${todoHigh.length}) · 已完成 ${completedToday.length}\n\n`;
  await sendLong(CH_GH, md, prefix);

  console.log(`\n✅ 完成`);
  console.log(`   待办 ${totalTodo} 条 · 🔥 ${todoHigh.length} · 📋 ${todoNormal.length}`);
  console.log(`   今日完成 ${completedToday.length} 条`);
  console.log(`   仓库 ${repos.length} 个`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });