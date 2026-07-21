// ~/pi-discord-agents/src/workflow/entry-integrator.mjs
// 主入口集成器 - 整合 Project、Settings、Summary 到主入口

import { ProjectIntegrator } from './project-integrator.mjs';
import { SummaryEngine } from './summary-engine.mjs';
import { SettingsManager } from '../user/settings-manager.mjs';
import { INTENT_TYPES } from './intent-classifier.mjs';

/**
 * 主入口消息处理结果
 */
export class EntryIntegrator {
  constructor({ rootDir, discord, log = () => {} }) {
    this.rootDir = rootDir;
    this.discord = discord;
    this.log = log;

    // 初始化组件
    this.projectIntegrator = new ProjectIntegrator({
      rootDir,
      log,
      discord,
    });

    this.settingsManager = new SettingsManager({
      rootDir,
      log,
    });

    this.summaryEngine = new SummaryEngine({ log });

    // 会话上下文
    this.contexts = new Map(); // channelId -> { turnCount, lastSummaryTurn }
  }

  /**
   * 处理用户消息
   * @param {object} msg - Discord 消息
   * @param {object} options - { channelId, threadId, userId }
   * @returns {object} 处理结果
   */
  async handleMessage(msg, options) {
    const { channelId, threadId, userId } = options;
    const text = (msg.content || '').trim();

    // 获取用户设置
    const settings = await this.settingsManager.get(userId);

    // 初始化上下文
    let ctx = this.contexts.get(channelId);
    if (!ctx) {
      ctx = {
        turnCount: 0,
        lastSummaryTurn: 0,
        turns: [],
      };
      this.contexts.set(channelId, ctx);
    }

    // 增加轮数
    ctx.turnCount++;
    ctx.turns.push({
      role: 'user',
      content: text,
      index: ctx.turnCount,
      timestamp: new Date().toISOString(),
    });

    // 1. 处理命令
    if (text.startsWith('!')) {
      return await this.handleCommand(msg, options, settings);
    }

    // 2. 使用 Project Integrator 处理
    const projectResult = await this.projectIntegrator.handleMessage(msg, options);

    // 3. 检查是否需要摘要
    let summary = null;
    if (settings.summary && projectResult?.projectId) {
      const shouldSummarize = this.summaryEngine.shouldSummarize({
        turnCount: ctx.turnCount,
        lastSummaryTurn: ctx.lastSummaryTurn,
        message: text,
      });

      if (shouldSummarize.should) {
        summary = await this.summaryEngine.generateSummary(ctx.turns);
        await this.projectIntegrator.createSubItem(
          this.getSessionKey(channelId, threadId, userId),
          'conversation',
          summary
        );
        ctx.lastSummaryTurn = ctx.turnCount;
      }
    }

    // 4. 构建回复
    const reply = await this.buildReply(msg, {
      projectResult,
      summary,
      settings,
    });

    // 5. 保存 assistant 回复到 turns
    ctx.turns.push({
      role: 'assistant',
      content: reply,
      index: ctx.turnCount,
      timestamp: new Date().toISOString(),
    });

    // 限制 turns 长度
    if (ctx.turns.length > 100) {
      ctx.turns = ctx.turns.slice(-100);
    }

    return {
      reply,
      projectResult,
      summary,
      shouldCreateProject: projectResult.intent?.type === INTENT_TYPES.PROJECT,
    };
  }

  /**
   * 处理命令
   */
  async handleCommand(msg, options, settings) {
    const text = (msg.content || '').trim();
    const { userId } = options;

    // === Project 命令 ===
    if (text === '!project' || text.startsWith('!project ')) {
      return await this.handleProjectCommand(msg, options);
    }

    if (text === '!summary' || text.startsWith('!summary ')) {
      return await this.handleSummaryCommand(msg, options);
    }

    // === 设置命令 ===
    if (text === '!settings' || text.startsWith('!settings ')) {
      return await this.handleSettingsCommand(msg, options);
    }

    if (text === '!quick') {
      await this.settingsManager.applyPreset(userId, 'quick');
      return { reply: '✅ 已切换到极简模式\n\n关闭所有通知和详情，只有核心回复。\n\n恢复: `!normal`' };
    }

    if (text === '!normal' || text === '!reset') {
      await this.settingsManager.applyPreset(userId, 'normal');
      return { reply: '✅ 已恢复默认设置' };
    }

    if (text === '!verbose') {
      await this.settingsManager.applyPreset(userId, 'verbose');
      return { reply: '✅ 已切换到详细模式\n\n开启所有详情。\n\n恢复正常: `!normal`' };
    }

    // 未知的命令，返回 null，让主程序处理
    return null;
  }

  /**
   * 处理 Project 命令
   */
  async handleProjectCommand(msg, options) {
    const text = (msg.content || '').trim();
    const { channelId, threadId, userId } = options;
    const sessionKey = this.getSessionKey(channelId, threadId, userId);

    // !project - 查看当前项目
    if (text === '!project') {
      const card = await this.projectIntegrator.generateProjectCard(sessionKey);
      if (card) {
        return { reply: card };
      }
      return { reply: '当前没有活跃的项目' };
    }

    // !project list - 列出所有项目
    if (text === '!project list') {
      const projects = await this.projectIntegrator.projectManager.listProjects();
      if (projects.length === 0) {
        return { reply: '暂无项目' };
      }

      let reply = '## 📦 项目列表\n\n';
      for (const p of projects.slice(0, 10)) {
        const statusEmoji = { active: '🟢', completed: '🔵', archived: '⚪' }[p.meta.status] || '⚪';
        reply += `${statusEmoji} ${p.title} (${p.meta.status})\n`;
        reply += `   ID: ${p.id}\n`;
        reply += `   更新: ${new Date(p.meta.updatedAt).toLocaleString('zh-CN')}\n\n`;
      }

      return { reply };
    }

    // !project done - 完成项目
    if (text === '!project done') {
      const result = await this.projectIntegrator.completeProject(sessionKey);
      if (result.error) {
        return { reply: `❌ ${result.error}` };
      }
      return { reply: '✅ 项目已标记完成' };
    }

    // !project archive - 归档项目
    if (text === '!project archive') {
      const project = await this.projectIntegrator.getCurrentProject(sessionKey);
      if (!project) {
        return { reply: '❌ 当前没有活跃的项目' };
      }
      await this.projectIntegrator.projectManager.archiveProject(project.id);
      return { reply: '✅ 项目已归档' };
    }

    return null;
  }

  /**
   * 处理摘要命令
   */
  async handleSummaryCommand(msg, options) {
    const { channelId, threadId, userId } = options;
    const sessionKey = this.getSessionKey(channelId, threadId, userId);
    const ctx = this.contexts.get(channelId);

    if (!ctx || ctx.turns.length === 0) {
      return { reply: '暂无对话内容' };
    }

    // 生成摘要
    const summary = await this.summaryEngine.generateSummary(ctx.turns);
    const card = this.summaryEngine.generateSummaryCard(summary);

    // 保存到 Project
    if (ctx.turnCount > 0) {
      await this.projectIntegrator.createSubItem(sessionKey, 'conversation', summary);
      ctx.lastSummaryTurn = ctx.turnCount;
    }

    return { reply: card };
  }

  /**
   * 处理设置命令
   */
  async handleSettingsCommand(msg, options) {
    const { userId } = options;
    const text = (msg.content || '').trim();

    const cmd = text.replace('!settings', '').trim();
    const result = await this.settingsManager.handleSettingsCommand(userId, cmd);

    if (result.type === 'show' || result.type === 'changed') {
      return { reply: result.card || result.message };
    }

    if (result.type === 'error') {
      return { reply: `❌ ${result.message}` };
    }

    if (result.type === 'preset') {
      return { reply: result.card };
    }

    if (result.type === 'show_one') {
      return { reply: result.message };
    }

    return null;
  }

  /**
   * 构建回复
   */
  async buildReply(msg, { projectResult, summary, settings }) {
    let reply = '';

    // 如果创建了 Project，通知用户
    if (projectResult?.action === 'project_created') {
      const card = projectResult.project;
      reply += `📦 **已创建项目**: ${card.title}\n\n`;
      reply += `| 类型 | ${card.type} |\n`;
      reply += `| 状态 | ${card.status} |\n`;
      reply += `| ID | \`${card.id}\` |\n\n`;
      reply += `所有相关对话和产出都会记录到这里。\n\n`;
    }

    // 如果有摘要，显示
    if (summary && settings.summary) {
      reply += `---\n`;
      reply += this.summaryEngine.generateSummaryCard(summary);
    }

    // 如果是查询，显示项目信息
    if (projectResult?.action === 'show_project') {
      const card = projectResult.project;
      reply += `## 📦 ${card.title}\n\n`;
      reply += `状态: ${card.statusEmoji} ${card.status}\n`;
      reply += `对话: ${card.stats.turnCount} 轮\n`;
    }

    return reply || null;
  }

  /**
   * 生成 session key
   */
  getSessionKey(channelId, threadId, userId) {
    return [channelId, threadId, userId].filter(Boolean).join(':');
  }

  /**
   * 获取当前项目
   */
  async getCurrentProject(channelId, threadId, userId) {
    const sessionKey = this.getSessionKey(channelId, threadId, userId);
    return await this.projectIntegrator.getCurrentProject(sessionKey);
  }

  /**
   * 运行归档检查
   */
  async runArchiveCheck() {
    return await this.projectIntegrator.runArchiveCheck();
  }
}
