// ~/pi-discord-agents/manual-dream.mjs
// 真接 Discord,手动触发一场 lian-zhu 梦。

// 手动读 .env
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const envText = readFileSync(resolve('.env'), 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

// 必要 env(代理)
const proxyVars = {
  HTTP_PROXY: 'http://127.0.0.1:7897',
  HTTPS_PROXY: 'http://127.0.0.1:7897',
  ALL_PROXY: 'socks5://127.0.0.1:7897',
  NO_PROXY: 'localhost,127.0.0.1',
};
for (const [k, v] of Object.entries(proxyVars)) {
  if (!process.env[k]) process.env[k] = v;
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CH_XIASI = process.env.CH_XIASI;

const log = (...a) => console.log('[manual-dream]', ...a);
log('准备连 Discord...');

// 真 Discord client(复用 src/discord-client.mjs)
const { createDiscordClient } = await import('./src/discord-client.mjs');
const discord = await createDiscordClient({
  token: DISCORD_TOKEN,
  log,
});
await discord.login();
log('Discord 已登录');

// 临时注册按钮交互 handler(仅本次运行有效)
discord.onButtonInteraction(async (interaction) => {
  const customId = interaction.customId;
  if (!customId.startsWith('xiasi:')) return;
  const parts = customId.split(':');
  const action = parts[1];
  const userId = interaction.user.id;
  log('按钮点击:', customId, 'by', userId);
  try {
    await interaction.deferReply({ ephemeral: true });
  } catch {}
  if (action === 'vote' && votes && parts[2] && parts[3]) {
    const kind = parts[2];
    const artifactId = parts[3];
    try {
      const r = await votes.vote({ artifactId, userId, kind });
      const c = r.current;
      const state = r.toggledOff ? '(取消)' : '(已投)';
      await discord.replyToInteraction(interaction, `✅ ${state} 👍${c.up} 👎${c.down} ⭐${c.star}`);
    } catch (e) {
      await discord.replyToInteraction(interaction, `🌧 投票失败:${e.message}`);
    }
  } else if (action === 'archive' && parts[2]) {
    try {
      await arts.archive(parts[2]);
      await discord.replyToInteraction(interaction, `🗂 已归档 \`${parts[2]}\``);
    } catch (e) {
      await discord.replyToInteraction(interaction, `🌧 归档失败:${e.message}`);
    }
  } else {
    await discord.replyToInteraction(interaction, '✅ 投票已记录(entry-bot 重启后生效)');
  }
});
log('按钮交互 handler 已注册(临时)');

// 等待就绪
await new Promise(r => setTimeout(r, 2000));
log('频道 ID:', CH_XIASI, '(#📜-夜游记)');

// 推送开始通知
const startMsg = `🚀 **遐思·连珠** · 开始 · 手动触发 · ${new Date().toISOString().slice(0, 19)}Z`;
const startRes = await discord.send(CH_XIASI, startMsg);
log('已推送开始消息');

// 初始化 dreaming
const { createMemoryStore } = await import('./src/memory-store.mjs');
const { createEmbedder } = await import('./src/embedder.mjs');
const { createArtifacts, createBudget, createDiary, createDreamingPi, createDreamer, loadXiasiConfig } =
  await import('./src/dreaming/index.mjs');
const { createMemoryJournal } = await import('./src/memory-journal.mjs');
const { createVotes } = await import('./src/dreaming/votes.mjs');

const xc = loadXiasiConfig();
const store = await createMemoryStore({ log });
const embedder = await createEmbedder({ log });
const journal = createMemoryJournal({ memoryStore: store, log });
const arts = await createArtifacts({ log });
const budget = createBudget({ dailyLimit: xc.dailyTokenBudget, tzOffsetHours: 8, log });
const diary = createDiary({ dreamingPi: null, log, tzOffsetHours: 8 });
const votes = createVotes({ log });

log('启动 dreaming-pi...');
const dreamingPi = await createDreamingPi({
  cliPath: '/Users/zhangsan/.nvm/versions/node/v24.15.0/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli.js',
  cwd: process.cwd(),
  env: { ...process.env, ...proxyVars },
  log,
});

const dreamer = await createDreamer({
  cfg: { dreaming: xc },
  dreamingPi,
  discord,
  memoryStore: store,
  journal,
  embedder,
  artifacts: arts,
  budget,
  diary,
  log,
});

try {
  log('━━━ 开始做梦: lian-zhu ━━━');
  const r = await dreamer.run({ type: 'lian-zhu', triggeredBy: 'manual' });
  log('━━━ 梦做完了 ━━━');
  log('status:', r.status, 'duration:', Math.round(r.durationMs / 1000) + 's', 'artifacts:', r.artifactCount);

  // 推送完成通知 + 按钮
  if (r.artifacts && r.artifacts.length && r.artifacts.length >= 1) {
    const topId = r.artifacts[0];
    const meta = await arts.get(topId);
    const title = meta.meta.title?.slice(0, 50) || '(无标题)';
    const score = (meta.meta.scores.total || 0).toFixed(2);
    const lines = [
      `✨ **遐思·连珠** · 完成 · ${Math.round(r.durationMs / 1000)}s · ${r.artifactCount} 条产物`,
      ``,
      `**top 产物:**`,
      `「${title}」`,
      `评分: ${score}`,
      `ID: \`${topId}\``,
      ``,
      `→ 点 👍👎⭐ 投票,点 🗂 归档`,
    ];
    
    const buttons = [
      { customId: `xiasi:vote:up:${topId}`, label: '👍 有意思', style: 'success' },
      { customId: `xiasi:vote:down:${topId}`, label: '👎 不准', style: 'danger' },
      { customId: `xiasi:vote:star:${topId}`, label: '⭐ 收藏', style: 'primary' },
      { customId: `xiasi:archive:${topId}`, label: '🗂 归档', style: 'secondary' },
    ];
    
    try {
      const msg = await discord.sendWithButtons(CH_XIASI, lines.join('\n'), buttons);
      log('已推送完成消息(带按钮), msg id:', msg?.id);
    } catch (e) {
      log('带按钮推送失败:', e.message);
      // 降级到纯文本
      await discord.send(CH_XIASI, lines.join('\n'));
      log('已推送(纯文本降级)');
    }
  } else {
    await discord.send(CH_XIASI, '✨ **遐思·连珠** · 完成 · 但未产出任何洞察');
  }

  log('梦已推送到 #📜-夜游记');
} catch (e) {
  log('💥 失败:', e);
  await discord.send(CH_XIASI, `🌧️ **遐思·连珠** · 失败: ${e.message}`);
} finally {
  try { await dreamingPi.stop(); } catch {}
  try { await dreamer.shutdown(); } catch {}
  await discord.destroy();
  log('Discord 已登出');
}