// ~/pi-discord-agents/src/runtime/team/team-core.mjs
// Agent Team 核心引擎
//
// Agent Team 设计理念:
// 1. Team: 多个 Agent 协作完成复杂任务
// 2. Subagent: 可被 Team 调用的小型 Agent
// 3. 任务委派: Team Leader 负责任务分发
// 4. 结果聚合: 收集各 Agent 结果并整合输出
//
// 协作模式:
// - Sequential: 串行执行，上一步输出作为下一步输入
// - Parallel: 并行执行，多个 Agent 同时工作
// - Hierarchical: 层级协作，Manager → Worker

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * 任务状态
 */
export const TASK_STATES = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

/**
 * Agent 类型
 */
export const AGENT_TYPES = {
  LEADER: 'leader',      // 团队领导，负责协调
  WORKER: 'worker',      // 执行具体任务
  REVIEWER: 'reviewer',   // 审查和评估
  ORCHESTRATOR: 'orchestrator', // 总指挥
};

/**
 * 协作模式
 */
export const COLLABORATION_MODES = {
  SEQUENTIAL: 'sequential',   // 串行: A → B → C
  PARALLEL: 'parallel',       // 并行: A ‖ B ‖ C
  HIERARCHICAL: 'hierarchical', // 层级: Manager → Workers
  FAN_OUT_IN: 'fan-out-in',    // 扇出收集: A → [B, C, D] → A
};

/**
 * Agent 定义
 */
export class Agent {
  constructor({ id, name, type, skills, capabilities, prompt, tools = [] }) {
    this.id = id;
    this.name = name;
    this.type = type || AGENT_TYPES.WORKER;
    this.skills = skills || [];
    this.capabilities = capabilities || [];
    this.prompt = prompt || '';
    this.tools = tools;
    this.state = 'idle';
    this.currentTask = null;
    this.stats = {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalTokens: 0,
      avgDuration: 0,
    };
  }

  canHandle(task) {
    // 检查是否有处理任务的技能
    for (const skill of this.skills) {
      if (task.requiredSkills?.includes(skill)) return true;
    }
    // 检查能力匹配
    for (const cap of this.capabilities) {
      if (task.capabilities?.includes(cap)) return true;
    }
    return false;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      skills: this.skills,
      capabilities: this.capabilities,
      state: this.state,
      stats: this.stats,
    };
  }
}

/**
 * Team 任务定义
 */
export class TeamTask {
  constructor({ id, type, description, requiredSkills, capabilities, input, context, priority = 'normal' }) {
    this.id = id;
    this.type = type;
    this.description = description;
    this.requiredSkills = requiredSkills || [];
    this.capabilities = capabilities || [];
    this.input = input;
    this.context = context || {};
    this.priority = priority; // low, normal, high, critical
    this.state = TASK_STATES.PENDING;
    this.result = null;
    this.error = null;
    this.startedAt = null;
    this.completedAt = null;
    this.assignedTo = null;
    this.subtasks = [];
  }

  markRunning(agentId) {
    this.state = TASK_STATES.RUNNING;
    this.assignedTo = agentId;
    this.startedAt = new Date().toISOString();
  }

  markCompleted(result) {
    this.state = TASK_STATES.COMPLETED;
    this.result = result;
    this.completedAt = new Date().toISOString();
  }

  markFailed(error) {
    this.state = TASK_STATES.FAILED;
    this.error = error;
    this.completedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      description: this.description,
      state: this.state,
      assignedTo: this.assignedTo,
      duration: this.completedAt && this.startedAt
        ? new Date(this.completedAt) - new Date(this.startedAt)
        : null,
      result: this.result,
      error: this.error,
    };
  }
}

/**
 * Team 定义
 */
export class Team {
  constructor({ id, name, description, agents = [], leaderId = null, workflow = [] }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.agents = new Map(agents.map(a => [a.id, a]));
    this.leaderId = leaderId || agents[0]?.id;
    this.tasks = new Map();
    this.executionHistory = [];
    this.state = 'idle';
    this.currentTask = null;
    this.workflow = workflow;
  }

  addAgent(agent) {
    this.agents.set(agent.id, agent);
  }

  removeAgent(agentId) {
    this.agents.delete(agentId);
  }

  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  getAvailableAgents() {
    return Array.from(this.agents.values()).filter(a => a.state === 'idle');
  }

  getLeader() {
    return this.agents.get(this.leaderId);
  }

  assignTask(task, agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    
    task.markRunning(agentId);
    agent.state = 'busy';
    agent.currentTask = task.id;
    this.tasks.set(task.id, task);
  }

  completeTask(taskId, result) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    
    task.markCompleted(result);
    
    const agent = this.agents.get(task.assignedTo);
    if (agent) {
      agent.state = 'idle';
      agent.currentTask = null;
      agent.stats.tasksCompleted++;
    }
  }

  failTask(taskId, error) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    task.markFailed(error);
    
    const agent = this.agents.get(task.assignedTo);
    if (agent) {
      agent.state = 'idle';
      agent.currentTask = null;
      agent.stats.tasksFailed++;
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      state: this.state,
      leaderId: this.leaderId,
      agents: Array.from(this.agents.values()).map(a => a.toJSON()),
      activeTasks: Array.from(this.tasks.values())
        .filter(t => t.state === TASK_STATES.RUNNING)
        .map(t => t.toJSON()),
      completedTasks: this.executionHistory.length,
    };
  }
}

/**
 * Team 模板预定义
 */
export const TEAM_TEMPLATES = {
  SALES: {
    id: 'team-sales',
    name: '销售团队',
    description: '从线索到成交的完整销售流程',
    agents: [
      { id: 'sales-lead', name: '销售主管', type: AGENT_TYPES.LEADER, skills: ['lead-qualification', 'deal-management'] },
      { id: 'sales-researcher', name: '调研员', type: AGENT_TYPES.WORKER, skills: ['company-research', 'competitive-analysis'] },
      { id: 'sales-closer', name: '成交专家', type: AGENT_TYPES.WORKER, skills: ['negotiation', 'proposal'] },
      { id: 'sales-reviewer', name: '质量审核', type: AGENT_TYPES.REVIEWER, skills: ['compliance-check', 'quality-review'] },
    ],
    workflow: [
      { step: 1, agent: 'sales-researcher', mode: COLLABORATION_MODES.SEQUENTIAL },
      { step: 2, agent: 'sales-lead', mode: COLLABORATION_MODES.SEQUENTIAL },
      { step: 3, agent: 'sales-closer', mode: COLLABORATION_MODES.SEQUENTIAL },
      { step: 4, agent: 'sales-reviewer', mode: COLLABORATION_MODES.SEQUENTIAL },
    ],
  },
  
  CONTENT: {
    id: 'team-content',
    name: '内容团队',
    description: '内容创作到发布完整流程',
    agents: [
      { id: 'content-lead', name: '内容主编', type: AGENT_TYPES.LEADER, skills: ['content-strategy', 'editorial'] },
      { id: 'content-writer', name: '内容撰写', type: AGENT_TYPES.WORKER, skills: ['writing', 'copywriting'] },
      { id: 'content-editor', name: '内容编辑', type: AGENT_TYPES.REVIEWER, skills: ['editing', 'seo-optimization'] },
      { id: 'content-publisher', name: '发布专员', type: AGENT_TYPES.WORKER, skills: ['publishing', 'social-media'] },
    ],
    workflow: [
      { step: 1, agent: 'content-lead', mode: COLLABORATION_MODES.SEQUENTIAL },
      { step: 2, agent: 'content-writer', mode: COLLABORATION_MODES.SEQUENTIAL },
      { step: 3, agent: 'content-editor', mode: COLLABORATION_MODES.SEQUENTIAL },
      { step: 4, agent: 'content-publisher', mode: COLLABORATION_MODES.SEQUENTIAL },
    ],
  },
  
  DEVELOPMENT: {
    id: 'team-dev',
    name: '开发团队',
    description: '从需求到代码完整流程',
    agents: [
      { id: 'dev-lead', name: '技术负责人', type: AGENT_TYPES.LEADER, skills: ['architecture', 'code-review'] },
      { id: 'dev-backend', name: '后端开发', type: AGENT_TYPES.WORKER, skills: ['backend', 'api-design'] },
      { id: 'dev-frontend', name: '前端开发', type: AGENT_TYPES.WORKER, skills: ['frontend', 'ui-implementation'] },
      { id: 'dev-tester', name: '测试工程师', type: AGENT_TYPES.REVIEWER, skills: ['testing', 'qa'] },
    ],
    workflow: [
      { step: 1, agent: 'dev-lead', mode: COLLABORATION_MODES.SEQUENTIAL },
      { step: 2, agents: ['dev-backend', 'dev-frontend'], mode: COLLABORATION_MODES.PARALLEL },
      { step: 3, agent: 'dev-tester', mode: COLLABORATION_MODES.SEQUENTIAL },
    ],
  },
};

/**
 * 创建 Team 工厂
 */
export function createTeam(template) {
  const agents = template.agents.map(a => new Agent(a));
  const team = new Team({
    id: template.id,
    name: template.name,
    description: template.description,
    agents,
    leaderId: template.agents[0]?.id,
  });
  // 复制 workflow
  if (template.workflow) {
    team.workflow = [...template.workflow];
  }
  return team;
}
