// ~/pi-discord-agents/src/runtime/session/session-key.mjs
// 多层 Session Key 管理器
//
// 设计:
//   - 支持 6 个维度: channel, user, project, task, intent, agent
//   - 使用 :: 分隔便于阅读
//   - 提供层级查询和比较方法

/**
 * Intent Type 枚举
 */
export const INTENT_TYPES = {
  // 闲聊/探索
  CHAT: 'chat',             // 日常聊天
  EXPLORE: 'explore',        // 探索性讨论
  
  // 任务执行
  TASK: 'task',             // 任务执行
  CODE_REVIEW: 'review',     // 代码评审
  BUG_FIX: 'bug',           // Bug修复
  
  // 信息查询
  QUERY: 'query',           // 信息查询
  SEARCH: 'search',          // 搜索
  
  // 决策
  DECISION: 'decision',      // 决策讨论
  BRAINSTORM: 'brainstorm',  // 头脑风暴
  
  // 协作
  COLLABORATE: 'collab',    // 协作
  RESPONSE: 'response',      // 响应评审
};

/**
 * Intent 识别规则
 */
const INTENT_RULES = [
  // 任务执行
  { pattern: /^(帮我|给我|帮我看看|看看这个|review|pr |代码评审)/i, type: INTENT_TYPES.CODE_REVIEW },
  { pattern: /^(bug|报错|崩溃|修复|fix)/i, type: INTENT_TYPES.BUG_FIX },
  { pattern: /^(任务|做|完成|执行)/, type: INTENT_TYPES.TASK },
  
  // 信息查询
  { pattern: /^(怎么|如何|什么|哪个|哪里)/, type: INTENT_TYPES.QUERY },
  { pattern: /^(搜|查找|找一下)/, type: INTENT_TYPES.SEARCH },
  
  // 决策
  { pattern: /^(决定|选哪个|哪个好|比较)/, type: INTENT_TYPES.DECISION },
  { pattern: /^(头脑风暴|想想|有什么想法)/, type: INTENT_TYPES.BRAINSTORM },
  
  // 闲聊
  { pattern: /^(聊聊|随便说|你好|hi|hello)/i, type: INTENT_TYPES.CHAT },
];

/**
 * SessionKey 类
 */
export class SessionKey {
  /**
   * 构建 Session Key
   * @param {Object} params
   * @param {string} params.channelId - 频道 ID
   * @param {string} params.userId - 用户 ID
   * @param {string} [params.projectId] - 项目 ID
   * @param {string} [params.taskId] - 任务 ID
   * @param {string} [params.intentType] - 意图类型
   * @param {string} [params.agentId] - Agent ID
   */
  static build({
    channelId,
    userId,
    projectId = null,
    taskId = null,
    intentType = null,
    agentId = null,
  }) {
    const parts = [`ch:${channelId}`, `u:${userId}`];
    
    if (projectId) parts.push(`p:${projectId}`);
    if (taskId) parts.push(`t:${taskId}`);
    if (intentType) parts.push(`i:${intentType}`);
    if (agentId) parts.push(`a:${agentId}`);
    
    return parts.join('::');
  }
  
  /**
   * 解析 Session Key
   * @param {string} key
   * @returns {Object} 解析后的各维度
   */
  static parse(key) {
    if (!key) return {};
    
    const result = {};
    const parts = key.split('::');
    
    for (const part of parts) {
      const [prefix, value] = part.split(':');
      switch (prefix) {
        case 'ch': result.channelId = value; break;
        case 'u': result.userId = value; break;
        case 'p': result.projectId = value; break;
        case 't': result.taskId = value; break;
        case 'i': result.intentType = value; break;
        case 'a': result.agentId = value; break;
      }
    }
    
    return result;
  }
  
  /**
   * 获取 Session 层级
   * @param {string} key
   * @returns {'task' | 'project' | 'channel' | 'unknown'}
   */
  static getLevel(key) {
    const parsed = SessionKey.parse(key);
    
    if (parsed.taskId) return 'task';
    if (parsed.projectId) return 'project';
    if (parsed.channelId) return 'channel';
    return 'unknown';
  }
  
  /**
   * 检查 keyA 是否是 keyB 的父级
   * @param {string} keyA - 可能的父级
   * @param {string} keyB - 检查的子级
   */
  static isParentOf(keyA, keyB) {
    const a = SessionKey.parse(keyA);
    const b = SessionKey.parse(keyB);
    
    // 检查每个维度
    if (a.channelId && a.channelId !== b.channelId) return false;
    if (a.userId && a.userId !== b.userId) return false;
    if (a.projectId && a.projectId !== b.projectId) return false;
    if (a.taskId && a.taskId !== b.taskId) return false;
    if (a.agentId && a.agentId !== b.agentId) return false;
    
    // 至少有一个维度更具体
    const aParts = (keyA.match(/::/g) || []).length;
    const bParts = (keyB.match(/::/g) || []).length;
    
    return bParts > aParts;
  }
  
  /**
   * 获取最近的公共父级
   * @param {string[]} keys
   */
  static getCommonParent(keys) {
    if (keys.length === 0) return null;
    if (keys.length === 1) return keys[0];
    
    const parsed = keys.map(k => SessionKey.parse(k));
    
    const result = {
      channelId: parsed[0].channelId,
      userId: parsed[0].userId,
      projectId: parsed[0].projectId,
    };
    
    // 找到所有 key 都相同的维度
    for (const p of parsed) {
      if (result.channelId !== p.channelId) result.channelId = null;
      if (result.userId !== p.userId) result.userId = null;
      if (result.projectId !== p.projectId) result.projectId = null;
    }
    
    if (!result.channelId) return null;
    
    return SessionKey.build(result);
  }
  
  /**
   * 从消息推断 Intent Type
   * @param {string} message
   * @returns {string}
   */
  static inferIntent(message) {
    if (!message) return INTENT_TYPES.CHAT;
    
    for (const rule of INTENT_RULES) {
      if (rule.pattern.test(message.trim())) {
        return rule.type;
      }
    }
    
    return INTENT_TYPES.CHAT;  // 默认闲聊
  }
  
  /**
   * 创建安全 Key（移除敏感信息）
   * @param {string} key
   */
  static anonymize(key) {
    return key.replace(/u:[^:]+/g, 'u:***');
  }
}

/**
 * Session 状态
 */
export const SESSION_STATES = {
  ACTIVE: 'active',      // 活跃
  IDLE: 'idle',         // 空闲
  ARCHIVED: 'archived',  // 已归档
  PROMOTED: 'promoted',  // 已提升
  DELETED: 'deleted',    // 已删除
};

/**
 * Session 层级
 */
export const SESSION_LEVELS = {
  TASK: 'task',
  PROJECT: 'project',
  CHANNEL: 'channel',
};
