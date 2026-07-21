// ~/pi-discord-agents/go-to-sleep.mjs
// 我亲自去梦一场。
// 手动触发 lian-zhu 类型,完整的 Light → REM → Deep 管线。
//
// 设计:完全复用 entry-bot 的初始化路径,不走 Discord / scheduler。

// 手动读 .env
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const envText = readFileSync(resolve('.env'), 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const log = (...a) => console.log('[zhangsan-dream]', ...a);
log('🌙 老张要睡了,遐思开始...');

// 必要 env
const proxyVars = {
  HTTP_PROXY: 'http://127.0.0.1:7897',
  HTTPS_PROXY: 'http://127.0.0.1:7897',
  ALL_PROXY: 'socks5://127.0.0.1:7897',
  NO_PROXY: 'localhost,127.0.0.1',
};
for (const [k, v] of Object.entries(proxyVars)) {
  if (!process.env[k]) process.env[k] = v;
}

// 必要模块
const { createMemoryStore } = await import('./src/memory-store.mjs');
const { createEmbedder } = await import('./src/embedder.mjs');
const { createArtifacts, createBudget, createDiary, createDreamingPi, createDreamer, loadXiasiConfig } =
  await import('./src/dreaming/index.mjs');
const { createMemoryJournal } = await import('./src/memory-journal.mjs');

const xc = loadXiasiConfig();
log('config:', { enabled: xc.enabled, channelId: xc.channelId, types: xc.types });

// 不接 discord(避免在 entry-bot 没跑时炸),用 mock
const discord = {
  async send() { log('(no-discord) 推送已跳过'); return null; },
  sendWithButtons: null,
};

const store = await createMemoryStore({ log });
const embedder = await createEmbedder({ log });
const journal = createMemoryJournal({ memoryStore: store, log });
const arts = await createArtifacts({ log });
const budget = createBudget({ dailyLimit: xc.dailyTokenBudget, tzOffsetHours: 8, log });
const diary = createDiary({ log, tzOffsetHours: 8 });

log('启动 dreaming-pi 子进程...');
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
  const r = await dreamer.run({ type: 'lian-zhu', triggeredBy: 'manual-by-zhangsan' });
  log('━━━ 梦做完了 ━━━');
  log('status:', r.status);
  log('durationMs:', r.durationMs);
  log('tokens:', r.tokens);
  log('artifactCount:', r.artifactCount);
  log('top:', r.topTitle);

  // 显示产物列表
  log('');
  log('=== 落定的产物 ===');
  for (const a of r.artifacts) {
    const meta = await arts.get(a);
    log(`  ${a}: ${meta.meta.title} · 评分 ${meta.meta.scores.total} · ${meta.meta.scores.novelty}/${meta.meta.scores.coherence}/${meta.meta.scores.utility}/${meta.meta.scores.grounding}/${meta.meta.scores.surprise}`);
  }

  log('');
  log('梦境已记入 data/dreams/DREAMS.md');
  log('产物已写入 data/dreams/artifacts/lian-zhu/');
  log('🌙 早安。');
} catch (e) {
  console.error('💥 梦做坏了:', e);
  process.exit(1);
} finally {
  try { await dreamingPi.stop(); } catch {}
  try { await dreamer.shutdown(); } catch {}
}
