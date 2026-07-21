// ~/pi-discord-agents/test-xiasi-discord.mjs
// 验证 Discord 推送链路:直接调 dreamer,看 #📜-夜游记 有没有消息。

import { createDiscordClient } from './src/discord-client.mjs';
import { loadConfig } from './src/config.mjs';
import { createArtifacts, createBudget, loadXiasiConfig } from './src/dreaming/index.mjs';
import { createDreamer } from './src/dreaming/dreamer.mjs';
import { createMemoryStore } from './src/memory-store.mjs';

const log = (...a) => console.log('[discord-test]', ...a);

async function main() {
  const cfgRes = loadConfig();
  if (!cfgRes.ok) throw new Error('config fail: ' + cfgRes.error);
  const cfg = cfgRes.value;

  const discord = createDiscordClient({
    token: cfg.token,
    onMessage: () => {},
  });
  await discord.login();
  await new Promise(r => setTimeout(r, 1500));

  log(`Discord ready · target #📜-夜游记 = ${cfg.channels.xiasi}`);

  const xc = loadXiasiConfig();
  const arts = await createArtifacts({ log });
  const budget = createBudget({ dailyLimit: xc.dailyTokenBudget, tzOffsetHours: 8, log });
  const store = await createMemoryStore({ log });

  const dreamer = await createDreamer({
    cfg: { dreaming: { ...xc, channelId: cfg.channels.xiasi }, channels: cfg.channels },
    dreamingPi: null,  // PR2 测试,REM 会失败但 light/deep 跑
    discord,
    memoryStore: store,
    journal: null,
    embedder: null,
    artifacts: arts,
    budget,
    log,
  });

  // 跑 lian-zhu,REM 因为 null pi 会失败 → status=failed → 推 🌧️ 通知
  const r1 = await dreamer.run({ type: 'lian-zhu', triggeredBy: 'manual' });
  log('run1:', JSON.stringify(r1));

  // status 走正常路径
  const s = await dreamer.status({ limit: 5 });
  log('status:', JSON.stringify(s, null, 2));

  await discord.destroy();
  log('✅ Discord 推送链路验证完成,请检查 #📜-夜游记');
}

main().catch(e => { console.error('❌', e); process.exit(1); });