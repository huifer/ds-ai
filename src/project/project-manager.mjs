// ~/pi-discord-agents/src/project/project-manager.mjs
// Project 管理器

import { ProjectStore, generateProjectId, generateSubItemId } from './project-store.mjs';

/**
 * Project 类型定义
 */
export const PROJECT_TYPES = {
  tech: {
    label: '技术开发',
    description: '代码开发、系统搭建、技术调研',
    subTypes: ['web-app', 'api', 'bot', 'script', 'research', 'architecture'],
  },
  sales: {
    label: '销售机会',
    description: '客户需求、商机跟进',
    subTypes: ['lead', 'opportunity', 'proposal'],
  },
  content: {
    label: '内容创作',
    description: '文章、笔记、视频、推文',
    subTypes: ['article', 'video', 'social', 'newsletter'],
  },
  delivery: {
    label: '项目交付',
    description: 'FDE 客户交付、项目实施',
    subTypes: ['poc', 'implementation', 'training', 'support'],
  },
};

/**
 * 子项类型定义
 */
export const SUB_ITEM_TYPES = {
  conversation: {
    label: '对话摘要',
    pluralLabel: '对话摘要',
  },
  document: {
    label: '文档产出',
    pluralLabel: '文档',
  },
  decision: {
    label: '关键决策',
    pluralLabel: '决策',
  },
  task: {
    label: '任务清单',
    pluralLabel: '任务',
  },
  code: {
    label: '代码产出',
    pluralLabel: '代码',
  },
  comment: {
    label: '评审反馈',
    pluralLabel: '反馈',
  },
  asset: {
    label: '资产引用',
    pluralLabel: '资产',
  },
  note: {
    label: '备注',
    pluralLabel: '备注',
  },
};

/**
 * Project 管理器
 */
export class ProjectManager {
  constructor({ rootDir, log = () => {} }) {
    this.store = new ProjectStore({ rootDir });
    this.log = log;
  }

  /**
   * 创建 Project
   */
  async createProject(params) {
    const {
      title,
      type,
      subType = null,
      threadId = null,
      sessionId = null,
      createdBy = 'ai',
      meta = {},
    } = params;

    // 生成 ID
    const id = generateProjectId();

    // 构建 Project 结构
    const project = {
      id,
      title,
      type,
      
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy,
        status: 'active',
        subType,
        ...meta,
      },
      
      links: {
        threadId,
        sessionId,
        parentProject: meta.parentProject || null,
      },
      
      stats: {
        turnCount: 0,
        summaryCount: 0,
        documentCount: 0,
        taskTotal: 0,
        taskDone: 0,
      },
      
      subItems: [],
    };

    await this.store.create(project);
    this.log(`[project] Created: ${id} - ${title}`);

    return project;
  }

  /**
   * 获取 Project
   */
  async getProject(id) {
    return await this.store.get(id);
  }

  /**
   * 获取当前活跃的 Project（按 thread 或 session）
   */
  async getActiveProject({ threadId, sessionId }) {
    const projects = await this.store.list({ status: 'active' });
    
    for (const p of projects) {
      if (threadId && p.links?.threadId === threadId) return p;
      if (sessionId && p.links?.sessionId === sessionId) return p;
    }
    
    return null;
  }

  /**
   * 更新 Project
   */
  async updateProject(id, updates) {
    const updated = await this.store.update(id, updates);
    this.log(`[project] Updated: ${id}`);
    return updated;
  }

  /**
   * 更新统计
   */
  async incrementStat(id, statName, delta = 1) {
    const project = await this.getProject(id);
    if (!project) return null;

    const current = project.stats?.[statName] ?? 0;
    return await this.updateProject(id, {
      stats: {
        ...project.stats,
        [statName]: current + delta,
      },
    });
  }

  /**
   * 更新状态
   */
  async setStatus(id, status) {
    return await this.updateProject(id, {
      meta: { status },
    });
  }

  /**
   * 列出 Projects
   */
  async listProjects(filters = {}) {
    return await this.store.list(filters);
  }

  /**
   * 归档 Project
   */
  async archiveProject(id, reason = 'manual') {
    return await this.updateProject(id, {
      meta: {
        status: 'archived',
        archivedAt: new Date().toISOString(),
        archiveReason: reason,
      },
    });
  }

  /**
   * 标记完成
   */
  async completeProject(id) {
    return await this.setStatus(id, 'completed');
  }

  /**
   * 删除 Project
   */
  async deleteProject(id) {
    return await this.store.delete(id);
  }

  // ==================== 子项操作 ====================

  /**
   * 创建子项
   */
  async createSubItem(projectId, params) {
    const {
      type,
      content,
      aiGenerated = false,
      createdBy = 'ai',
    } = params;

    const id = generateSubItemId(type);

    const item = {
      id,
      type,
      content,
      aiGenerated,
      createdBy,
    };

    await this.store.createSubItem(projectId, item);
    
    // 更新 Project 统计
    await this.incrementStat(projectId, `${type}Count`, 1);
    
    // 如果是 task，增加 taskTotal
    if (type === 'task') {
      const project = await this.getProject(projectId);
      await this.updateProject(projectId, {
        stats: {
          ...project.stats,
          taskTotal: (project.stats.taskTotal ?? 0) + 1,
        },
      });
    }

    this.log(`[project] Created subItem: ${id} in ${projectId}`);

    return item;
  }

  /**
   * 获取子项
   */
  async getSubItem(projectId, itemId) {
    return await this.store.getSubItem(projectId, itemId);
  }

  /**
   * 更新子项
   */
  async updateSubItem(projectId, itemId, updates) {
    const updated = await this.store.updateSubItem(projectId, itemId, updates);
    this.log(`[project] Updated subItem: ${itemId}`);
    return updated;
  }

  /**
   * 删除子项
   */
  async deleteSubItem(projectId, itemId) {
    const item = await this.getSubItem(projectId, itemId);
    if (!item) return false;

    const deleted = await this.store.deleteSubItem(projectId, itemId);
    
    if (deleted) {
      // 更新统计
      await this.incrementStat(projectId, `${item.type}Count`, -1);
      
      if (item.type === 'task' && item.content?.status === 'completed') {
        const project = await this.getProject(projectId);
        await this.updateProject(projectId, {
          stats: {
            ...project.stats,
            taskDone: Math.max(0, (project.stats.taskDone ?? 1) - 1),
          },
        });
      }
    }

    return deleted;
  }

  /**
   * 列出子项
   */
  async listSubItems(projectId, filters = {}) {
    return await this.store.listSubItems(projectId, filters);
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(projectId, taskId, status) {
    const task = await this.getSubItem(projectId, taskId);
    if (!task || task.type !== 'task') {
      throw new Error(`Task ${taskId} not found`);
    }

    const wasCompleted = task.content?.status === 'completed';
    const isCompleted = status === 'completed';

    const updated = await this.updateSubItem(projectId, taskId, {
      content: {
        ...task.content,
        status,
        completedAt: isCompleted ? new Date().toISOString() : null,
      },
    });

    // 更新 taskDone 统计
    if (!wasCompleted && isCompleted) {
      const project = await this.getProject(projectId);
      await this.updateProject(projectId, {
        stats: {
          ...project.stats,
          taskDone: (project.stats.taskDone ?? 0) + 1,
        },
      });
    } else if (wasCompleted && !isCompleted) {
      const project = await this.getProject(projectId);
      await this.updateProject(projectId, {
        stats: {
          ...project.stats,
          taskDone: Math.max(0, (project.stats.taskDone ?? 1) - 1),
        },
      });
    }

    return updated;
  }

  /**
   * 创建对话摘要
   */
  async createConversation(projectId, params) {
    const {
      summary,
      keyPoints = [],
      decisions = [],
      pending = [],
      nextAction = '',
      turns = {},
    } = params;

    return await this.createSubItem(projectId, {
      type: 'conversation',
      content: {
        summary,
        keyPoints,
        decisions,
        pending,
        nextAction,
        turns,
      },
    });
  }

  /**
   * 创建文档子项
   */
  async createDocument(projectId, params) {
    const {
      title,
      path,
      docType = 'markdown',
      summary = '',
      status = 'draft',
    } = params;

    return await this.createSubItem(projectId, {
      type: 'document',
      content: {
        title,
        path,
        type: docType,
        summary,
        status,
      },
    });
  }

  /**
   * 创建任务
   */
  async createTask(projectId, params) {
    const {
      title,
      description = '',
      assignee = 'ai',
      priority = 'medium',
      dueAt = null,
    } = params;

    return await this.createSubItem(projectId, {
      type: 'task',
      content: {
        title,
        description,
        status: 'pending',
        assignee,
        priority,
        dueAt,
        completedAt: null,
      },
    });
  }

  /**
   * 创建决策
   */
  async createDecision(projectId, params) {
    const {
      decision,
      reason = [],
      alternatives = [],
      tradeoffs = [],
      decidedBy = 'user',
    } = params;

    return await this.createSubItem(projectId, {
      type: 'decision',
      content: {
        decision,
        reason,
        alternatives,
        tradeoffs,
        decidedBy,
        status: 'proposed',
      },
    });
  }

  // ==================== 辅助方法 ====================

  /**
   * 生成 Project 卡片（用于 Discord 展示）
   */
  generateProjectCard(project) {
    const { id, title, type, meta, stats } = project;
    const typeInfo = PROJECT_TYPES[type] || { label: type };
    
    const statusEmoji = {
      active: '🟢',
      completed: '🔵',
      archived: '⚪',
      blocked: '🟡',
    }[meta.status] || '⚪';

    const taskProgress = stats.taskTotal > 0 
      ? `${stats.taskDone}/${stats.taskTotal}` 
      : '-';

    return {
      id,
      title,
      type: typeInfo.label,
      status: meta.status,
      statusEmoji,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      stats: {
        ...stats,
        taskProgress,
      },
    };
  }

  /**
   * 生成子项列表（用于 Discord 展示）
   */
  generateSubItemsList(projectId, filters = {}) {
    // 这个方法需要配合 Discord 格式化
    return async () => {
      const items = await this.listSubItems(projectId, filters);
      return items;
    };
  }

  /**
   * 检查归档条件
   */
  async checkArchiveConditions() {
    const projects = await this.listProjects({ status: 'active' });
    const now = Date.now();
    const ARCHIVE_DAYS = 30;
    const ARCHIVE_MS = ARCHIVE_DAYS * 24 * 60 * 60 * 1000;

    const toArchive = [];
    for (const p of projects) {
      const updatedAt = new Date(p.meta.updatedAt).getTime();
      if (now - updatedAt > ARCHIVE_MS) {
        toArchive.push({
          id: p.id,
          title: p.title,
          daysSinceUpdate: Math.floor((now - updatedAt) / (24 * 60 * 60 * 1000)),
        });
      }
    }

    return toArchive;
  }

  /**
   * 自动归档过期项目
   */
  async autoArchive() {
    const toArchive = await this.checkArchiveConditions();
    const results = [];

    for (const { id, title, daysSinceUpdate } of toArchive) {
      await this.archiveProject(id, `auto: ${daysSinceUpdate}天无活动`);
      results.push({ id, title, daysSinceUpdate });
      this.log(`[project] Auto archived: ${id} (${daysSinceUpdate} days)`);
    }

    return results;
  }
}
