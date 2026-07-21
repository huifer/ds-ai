// ~/pi-discord-agents/src/user/settings-manager.mjs
// 用户设置管理器

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 默认设置
 */
export const DEFAULT_SETTINGS = {
  // 进度与日志
  progress: true,          // 显示任务进度条
  logs: false,             // 显示详细日志
  
  // 内容控制
  summary: true,           // 自动生成对话摘要
  archive_auto: true,      // 自动归档
  
  // 通知控制
  approval_push: true,      // 审批推送
  daily_summary: true,     // 每日摘要
  reminder: true,           // 任务提醒
  alert: true,             // 系统告警
  
  // 内容发布
  content_render: true,    // 内容渲染预览
  content_auto_queue: false, // 自动加入发布队列
};

/**
 * 设置项元数据
 */
export const SETTING_META = {
  progress: {
    label: '进度条',
    labelEn: 'progress',
    description: '显示任务执行进度',
    example: '⏳ [3/5] 正在处理...',
  },
  logs: {
    label: '详细日志',
    labelEn: 'logs',
    description: '显示 AI 执行步骤',
    example: '📝 执行: npm install',
  },
  summary: {
    label: '对话摘要',
    labelEn: 'summary',
    description: '自动生成对话摘要',
  },
  archive_auto: {
    label: '自动归档',
    labelEn: 'archive',
    description: '30天无活动自动归档',
  },
  approval_push: {
    label: '审批推送',
    labelEn: 'approval',
    description: '推送审批内容到 #审批',
  },
  daily_summary: {
    label: '每日摘要',
    labelEn: 'daily',
    description: '每日推送工作摘要',
  },
  reminder: {
    label: '任务提醒',
    labelEn: 'reminder',
    description: '推送任务到期提醒',
  },
  alert: {
    label: '系统告警',
    labelEn: 'alert',
    description: '推送系统异常',
  },
  content_render: {
    label: '内容渲染',
    labelEn: 'render',
    description: '自动渲染内容预览',
  },
  content_auto_queue: {
    label: '自动发布',
    labelEn: 'auto-publish',
    description: '自动加入发布队列',
  },
};

/**
 * 预设模式
 */
export const PRESET_MODES = {
  quick: {
    label: '极简模式',
    settings: {
      progress: false,
      logs: false,
      summary: true,
      archive_auto: true,
      approval_push: false,
      daily_summary: false,
      reminder: false,
      alert: true,
      content_render: true,
      content_auto_queue: false,
    },
  },
  normal: {
    label: '正常模式',
    settings: { ...DEFAULT_SETTINGS },
  },
  verbose: {
    label: '详细模式',
    settings: {
      progress: true,
      logs: true,
      summary: true,
      archive_auto: true,
      approval_push: true,
      daily_summary: true,
      reminder: true,
      alert: true,
      content_render: true,
      content_auto_queue: false,
    },
  },
};

/**
 * 设置管理器
 */
export class SettingsManager {
  constructor({ rootDir, log = () => {} }) {
    this.rootDir = rootDir ?? join(__dirname, '../../data/users');
    this.log = log;
    this.cache = new Map(); // userId -> settings
  }

  /**
   * 获取设置目录
   */
  getUserDir(userId) {
    const dir = join(this.rootDir, userId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * 获取设置文件路径
   */
  getSettingsPath(userId) {
    return join(this.getUserDir(userId), 'settings.json');
  }

  /**
   * 获取用户设置
   */
  async get(userId) {
    // 先检查缓存
    if (this.cache.has(userId)) {
      return { ...this.cache.get(userId) };
    }

    const path = this.getSettingsPath(userId);
    if (!existsSync(path)) {
      // 返回默认设置
      const settings = { ...DEFAULT_SETTINGS };
      this.cache.set(userId, settings);
      return settings;
    }

    try {
      const content = readFileSync(path, 'utf8');
      const stored = JSON.parse(content);
      // 合并默认设置（防止新增设置项缺失）
      const settings = { ...DEFAULT_SETTINGS, ...stored };
      this.cache.set(userId, settings);
      return settings;
    } catch (e) {
      this.log(`[settings] Failed to load settings for ${userId}: ${e.message}`);
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * 保存用户设置
   */
  async set(userId, key, value) {
    const settings = await this.get(userId);
    
    // 检查是否是有效设置项
    if (!(key in DEFAULT_SETTINGS)) {
      throw new Error(`Invalid setting: ${key}`);
    }

    settings[key] = value;
    
    // 保存到文件
    const path = this.getSettingsPath(userId);
    writeFileSync(path, JSON.stringify(settings, null, 2), 'utf8');
    
    // 更新缓存
    this.cache.set(userId, settings);
    
    this.log(`[settings] ${userId} set ${key}=${value}`);
    return settings;
  }

  /**
   * 批量设置
   */
  async setMany(userId, updates) {
    const settings = await this.get(userId);
    
    for (const [key, value] of Object.entries(updates)) {
      if (key in DEFAULT_SETTINGS) {
        settings[key] = value;
      }
    }

    const path = this.getSettingsPath(userId);
    writeFileSync(path, JSON.stringify(settings, null, 2), 'utf8');
    this.cache.set(userId, settings);

    return settings;
  }

  /**
   * 重置为默认
   */
  async reset(userId) {
    return await this.setMany(userId, DEFAULT_SETTINGS);
  }

  /**
   * 应用预设模式
   */
  async applyPreset(userId, presetName) {
    const preset = PRESET_MODES[presetName];
    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}`);
    }

    return await this.setMany(userId, preset.settings);
  }

  /**
   * 检查设置值
   */
  async isEnabled(userId, key) {
    const settings = await this.get(userId);
    return settings[key] === true;
  }

  /**
   * 生成设置卡片（Discord 格式）
   */
  async generateSettingsCard(userId) {
    const settings = await this.get(userId);

    let card = '## 📊 当前设置\n\n';
    card += '| 设置项 | 状态 | 说明 |\n';
    card += '|--------|------|------|\n';

    for (const [key, meta] of Object.entries(SETTING_META)) {
      const value = settings[key];
      const status = value ? '✅' : '❌';
      card += `| ${meta.label} | ${status} | ${meta.description} |\n`;
    }

    card += '\n';
    card += '**修改设置**: `!settings <项> on/off`\n';
    card += '**预设模式**: `!quick` | `!normal` | `!verbose`\n';
    card += '**重置**: `!reset`\n';

    return card;
  }

  /**
   * 处理设置命令
   */
  async handleSettingsCommand(userId, text) {
    const parts = text.trim().split(/\s+/);
    // 注意: text 已经不包含 "!settings" 前缀
    const subCommand = parts[0]?.toLowerCase();
    const arg = parts[1]?.toLowerCase();

    // 无参数 - 显示设置
    if (!subCommand || subCommand === 'list') {
      return {
        type: 'show',
        card: await this.generateSettingsCard(userId),
      };
    }

    // 预设模式
    if (subCommand === 'quick') {
      await this.applyPreset(userId, 'quick');
      return {
        type: 'preset',
        preset: 'quick',
        card: '✅ 已切换到极简模式\n\n关闭所有通知和详情，只有核心回复。\n\n恢复: `!normal`',
      };
    }

    if (subCommand === 'normal' || subCommand === 'reset') {
      await this.applyPreset(userId, 'normal');
      return {
        type: 'preset',
        preset: 'normal',
        card: '✅ 已恢复默认设置',
      };
    }

    if (subCommand === 'verbose') {
      await this.applyPreset(userId, 'verbose');
      return {
        type: 'preset',
        preset: 'verbose',
        card: '✅ 已切换到详细模式\n\n开启所有详情。\n\n恢复正常: `!normal`',
      };
    }

    // 单项设置
    const settingKey = this.findSettingKey(subCommand);
    if (!settingKey) {
      return {
        type: 'error',
        message: `未知设置项: ${subCommand}\n\n可用: ${Object.keys(SETTING_META).join(', ')}`,
      };
    }

    if (!arg || (arg !== 'on' && arg !== 'off')) {
      const meta = SETTING_META[settingKey];
      const current = (await this.get(userId))[settingKey];
      return {
        type: 'show_one',
        key: settingKey,
        label: meta.label,
        current: current ? '✅ 已开启' : '❌ 已关闭',
        message: `${meta.label}: ${current ? '✅' : '❌'}\n\n修改: !settings ${subCommand} on/off`,
      };
    }

    const value = arg === 'on';
    await this.set(userId, settingKey, value);
    const meta = SETTING_META[settingKey];

    return {
      type: 'changed',
      key: settingKey,
      value,
      card: `✅ ${meta.label}已${value ? '开启' : '关闭'}`,
    };
  }

  /**
   * 查找设置项 key（支持中文别名）
   */
  findSettingKey(input) {
    // 直接匹配
    if (input in DEFAULT_SETTINGS) {
      return input;
    }

    // 中文别名
    const aliasMap = {
      '进度': 'progress',
      '日志': 'logs',
      '摘要': 'summary',
      '归档': 'archive_auto',
      '审批': 'approval_push',
      '每日': 'daily_summary',
      '提醒': 'reminder',
      '告警': 'alert',
      '渲染': 'content_render',
      '自动发布': 'content_auto_queue',
    };

    return aliasMap[input] || null;
  }
}
