// ~/pi-discord-agents/scripts/trigger-daily-summary.mjs
// 手动触发每日总结任务

import { runDailySummaryJob } from '../src/jobs/daily-summary.mjs';
import { RpcClient } from '@earendil-works/pi-coding-agent';
import { createDiscordClient } from '../src/discord-client.mjs';
import { loadConfig } from '../src/config.mjs';

const now = new Date();
const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
const tzMs = utcMs + 8 * 3600_000;
const d = new Date(tzMs);
const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

function log(...args) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[daily-summary ${ts}] ${args.join(' ')}`);
}

async function main() {
  log('🌙 手动触发每日总结任务...');
  log(`📅 日期: ${dateKey}`);

  // 加载配置
  const cfgRes = loadConfig();
  if (!cfgRes.ok) {
    log('❌ 配置加载失败:', cfgRes.error);
    process.exit(1);
  }
  const cfg = cfgRes.value;

  // 创建 Discord 客户端
  const discord = createDiscordClient({
    token: cfg.token,
    onMessage: () => {},
  });

  try {
    await discord.login();
    log('✅ Discord 客户端已登录');
  } catch (e) {
    log('❌ Discord 登录失败:', e.message);
    process.exit(1);
  }

  // 创建 Pi RPC 客户端
  const PI_BIN_DIR = '/Users/zhangsan/.nvm/versions/node/v24.15.0/lib/node_modules/@earendil-works/pi-coding-agent';
  const PI_CLI = `${PI_BIN_DIR}/dist/cli.js`;

  const pi = new RpcClient({
    cliPath: PI_CLI,
    cwd: '/Users/zhangsan/pi-discord-agents',
    provider: 'minimax-cn',
    model: 'MiniMax-M3',
    env: {
      DISCORD_TOKEN: cfg.token,
      CH_ENTRY: cfg.channels.entry,
      CH_MEMORY: cfg.channels.memory,
      CH_DAILY: cfg.channels.daily,
    },
  });

  // 等待 Pi ready
  log('⏳ 等待 Pi ready...');
  const startTime = Date.now();
  while (!pi.isReady && Date.now() - startTime < 60000) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!pi.isReady) {
    log('⚠️ Pi 未 ready，尝试强制执行');
  }
  log('✅ Pi RPC 已就绪');

  try {
    await runDailySummaryJob({
      dateKey,
      pi,
      discord,
      log,
    });
    log('✅ 每日总结任务执行完成');
  } catch (e) {
    log('❌ 每日总结任务执行失败:', e.message);
    console.error(e);
  } finally {
    try {
      await discord.destroy();
      if (pi.terminate) {
        await pi.terminate();
      }
      log('✅ 已清理资源');
    } catch (e) {
      log('⚠️ 清理资源时出错:', e.message);
    }
  }

  log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('📊 任务总结');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('✅ 每日总结任务已手动触发');
  log('📂 请检查 #🌙 每日总结 频道');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(e => {
  log('❌ 执行失败:', e.message);
  console.error(e);
  process.exit(1);
});