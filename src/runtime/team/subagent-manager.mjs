// ~/pi-discord-agents/src/runtime/team/subagent-manager.mjs
// Subagent 生命周期管理器
//
// 功能:
// - Subagent 的创建、调度、销毁
// - Subagent 资源管理
// - Subagent 状态监控
// - 自动扩缩容

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Subagent 状态
 */
export const SUBAGENT_STATES = {
  CREATING: 'creating',     // 创建中
  IDLE: 'idle',           // 空闲
  RUNNING: 'running',       // 运行中
  WAITING: 'waiting',       // 等待输入
  COMPLETED: 'completed',   // 已完成
  FAILED: 'failed',        // 失败
  TERMINATED: 'terminated', // 已终止
};

/**
 * Subagent 定义
 */
export class Subagent {
  constructor({
    id,
    name,
    parentId,         // 父 Team ID
    parentTaskId,     // 父任务 ID
    agentType,         // Agent 类型
    skills,
    capabilities,
    prompt,
    resources = {},   // 资源配置
    maxLifetime = 3600, // 最大生命周期（秒）
    maxTokens = 50000,
  }) {
    this.id = id;
    this.name = name;
    this.parentId = parentId;
    this.parentTaskId = parentTaskId;
    this.agentType = agentType;
    this.skills = skills || [];
    this.capabilities = capabilities || [];
    this.prompt = prompt || '';
    this.resources = resources;
    
    this.state = SUBAGENT_STATES.CREATING;
    this.createdAt = new Date().toISOString();
    this.lastActiveAt = new Date().toISOString();
    this.startedAt = null;
    this.endedAt = null;
    
    // 资源限制
    this.maxLifetime = maxLifetime;
    this.maxTokens = maxTokens;
    this.totalTokens = 0;
    
    // 执行统计
    this.tasksCompleted = 0;
    this.tasksFailed = 0;
    
    // 子 Subagent（如果支持层级）
    this.children = [];
    
    // Session 信息
    this.sessionKey = null;
  }

  /**
   * 启动
   */
  start(sessionKey) {
    this.state = SUBAGENT_STATES.IDLE;
    this.startedAt = new Date().toISOString();
    this.sessionKey = sessionKey;
  }

  /**
   * 激活
   */
  activate() {
    this.state = SUBAGENT_STATES.RUNNING;
    this.lastActiveAt = new Date().toISOString();
  }

  /**
   * 等待
   */
  wait() {
    this.state = SUBAGENT_STATES.WAITING;
  }

  /**
   * 完成
   */
  complete() {
    this.state = SUBAGENT_STATES.COMPLETED;
    this.endedAt = new Date().toISOString();
  }

  /**
   * 失败
   */
  fail(error) {
    this.state = SUBAGENT_STATES.FAILED;
    this.error = error;
    this.endedAt = new Date().toISOString();
  }

  /**
   * 终止
   */
  terminate() {
    this.state = SUBAGENT_STATES.TERMINATED;
    this.endedAt = new Date().toISOString();
  }

  /**
   * 检查是否应该终止
   */
  shouldTerminate() {
    const now = Date.now();
    
    // 生命周期检查
    if (this.startedAt) {
      const lifetime = (now - new Date(this.startedAt).getTime()) / 1000;
      if (lifetime > this.maxLifetime) return 'lifetime-exceeded';
    }
    
    // Token 检查
    if (this.totalTokens > this.maxTokens) return 'token-limit-exceeded';
    
    // 空闲超时
    const idle = (now - new Date(this.lastActiveAt).getTime()) / 1000;
    if (idle > 300 && this.state === SUBAGENT_STATES.IDLE) return 'idle-timeout';
    
    return false;
  }

  /**
   * 添加子 Subagent
   */
  addChild(subagentId) {
    if (!this.children.includes(subagentId)) {
      this.children.push(subagentId);
    }
  }

  /**
   * 获取生命周期（秒）
   */
  getLifetime() {
    if (!this.startedAt) return 0;
    return (Date.now() - new Date(this.startedAt).getTime()) / 1000;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      parentId: this.parentId,
      parentTaskId: this.parentTaskId,
      agentType: this.agentType,
      state: this.state,
      skills: this.skills,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      lastActiveAt: this.lastActiveAt,
      endedAt: this.endedAt,
      lifetime: this.getLifetime(),
      totalTokens: this.totalTokens,
      tasksCompleted: this.tasksCompleted,
      tasksFailed: this.tasksFailed,
      children: this.children,
    };
  }
}

/**
 * Subagent Manager
 */
export class SubagentManager {
  constructor({
    rootDir,
    log = () => {},
    // 配置
    maxSubagents = 10,
    defaultLifetime = 3600,
    defaultMaxTokens = 50000,
    idleTimeout = 300,
  }) {
    this.rootDir = rootDir;
    this.log = log;
    
    this.maxSubagents = maxSubagents;
    this.defaultLifetime = defaultLifetime;
    this.defaultMaxTokens = defaultMaxTokens;
    this.idleTimeout = idleTimeout;
    
    this.subagents = new Map();  // id -> Subagent
    this.byParent = new Map();  // parentId -> Set<SubagentId>
    this.byTask = new Map();    // taskId -> Set<SubagentId>
    
    // 存储目录
    this.storageDir = resolve(rootDir, 'data', 'subagents');
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
    
    // 清理定时器
    this.cleanupInterval = setInterval(() => this._cleanup(), 60000);
  }

  /**
   * 创建 Subagent
   */
  create({
    name,
    parentId,
    parentTaskId,
    agentType,
    skills,
    capabilities,
    prompt,
    resources,
    maxLifetime,
    maxTokens,
  }) {
    // 检查数量限制
    if (this.subagents.size >= this.maxSubagents) {
      // 尝试清理空闲的 Subagent
      this._evictIdle();
      
      if (this.subagents.size >= this.maxSubagents) {
        throw new Error(`Subagent 数量已达上限 (${this.maxSubagents})`);
      }
    }

    const id = this._generateId('subagent');
    
    const subagent = new Subagent({
      id,
      name: name || agentType,
      parentId,
      parentTaskId,
      agentType,
      skills,
      capabilities,
      prompt,
      resources,
      maxLifetime: maxLifetime || this.defaultLifetime,
      maxTokens: maxTokens || this.defaultMaxTokens,
    });

    this.subagents.set(id, subagent);
    
    // 建立索引
    if (parentId) {
      if (!this.byParent.has(parentId)) {
        this.byParent.set(parentId, new Set());
      }
      this.byParent.get(parentId).add(id);
    }
    
    if (parentTaskId) {
      if (!this.byTask.has(parentTaskId)) {
        this.byTask.set(parentTaskId, new Set());
      }
      this.byTask.get(parentTaskId).add(id);
    }

    this.log(`[subagent-manager] 创建 Subagent: ${id} (${agentType})`);
    this._persist(subagent);

    return subagent;
  }

  /**
   * 获取 Subagent
   */
  get(id) {
    return this.subagents.get(id);
  }

  /**
   * 获取父 Team 的所有 Subagent
   */
  getByParent(parentId) {
    const ids = this.byParent.get(parentId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.subagents.get(id)).filter(Boolean);
  }

  /**
   * 获取任务的所有 Subagent
   */
  getByTask(taskId) {
    const ids = this.byTask.get(taskId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.subagents.get(id)).filter(Boolean);
  }

  /**
   * 更新 Subagent 状态
   */
  updateState(id, state) {
    const subagent = this.subagents.get(id);
    if (!subagent) return;

    switch (state) {
      case SUBAGENT_STATES.RUNNING:
        subagent.activate();
        break;
      case SUBAGENT_STATES.IDLE:
        subagent.state = SUBAGENT_STATES.IDLE;
        break;
      case SUBAGENT_STATES.WAITING:
        subagent.wait();
        break;
      case SUBAGENT_STATES.COMPLETED:
        subagent.complete();
        break;
      case SUBAGENT_STATES.FAILED:
        subagent.fail();
        break;
      case SUBAGENT_STATES.TERMINATED:
        subagent.terminate();
        break;
    }

    subagent.lastActiveAt = new Date().toISOString();
    this._persist(subagent);
  }

  /**
   * 终止 Subagent
   */
  terminate(id, reason = 'manual') {
    const subagent = this.subagents.get(id);
    if (!subagent) return false;

    subagent.terminate();
    subagent.terminationReason = reason;
    
    // 终止所有子 Subagent
    for (const childId of subagent.children) {
      this.terminate(childId, 'parent-terminated');
    }

    this.log(`[subagent-manager] 终止 Subagent: ${id} (${reason})`);
    this._persist(subagent);
    
    return true;
  }

  /**
   * 记录 Token 使用
   */
  recordTokens(id, tokens) {
    const subagent = this.subagents.get(id);
    if (!subagent) return;

    subagent.totalTokens += tokens;
    subagent.lastActiveAt = new Date().toISOString();
    
    this._persist(subagent);
  }

  /**
   * 获取可用 Subagent
   */
  getAvailable(agentType = null) {
    return Array.from(this.subagents.values()).filter(s => {
      if (s.state !== SUBAGENT_STATES.IDLE) return false;
      if (agentType && s.agentType !== agentType) return false;
      if (s.shouldTerminate()) return false;
      return true;
    });
  }

  /**
   * 获取统计
   */
  getStats() {
    const all = Array.from(this.subagents.values());
    
    return {
      total: all.length,
      byState: this._groupBy(all, 'state'),
      byType: this._groupBy(all, 'agentType'),
      avgLifetime: all.reduce((sum, s) => sum + s.getLifetime(), 0) / (all.length || 1),
      totalTokens: all.reduce((sum, s) => sum + s.totalTokens, 0),
    };
  }

  /**
   * 清理过期 Subagent
   */
  _cleanup() {
    let cleaned = 0;
    
    for (const [id, subagent] of this.subagents) {
      const reason = subagent.shouldTerminate();
      if (reason) {
        this.terminate(id, reason);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.log(`[subagent-manager] 清理 ${cleaned} 个过期 Subagent`);
    }
  }

  /**
   * 驱逐空闲 Subagent
   */
  _evictIdle() {
    const idle = Array.from(this.subagents.values())
      .filter(s => s.state === SUBAGENT_STATES.IDLE)
      .sort((a, b) => new Date(a.lastActiveAt) - new Date(b.lastActiveAt));

    if (idle.length > 0) {
      this.terminate(idle[0].id, 'evicted');
    }
  }

  /**
   * 生成 ID
   */
  _generateId(prefix) {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${ts}_${rand}`;
  }

  /**
   * 持久化
   */
  _persist(subagent) {
    const path = resolve(this.storageDir, `${subagent.id}.json`);
    writeFileSync(path, JSON.stringify(subagent.toJSON(), null, 2), 'utf8');
  }

  /**
   * 分组统计
   */
  _groupBy(arr, key) {
    const result = {};
    for (const item of arr) {
      const k = item[key] || 'unknown';
      result[k] = (result[k] || 0) + 1;
    }
    return result;
  }

  /**
   * 关闭
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // 终止所有 Subagent
    for (const [id] of this.subagents) {
      this.terminate(id, 'manager-shutdown');
    }
    
    this.log(`[subagent-manager] shutdown`);
  }
}
