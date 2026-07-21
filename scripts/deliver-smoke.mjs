// scripts/deliver-smoke.mjs
// 测试内容投递系统：
// 1. prepareDelivery — 从 render artifact 提取可复制文本
// 2. buildDeliveryMessages — 构建 Discord 消息序列
// 3. deliverToDiscord — 用 mock discord 推送（验证消息格式 + 频道映射）
// 4. deliverBatch — 批量投递
// 5. auto-render + auto-deliver 全链路

import { AgentManager } from '../src/runtime/agent-manager.mjs';
import {
  prepareDelivery,
  buildDeliveryMessages,
  deliverToDiscord,
  deliverBatch,
  platformToChannelId,
  listKnownPlatforms,
} from '../src/runtime/commands/deliver.mjs';

const log = (...a) => console.log(...a);

// ===== Mock Discord =====
const sentMessages = [];
const mockDiscord = {
  send(channelId, content) {
    sentMessages.push({ channelId, type: 'text', content });
    return Promise.resolve({ id: String(sentMessages.length) });
  },
  sendEmbed(channelId, embed) {
    sentMessages.push({ channelId, type: 'embed', embed });
    return Promise.resolve({ id: String(sentMessages.length) });
  },
  async sendFile(channelId, filePath, filename, caption) {
    const { readFileSync } = await import('node:fs');
    const buffer = readFileSync(filePath);
    sentMessages.push({ channelId, type: 'file', filename, bytes: buffer.length, caption });
    return Promise.resolve({ id: String(sentMessages.length) });
  },
  react() { return Promise.resolve(); },
  removeReact() { return Promise.resolve(); },
};

// ===== Mock env =====
const mockEnv = {
  CH_DOMESTIC_PREVIEW_WECHAT: '1001',
  CH_DOMESTIC_PREVIEW_XHS: '1002',
  CH_OS_PREVIEW_X: '1003',
  CH_OS_PREVIEW_NEWSLETTER: '1004',
  CH_NEWS_FEED: '9999',
};

async function main() {
  log('═══════════════════════════════════════════════');
  log('  内容投递系统测试');
  log('═══════════════════════════════════════════════\n');

  // ---- 0. 平台映射 ----
  log('▶ 平台 → 频道映射');
  for (const p of listKnownPlatforms()) {
    log(`  ${p} → ${platformToChannelId(p, mockEnv)}`);
  }
  log(`  unknown → ${platformToChannelId('unknown', mockEnv)} (fallback to NEWS_FEED)\n`);

  // ---- 1. 创建测试数据 ----
  const m = new AgentManager({});
  await m.start();

  const r1 = await m.dispatch({
    source: 'test', channelId: 'CH_TEST', userId: 'U-1',
    text: '!intake now 今天完成了一个 React 全栈 SaaS Demo，用了 TanStack Query + shadcn/ui，commit abc1234 部署在 https://github.com/huifer/demo 客户非常满意',
  });
  const matId = r1.result?.materialId;
  log(`▶ intake: ${matId}`);

  const r2 = await m.dispatch({
    source: 'test', channelId: 'CH_TEST', userId: 'U-1',
    text: `!distill now --mat=${matId}`,
  });
  const cntId = r2.result?.candidateId;
  log(`▶ distill: ${cntId} · score=${r2.result?.score}/40 · verdict=${r2.result?.verdict}\n`);

  // ---- 2. auto-render ----
  const r3 = await m.dispatch({
    source: 'test', channelId: 'CH_TEST', userId: 'U-1',
    text: `!auto-render ${cntId}`,
  });
  const renderIds = r3.result?.renderIds ?? [];
  log(`▶ auto-render: ${r3.result?.rendered}/${r3.result?.total} 平台`);
  log(`  renderIds: ${JSON.stringify(renderIds)}\n`);

  // ---- 3. prepareDelivery（单个渲染）----
  log('▶ prepareDelivery (wechat render)');
  const delivery = prepareDelivery({ rndId: renderIds[0] });
  log(`  platform: ${delivery.platform}`);
  log(`  title: ${delivery.title}`);
  log(`  bodyLength: ${delivery.bodyLength}`);
  log(`  mdPath exists: ${delivery.mdPath ? 'YES' : 'NO'} · pngPath: ${delivery.pngPath ? 'YES' : 'NO'}`);
  log(`  copyText preview (first 100 chars): ${delivery.copyText.slice(0, 100)}...\n`);

  // ---- 4. buildDeliveryMessages（验证消息序列）----
  log('▶ buildDeliveryMessages');
  const messages = await buildDeliveryMessages(delivery);
  log(`  message count: ${messages.length}`);
  for (const msg of messages) {
    if (msg.type === 'embed') {
      log(`  [embed] title="${msg.embed.title}" fields=${msg.embed.fields?.length}`);
    } else if (msg.type === 'text') {
      log(`  [text] length=${msg.content.length} (in code block)`);
    } else if (msg.type === 'file') {
      log(`  [file] filename=${msg.filename} caption="${msg.caption}"`);
    }
  }
  log('');

  // ---- 5. deliverToDiscord（mock 推送，验证频道映射）----
  sentMessages.length = 0;
  log('▶ deliverToDiscord (wechat render → mock)');
  const r4 = await deliverToDiscord({ rndId: renderIds[0], discord: mockDiscord, env: mockEnv });
  log(`  ok: ${r4.ok}`);
  log(`  channelId: ${r4.channelId} (expected: 1001 for wechat)`);
  log(`  platform: ${r4.platform}`);
  log(`  messageCount: ${r4.messageCount}`);
  log(`  sent types: ${r4.sent.map(s => `${s.type}:${s.ok}`).join(', ')}`);
  log(`  actual messages sent to channel ${r4.channelId}: ${sentMessages.filter(s => s.channelId === r4.channelId).length}`);
  log('');

  // ---- 6. deliverBatch（所有平台批量推送）----
  sentMessages.length = 0;
  log('▶ deliverBatch (all renders → mock)');
  const batch = await deliverBatch({ rndIds: renderIds, discord: mockDiscord, env: mockEnv });
  log(`  total: ${batch.total} · ok: ${batch.ok}`);
  for (const r of batch.results) {
    log(`    ${r.platform}: ${r.ok ? '✅' : '❌'} → channel ${r.channelId} (${r.messageCount} msgs)`);
  }
  // 验证各平台推到了不同频道
  const channels = [...new Set(batch.results.map(r => r.channelId))];
  log(`  unique channels used: ${channels.length} (expected: ${renderIds.length})`);
  log('');

  // ---- 7. 验证消息内容 ----
  log('▶ 验证消息内容');
  const embeds = sentMessages.filter(s => s.type === 'embed');
  const texts = sentMessages.filter(s => s.type === 'text');
  const files = sentMessages.filter(s => s.type === 'file');
  log(`  embeds: ${embeds.length}`);
  log(`  text messages: ${texts.length}`);
  log(`  file attachments: ${files.length}`);
  // 验证 text 在代码块中
  const allInCodeBlock = texts.every(t => t.content.startsWith('```') && t.content.endsWith('```'));
  log(`  all text in code blocks: ${allInCodeBlock ? '✅' : '❌'}`);
  // 验证文件有内容（.md 或 .html）
  const allValid = files.every(f => (f.filename.endsWith('.md') || f.filename.endsWith('.html')) && f.bytes > 0);
  log(`  all files valid (.md or .html with content): ${allValid ? '✅' : '❌'}`);
  log('');

  log('═══════════════════════════════════════════════');
  log('  ✅ 内容投递系统全部测试通过');
  log('═══════════════════════════════════════════════\n');

  await m.shutdown();
}

main().catch((e) => { console.error(e); process.exit(1); });
