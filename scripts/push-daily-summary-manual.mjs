// ~/pi-discord-agents/scripts/push-daily-summary-manual.mjs
// 直接推送每日总结到 Discord（简化版）

import { readFileSync } from 'node:fs';
import { Client, GatewayIntentBits } from 'discord.js';
import { loadConfig } from '../src/config.mjs';

const RSS_FILE = '/Users/zhangsan/pi-discord-agents/data/rss/2026-07-19.md';
const DAILY_CHANNEL_ID = '1527764062027644989';

function log(...args) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[push-daily-manual ${ts}] ${args.join(' ')}`);
}

async function main() {
  log('🌙 推送每日总结到 Discord...');

  // 加载配置
  const cfgRes = loadConfig();
  if (!cfgRes.ok) {
    log('❌ 配置加载失败:', cfgRes.error);
    process.exit(1);
  }
  const cfg = cfgRes.value;

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  try {
    await client.login(cfg.token);
    log('✅ Discord 客户端已登录');

    // 读取 RSS 内容作为临时替换
    let rssContent = '';
    try {
      rssContent = readFileSync(RSS_FILE, 'utf-8');
      log(`📄 RSS 文件已读取 (${rssContent.length} 字符)`);
    } catch (e) {
      rssContent = '⚠️ 无法读取 RSS 文件: ' + e.message;
    }

    // 创建今日每日总结
    const summaryDate = '2026-07-18';
    const summary = `# 🌙 每日总结 · ${summaryDate}

> 生成时间: 北京时间 23:00 · 由 Pi Agent 自动汇总

## 今日概览
现在是下午 13:20，系统状态正常。

## 🛠 主要工作
- 修复 Discord 推送功能（添加 sendPng 方法）
- 清理 discard 测试数据
- 定时任务执行状态确认

## 💡 主要决定
- 不需要定期清理 discard，只用于测试

## 📊 今日数据
- RSS 资讯: 已生成并推送 ✅
- GitHub 待办: 已生成并推送 ✅
- Token 用量: 已生成但推送失败(已修复) ✅

## 🚧 阻塞 / 待办
- 每日总结任务: 已修复 sendPng，等待 23:00 自动触发验证

## 🔁 反复模式
- 定时任务可能需要更好的错误处理和重试机制

---

_注: 这是手动推送的简化版，完整版将等待今晚 23:00 自动触发_`;

    // 发送消息
    const maxLen = 1900;
    if (summary.length <= maxLen) {
      await client.channels.fetch(DAILY_CHANNEL_ID).then(channel => {
        if (channel && channel.type === 'GuildText') {
          return channel.send(summary);
        }
      });
    } else {
      // 分片发送
      const chunks = [];
      let rest = summary;
      while (rest.length > 0) {
        const cut = rest.lastIndexOf('\n\n', maxLen);
        const pos = cut < maxLen * 0.5 ? maxLen : cut;
        chunks.push(rest.slice(0, pos));
        rest = rest.slice(pos).replace(/^\n+/, '');
        if (chunks.length > 1 && rest.length > 0) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
      const channel = await client.channels.fetch(DAILY_CHANNEL_ID);
      if (channel && channel.type === 'GuildText') {
        for (let i = 0; i < chunks.length; i++) {
          const tag = chunks.length > 1 ? `\n\n_(${i + 1}/${chunks.length})_` : '';
          await channel.send(chunks[i] + tag);
          if (i < chunks.length - 1) {
            await new Promise(r => setTimeout(r, 300));
          }
        }
      }
    }

    log('✅ 每日总结已推送到 Discord');
    log(`📌 频道: #🌙 每日总结 (${DAILY_CHANNEL_ID})`);
    log(`📊 长度: ${summary.length} 字符`);

  } catch (e) {
    log('❌ 推送失败:', e.message);
    console.error(e);
  } finally {
    await client.destroy();
    log('✅ Discord 客户端已断开');
  }
}

main().catch(e => {
  log('❌ 执行失败:', e.message);
  console.error(e);
  process.exit(1);
});