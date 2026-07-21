// ~/pi-discord-agents/src/file/file-commands.mjs
// 文件命令处理器

import { FileSearcher, FILE_TYPES } from './file-searcher.mjs';

/**
 * 文件命令处理器
 */
export class FileCommands {
  constructor({ rootDir, log = () => {} }) {
    this.searcher = new FileSearcher({ rootDir, log });
    this.log = log;
  }

  /**
   * 处理文件命令
   */
  async handleCommand(text, userId = 'default-user') {
    const trimmed = text.trim();
    
    // !files <关键词>
    if (trimmed.startsWith('!files')) {
      return await this.handleSearch(trimmed.slice(6).trim());
    }

    // !file <文件名>
    if (trimmed.startsWith('!file')) {
      return await this.handleDetail(trimmed.slice(6).trim());
    }

    // !recent [类型]
    if (trimmed.startsWith('!recent')) {
      return await this.handleRecent(trimmed.slice(7).trim());
    }

    // !types - 列出支持的文件类型
    if (trimmed === '!types' || trimmed === '!filetypes') {
      return this.handleListTypes();
    }

    return null;
  }

  /**
   * 处理搜索
   */
  async handleSearch(text) {
    if (!text) {
      return {
        reply: '🔍 **文件搜索**\n\n用法:\n• `!files <关键词>` - 搜索文件\n• `!files <关键词> -type <类型>` - 按类型筛选\n• `!recent` - 最近文件\n• `!types` - 支持的文件类型',
      };
    }

    // 解析选项
    const options = this.parseOptions(text);
    const query = options._.join(' ');
    
    if (!query) {
      return { reply: '请输入搜索关键词' };
    }

    const results = await this.searcher.search(query, {
      type: options.type || null,
      extension: options.ext || null,
      maxResults: parseInt(options.limit) || 20,
      includeContent: options.content === 'true',
    });

    return {
      reply: this.searcher.generateResultCard(results, query),
    };
  }

  /**
   * 处理详情
   */
  async handleDetail(text) {
    if (!text) {
      return { reply: '请输入文件名' };
    }

    const results = await this.searcher.search(text, {
      maxResults: 1,
    });

    if (results.length === 0) {
      return { reply: `未找到文件: ${text}` };
    }

    return {
      reply: this.searcher.generateDetailCard(results[0]),
    };
  }

  /**
   * 处理最近文件
   */
  async handleRecent(text) {
    const type = text || null;
    
    const results = await this.searcher.listRecent(type, 10);

    if (results.length === 0) {
      return {
        reply: '📁 **最近文件**\n\n最近 30 天内没有文件更新。',
      };
    }

    let card = '📁 **最近文件** (30天内)\n\n';

    for (const file of results) {
      const age = this.formatAge(file.age);
      card += `${file.icon} **${file.name}**\n`;
      card += `   ${age} | ${file.sizeFormatted} | ${file.typeLabel}\n`;
      card += `   📁 ${file.relativePath}\n\n`;
    }

    card += `\n---\n`;
    card += `_使用 \`!files <关键词>\` 搜索文件_`;

    return { reply: card };
  }

  /**
   * 列出支持的类型
   */
  handleListTypes() {
    
    let card = '📋 **支持的文件类型**\n\n';

    const typeIcons = {
      document: '📄',
      spreadsheet: '📊',
      image: '🖼️',
      video: '🎬',
      audio: '🎵',
      code: '💻',
      archive: '📦',
      design: '🎨',
    };

    const typeNames = {
      document: '文档',
      spreadsheet: '表格',
      image: '图片',
      video: '视频',
      audio: '音频',
      code: '代码',
      archive: '压缩包',
      design: '设计稿',
    };

    for (const [key, info] of Object.entries(FILE_TYPES)) {
      card += `${info.icon} **${typeNames[key] || info.label}**\n`;
      card += `   \`${info.extensions.join(' ')}\`\n\n`;
    }

    card += `\n---\n`;
    card += `_使用 \`!recent document\` 查看最近文档_\n`;

    return { reply: card };
  }

  /**
   * 解析命令选项
   */
  parseOptions(text) {
    const options = { _: [] };
    const parts = text.split(/\s+/);
    
    for (const part of parts) {
      if (part.startsWith('-')) {
        const [key, value] = part.slice(1).split(':');
        options[key] = value || true;
      } else {
        options._.push(part);
      }
    }

    return options;
  }

  /**
   * 格式化时间差
   */
  formatAge(ms) {
    const minutes = Math.floor(ms / (60 * 1000));
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
  }
}
