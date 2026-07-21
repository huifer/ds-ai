// ~/pi-discord-agents/src/content/content-renderer.mjs
// 内容渲染器 - 各平台内容模板和渲染

/**
 * 平台定义
 */
export const PLATFORMS = {
  WECHAT: {
    id: 'wechat',
    name: '公众号',
    icon: '📝',
    maxTitle: 64,
    maxContent: 20000,
    hasCover: true,
    hasSummary: true,
  },
  XHS: {
    id: 'xiaohongshu',
    name: '小红书',
    icon: '📕',
    maxTitle: 20,
    maxContent: 1000,
    hasCover: true,
    hasSummary: false,
    tags: true,
    maxTags: 10,
  },
  VIDEO: {
    id: 'video',
    name: '视频号',
    icon: '🎬',
    hasScript: true,
    hasDuration: true,
  },
  X: {
    id: 'x',
    name: 'X/Twitter',
    icon: '🐦',
    maxContent: 280,
    hasThread: true,
    maxThread: 25,
  },
  NEWSLETTER: {
    id: 'newsletter',
    name: 'Newsletter',
    icon: '📧',
    hasSections: true,
  },
};

/**
 * 内容渲染器
 */
export class ContentRenderer {
  constructor({ log = () => {} }) {
    this.log = log;
  }

  /**
   * 渲染内容
   */
  async render({ platform, title, content, metadata = {} }) {
    const platformInfo = PLATFORMS[platform.toUpperCase()] || PLATFORMS.WECHAT;
    
    switch (platform.toLowerCase()) {
      case 'wechat':
      case 'weixin':
        return this.renderWechat({ title, content, metadata });
      
      case 'xiaohongshu':
      case 'xhs':
        return this.renderXHS({ title, content, metadata });
      
      case 'video':
      case 'videostar':
        return this.renderVideo({ title, content, metadata });
      
      case 'x':
      case 'twitter':
        return this.renderX({ title, content, metadata });
      
      case 'newsletter':
        return this.renderNewsletter({ title, content, metadata });
      
      default:
        return this.renderGeneric({ title, content, metadata });
    }
  }

  /**
   * 渲染公众号内容
   */
  renderWechat({ title, content, metadata }) {
    const cover = metadata.cover || '';
    const summary = metadata.summary || content.slice(0, 120) + '...';
    const author = metadata.author || '杭州 OPC 张三';

    return {
      platform: 'wechat',
      files: {
        markdown: this.generateMarkdown({ title, content, author }),
        preview: this.generateWechatPreview({ title, summary, cover }),
      },
      meta: {
        title,
        summary,
        cover,
        author,
        wordCount: content.length,
      },
    };
  }

  /**
   * 渲染小红书内容
   */
  renderXHS({ title, content, metadata }) {
    const cover = metadata.cover || '';
    const tags = metadata.tags || [];

    // 小红书格式：标题 + 正文 + 标签
    let formattedContent = `**${title}**\n\n${content}`;

    // 添加标签
    if (tags.length > 0) {
      formattedContent += '\n\n';
      formattedContent += tags.map(t => `#${t}`).join(' ');
    }

    return {
      platform: 'xiaohongshu',
      files: {
        markdown: formattedContent,
        preview: this.generateXHSPreview({ title, content, cover, tags }),
      },
      meta: {
        title,
        content: formattedContent,
        cover,
        tags,
        wordCount: content.length,
      },
    };
  }

  /**
   * 渲染视频号内容
   */
  renderVideo({ title, content, metadata }) {
    const script = content;
    const duration = metadata.duration || '3-5分钟';
    const outline = metadata.outline || [];
    
    // 生成脚本格式
    let scriptContent = `# ${title}\n\n`;
    scriptContent += `**时长**: ${duration}\n\n`;
    
    if (outline.length > 0) {
      scriptContent += `## 大纲\n`;
      outline.forEach((point, i) => {
        scriptContent += `${i + 1}. ${point}\n`;
      });
      scriptContent += '\n';
    }
    
    scriptContent += `## 完整脚本\n\n${script}`;

    return {
      platform: 'video',
      files: {
        markdown: scriptContent,
        outline: outline.join('\n'),
      },
      meta: {
        title,
        duration,
        outline,
        wordCount: script.length,
      },
    };
  }

  /**
   * 渲染 X/Twitter 内容
   */
  renderX({ title, content, metadata }) {
    const isThread = metadata.isThread || content.length > 280;
    const thread = metadata.thread || [];

    if (isThread && thread.length > 0) {
      // 线程格式
      const threads = thread.map((t, i) => 
        `${i + 1}/${thread.length}\n\n${t}`
      ).join('\n\n---\n\n');

      return {
        platform: 'x',
        files: {
          markdown: threads,
        },
        meta: {
          title,
          isThread: true,
          threadLength: thread.length,
        },
      };
    }

    // 单条推文
    const truncated = content.length > 280 ? content.slice(0, 277) + '...' : content;
    const hashtags = metadata.hashtags || [];

    let tweet = truncated;
    if (hashtags.length > 0) {
      tweet += '\n\n' + hashtags.map(h => `#${h}`).join(' ');
    }

    return {
      platform: 'x',
      files: {
        markdown: tweet,
      },
      meta: {
        title,
        content: tweet,
        hashtags,
        charCount: tweet.length,
      },
    };
  }

  /**
   * 渲染 Newsletter
   */
  renderNewsletter({ title, content, metadata }) {
    const sections = metadata.sections || [];
    const cta = metadata.cta || '欢迎关注我们';
    const author = metadata.author || '杭州 OPC 张三';

    let newsletter = `# ${title}\n\n`;
    newsletter += `*By ${author}*\n\n`;
    newsletter += `---\n\n`;

    // 添加章节
    if (sections.length > 0) {
      for (const section of sections) {
        newsletter += `## ${section.title}\n\n`;
        newsletter += `${section.content}\n\n`;
      }
    } else {
      newsletter += content + '\n\n';
    }

    newsletter += `---\n\n`;
    newsletter += `${cta}\n`;

    return {
      platform: 'newsletter',
      files: {
        markdown: newsletter,
      },
      meta: {
        title,
        sections,
        cta,
        author,
        wordCount: newsletter.length,
      },
    };
  }

  /**
   * 通用格式
   */
  renderGeneric({ title, content, metadata }) {
    return {
      platform: 'generic',
      files: {
        markdown: `# ${title}\n\n${content}`,
      },
      meta: {
        title,
        content,
        ...metadata,
      },
    };
  }

  /**
   * 生成 Markdown 文件
   */
  generateMarkdown({ title, content, author }) {
    const date = new Date().toLocaleDateString('zh-CN');
    return `# ${title}\n\n*${author} · ${date}*\n\n---\n\n${content}\n`;
  }

  /**
   * 生成公众号预览
   */
  generateWechatPreview({ title, summary, cover }) {
    return {
      type: 'wechat_preview',
      title,
      summary,
      cover,
      date: new Date().toLocaleDateString('zh-CN'),
    };
  }

  /**
   * 生成小红书预览
   */
  generateXHSPreview({ title, content, cover, tags }) {
    return {
      type: 'xiaohongshu_preview',
      title,
      content,
      cover,
      tags,
      date: new Date().toLocaleDateString('zh-CN'),
    };
  }

  /**
   * 从内容生成建议
   */
  suggestTags(content) {
    const tags = [];
    
    // 常见标签
    const tagPatterns = [
      { pattern: /AI|人工智能|ChatGPT|Agent|GPT/g, tag: 'AI' },
      { pattern: /开发|编程|代码|程序员/g, tag: '编程' },
      { pattern: /创业|商业|赚钱/g, tag: '创业' },
      { pattern: /效率|工具|软件/g, tag: '效率工具' },
      { pattern: /个人成长|学习/g, tag: '自我提升' },
    ];

    for (const { pattern, tag } of tagPatterns) {
      if (pattern.test(content) && !tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags.slice(0, 5);
  }

  /**
   * 从内容生成推文线程
   */
  suggestThread(content) {
    // 简单分割：按段落或句子
    const paragraphs = content.split(/\n\n+/);
    const thread = [];
    let currentTweet = '';

    for (const para of paragraphs) {
      if (currentTweet.length + para.length + 2 <= 270) {
        currentTweet += (currentTweet ? '\n\n' : '') + para;
      } else {
        if (currentTweet) thread.push(currentTweet);
        currentTweet = para.slice(0, 270);
      }
    }

    if (currentTweet) thread.push(currentTweet);

    return thread.slice(0, 25); // X 限制 25 条
  }
}
