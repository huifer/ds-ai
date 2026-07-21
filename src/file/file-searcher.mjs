// ~/pi-discord-agents/src/file/file-searcher.mjs
// 本地文件搜索引擎

import { readdir, stat, readFile } from 'node:fs/promises';
import { join, extname, basename, dirname } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * 文件类型定义
 */
export const FILE_TYPES = {
  document: {
    extensions: ['.md', '.txt', '.doc', '.docx', '.pdf', '.rtf'],
    icon: '📄',
    label: '文档',
  },
  spreadsheet: {
    extensions: ['.xlsx', '.xls', '.csv'],
    icon: '📊',
    label: '表格',
  },
  image: {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'],
    icon: '🖼️',
    label: '图片',
  },
  video: {
    extensions: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
    icon: '🎬',
    label: '视频',
  },
  audio: {
    extensions: ['.mp3', '.wav', '.flac', '.aac', '.ogg'],
    icon: '🎵',
    label: '音频',
  },
  code: {
    extensions: ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.mjs', '.html', '.css', '.json', '.yaml', '.yml', '.toml'],
    icon: '💻',
    label: '代码',
  },
  archive: {
    extensions: ['.zip', '.rar', '.7z', '.tar', '.gz'],
    icon: '📦',
    label: '压缩包',
  },
  design: {
    extensions: ['.fig', '.sketch', '.psd', '.ai'],
    icon: '🎨',
    label: '设计稿',
  },
};

/**
 * 本地文件搜索引擎
 */
export class FileSearcher {
  constructor({ rootDir, log = () => {} }) {
    this.rootDir = rootDir;
    this.log = log;
    
    // 可搜索的目录配置
    this.searchDirs = [
      { path: join(rootDir, 'data', 'projects'), label: '项目文件', recursive: true },
      { path: join(rootDir, 'data', 'content'), label: '内容文件', recursive: true },
      { path: join(rootDir, 'docs'), label: '文档', recursive: true },
      { path: join(rootDir, 'scripts'), label: '脚本', recursive: true },
    ];
  }

  /**
   * 添加搜索目录
   */
  addSearchDir(path, label, recursive = true) {
    this.searchDirs.push({ path, label, recursive });
  }

  /**
   * 搜索文件
   */
  async search(query, options = {}) {
    const {
      type = null,           // 文件类型筛选
      extension = null,      // 扩展名筛选
      maxResults = 20,       // 最大结果数
      includeContent = false, // 是否搜索文件内容
    } = options;

    const results = [];
    const queryLower = query.toLowerCase();

    // 遍历搜索目录
    for (const dir of this.searchDirs) {
      if (!existsSync(dir.path)) continue;

      try {
        const files = await this.walkDir(dir.path, dir.recursive);
        
        for (const file of files) {
          // 文件名匹配
          const fileName = basename(file).toLowerCase();
          const fileExt = extname(file).toLowerCase();
          
          let matched = false;
          let matchReason = '';

          // 文件名包含关键词
          if (fileName.includes(queryLower)) {
            matched = true;
            matchReason = '文件名匹配';
          }

          // 类型筛选
          if (type && !matched) {
            const typeInfo = FILE_TYPES[type];
            if (typeInfo && typeInfo.extensions.includes(fileExt)) {
              matched = true;
              matchReason = `类型: ${typeInfo.label}`;
            }
          }

          // 扩展名筛选
          if (extension && !matched) {
            if (fileExt === `.${extension.toLowerCase()}`) {
              matched = true;
              matchReason = `扩展名: ${extension}`;
            }
          }

          // 内容搜索（仅文本文件）
          if (includeContent && !matched && this.isTextFile(file)) {
            try {
              const content = await readFile(file, 'utf8');
              if (content.includes(query)) {
                matched = true;
                matchReason = '内容匹配';
              }
            } catch (e) {
              // 忽略读取错误
            }
          }

          if (matched) {
            const fileInfo = await this.getFileInfo(file, dir.label);
            results.push({
              ...fileInfo,
              matchReason,
            });
          }

          // 达到最大结果数
          if (results.length >= maxResults) break;
        }
      } catch (e) {
        this.log(`[file-search] 搜索目录失败: ${dir.path} - ${e.message}`);
      }

      if (results.length >= maxResults) break;
    }

    return results.slice(0, maxResults);
  }

  /**
   * 遍历目录获取所有文件
   */
  async walkDir(dir, recursive = true) {
    const files = [];
    
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isFile()) {
          files.push(fullPath);
        } else if (entry.isDirectory() && recursive) {
          // 排除隐藏目录和 node_modules
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const subFiles = await this.walkDir(fullPath, true);
            files.push(...subFiles);
          }
        }
      }
    } catch (e) {
      this.log(`[file-search] 遍历失败: ${dir} - ${e.message}`);
    }

    return files;
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(filePath, sourceLabel = '文件') {
    try {
      const stats = await stat(filePath);
      const fileName = basename(filePath);
      const fileExt = extname(filePath).toLowerCase();
      const dirName = basename(dirname(filePath));

      // 获取文件类型
      let fileType = 'other';
      let typeInfo = null;
      
      for (const [type, info] of Object.entries(FILE_TYPES)) {
        if (info.extensions.includes(fileExt)) {
          fileType = type;
          typeInfo = info;
          break;
        }
      }

      return {
        name: fileName,
        path: filePath,
        relativePath: filePath.replace(this.rootDir, ''),
        extension: fileExt,
        size: stats.size,
        sizeFormatted: this.formatSize(stats.size),
        modifiedAt: stats.mtime.toISOString(),
        modifiedAtFormatted: stats.mtime.toLocaleString('zh-CN'),
        type: fileType,
        icon: typeInfo?.icon || '📁',
        typeLabel: typeInfo?.label || '其他',
        source: sourceLabel,
        dir: dirName,
      };
    } catch (e) {
      return {
        name: basename(filePath),
        path: filePath,
        error: e.message,
      };
    }
  }

  /**
   * 格式化文件大小
   */
  formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  /**
   * 判断是否为文本文件
   */
  isTextFile(filePath) {
    const ext = extname(filePath).toLowerCase();
    const textExtensions = ['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.html', '.css', '.js', '.ts', '.mjs', '.py', '.java', '.c', '.cpp', '.go', '.rs', '.sh', '.bash'];
    return textExtensions.includes(ext);
  }

  /**
   * 生成搜索结果卡片
   */
  generateResultCard(results, query) {
    if (results.length === 0) {
      return `🔍 **搜索结果**: \`${query}\`\n\n未找到相关文件。\n\n提示：\n• 尝试更通用的关键词\n• 使用 \`!files <关键词> -type <类型>\` 筛选类型\n• 类型可选: document, spreadsheet, image, video, audio, code`;
    }

    let card = `🔍 **搜索结果**: \`${query}\`\n\n`;
    card += `找到 **${results.length}** 个相关文件:\n\n`;

    for (const file of results) {
      const size = file.sizeFormatted || '未知';
      card += `${file.icon} **${file.name}**\n`;
      card += `   ${file.matchReason} | ${size} | ${file.typeLabel}\n`;
      card += `   📁 ${file.relativePath}\n\n`;
    }

    card += `\n---\n`;
    card += `_使用 \`!file <文件名>\` 获取完整路径_\n`;

    return card;
  }

  /**
   * 生成文件详情卡片
   */
  generateDetailCard(fileInfo) {
    let card = `${fileInfo.icon} **${fileInfo.name}**\n\n`;
    card += `**路径**: \`${fileInfo.relativePath}\`\n\n`;
    card += `| 属性 | 值 |\n|--------|-----|\n`;
    card += `| 类型 | ${fileInfo.typeLabel} |\n`;
    card += `| 大小 | ${fileInfo.sizeFormatted} |\n`;
    card += `| 修改 | ${fileInfo.modifiedAtFormatted} |\n`;
    card += `| 来源 | ${fileInfo.source} |\n`;

    return card;
  }

  /**
   * 按类型列出最近文件
   */
  async listRecent(type = null, limit = 10) {
    const results = [];
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30天内

    for (const dir of this.searchDirs) {
      if (!existsSync(dir.path)) continue;

      try {
        const files = await this.walkDir(dir.path, dir.recursive);
        
        for (const file of files) {
          const fileExt = extname(file).toLowerCase();
          
          // 类型筛选
          if (type) {
            const typeInfo = FILE_TYPES[type];
            if (!typeInfo || !typeInfo.extensions.includes(fileExt)) {
              continue;
            }
          }

          const stats = await stat(file);
          const age = now - stats.mtime.getTime();
          
          if (age <= maxAge) {
            const fileInfo = await this.getFileInfo(file, dir.label);
            fileInfo.age = age;
            results.push(fileInfo);
          }
        }
      } catch (e) {
        // 忽略
      }
    }

    // 按修改时间排序
    results.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));

    return results.slice(0, limit);
  }
}
