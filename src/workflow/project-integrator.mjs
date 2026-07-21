// ~/pi-discord-agents/src/workflow/project-integrator.mjs
// Project 集成器 - 将 Project 系统集成到主入口

import { ProjectManager, PROJECT_TYPES } from '../project/project-manager.mjs';
import { IntentClassifier, INTENT_TYPES } from './intent-classifier.mjs';
import { SummaryEngine } from './summary-engine.mjs';

/**
 * Project 集成器
 * 负责：
 * 1. 意图分类
 * 2. Project 创建/获取
 * 3. 对话摘要
 * 4. 子项创建
 */
export class ProjectIntegrator {
  constructor({ rootDir, log = () => {}, discord = null }) {
    this.log = log;
    this.discord = discord;
    
    // 初始化组件
    this.projectManager = new ProjectManager({ rootDir, log });
    this.intentClassifier = new IntentClassifier({ log });
    this.summaryEngine = new SummaryEngine({ log });

    // 会话状态
    this.sessionState = new Map(); // sessionKey -> { turnCount, lastSummaryTurn, activeProjectId }
  }

  /**
   * 处理用户消息
   * @param {object} msg - Discord 消息对象
   * @param {object} options - { channelId, threadId, userId }
   * @returns {object} 处理结果
   */
  async handleMessage(msg, options = {}) {
    const { channelId, threadId, userId } = options;
    const text = msg.content || '';
    
    // 生成 session key
    const sessionKey = this.getSessionKey(channelId, threadId, userId);
    
    // 获取或初始化会话状态
    let state = this.sessionState.get(sessionKey);
    if (!state) {
      state = {
        turnCount: 0,
        lastSummaryTurn: 0,
        activeProjectId: null,
        turns: [],
      };
      this.sessionState.set(sessionKey, state);
    }

    // 增加轮数
    state.turnCount++;
    state.turns.push({
      role: 'user',
      content: text,
      index: state.turnCount,
      timestamp: new Date().toISOString(),
    });

    // 1. 意图分类
    const intent = await this.intentClassifier.classify(text, {
      turnCount: state.turnCount,
    });

    this.log(`[project-integrator] Intent: ${intent.type}, reason: ${intent.reason}`);

    // 2. 根据意图处理
    let result = {
      intent,
      action: 'reply', // 默认直接回复
    };

    if (intent.type === INTENT_TYPES.PROJECT) {
      // 需要创建或获取 Project
      const projectResult = await this.handleProjectIntent(
        text,
        intent,
        { channelId, threadId, userId, sessionKey },
        state
      );
      result = { ...result, ...projectResult };
    } else if (intent.type === INTENT_TYPES.APPROVAL) {
      // 需要审批
      result.action = 'approval';
    } else if (intent.type === INTENT_TYPES.QUERY) {
      // 查询类
      const queryResult = await this.handleQueryIntent(
        text,
        { channelId, threadId, userId, sessionKey },
        state
      );
      result = { ...result, ...queryResult };
    }

    // 3. 检查是否需要摘要
    const shouldSummarize = this.summaryEngine.shouldSummarize({
      turnCount: state.turnCount,
      lastSummaryTurn: state.lastSummaryTurn,
      message: text,
    });

    if (shouldSummarize.should && state.activeProjectId) {
      // 生成摘要
      const summary = await this.summaryEngine.generateSummary(state.turns);
      
      // 保存到 Project
      await this.projectManager.createConversation(state.activeProjectId, summary);

      // 更新状态
      state.lastSummaryTurn = state.turnCount;

      result.summary = summary;
      this.log(`[project-integrator] Summary created: ${state.activeProjectId}`);
    }

    // 4. 保存 assistant 回复到 turns
    // 注意：这个需要在实际回复后调用 saveAssistantTurn

    return result;
  }

  /**
   * 保存 assistant 回复
   */
  async saveAssistantTurn(sessionKey, content) {
    const state = this.sessionState.get(sessionKey);
    if (!state) return;

    state.turns.push({
      role: 'assistant',
      content,
      index: state.turnCount,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 处理 Project 相关意图
   */
  async handleProjectIntent(text, intent, options, state) {
    const { channelId, threadId, userId } = options;

    // 检查是否已有活跃 Project
    let project = state.activeProjectId 
      ? await this.projectManager.getProject(state.activeProjectId)
      : null;

    // 如果没有活跃 Project，创建新的
    if (!project) {
      const title = await this.intentClassifier.generateTitle(text, intent.projectType);
      
      project = await this.projectManager.createProject({
        title,
        type: intent.projectType,
        threadId,
        sessionId: this.getSessionKey(channelId, null, userId),
        createdBy: 'user',
      });

      state.activeProjectId = project.id;

      // 创建初始对话摘要
      await this.projectManager.createConversation(project.id, {
        summary: text.slice(0, 200),
        keyPoints: [],
        decisions: [],
        pending: [],
        nextAction: '等待进一步沟通',
        turns: { start: 1, end: 1, count: 1 },
      });

      this.log(`[project-integrator] Created project: ${project.id}`);

      return {
        action: 'project_created',
        project: this.projectManager.generateProjectCard(project),
        projectId: project.id,
      };
    }

    // 有活跃 Project，更新统计
    await this.projectManager.incrementStat(project.id, 'turnCount');

    return {
      action: 'project_updated',
      project: this.projectManager.generateProjectCard(project),
      projectId: project.id,
    };
  }

  /**
   * 处理查询意图
   */
  async handleQueryIntent(text, options, state) {
    const lowerText = text.toLowerCase();

    // 查看当前项目
    if (lowerText.includes('当前项目') || lowerText.includes('这个项目')) {
      if (state.activeProjectId) {
        const project = await this.projectManager.getProject(state.activeProjectId);
        if (project) {
          return {
            action: 'show_project',
            project: this.projectManager.generateProjectCard(project),
          };
        }
      }
      return {
        action: 'no_active_project',
        message: '当前没有活跃的项目',
      };
    }

    // 列出所有项目
    if (lowerText.includes('项目列表') || lowerText.includes('所有项目')) {
      const projects = await this.projectManager.listProjects();
      return {
        action: 'list_projects',
        projects: projects.map(p => this.projectManager.generateProjectCard(p)),
      };
    }

    return { action: 'query_handled' };
  }

  /**
   * 创建子项
   */
  async createSubItem(sessionKey, type, content) {
    const state = this.sessionState.get(sessionKey);
    if (!state?.activeProjectId) {
      return { error: 'No active project' };
    }

    const item = await this.projectManager.createSubItem(state.activeProjectId, {
      type,
      content,
    });

    return { item, projectId: state.activeProjectId };
  }

  /**
   * 创建任务
   */
  async createTask(sessionKey, title, options = {}) {
    const state = this.sessionState.get(sessionKey);
    if (!state?.activeProjectId) {
      return { error: 'No active project' };
    }

    const task = await this.projectManager.createTask(state.activeProjectId, {
      title,
      ...options,
    });

    return { task, projectId: state.activeProjectId };
  }

  /**
   * 完成项目
   */
  async completeProject(sessionKey) {
    const state = this.sessionState.get(sessionKey);
    if (!state?.activeProjectId) {
      return { error: 'No active project' };
    }

    const project = await this.projectManager.completeProject(state.activeProjectId);
    state.activeProjectId = null;

    return { project };
  }

  /**
   * 生成 session key
   */
  getSessionKey(channelId, threadId, userId) {
    return [channelId, threadId, userId].filter(Boolean).join(':');
  }

  /**
   * 获取当前 Project
   */
  async getCurrentProject(sessionKey) {
    const state = this.sessionState.get(sessionKey);
    if (!state?.activeProjectId) return null;
    return await this.projectManager.getProject(state.activeProjectId);
  }

  /**
   * 生成项目卡片（Discord 格式）
   */
  async generateProjectCard(sessionKey) {
    const project = await this.getCurrentProject(sessionKey);
    if (!project) return null;

    const card = this.projectManager.generateProjectCard(project);
    
    const typeInfo = PROJECT_TYPES[project.type] || { label: project.type };
    const statusEmoji = card.statusEmoji;

    let message = `## ${statusEmoji} 当前项目: ${card.title}\n\n`;
    message += `| 属性 | 值 |\n`;
    message += `|------|-----|\n`;
    message += `| 类型 | ${typeInfo.label} |\n`;
    message += `| 状态 | ${card.status} |\n`;
    message += `| 创建 | ${new Date(card.createdAt).toLocaleString('zh-CN')} |\n`;
    message += `| 对话 | ${card.stats.turnCount} 轮 |\n`;
    message += `| 任务 | ${card.stats.taskProgress} |\n`;

    return message;
  }

  /**
   * 运行归档检查
   */
  async runArchiveCheck() {
    const results = await this.projectManager.autoArchive();
    this.log(`[project-integrator] Archived ${results.length} projects`);
    return results;
  }
}
