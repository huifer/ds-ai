// ~/pi-discord-agents/src/runtime/team/team-engine.mjs
// Team Engine: 执行 Team 任务编排
//
// 功能:
// - 任务委派和执行
// - 串行/并行/层级协作
// - 结果聚合
// - 错误处理和恢复

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { Team, TeamTask, TASK_STATES, COLLABORATION_MODES, createTeam, TEAM_TEMPLATES } from './team-core.mjs';
import { SessionKey, INTENT_TYPES } from '../session/session-key.mjs';

/**
 * 任务执行上下文
 */
class ExecutionContext {
  constructor({ team, rootDir, log }) {
    this.team = team;
    this.rootDir = rootDir;
    this.log = log;
    this.contextData = new Map();
  }

  set(key, value) {
    this.contextData.set(key, value);
  }

  get(key) {
    return this.contextData.get(key);
  }

  getAll() {
    return Object.fromEntries(this.contextData);
  }
}

/**
 * Team Engine
 */
export class TeamEngine {
  constructor({
    rootDir,
    piBridge,        // Pi Bridge 用于调用 LLM
    sessionManager,   // Session 管理器
    memoryStore,      // 记忆存储
    log = () => {},
  }) {
    this.rootDir = rootDir;
    this.piBridge = piBridge;
    this.sessionManager = sessionManager;
    this.memoryStore = memoryStore;
    this.log = log;

    this.teams = new Map();
    this.executionHistory = new Map();
    
    // 初始化目录
    this.executionsDir = resolve(rootDir, 'data', 'team-executions');
    if (!existsSync(this.executionsDir)) {
      mkdirSync(this.executionsDir, { recursive: true });
    }
  }

  /**
   * 注册 Team
   */
  registerTeam(team) {
    this.teams.set(team.id, team);
    this.log(`[team-engine] 注册 Team: ${team.name} (${team.agents.size} agents)`);
    return team;
  }

  /**
   * 从模板创建并注册 Team
   */
  createAndRegisterTeam(templateId) {
    const template = TEAM_TEMPLATES[templateId];
    if (!template) throw new Error(`Team 模板 ${templateId} 不存在`);
    
    const team = createTeam(template);
    return this.registerTeam(team);
  }

  /**
   * 获取 Team
   */
  getTeam(teamId) {
    return this.teams.get(teamId);
  }

  /**
   * 执行 Team 任务
   */
  async execute({
    teamId,
    task,
    mode = COLLABORATION_MODES.SEQUENTIAL,
    context = {},
  }) {
    const team = this.teams.get(teamId);
    if (!team) throw new Error(`Team ${teamId} 不存在`);

    const executionId = this._generateId('exec');
    const execCtx = new ExecutionContext({ team, rootDir: this.rootDir, log: this.log });
    
    // 设置初始上下文
    for (const [key, value] of Object.entries(context)) {
      execCtx.set(key, value);
    }

    const execution = {
      id: executionId,
      teamId,
      task: task.toJSON ? task.toJSON() : task,
      mode,
      startedAt: new Date().toISOString(),
      completedAt: null,
      state: TASK_STATES.RUNNING,
      steps: [],
      result: null,
      error: null,
    };

    this.log(`[team-engine] ▶ 执行 ${team.name}: ${executionId}`);

    try {
      // 根据模式执行
      switch (mode) {
        case COLLABORATION_MODES.SEQUENTIAL:
          execution.result = await this._executeSequential(team, task, execCtx);
          break;
        case COLLABORATION_MODES.PARALLEL:
          execution.result = await this._executeParallel(team, task, execCtx);
          break;
        case COLLABORATION_MODES.HIERARCHICAL:
          execution.result = await this._executeHierarchical(team, task, execCtx);
          break;
        case COLLABORATION_MODES.FAN_OUT_IN:
          execution.result = await this._executeFanOutIn(team, task, execCtx);
          break;
        default:
          throw new Error(`未知协作模式: ${mode}`);
      }

      execution.state = TASK_STATES.COMPLETED;
      execution.completedAt = new Date().toISOString();
      
      this.log(`[team-engine] ✓ 完成 ${team.name}: ${executionId}`);
    } catch (error) {
      execution.state = TASK_STATES.FAILED;
      execution.error = error.message;
      execution.completedAt = new Date().toISOString();
      
      this.log(`[team-engine] ✗ 失败 ${team.name}: ${error.message}`);
    }

    // 保存执行历史
    this.executionHistory.set(executionId, execution);
    this._persistExecution(execution);

    return execution;
  }

  /**
   * 串行执行
   */
  async _executeSequential(team, task, execCtx) {
    const results = [];
    
    // 获取工作流步骤
    const workflow = team.workflow || [];
    
    for (const step of workflow) {
      const stepResult = await this._executeStep(team, step, task, execCtx);
      results.push(stepResult);
      
      // 将结果注入上下文，供下一步使用
      execCtx.set(`step_${step.step}`, stepResult);
      execCtx.set('last_result', stepResult);
    }
    
    return {
      type: 'sequential',
      steps: results,
      final: results[results.length - 1],
    };
  }

  /**
   * 并行执行
   */
  async _executeParallel(team, task, execCtx) {
    const workflow = team.workflow || [];
    
    // 找到并行步骤
    const parallelSteps = workflow.filter(s => s.agents?.length > 1);
    if (parallelSteps.length === 0) {
      return this._executeSequential(team, task, execCtx);
    }

    const results = [];
    
    for (const step of parallelSteps) {
      const promises = step.agents.map(agentId => 
        this._executeAgent(team.getAgent(agentId), task, execCtx)
      );
      
      const stepResults = await Promise.all(promises);
      results.push({
        step: step.step,
        agents: step.agents,
        results: stepResults,
      });
      
      // 聚合结果
      execCtx.set(`parallel_step_${step.step}`, stepResults);
    }
    
    return {
      type: 'parallel',
      results,
      aggregated: this._aggregateResults(results),
    };
  }

  /**
   * 层级执行
   */
  async _executeHierarchical(team, task, execCtx) {
    const leader = team.getLeader();
    if (!leader) throw new Error('Team 没有 Leader');

    // 1. Leader 分析任务并规划
    const plan = await this._agentExecute(leader, {
      type: 'planning',
      input: task,
      context: execCtx.getAll(),
    }, execCtx);

    execCtx.set('plan', plan);

    // 2. 分配子任务给 Workers
    const subtasks = plan.subtasks || [];
    const workerResults = [];
    
    for (const subtask of subtasks) {
      const worker = team.agents.get(subtask.agentId);
      if (!worker) continue;
      
      const result = await this._agentExecute(worker, {
        type: 'execution',
        input: subtask,
        context: execCtx.getAll(),
      }, execCtx);
      
      workerResults.push({
        agentId: subtask.agentId,
        result,
      });
    }

    // 3. Leader 聚合结果
    const aggregated = await this._agentExecute(leader, {
      type: 'aggregation',
      input: workerResults,
      context: execCtx.getAll(),
    }, execCtx);

    return {
      type: 'hierarchical',
      plan,
      workerResults,
      aggregated,
    };
  }

  /**
   * 扇出收集
   */
  async _executeFanOutIn(team, task, execCtx) {
    const leader = team.getLeader();
    const workers = team.getAvailableAgents().filter(a => a.type !== 'leader');

    // 1. Leader 准备任务
    const prepared = await this._agentExecute(leader, {
      type: 'preparation',
      input: task,
      context: execCtx.getAll(),
    }, execCtx);

    // 2. 扇出给 Workers
    const workerPromises = workers.map(worker => 
      this._agentExecute(worker, {
        type: 'contribution',
        input: prepared,
        context: execCtx.getAll(),
      }, execCtx).then(result => ({ agentId: worker.id, result }))
    );

    const contributions = await Promise.all(workerPromises);

    // 3. Leader 收集整合
    const synthesized = await this._agentExecute(leader, {
      type: 'synthesis',
      input: contributions,
      context: execCtx.getAll(),
    }, execCtx);

    return {
      type: 'fan-out-in',
      prepared,
      contributions,
      synthesized,
    };
  }

  /**
   * 执行单个步骤
   */
  async _executeStep(team, step, task, execCtx) {
    const agent = step.agent 
      ? team.getAgent(step.agent)
      : team.getAgent(step.agents?.[0]);

    if (!agent) {
      throw new Error(`Agent not found for step ${step.step}`);
    }

    const result = await this._agentExecute(agent, {
      type: 'step',
      step: step.step,
      input: task,
      context: execCtx.getAll(),
    }, execCtx);

    return {
      step: step.step,
      agentId: agent.id,
      agentName: agent.name,
      result,
    };
  }

  /**
   * 执行 Agent
   */
  async _agentExecute(agent, action, execCtx) {
    if (!agent) {
      throw new Error('Agent is null');
    }

    const startTime = Date.now();
    
    // 更新 Agent 状态
    agent.state = 'running';
    agent.currentTask = action.type;

    try {
      // 构建 Agent prompt
      const prompt = this._buildAgentPrompt(agent, action, execCtx);

      // 调用 LLM
      if (this.piBridge?.available) {
        const response = await this.piBridge.prompt(prompt, action.input, {
          timeoutMs: 120000,
        });
        
        const result = this._parseAgentResponse(response, agent);
        
        // 更新统计
        agent.stats.tasksCompleted++;
        agent.stats.totalTokens += response.usage?.total_tokens || 0;
        
        return result;
      } else {
        // Mock 模式
        return {
          agentId: agent.id,
          agentName: agent.name,
          type: action.type,
          output: `[Mock] ${agent.name} 处理了 ${action.type}`,
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      agent.stats.tasksFailed++;
      throw error;
    } finally {
      agent.state = 'idle';
      agent.currentTask = null;
    }
  }

  /**
   * 构建 Agent Prompt
   */
  _buildAgentPrompt(agent, action, execCtx) {
    const parts = [];

    // System prompt
    parts.push(`# ${agent.name}`);
    if (agent.prompt) {
      parts.push(agent.prompt);
    }
    parts.push(`\n## 你的职责`);
    parts.push(`- ID: ${agent.id}`);
    parts.push(`- 类型: ${agent.type}`);
    parts.push(`- 技能: ${agent.skills.join(', ')}`);

    // Action context
    parts.push(`\n## 当前任务`);
    parts.push(`- 类型: ${action.type}`);
    parts.push(`- 描述: ${action.description || JSON.stringify(action.input)}`);

    // Shared context
    const context = execCtx.getAll();
    if (Object.keys(context).length > 0) {
      parts.push(`\n## 上下文`);
      for (const [key, value] of Object.entries(context)) {
        parts.push(`- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * 解析 Agent 响应
   */
  _parseAgentResponse(response, agent) {
    return {
      agentId: agent.id,
      agentName: agent.name,
      output: typeof response === 'string' ? response : JSON.stringify(response),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 聚合并行结果
   */
  _aggregateResults(results) {
    return {
      summary: results.map(r => r.agentName).join(', ') + ' 已完成',
      details: results,
    };
  }

  /**
   * 生成 ID
   */
  _generateId(prefix) {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${ts}-${rand}`;
  }

  /**
   * 持久化执行记录
   */
  _persistExecution(execution) {
    const path = resolve(this.executionsDir, `${execution.id}.json`);
    writeFileSync(path, JSON.stringify(execution, null, 2), 'utf8');
  }

  /**
   * 获取执行历史
   */
  getExecutionHistory({ teamId = null, limit = 10 } = {}) {
    const history = [];
    const files = readdirSync(this.executionsDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      try {
        const content = readFileSync(resolve(this.executionsDir, file), 'utf8');
        const exec = JSON.parse(content);
        
        if (teamId && exec.teamId !== teamId) continue;
        
        history.push(exec);
      } catch {}
    }

    return history
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
      .slice(0, limit);
  }

  /**
   * 获取 Team 统计
   */
  getTeamStats(teamId) {
    const team = this.teams.get(teamId);
    if (!team) return null;

    const history = this.getExecutionHistory({ teamId, limit: 100 });

    return {
      team: team.toJSON(),
      executions: history.length,
      successRate: history.filter(e => e.state === 'completed').length / (history.length || 1),
      avgDuration: history.reduce((sum, e) => {
        if (e.completedAt && e.startedAt) {
          return sum + (new Date(e.completedAt) - new Date(e.startedAt));
        }
        return sum;
      }, 0) / (history.length || 1),
    };
  }
}
