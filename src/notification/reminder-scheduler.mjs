// ~/pi-discord-agents/src/notification/reminder-scheduler.mjs
// 提醒调度器

/**
 * 提醒类型
 */
export const REMINDER_TYPES = {
  TASK_DUE: { id: 'task_due', label: '任务到期', icon: '⏰' },
  PROJECT_INACTIVE: { id: 'project_inactive', label: '项目沉寂', icon: '📌' },
  DAILY_SUMMARY: { id: 'daily_summary', label: '每日总结', icon: '📊' },
  WEEKLY_SUMMARY: { id: 'weekly_summary', label: '每周总结', icon: '📅' },
  CUSTOMER_FOLLOWUP: { id: 'customer_followup', label: '客户跟进', icon: '👤' },
  PAYMENT_DUE: { id: 'payment_due', label: '付款到期', icon: '💰' },
};

/**
 * 提醒调度器
 */
export class ReminderScheduler {
  constructor({ discord, channelId, projectManager, settingsManager, log = () => {} }) {
    this.discord = discord;
    this.channelId = channelId;
    this.projectManager = projectManager;
    this.settingsManager = settingsManager;
    this.log = log;

    // 缓存提醒状态
    this.sentReminders = new Map(); // key -> lastSent timestamp
  }

  /**
   * 检查并发送提醒
   */
  async checkAndSend(userId) {
    // 检查用户设置
    if (this.settingsManager) {
      const reminderEnabled = await this.settingsManager.isEnabled(userId, 'reminder');
      const dailyEnabled = await this.settingsManager.isEnabled(userId, 'daily_summary');
      
      if (!reminderEnabled && !dailyEnabled) {
        return { sent: 0 };
      }

      // 发送每日摘要
      if (dailyEnabled) {
        await this.sendDailySummary();
      }
    }

    // 检查项目沉寂
    await this.checkProjectInactivity();

    // 检查任务到期
    await this.checkTaskDue();

    return { sent: this.sentReminders.size };
  }

  /**
   * 发送每日摘要
   */
  async sendDailySummary() {
    const today = new Date().toISOString().slice(0, 10);
    const key = `daily_summary:${today}`;
    
    // 避免重复发送
    if (this.sentReminders.has(key)) return;

    try {
      // 获取今天的项目活动
      const projects = await this.projectManager?.listProjects() || [];
      const todayProjects = projects.filter(p => {
        const updated = new Date(p.meta?.updatedAt).toISOString().slice(0, 10);
        return updated === today;
      });

      // 获取活跃项目数
      const activeProjects = projects.filter(p => p.meta?.status === 'active');
      
      // 生成摘要
      const summary = await this.generateDailySummary({
        todayProjects,
        activeProjects,
        totalProjects: projects.length,
      });

      // 发送到频道
      await this.discord.send(this.channelId, summary);
      
      this.sentReminders.set(key, Date.now());
      this.log(`[reminder] 每日摘要已发送`);

      return { ok: true };
    } catch (e) {
      this.log(`[reminder] 每日摘要发送失败: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }

  /**
   * 生成每日摘要内容
   */
  async generateDailySummary({ todayProjects, activeProjects, totalProjects }) {
    const today = new Date().toLocaleDateString('zh-CN');
    
    let content = `## 📊 每日工作摘要\n\n`;
    content += `**日期**: ${today}\n\n`;
    
    // 活跃项目
    content += `### 🟢 进行中项目 (${activeProjects.length})\n`;
    if (activeProjects.length === 0) {
      content += '_暂无进行中的项目_\n';
    } else {
      for (const p of activeProjects.slice(0, 5)) {
        const progress = p.stats?.taskTotal > 0 
          ? `${p.stats.taskDone}/${p.stats.taskTotal}` 
          : '-';
        content += `• **${p.title}** (${progress} 任务)\n`;
      }
      if (activeProjects.length > 5) {
        content += `_还有 ${activeProjects.length - 5} 个项目..._\n`;
      }
    }
    content += '\n';

    // 今日更新
    content += `### 📝 今日更新 (${todayProjects.length})\n`;
    if (todayProjects.length === 0) {
      content += '_今日暂无更新_\n';
    } else {
      for (const p of todayProjects.slice(0, 3)) {
        content += `• ${p.title}\n`;
      }
    }
    content += '\n';

    // 统计
    content += `### 📈 统计\n`;
    content += `| 指标 | 数量 |\n|--------|--------|\n`;
    content += `| 总项目 | ${totalProjects} |\n`;
    content += `| 进行中 | ${activeProjects.length} |\n`;
    content += `| 今日更新 | ${todayProjects.length} |\n`;

    return content;
  }

  /**
   * 检查项目沉寂
   */
  async checkProjectInactivity() {
    const projects = await this.projectManager?.listProjects({ status: 'active' }) || [];
    const now = Date.now();
    const WARNING_DAYS = 7;  // 7天无活动警告
    const WARNING_MS = WARNING_DAYS * 24 * 60 * 60 * 1000;

    for (const project of projects) {
      const updatedAt = new Date(project.meta?.updatedAt).getTime();
      const daysSince = (now - updatedAt) / (24 * 60 * 60 * 1000);
      
      const key = `inactive_warning:${project.id}`;
      
      // 只在第 7 天发送一次警告
      if (daysSince >= WARNING_DAYS && daysSince < WARNING_DAYS + 1) {
        if (!this.sentReminders.has(key)) {
          const msg = `📌 **项目沉寂提醒**\n\n` +
            `项目 **${project.title}** 已 ${Math.floor(daysSince)} 天无活动。\n\n` +
            `如需继续，请回复继续。\n` +
            `如需归档，请说 **归档**。`;
          
          await this.discord.send(this.channelId, msg);
          this.sentReminders.set(key, now);
        }
      }
    }
  }

  /**
   * 检查任务到期
   */
  async checkTaskDue() {
    const projects = await this.projectManager?.listProjects({ status: 'active' }) || [];
    
    for (const project of projects) {
      const tasks = await this.projectManager?.listSubItems(project.id, { type: 'task' }) || [];
      
      for (const task of tasks) {
        if (task.content?.status !== 'pending') continue;
        
        const dueAt = task.content?.dueAt;
        if (!dueAt) continue;

        const dueDate = new Date(dueAt);
        const now = new Date();
        const daysUntil = Math.floor((dueDate - now) / (24 * 60 * 60 * 1000));
        
        // 只在到期前 1 天和当天发送
        if (daysUntil < 0 || daysUntil > 1) continue;
        
        const key = `task_due:${task.id}`;
        if (this.sentReminders.has(key)) continue;

        const urgency = daysUntil === 0 ? '🔴' : '🟡';
        const msg = `${urgency} **任务到期提醒**\n\n` +
          `项目: ${project.title}\n` +
          `任务: ${task.content.title}\n` +
          `截止: ${dueDate.toLocaleDateString('zh-CN')}\n\n` +
          `${daysUntil === 0 ? '⚠️ 今天到期！' : `还有 ${daysUntil} 天`}`;

        await this.discord.send(this.channelId, msg);
        this.sentReminders.set(key, Date.now());
      }
    }
  }

  /**
   * 发送自定义提醒
   */
  async sendReminder({ type, title, content, urgent = false }) {
    const typeInfo = REMINDER_TYPES[type] || { icon: '📋' };
    const emoji = urgent ? '🔴' : typeInfo.icon;

    const msg = `## ${emoji} ${title}\n\n${content}`;
    
    try {
      await this.discord.send(this.channelId, msg);
      this.log(`[reminder] 自定义提醒已发送: ${title}`);
      return { ok: true };
    } catch (e) {
      this.log(`[reminder] 发送失败: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }

  /**
   * 清理过期缓存
   */
  cleanup() {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    
    for (const [key, timestamp] of this.sentReminders.entries()) {
      if (now - timestamp > DAY_MS) {
        this.sentReminders.delete(key);
      }
    }
  }
}
