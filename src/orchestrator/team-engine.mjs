// ~/pi-discord-agents/src/orchestrator/team-engine.mjs
// TeamEngine:执行复杂任务的多 Agent 协作
//
// 设计要点:
//   1. Team = 一组有依赖关系的 agent 步骤
//   2. 串行/并行/分支 多种执行模式
//   3. 步骤间传递上下文(context passing)
//   4. 任一步失败 → 整个 team 失败 + 详情
//   5. 最终审批(可选) - 需要人工审批才能完成
//   6. 全过程可观测 - 状态写入 data/team-execution/<id>.json

import { writeFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { SessionPool } from './session-pool.mjs';

/**
 * Team 定义
 *
 * 字段说明:
 *   id: team id
 *   description: 人类可读描述
 *   trigger: 正则匹配 !team-xxx args
 *   steps: 步骤数组
 *     - agent: agent id
 *     - skill: skill name
 *     - label: 步骤描述
 *     - mode: 'sequential' | 'parallel' | 'branch'(默认 sequential)
 *     - inputFrom: 上一步的输出如何作为这一步的输入
 *       - 'previous': 用上一步输出(默认)
 *       - 'original': 用原始用户输入
 *       - 'merge': 合并所有上一步输出
 *     - condition: 条件函数(接收上下文返回 bool),false 则跳过
 *   finalApproval: 最终审批类型(可选,如 'contract-sign')
 *   finalChannel: 最终结果发送的频道(可选)
 */
export const TEAMS = [
  {
    id: 'lead-to-contract',
    description: '线索 → 资质评估 → 报价 → 合同 全流程',
    trigger: /^!lead-to-contract\s+(.+)/,
    steps: [
      { agent: 'sales', skill: 'lead-capture', label: '1. 录入线索' },
      { agent: 'sales', skill: 'qualification', label: '2. 资质评估', inputFrom: 'previous' },
      { agent: 'quote', skill: 'estimate', label: '3. 报价生成', inputFrom: 'previous' },
      { agent: 'contract', skill: 'contract-summarize', label: '4. 合同摘要', inputFrom: 'previous' },
    ],
    finalApproval: 'contract-sign',
    finalChannel: 'contract-ops', // → CH_CONTRACT_OPS
  },

  {
    id: 'idea-to-publish',
    description: '灵感 → 蒸馏 brief → 渲染 → QA → 发布',
    trigger: /^!idea-to-publish\s+(.+)/,
    steps: [
      { agent: 'distill', skill: 'distill-brief', label: '1. 内容 brief' },
      {
        agent: 'renderer', skill: 'platform-render', label: '2. 多平台渲染',
        // 并行:同时渲染国内/海外
        mode: 'parallel',
        branches: [
          { agent: 'renderer', skill: 'platform-render', label: '2a. 国内渲染', params: { region: 'domestic' } },
          { agent: 'renderer', skill: 'platform-render', label: '2b. 海外渲染', params: { region: 'overseas' } },
        ],
      },
      { agent: 'qa', skill: 'qa-report', label: '3. QA 检查', inputFrom: 'previous' },
      { agent: 'publisher', skill: 'platform-publish', label: '4. 发布', inputFrom: 'previous' },
    ],
    finalApproval: 'publish-domestic',
    finalChannel: 'agent-status',
  },

  {
    id: 'pr-full-cycle',
    description: '项目立项 → 计划 → PRD → POC → 测试 → 部署',
    trigger: /^!pr-full-cycle\s+(.+)/,
    steps: [
      { agent: 'pm', skill: 'project-bootstrap', label: '1. 项目立项' },
      { agent: 'project', skill: 'plan-build', label: '2. 计划构建', inputFrom: 'previous' },
      { agent: 'solution', skill: 'prd-v10', label: '3. PRD v1.0', inputFrom: 'previous' },
      { agent: 'delivery', skill: 'poc-plan', label: '4. POC 计划', inputFrom: 'previous' },
      {
        agent: 'qa', skill: 'test-plan', label: '5. 测试计划',
        // 条件:只有当 PRD 通过时才执行
        condition: (ctx) => ctx.stepResults?.[2]?.status === 'OK',
      },
    ],
    finalApproval: 'prod-deploy',
    finalChannel: 'project-mgmt',
  },

  {
    id: 'sales-deep-dive',
    description: '销售线索深度挖掘: 线索 → Discovery → 方案 → 报价',
    trigger: /^!sales-deep-dive\s+(.+)/,
    steps: [
      { agent: 'sales', skill: 'lead-capture', label: '1. 录入线索' },
      { agent: 'sales', skill: 'qualification', label: '2. 资质评估', inputFrom: 'previous' },
      { agent: 'solution', skill: 'discovery', label: '3. 需求发现', inputFrom: 'previous' },
      { agent: 'solution', skill: 'prd-v01', label: '4. PRD v0.1', inputFrom: 'previous' },
      { agent: 'quote', skill: 'estimate', label: '5. 报价', inputFrom: 'previous' },
    ],
    finalApproval: 'quote-send',
    finalChannel: 'opportunity-solution',
  },

  {
    id: 'incident-response',
    description: '生产事故响应: 告警 → 评估 → 处理 → 复盘',
    trigger: /^!incident-response\s+(.+)/,
    steps: [
      { agent: 'delivery', skill: 'incident', label: '1. 事故评估', mode: 'sequential' },
      { agent: 'delivery', skill: 'runbook', label: '2. 应用 Runbook', inputFrom: 'previous' },
      { agent: 'qa', skill: 'health-report', label: '3. 系统健康检查', inputFrom: 'previous', mode: 'parallel' },
      { agent: 'delivery', skill: 'deploy', label: '4. 部署修复', inputFrom: 'previous' },
    ],
    finalChannel: 'agent-status',
  },
];

/**
 * TeamExecution: 单次 team 执行的完整记录
 */
class TeamExecution {
  constructor({ teamId, originalInput, userId, channelId, rootDir }) {
    this.id = `team-${Date.now()}-${createHash('sha1').update(`${teamId}:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 6)}`;
    this.teamId = teamId;
    this.originalInput = originalInput;
    this.userId = userId;
    this.channelId = channelId;
    this.rootDir = rootDir;
    this.startedAt = new Date().toISOString();
    this.completedAt = null;
    this.status = 'running'; // running / success / failed / awaiting_approval
    this.stepResults = [];
    this.finalResult = null;
    this.error = null;
  }

  toJSON() {
    return {
      id: this.id,
      teamId: this.teamId,
      originalInput: this.originalInput,
      userId: this.userId,
      channelId: this.channelId,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      status: this.status,
      stepResults: this.stepResults,
      finalResult: this.finalResult,
      error: this.error,
    };
  }

  persist() {
    const dir = resolve(this.rootDir, 'data/team-execution');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${this.id}.json`), JSON.stringify(this.toJSON(), null, 2), 'utf8');
  }
}

/**
 * TeamEngine
 */
export class TeamEngine {
  /**
   * @param {object} opts
   * @param {object} opts.registry - AgentRegistry
   * @param {object} opts.sessionPool - SessionPool
   * @param {object} opts.multiAgentManager - MultiAgentManager (用于执行单步)
   * @param {function} opts.log
   * @param {string} opts.rootDir
   */
  constructor({ registry, sessionPool, multiAgentManager, log = () => {}, rootDir }) {
    this.registry = registry;
    this.sessionPool = sessionPool;
    this.multiAgentManager = multiAgentManager;
    this.log = log;
    this.rootDir = rootDir ?? process.cwd();
    this.byId = new Map();
    this.byPattern = [];

    for (const team of TEAMS) {
      this.byId.set(team.id, team);
      this.byPattern.push(team);
    }
  }

  /**
   * 匹配用户输入是否为 team 命令
   */
  match(text) {
    for (const team of this.byPattern) {
      const m = text.match(team.trigger);
      if (m) {
        return { team, match: m, args: m.slice(1) };
      }
    }
    return null;
  }

  /**
   * 执行一个 team
   * @returns {Promise<TeamExecution>}
   */
  async execute({ teamId, originalInput, userId, channelId }) {
    const team = this.byId.get(teamId);
    if (!team) {
      throw new Error(`team not found: ${teamId}`);
    }

    const execution = new TeamExecution({
      teamId,
      originalInput,
      userId,
      channelId,
      rootDir: this.rootDir,
    });

    this.log(`[team-engine] 开始执行: ${team.id} (${execution.id})`);
    this.log(`[team-engine]   输入: "${originalInput.slice(0, 60)}"`);
    this.log(`[team-engine]   步骤数: ${team.steps.length}`);

    execution.persist();

    try {
      // 顺序执行步骤
      for (let i = 0; i < team.steps.length; i++) {
        const stepDef = team.steps[i];
        const stepNum = i + 1;

        // 条件检查
        if (stepDef.condition && !stepDef.condition(execution)) {
          this.log(`[team-engine]   跳过步骤 ${stepNum}: 条件不满足`);
          execution.stepResults.push({
            stepNum,
            agent: stepDef.agent,
            skill: stepDef.skill,
            status: 'skipped',
            reason: 'condition_false',
          });
          execution.persist();
          continue;
        }

        // 计算这一步的输入
        const stepInput = this._buildStepInput(stepDef, execution);

        // 执行:支持 sequential / parallel / branch
        if (stepDef.mode === 'parallel' && stepDef.branches) {
          this.log(`[team-engine]   步骤 ${stepNum}: ${stepDef.label} (并行 ${stepDef.branches.length} 分支)`);
          const branchResults = await this._executeParallelBranches(stepDef.branches, stepInput, execution);
          execution.stepResults.push({
            stepNum,
            agent: stepDef.agent,
            skill: stepDef.skill,
            mode: 'parallel',
            branches: branchResults,
            status: branchResults.every(r => r.status === 'OK') ? 'OK' : 'PARTIAL',
          });
        } else {
          this.log(`[team-engine]   步骤 ${stepNum}: ${stepDef.label} (${stepDef.agent}/${stepDef.skill})`);
          const result = await this._executeStep(stepDef, stepInput, execution);
          execution.stepResults.push({
            stepNum,
            agent: stepDef.agent,
            skill: stepDef.skill,
            mode: 'sequential',
            ...result,
            status: result.status ?? (result.error ? 'ERROR' : 'OK'),
          });

          // 单步失败:整个 team 失败
          if (result.error) {
            execution.status = 'failed';
            execution.error = `step_${stepNum}_failed: ${result.error}`;
            execution.completedAt = new Date().toISOString();
            execution.persist();
            this.log(`[team-engine]   ❌ 步骤 ${stepNum} 失败,终止`);
            return execution;
          }
        }

        execution.persist();
      }

      // 最终审批
      if (team.finalApproval) {
        execution.status = 'awaiting_approval';
        execution.finalResult = {
          approvalType: team.finalApproval,
          approvalId: null, // 实际审批由 approval 系统分配
          pendingChannel: team.finalChannel,
        };
        execution.completedAt = new Date().toISOString();
        execution.persist();
        this.log(`[team-engine]   ⏸️  等待审批: ${team.finalApproval}`);
        return execution;
      }

      // 完成
      execution.status = 'success';
      execution.completedAt = new Date().toISOString();
      execution.finalResult = {
        summary: this._summarize(execution),
      };
      execution.persist();

      this.log(`[team-engine] ✅ 完成: ${execution.id}`);
      return execution;
    } catch (e) {
      execution.status = 'failed';
      execution.error = e.message;
      execution.completedAt = new Date().toISOString();
      execution.persist();
      this.log(`[team-engine] ❌ 异常: ${e.message}`);
      return execution;
    }
  }

  /**
   * 计算步骤的输入
   */
  _buildStepInput(stepDef, execution) {
    const inputFrom = stepDef.inputFrom ?? 'previous';

    if (inputFrom === 'original') {
      return execution.originalInput;
    }

    if (inputFrom === 'merge') {
      // 合并所有上一步输出
      const allOutputs = execution.stepResults
        .filter(r => r.result?.reply)
        .map(r => `[${r.label ?? r.agent}]: ${r.result.reply}`)
        .join('\n\n');
      return `${execution.originalInput}\n\n# 上游步骤输出汇总\n${allOutputs}`;
    }

    // 默认: 'previous' - 用上一步输出
    const lastResult = execution.stepResults[execution.stepResults.length - 1];
    if (lastResult?.result?.reply) {
      return `${execution.originalInput}\n\n# 上一步(${lastResult.label ?? lastResult.agent})输出\n${lastResult.result.reply}`;
    }

    return execution.originalInput;
  }

  /**
   * 执行单个步骤(走 multi-agent,强制用指定 agent/skill)
   */
  async _executeStep(stepDef, input, execution) {
    if (!this.multiAgentManager) {
      return { status: 'ERROR', error: 'multiAgentManager 未配置' };
    }

    try {
      // 验证 agent/skill 存在
      const agentDef = this.registry.get(stepDef.agent);
      if (!agentDef) {
        return { error: `agent not found: ${stepDef.agent}`, label: stepDef.label };
      }
      if (!agentDef.skills?.includes(stepDef.skill)) {
        // skill 不在 agent 的列表里 - 警告但继续
        this.log(`[team-engine]     ⚠️  skill ${stepDef.skill} 不在 ${stepDef.agent} 的 skill 列表中`);
      }

      // 强制路由到指定 agent(不走自由文本路由)
      const result = await this._handleWithAgent({
        agentId: stepDef.agent,
        skill: stepDef.skill,
        text: input,
        userId: execution.userId,
        channelId: execution.channelId,
        channelName: `team-${execution.teamId}`,
      });

      return {
        label: stepDef.label,
        result: {
          agentId: result.agentId,
          reply: result.reply,
          sessionKey: result.sessionKey,
          compressed: result.compressed,
        },
      };
    } catch (e) {
      return { error: e.message.slice(0, 200), label: stepDef.label };
    }
  }

  /**
   * 并行执行多个分支
   */
  async _executeParallelBranches(branches, input, execution) {
    const tasks = branches.map(async (branch, idx) => {
      this.log(`[team-engine]     分支 ${idx + 1}: ${branch.label}`);
      try {
        const result = await this._handleWithAgent({
          agentId: branch.agent,
          skill: branch.skill,
          text: input,
          userId: execution.userId,
          channelId: execution.channelId,
          channelName: `team-${execution.teamId}-branch-${idx}`,
        });
        return {
          branch: idx + 1,
          label: branch.label,
          agent: branch.agent,
          status: 'OK',
          result: {
            agentId: result.agentId,
            reply: result.reply,
          },
        };
      } catch (e) {
        return {
          branch: idx + 1,
          label: branch.label,
          agent: branch.agent,
          status: 'ERROR',
          error: e.message.slice(0, 200),
        };
      }
    });

    return await Promise.all(tasks);
  }

  /**
   * 强制用指定 agent 处理消息(绕过 router)
   */
  async _handleWithAgent({ agentId, skill, text, userId, channelId, channelName }) {
    const agentDef = this.registry.get(agentId);
    if (!agentDef) throw new Error(`agent not found: ${agentId}`);

    // 创建/获取 session(以 agent 维度隔离)
    const sessionKey = SessionPool.makeKey({
      channelId,
      userId,
      topicKey: `team:${skill}`,
      agentId,
    });
    const session = this.sessionPool.getOrCreate({
      channelId,
      userId,
      topicKey: `team:${skill}`,
      agentId,
    });

    // 加载 skill 指令
    const skillRecord = this.registry.loadSkillInstructions(agentId, skill);

    // 构造 system prompt: agent + skill
    let systemPrompt = agentDef.systemPrompt ?? '';
    if (skillRecord?.body) {
      systemPrompt += `\n\n# 当前 Skill: ${skill}\n${skillRecord.body}`;
    }

    // 调用 LLM
    const userText = `<instructions>\n${systemPrompt}\n</instructions>\n\n<input>\n${text}\n</input>`;
    let reply;
    if (this.multiAgentManager?.piBridge?.available) {
      reply = await this.multiAgentManager.piBridge.prompt(systemPrompt, text);
    } else {
      throw new Error('piBridge 不可用');
    }

    // 记录 session
    const userTokens = SessionPool.estimateTokens(text);
    const replyTokens = SessionPool.estimateTokens(reply ?? '');
    await this.sessionPool.addTurn(sessionKey, 'user', text, userTokens);
    const compressResult = await this.sessionPool.addTurn(sessionKey, 'assistant', reply ?? '', replyTokens);

    return {
      agentId,
      agentDisplayName: agentDef.displayName,
      reply: reply ?? '(无响应)',
      sessionKey,
      compressed: compressResult.compressed,
      compressionReason: compressResult.reason,
    };
  }

  /**
   * 生成最终汇总
   */
  _summarize(execution) {
    const lines = [];
    lines.push(`# Team 执行完成 - ${execution.teamId}`);
    lines.push(`ID: ${execution.id}`);
    lines.push(`开始: ${execution.startedAt}`);
    lines.push(`完成: ${execution.completedAt}`);
    lines.push(`耗时: ${((new Date(execution.completedAt) - new Date(execution.startedAt)) / 1000).toFixed(1)}s`);
    lines.push('');
    lines.push('## 各步骤结果');
    for (const r of execution.stepResults) {
      const label = r.label ?? `${r.agent}/${r.skill}`;
      lines.push(`### ${label}`);
      lines.push(`- Agent: ${r.agent}`);
      lines.push(`- Skill: ${r.skill}`);
      lines.push(`- 状态: ${r.status}`);
      if (r.result?.reply) {
        lines.push(`- 摘要: ${r.result.reply.slice(0, 200)}`);
      }
      if (r.error) {
        lines.push(`- 错误: ${r.error}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  /**
   * 列出所有 team
   */
  listTeams() {
    return TEAMS.map(t => ({
      id: t.id,
      description: t.description,
      steps: t.steps.map(s => s.label),
      finalApproval: t.finalApproval,
    }));
  }

  /**
   * 查询 team 执行历史
   */
  listExecutions({ limit = 20, teamId = null } = {}) {
    const dir = resolve(this.rootDir, 'data/team-execution');
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse();
    const results = [];
    for (const f of files.slice(0, limit)) {
      try {
        const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        if (teamId && data.teamId !== teamId) continue;
        results.push(data);
      } catch {}
    }
    return results;
  }
}