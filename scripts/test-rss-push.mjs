// ~/pi-discord-agents/scripts/test-rss-push.mjs
// 手动测试 RSS 推送到 Discord

import { Client, GatewayIntentBits } from 'discord.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');
const RSS_FILE = `${ROOT}/data/rss/2026-07-19.md`;
const RSS_CHANNEL_ID = '1527764058709954672';

function log(...args) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[test-rss-push ${ts}] ${args.join(' ')}`);
}

async function main() {
  log('🚀 测试 RSS 推送到 Discord...');

  // 读取 RSS 文件
  let rssContent;
  try {
    rssContent = readFileSync(RSS_FILE, 'utf-8');
    log(`📄 RSS 文件已读取 (${rssContent.length} 字符)`);
  } catch (e) {
    log('❌ RSS 文件读取失败:', e.message);
    process.exit(1);
  }

  // Discord 客户端
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  try {
    // 加载配置
    const envContent = readFileSync(`${ROOT}/.env`, 'utf-8');
    const tokenMatch = envContent.match(/DISCORD_TOKEN=([^\n]+)/);
    if (!tokenMatch) {
      log('❌ 找不到 DISCORD_TOKEN');
      process.exit(1);
    }
    const token = tokenMatch[1].trim();

    await client.login(token);
    log('✅ Discord 客户端已登录');

    // 获取 RSS 频道
    const channel = await client.channels.fetch(RSS_CHANNEL_ID);
    if (!channel) {
      log('❌ 无法获取 RSS 频道');
      process.exit(1);
    }
    log(`📌 RSS 频道: #${channel.name}`);

    // 发送 RSS 内容
    log('📤 开始发送 RSS 内容...');
    const content = `📰 **【RSS 资讯日报 · 2026-07-19】**

${rssContent}`;

    if (content.length > 1900) {
      log(`⚠️  内容过长 (${content.length} 字符)，需要分片发送`);
      const chunks = [];
      let rest = content;
      while (rest.length > 0) {
        if (rest.length <= 1900) {
          chunks.push(rest);
          break;
        }
        const cut = rest.lastIndexOf('\n\n', 1900);
        const pos = cut < 950 ? 1900 : cut;
        chunks.push(rest.slice(0, pos));
        rest = rest.slice(pos).replace(/^\n+/, '');
      }

      for (let i = 0; i < chunks.length; i++) {
        const tag = chunks.length > 1 ? `\n\n_(${i + 1}/${chunks.length})_` : '';
        await channel.send(chunks[i] + tag);
        log(`✓ 已发送片段 ${i + 1}/${chunks.length}`);
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
    } else {
      const message = await channel.send(content);
      log(`✅ 已发送完整内容: ${message.id}`);
    }

    log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('✅ RSS 推送测试成功！');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (e) {
    log('❌ 测试失败:', e.message);
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