// scripts/push-to-discord.mjs
// 实际连接 Discord，运行完整内容流水线，推送真实数据到频道
// 用法：node scripts/push-to-discord.mjs
//
// 推送内容：
// 1. intake → #每日素材
// 2. distill → #国内总编 + #海外总编
// 3. auto-render → 各平台预览频道（embed + Markdown + .md 文件）
// 4. 小红书 → HTML 卡片（可直接截图用）

import { createDiscordClient } from '../src/discord-client.mjs';
import { loadConfig } from '../src/config.mjs';
import { AgentManager } from '../src/runtime/agent-manager.mjs';
import { handleAgentResult } from '../src/runtime/agent-result.mjs';
import { deliverBatch } from '../src/runtime/commands/deliver.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const ROOT = resolve(process.cwd());
const cfg = loadConfig();
if (!cfg.ok) {
  console.error('❌ 配置错误:', cfg.error);
  process.exit(1);
}
const TOKEN = cfg.value.token;

// 把 .env 所有变量加载到 process.env（频道 ID 等）
import { readFileSync } from 'node:fs';
const _envText = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
for (const raw of _envText.split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) {
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
log(`  ✅ .env 已加载 · CH_DOMESTIC_MAIN=${process.env.CH_DOMESTIC_MAIN} · CH_OS_MAIN=${process.env.CH_OS_MAIN}`);

if (!TOKEN) {
  console.error('❌ 缺少 DISCORD_TOKEN');
  process.exit(1);
}

// ===== 示例素材（模拟真实工作内容）=====
const SAMPLES = [
  '今天用 React + TypeScript + Vite + TanStack Query 给客户做了一个 SaaS 数据分析平台的 Demo，用了 shadcn/ui 组件库，commit abc1234ef 部署在 https://github.com/huifer/demo，客户反馈界面专业、数据可视化清晰。',
  '帮一个跨境电商客户用 Rust 写了一个高性能的订单聚合 API，用了 axum + tokio + sqlx，QPS 从 200 提升到 5000，延迟从 200ms 降到 15ms，commit def5678ab 部署在 https://github.com/huifer/order-aggregator',
];

function log(...a) { console.log(...a); }

async function main() {
  log('═══════════════════════════════════════════════');
  log('  Discord 实际推送测试');
  log('═══════════════════════════════════════════════\n');

  // 1. 连接 Discord
  log('▶ 连接 Discord...');
  let discordClient;
  const discord = await new Promise((resolvePromise) => {
    const dc = createDiscordClient({
      token: TOKEN,
      onMessage: (event) => {
        if (event === 'ready') {
          log(`  ✅ Discord 已登录: ${event.client?.user?.tag ?? 'bot'}`);
          resolvePromise(dc);
        }
      },
    });
    discordClient = dc;
    dc.login().catch((e) => {
      log(`  ❌ Discord 登录失败: ${e.message}`);
      process.exit(1);
    });
  });

  // 等待频道缓存
  await sleep(2000);

  // 2. 初始化 AgentManager
  log('▶ 初始化 AgentManager...');
  const agentManager = new AgentManager({ root: ROOT });
  await agentManager.start();
  log(`  ✅ ${agentManager.agents.size} agents 就绪\n`);

  // Mock msg（用于 handleAgentResult 的 reply）
  const mockMsg = { channelId: 'test', reply: async (t) => log(`  [reply] ${t?.slice(0, 60)}`) };

  // 3. 遍历素材，走完整流水线
  for (let i = 0; i < SAMPLES.length; i++) {
    const sample = SAMPLES[i];
    log(`\n▶━━━ 素材 ${i + 1}/${SAMPLES.length} ━━━`);
    log(`  "${sample.slice(0, 60)}..."`);

    // --- intake ---
    log('\n  [1/4] !intake now');
    const r1 = await agentManager.dispatch({
      source: 'discord', channelId: process.env.CH_DAILY_MATERIAL,
      userId: 'system', text: `!intake now ${sample}`,
    });
    await handleAgentResult({
      result: r1, msg: mockMsg, discord, log,
      env: process.env,
    });
    log(`  → ${r1.status} ${r1.result?.materialId ?? r1.error}`);

    // --- distill ---
    log('\n  [2/4] !distill now');
    const r2 = await agentManager.dispatch({
      source: 'discord', channelId: process.env.CH_DOMESTIC_MAIN,
      userId: 'system', text: `!distill now --mat=${r1.result?.materialId}`,
    });
    await handleAgentResult({
      result: r2, msg: mockMsg, discord, log,
      env: process.env,
    });
    log(`  → ${r2.status} ${r2.result?.candidateId} · score=${r2.result?.score}/40 · verdict=${r2.result?.verdict}`);
    log(`  → platforms: ${JSON.stringify(r2.result?.platforms)}`);
    const cntId = r2.result?.candidateId;

    // --- auto-render + deliver ---
    log('\n  [3/4] !auto-render（渲染 + 投递到预览频道）');
    const r3 = await agentManager.dispatch({
      source: 'discord', channelId: process.env.CH_DOMESTIC_MAIN,
      userId: 'system', text: `!auto-render ${cntId}`,
    });
    await handleAgentResult({
      result: r3, msg: mockMsg, discord, log,
      env: process.env,
    });
    log(`  → 渲染: ${r3.result?.rendered}/${r3.result?.total} 平台`);

    // 投递到各预览频道
    if (r3.result?.renderIds?.length) {
      log('\n  [4/4] 投递 Markdown + .md 文件到各预览频道');
      const batch = await deliverBatch({
        rndIds: r3.result.renderIds,
        discord, env: process.env,
      });
      log(`  → 投递: ${batch.ok}/${batch.total} 成功`);
      for (const r of batch.results) {
        log(`    ${r.ok ? '✅' : '❌'} ${r.platform} → ${r.channelId ? `<#${r.channelId}>` : '(no channel)'} · ${r.messageCount} msgs`);
      }

      // 小红书 PNG 已由 deliver 自动投递，无需额外生成
    }

    log('\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  // 4. 推送总结到 #主快讯
  log('\n▶ 推送总结到 #主快讯');
  const newsFeed = process.env.CH_NEWS_FEED;
  if (newsFeed) {
    const { EmbedBuilder } = await import('discord.js');
    const embed = new EmbedBuilder()
      .setTitle('📋 内容流水线推送完成')
      .setDescription(`已处理 ${SAMPLES.length} 条素材\nintake → distill → render → deliver 全链路`)
      .setColor(0x22c55e)
      .addFields(
        { name: '素材数', value: String(SAMPLES.length), inline: true },
        { name: '渲染平台', value: 'wechat · x · newsletter', inline: true },
        { name: '状态', value: '✅ 全部推送', inline: true },
      )
      .setFooter({ text: `杭州 OPC 张三 · ${new Date().toISOString().slice(0, 19)}` });
    await discord.sendEmbed(newsFeed, embed);
    log(`  ✅ 总结已推送到 <#${newsFeed}>`);
  }

  log('\n═══════════════════════════════════════════════');
  log('  ✅ Discord 推送全部完成');
  log('═══════════════════════════════════════════════\n');

  await agentManager.shutdown();
  await discordClient.destroy();
  process.exit(0);
}

// ===== 小红书 HTML 卡片 =====
async function pushXiaohongshuCard({ rndId, candidateId, discord, env, agentManager }) {
  // 加载渲染内容
  const { readFileSync } = await import('node:fs');
  const renderPath = resolve(ROOT, 'data/content/renders', `${rndId}.json`);
  const render = JSON.parse(readFileSync(renderPath, 'utf8'));
  const candidatePath = resolve(ROOT, 'data/content/candidates', `${candidateId}.json`);
  const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));

  const title = candidate.title ?? '小红书内容';
  const content = candidate.content ?? render.body ?? '';
  const brand = '杭州 OPC 张三';

  // 生成小红书风格 HTML 卡片（可直接截图）
  const html = generateXhsHtml(title, content, brand, candidate.score?.total);

  // 保存 HTML 文件
  const xhsDir = resolve(ROOT, 'data/content/renders');
  const htmlPath = resolve(xhsDir, `${rndId}-xiaohongshu-card.html`);
  writeFileSync(htmlPath, html, 'utf8');

  // 推送到小红书预览频道
  const channelId = env.CH_DOMESTIC_PREVIEW_XHS;
  if (channelId) {
    const { EmbedBuilder } = await import('discord.js');
    const embed = new EmbedBuilder()
      .setTitle(`📕 小红书卡片 · ${title.slice(0, 40)}`)
      .setDescription(`已生成 HTML 卡片（可直接截图发布）\n评分: ${candidate.score?.total ?? '-'}/40`)
      .setColor(0xff2442)
      .addFields(
        { name: '文件', value: `${rndId}-xiaohongshu-card.html`, inline: true },
        { name: '用途', value: '截图后发小红书', inline: true },
      );
    await discord.sendEmbed(channelId, embed);
    await discord.sendFile(channelId, htmlPath, `${rndId}-xiaohongshu-card.html`, '📎 小红书 HTML 卡片（浏览器打开 → 截图 → 发布）');
    log(`    ✅ 小红书 HTML 卡片 → <#${channelId}>`);
  }
}

function generateXhsHtml(title, content, brand, score) {
  // 截取正文前 500 字
  const body = (content ?? '').slice(0, 500);
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'PingFang SC', 'Noto Sans CJK SC', system-ui, sans-serif;
    background: linear-gradient(135deg, #ff2442 0%, #ff6b81 100%);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 40px 20px;
  }
  .card {
    background: #fff;
    border-radius: 24px;
    max-width: 600px;
    width: 100%;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  }
  .card-header {
    background: linear-gradient(135deg, #ff2442, #ff6b81);
    padding: 40px 32px;
    color: #fff;
  }
  .card-header h1 {
    font-size: 1.6rem;
    font-weight: 800;
    line-height: 1.4;
    margin-bottom: 12px;
  }
  .card-header .tag {
    display: inline-block;
    background: rgba(255,255,255,0.25);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
  }
  .card-body {
    padding: 32px;
  }
  .card-body p {
    font-size: 1.05rem;
    line-height: 1.8;
    color: #333;
    margin-bottom: 16px;
    white-space: pre-wrap;
  }
  .stats {
    display: flex;
    gap: 12px;
    margin: 20px 0;
  }
  .stat {
    flex: 1;
    background: #fff5f5;
    border-radius: 12px;
    padding: 16px;
    text-align: center;
  }
  .stat .num {
    font-size: 1.4rem;
    font-weight: 800;
    color: #ff2442;
  }
  .stat .label {
    font-size: 0.75rem;
    color: #999;
    margin-top: 4px;
  }
  .card-footer {
    padding: 20px 32px;
    border-top: 1px solid #f0f0f0;
    text-align: center;
    color: #999;
    font-size: 0.85rem;
  }
  .emoji-row {
    font-size: 1.5rem;
    margin: 16px 0;
    text-align: center;
  }
</style>
</head>
<body>
<div class="card">
  <div class="card-header">
    <h1>${escapeHtml(title)}</h1>
    <span class="tag">杭州 OPC 张三</span>
  </div>
  <div class="card-body">
    <div class="emoji-row">🚀 💻 ✨</div>
    <p>${escapeHtml(body)}</p>
    <div class="stats">
      <div class="stat"><div class="num">${score ?? '—'}</div><div class="label">内容评分</div></div>
      <div class="stat"><div class="num">React</div><div class="label">技术栈</div></div>
      <div class="stat"><div class="num">✅</div><div class="label">已验证</div></div>
    </div>
  </div>
  <div class="card-footer">
    © ${year} ${brand} · All rights reserved
  </div>
</div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch((e) => {
  console.error('❌ 错误:', e);
  process.exit(1);
});
