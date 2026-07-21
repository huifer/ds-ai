// ~/pi-discord-agents/src/content/content-publisher.mjs
// 内容发布器 - 将内容推送到对应频道

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 内容发布器
 */
export class ContentPublisher {
  constructor({ discord, channels, rootDir, log = () => {} }) {
    this.discord = discord;
    this.channels = channels;  // { wechat, xhs, video, x, newsletter }
    this.rootDir = rootDir;
    this.log = log;
  }

  /**
   * 发布内容到频道
   */
  async publish({ platform, content, title, metadata = {} }) {
    const channelId = this.channels[platform];
    
    if (!channelId) {
      return { ok: false, error: `未配置 ${platform} 频道` };
    }

    try {
      // 生成消息内容
      const message = this.formatForChannel(platform, { title, content, metadata });

      // 发送到频道
      const sent = await this.discord.send(channelId, message);

      // 保存到本地
      const savedPath = await this.saveToLocal(platform, { title, content, metadata });

      this.log(`[publisher] 已发布到 ${platform}: ${title}`);

      return {
        ok: true,
        channelId,
        messageId: sent?.id,
        savedPath,
      };
    } catch (e) {
      this.log(`[publisher] 发布失败: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }

  /**
   * 格式化消息
   */
  formatForChannel(platform, { title, content, metadata }) {
    const timestamp = new Date().toLocaleString('zh-CN');

    switch (platform) {
      case 'wechat':
        return `📝 **${title}**\n\n${content}\n\n---\n_${timestamp}_`;

      case 'xiaohongshu':
        const tags = (metadata.tags || []).map(t => `#${t}`).join(' ');
        return `📕 **${title}**\n\n${content}\n\n${tags}\n\n_${timestamp}_`;

      case 'video':
        const duration = metadata.duration || '未知时长';
        return `🎬 **${title}**\n\n**时长**: ${duration}\n\n${content}\n\n_${timestamp}_`;

      case 'x':
        const hashtags = (metadata.hashtags || []).map(h => `#${h}`).join(' ');
        return `🐦 **${title}**\n\n${content}\n\n${hashtags}`;

      case 'newsletter':
        const author = metadata.author || '杭州 OPC 张三';
        return `📧 **${title}**\n\n_${author} · ${timestamp}_\n\n${content}`;

      default:
        return `**${title}**\n\n${content}`;
    }
  }

  /**
   * 保存到本地
   */
  async saveToLocal(platform, { title, content, metadata }) {
    const platformDir = join(this.rootDir, 'data', 'content', platform);
    
    if (!existsSync(platformDir)) {
      mkdirSync(platformDir, { recursive: true });
    }

    const date = new Date().toISOString().slice(0, 10);
    const safeTitle = title.replace(/[^\w\s\u4e00-\u9fa5]/g, '').slice(0, 30);
    const filename = `${date}-${safeTitle}.md`;
    const filepath = join(platformDir, filename);

    let fileContent = `# ${title}\n\n`;
    fileContent += `**平台**: ${platform}\n`;
    fileContent += `**时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
    
    if (metadata.tags) {
      fileContent += `**标签**: ${metadata.tags.join(', ')}\n`;
    }
    if (metadata.author) {
      fileContent += `**作者**: ${metadata.author}\n`;
    }
    
    fileContent += `\n---\n\n${content}`;

    writeFileSync(filepath, fileContent, 'utf8');
    this.log(`[publisher] 已保存: ${filepath}`);

    return filepath;
  }

  /**
   * 批量发布到多个平台
   */
  async publishAll({ platforms, title, content, metadata = {} }) {
    const results = {};

    for (const platform of platforms) {
      results[platform] = await this.publish({
        platform,
        title,
        content,
        metadata,
      });
    }

    return results;
  }
}
