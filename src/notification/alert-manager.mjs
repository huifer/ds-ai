// ~/pi-discord-agents/src/notification/alert-manager.mjs
// 告警管理器

/**
 * 告警级别
 */
export const ALERT_LEVELS = {
  CRITICAL: { id: 'critical', label: '严重', emoji: '🚨', color: 0xff0000 },
  ERROR: { id: 'error', label: '错误', emoji: '❌', color: 0xff6600 },
  WARNING: { id: 'warning', label: '警告', emoji: '⚠️', color: 0xffcc00 },
  INFO: { id: 'info', label: '信息', emoji: 'ℹ️', color: 0x0099ff },
};

/**
 * 告警类型
 */
export const ALERT_TYPES = {
  PI_RPC_DISCONNECT: { id: 'pi_rpc_disconnect', label: 'Pi RPC 连接断开' },
  PI_RPC_ERROR: { id: 'pi_rpc_error', label: 'Pi RPC 错误' },
  TASK_FAILED: { id: 'task_failed', label: '任务失败' },
  SCHEDULER_ERROR: { id: 'scheduler_error', label: '调度器错误' },
  MEMORY_ERROR: { id: 'memory_error', label: '记忆系统错误' },
  DISCORD_ERROR: { id: 'discord_error', label: 'Discord 连接错误' },
  PROJECT_ERROR: { id: 'project_error', label: '项目系统错误' },
  SYSTEM_ERROR: { id: 'system_error', label: '系统错误' },
  TOKEN_USAGE_HIGH: { id: 'token_usage_high', label: 'Token 使用过高' },
  STORAGE_FULL: { id: 'storage_full', label: '存储空间不足' },
};

/**
 * 告警管理器
 */
export class AlertManager {
  constructor({ discord, channelId, log = () => {} }) {
    this.discord = discord;
    this.channelId = channelId;
    this.log = log;

    // 告警状态
    this.activeAlerts = new Map(); // alertKey -> { startTime, count }
    this.resolvedAlerts = [];

    // 防抖配置
    this.debounceMs = 60_000;  // 同一告警 60 秒内不重复
    this.maxPerHour = 10;        // 每小时最多 10 条告警
    this.hourlyCount = 0;
    this.hourlyResetTime = Date.now() + 3600_000;
  }

  /**
   * 发送告警
   */
  async alert({ type, level = 'error', title, message, details = null, retryable = false }) {
    // 检查频率限制
    if (!this.checkRateLimit()) {
      this.log(`[alert] 频率限制，跳过告警: ${type}`);
      return { ok: false, reason: 'rate_limited' };
    }

    const typeInfo = ALERT_TYPES[type] || { id: type, label: type };
    const levelInfo = ALERT_LEVELS[level] || ALERT_LEVELS.ERROR;

    // 防抖检查
    const alertKey = `${type}:${level}`;
    const lastAlert = this.activeAlerts.get(alertKey);
    if (lastAlert && Date.now() - lastAlert.startTime < this.debounceMs) {
      lastAlert.count++;
      this.log(`[alert] 防抖跳过: ${type} (count: ${lastAlert.count})`);
      return { ok: false, reason: 'debounced' };
    }

    // 生成告警消息
    const alertMessage = this.generateAlertMessage({
      typeInfo,
      levelInfo,
      title: title || typeInfo.label,
      message,
      details,
      retryable,
    });

    // 发送到告警频道
    try {
      const sent = await this.discord.send(this.channelId, alertMessage);
      
      // 记录告警
      this.activeAlerts.set(alertKey, {
        startTime: Date.now(),
        count: 1,
        message: alertMessage,
      });

      // 增加计数
      this.hourlyCount++;

      this.log(`[alert] 已发送: ${level} - ${type}`);
      return { ok: true, messageId: sent?.id };
    } catch (e) {
      this.log(`[alert] 发送失败: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }

  /**
   * 生成告警消息
   */
  generateAlertMessage({ typeInfo, levelInfo, title, message, details, retryable }) {
    const timestamp = new Date().toLocaleString('zh-CN');

    let content = `${levelInfo.emoji} **${levelInfo.label}告警**: ${title || typeInfo.label}\n\n`;
    
    if (message) {
      content += `**描述**: ${message}\n\n`;
    }

    if (details) {
      content += `**详情**:\n\`\`\`\n${details}\n\`\`\`\n\n`;
    }

    content += `**时间**: ${timestamp}\n`;
    content += `**类型**: ${typeInfo.label}\n`;

    if (retryable) {
      content += `\n_系统正在尝试自动恢复..._`;
    }

    return content;
  }

  /**
   * 检查频率限制
   */
  checkRateLimit() {
    // 重置小时计数
    if (Date.now() > this.hourlyResetTime) {
      this.hourlyCount = 0;
      this.hourlyResetTime = Date.now() + 3600_000;
    }

    return this.hourlyCount < this.maxPerHour;
  }

  /**
   * 解决告警
   */
  resolve(alertKey, message = '已自动恢复') {
    const alert = this.activeAlerts.get(alertKey);
    if (!alert) return;

    const resolved = {
      ...alert,
      key: alertKey,
      resolvedAt: new Date().toISOString(),
      resolvedMessage: message,
    };

    this.resolvedAlerts.push(resolved);
    this.activeAlerts.delete(alertKey);

    // 发送解决通知
    const msg = `✅ **告警已解决**: ${alertKey}\n\n${message}`;
    this.discord.send(this.channelId, msg).catch(() => {});

    this.log(`[alert] 已解决: ${alertKey}`);
  }

  /**
   * 获取活跃告警列表
   */
  getActiveAlerts() {
    const alerts = [];
    for (const [key, alert] of this.activeAlerts.entries()) {
      alerts.push({
        key,
        ...alert,
        duration: Date.now() - alert.startTime,
      });
    }
    return alerts.sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * 获取告警统计
   */
  getStats() {
    return {
      active: this.activeAlerts.size,
      resolved: this.resolvedAlerts.length,
      hourlyCount: this.hourlyCount,
      maxPerHour: this.maxPerHour,
    };
  }

  // ==================== 便捷方法 ====================

  /**
   * Pi RPC 断开连接
   */
  async piRpcDisconnect(error) {
    return await this.alert({
      type: 'pi_rpc_disconnect',
      level: 'critical',
      title: 'Pi RPC 连接断开',
      message: error?.message || 'RPC 连接丢失',
      details: error?.stack,
      retryable: true,
    });
  }

  /**
   * Pi RPC 错误
   */
  async piRpcError(error) {
    return await this.alert({
      type: 'pi_rpc_error',
      level: 'error',
      title: 'Pi RPC 执行错误',
      message: error?.message,
      details: error?.stack,
    });
  }

  /**
   * 任务失败
   */
  async taskFailed(taskId, error) {
    return await this.alert({
      type: 'task_failed',
      level: 'error',
      title: `任务失败: ${taskId}`,
      message: error?.message,
      details: error?.stack,
    });
  }

  /**
   * 调度器错误
   */
  async schedulerError(jobId, error) {
    return await this.alert({
      type: 'scheduler_error',
      level: 'warning',
      title: `调度任务失败: ${jobId}`,
      message: error?.message,
    });
  }

  /**
   * 系统错误
   */
  async systemError(error) {
    return await this.alert({
      type: 'system_error',
      level: 'critical',
      title: '系统错误',
      message: error?.message,
      details: error?.stack,
    });
  }

  /**
   * Token 使用过高
   */
  async tokenUsageHigh(usage) {
    return await this.alert({
      type: 'token_usage_high',
      level: 'warning',
      title: 'Token 使用过高',
      message: `今日使用: ${usage.today?.toLocaleString() || 'N/A'} tokens\n` +
        `阈值: ${usage.threshold?.toLocaleString() || 'N/A'} tokens`,
    });
  }
}
