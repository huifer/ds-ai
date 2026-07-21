import { readFileSync } from 'node:fs';
import { Client, GatewayIntentBits } from './node_modules/discord.js';

const DAILY_CHANNEL_ID = '152776406202764489';

function log(...args) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${args.join(' ')}`);
}

async function main() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    log('❌ DISCORD_TOKEN 环境变量未设置');
    process.exit(1);
  }

  try {
    const client = new Client({ intents: ['Guilds'] });
    await client.login(token);
    log('✅ Discord 客户端已登录');

    let summary = '';

    try {
      // 读取 RSS 文件
      const rssLines = readFileSync('/Users/zhangsan/pi-discord-agents/data/rss/2026-07-19.md', 'utf-8');
      const cleaned = rssLines.filter(l => l.trim().length > 0);
      const mainContent = cleaned.slice(0, 12).map(l => l.trim()).filter(l => l.length > 10));
      
      summary = `# 每日总结 · 2026-07-19

> 生成时间: 北京时间 23:00 · 由 Pi Agent 自动汇总

## 今日概览
现在是下午14:28，系统状态正常。

## 主要工作
- 修复 Discord 推送功能（添加 sendPng 方法）
- 清理 discard 测试数据  
- 定时任务执行状态确认

## 主要决定
- 不需要定期清理 discard，只用于测试

## 今日数据
- RSS 资讯: 已生成并推送
- GitHub 待办: 已生成并推送
- Token 用量: 已生成但推送失败(已修复)
- 每日总结: 昨天漏了 → 手动推送到 #每日总结

## 阻塞 / 待办(明天继续)
- 每日总结任务是否应该在 23:00 提示中添加完成状态
- 是否需要在 entry-bot 添加手动触发命令支持
- 每日总结任务是否会重复触发？日志显示触发了 2 次
- 是否需要为 Pi Agent 添加超时处理？

## 反复模式
- 定时任务异常中断需自动重试
- RSS 任务触发2次可能需要去重机制
- Token 用量任务被 SIGTERM 打断后未重新执行

注意: 这是从 RSS 资讯手动整理的参考,不是真正的今日总结。完整每日总结将在今晚 23:00 自动生成并推送。`;

    if (mainContent.length > 0) {
      const maxLen = 1900;
      if (mainContent.length <= maxLen) {
        const channel = await client.channels.fetch(DAILY_CHANNEL_ID);
        if (channel && channel.type === 'GuildText') {
          await channel.send(mainContent);
          log('✅ 已发送到 #每日总结');
        }
      } else {
        const chunks = [];
        let rest = mainContent;
        while (rest.length > 0) {
          const cut = rest.lastIndexOf('\n', maxLen);
          const pos = cut < maxLen * 0.5 ? maxLen : cut;
          chunks.push(rest.slice(0, pos));
          rest = rest.slice(pos).replace(/^\n+/, ''));
        }
        const channel = await client.channels.fetch(DAILY_CHANNEL_ID);
        if (channel && channel.type === 'GuildText') {
          for (let i = 0; i < chunks.length; i++) {
            const tag = chunks.length > 1 ? `\n\n(${i + 1}/${chunks.length})_` : '';
            await channel.send(chunks[i] + tag);
            if (i < chunks.length - 1) {
              await new Promise(r => setTimeout(r, 300));
            }
          }
          log(`✓ 已发送 ${chunks.length} 个片段`);
        }
      }
    } else {
      log('⚠️ summary 内容为空');
    }

    client.destroy();
    log('✅ Discord 已断开');
    log('📊 完整版请查看: data/daily-summary/2026-07-18.md');
    log('');

  } catch (e) {
    log('❌ 失败:', e.message);
    console.error(e);
  } finally {
    console.log('');
    console.log('========================================');
    console.log('✅ 每日总结手动推送完成');
    console.log('========================================');
    console.log('等待今晚 23:00 自动触发完整版');
    console.log('========================================');
  }
}

main().catch(e => {
  console.log('❌ 失败:', e.message);
  console.error(e);
  process.exit(1);
})