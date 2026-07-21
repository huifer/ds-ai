// ~/pi-discord-agents/scripts/clear-discord-messages.mjs
// 清理 Discord 所有频道的历史消息

import { Client, GatewayIntentBits } from 'discord.js';
import { loadConfig } from '../src/config.mjs';
import { appendFileSync } from 'node:fs';

function log(...args) {
  const ts = new Date().toISOString().slice(11, 19);
  const msg = `[clear-messages ${ts}] ${args.join(' ')}\n`;
  process.stdout.write(msg);
}

async function clearMessages() {
  log('开始清理 Discord 历史消息...');

  // 加载配置
  const cfgRes = loadConfig();
  if (!cfgRes.ok) {
    console.error('配置加载失败:', cfgRes.error);
    process.exit(1);
  }
  const cfg = cfgRes.value;

  // 创建 Discord 客户端
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  try {
    await client.login(cfg.token);
    log('Discord 客户端已登录');

    // 获取频道 ID 列表
    const channelIds = Object.values(cfg.channels).filter(id => id);

    let totalDeleted = 0;

    for (const channelId of channelIds) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
          log(`⚠️  频道 ${channelId} 不存在，跳过`);
          continue;
        }

        log(`\n📋 开始清理频道: ${channel.name} (${channelId})`);

        let deletedCount = 0;
        let lastId = null;
        let hasMore = true;

        while (hasMore) {
          const fetchOptions = { limit: 100 };
          if (lastId) fetchOptions.before = lastId;

          const messages = await channel.messages.fetch(fetchOptions);
          if (messages.size === 0) {
            hasMore = false;
            break;
          }

          log(`  批量获取到 ${messages.size} 条消息...`);

          // 批量删除（14天内的消息可以批量删除）
          const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
          const recentMessages = [];
          const oldMessages = [];

          for (const [id, msg] of messages) {
            lastId = id;
            if (msg.createdTimestamp > twoWeeksAgo) {
              recentMessages.push(msg);
            } else {
              oldMessages.push(msg);
            }
          }

          // 批量删除14天内的消息
          if (recentMessages.length > 0) {
            try {
              await channel.bulkDelete(recentMessages);
              deletedCount += recentMessages.length;
              totalDeleted += recentMessages.length;
              log(`  ✓ 批量删除了 ${recentMessages.length} 条消息`);
            } catch (e) {
              // 如果批量删除失败，逐条删除
              log(`  ⚠️  批量删除失败，改用逐条删除: ${e.message}`);
              for (const msg of recentMessages) {
                try {
                  await msg.delete();
                  deletedCount++;
                  totalDeleted++;
                  if (deletedCount % 50 === 0) {
                    log(`  已删除 ${deletedCount} 条消息...`);
                    // 添加延迟避免触发速率限制
                    await new Promise(r => setTimeout(r, 1000));
                  }
                } catch (err) {
                  log(`  ✗ 删除消息 ${msg.id} 失败: ${err.message}`);
                }
              }
            }
          }

          // 逐条删除超过14天的消息
          if (oldMessages.length > 0) {
            for (const msg of oldMessages) {
              try {
                await msg.delete();
                deletedCount++;
                totalDeleted++;
                if (deletedCount % 50 === 0) {
                  log(`  已删除 ${deletedCount} 条消息...`);
                  // 添加延迟避免触发速率限制
                  await new Promise(r => setTimeout(r, 1000));
                }
              } catch (err) {
                log(`  ✗ 删除消息 ${msg.id} 失败: ${err.message}`);
              }
            }
          }

          // 添加延迟避免触发速率限制
          await new Promise(r => setTimeout(r, 1000));
        }

        log(`✓ 频道 ${channel.name} 清理完成，共删除 ${deletedCount} 条消息\n`);

      } catch (e) {
        log(`✗ 处理频道 ${channelId} 时出错: ${e.message}`);
      }
    }

    log(`\n🎉 所有频道清理完成！共删除 ${totalDeleted} 条消息`);

  } catch (e) {
    log(`❌ 清理失败: ${e.message}`);
    console.error(e);
  } finally {
    await client.destroy();
    log('Discord 客户端已断开');
    process.exit(0);
  }
}

// 运行
clearMessages().catch(e => {
  log(`致命错误: ${e.message}`);
  console.error(e);
  process.exit(1);
});