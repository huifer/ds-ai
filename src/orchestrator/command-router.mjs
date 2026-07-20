// ~/pi-discord-agents/src/orchestrator/command-router.mjs
// Command Router:把 Discord 命令(!command)映射到 Agent/Skill/Team
//
// 设计要点:
//   1. 一个 command 对应一个 agent (1:1)
//   2. 一个 command 对应一组 agent (1:N) - 组成 team
//   3. 一个 agent 对应多 command (1:N)
//   4. 支持 approval workflow (需要审批才能执行)
//   5. 复用现有 AgentManager 的 parseCommand + setRoute 逻辑
//
// 这里的命令路由系统独立于 Router (自由文本路由),专门处理 !command 类命令。

import { parseCommand } from '../runtime/agent-manager.mjs';

/**
 * Command → Agent 映射定义
 *
 * 字段说明:
 *   cmd: 命令名 (e.g., 'lead')
 *   sub: 子命令 (e.g., 'new'),可选
 *   description: 命令说明
 *   agent: 主执行的 Agent id
 *   skill: Agent 内的 skill
 *   approval: 审批类型(可选),如 'quote-send'
 *   team: 协作 agent 列表(可选),用于复杂任务
 *   channelHint: 期望的频道(可选,用于频道感知)
 */
export const COMMAND_AGENT_MAP = [
  // ========== 内容流水线 ==========
  { cmd: 'intake', sub: 'now', agent: 'intake', skill: 'daily-intake', approval: null,
    description: '手动触发内容采集' },
  { cmd: 'distill', sub: 'now', agent: 'distill', skill: 'distill-run', approval: null,
    description: '手动触发素材蒸馏' },
  { cmd: 'brief', sub: '*', agent: 'distill', skill: 'distill-brief', approval: null,
    description: '生成内容 brief' },
  { cmd: 'render', sub: '*', agent: 'renderer', skill: 'platform-render', approval: null,
    description: '渲染内容到指定平台' },
  { cmd: 'auto-render', sub: '*', agent: 'renderer', skill: 'platform-render', approval: null,
    description: '自动渲染并投递' },
  { cmd: 'publish', sub: '*', agent: 'publisher', skill: 'platform-publish', approval: 'publish-domestic',
    description: '发布到指定平台(需审批)' },
  { cmd: 'qa', sub: 'last', agent: 'qa', skill: 'qa-report', approval: null,
    description: '查看 QA 报告' },
  { cmd: 'qa', sub: 'plan', agent: 'qa', skill: 'test-plan', approval: null,
    description: '生成测试计划' },
  { cmd: 'qa', sub: 'accept', agent: 'qa', skill: 'acceptance', approval: null,
    description: '验收测试' },
  { cmd: 'qa', sub: 'defect', agent: 'qa', skill: 'defect', approval: null,
    description: '上报缺陷' },
  { cmd: 'privacy', sub: 'check', agent: 'privacy', skill: 'privacy-redact', approval: null,
    description: '隐私审查' },
  { cmd: 'fact', sub: 'check', agent: 'fact-check', skill: 'fact-check', approval: null,
    description: '事实核查' },

  // ========== 项目管理 ==========
  { cmd: 'pr', sub: 'new', agent: 'pm', skill: 'project-bootstrap', approval: null,
    description: '创建新项目' },
  { cmd: 'pr', sub: 'list', agent: 'pm', skill: 'project-list', approval: null,
    description: '列出项目' },
  { cmd: 'build', sub: 'stage', agent: 'pm', skill: 'stage-gate', approval: null,
    description: '推进阶段门' },
  { cmd: 'pm', sub: 'plan', agent: 'project', skill: 'plan-build', approval: null,
    description: '构建项目计划',
    channelHint: ['项目管理', '主入口'] },
  { cmd: 'pm', sub: 'weekly', agent: 'project', skill: 'weekly-report', approval: null,
    description: '生成周报' },
  { cmd: 'pm', sub: 'risk', agent: 'project', skill: 'raid', approval: null,
    description: '风险管理 RAID' },

  // ========== 销售与合同 ==========
  { cmd: 'lead', sub: 'new', agent: 'sales', skill: 'lead-capture', approval: null,
    description: '录入新线索',
    channelHint: ['销售线索', '主入口'] },
  { cmd: 'lead', sub: 'list', agent: 'sales', skill: 'lead-list', approval: null,
    description: '列出线索' },
  { cmd: 'lead', sub: 'qualify', agent: 'sales', skill: 'qualification', approval: null,
    description: '线索资质评估' },
  { cmd: 'quote', sub: 'draft', agent: 'quote', skill: 'estimate', approval: null,
    description: '起草报价' },
  { cmd: 'quote', sub: 'set', agent: 'quote', skill: 'discount', approval: null,
    description: '设置折扣' },
  { cmd: 'quote', sub: 'approve', agent: 'chief', skill: 'approval-handle', approval: 'quote-send',
    description: '审批报价(需审批)' },
  { cmd: 'bid', sub: 'start', agent: 'bid', skill: 'tender-ingestion', approval: null,
    description: '启动投标' },
  { cmd: 'bid', sub: 'compliance', agent: 'bid', skill: 'compliance-matrix', approval: null,
    description: '投标合规检查' },
  { cmd: 'bid', sub: 'submit', agent: 'chief', skill: 'approval-handle', approval: 'bid-submit',
    description: '提交投标(需审批)' },
  { cmd: 'contract', sub: 'new', agent: 'contract', skill: 'contract-summarize', approval: null,
    description: '新建合同摘要' },
  { cmd: 'contract', sub: 'risk', agent: 'contract', skill: 'risk-register', approval: null,
    description: '合同风险登记' },
  { cmd: 'contract', sub: 'sign', agent: 'chief', skill: 'approval-handle', approval: 'contract-sign',
    description: '签合同(需审批)' },

  // ========== 解决方案 ==========
  { cmd: 'prd', sub: 'v0.1', agent: 'solution', skill: 'prd-v01', approval: null,
    description: '生成 PRD v0.1' },
  { cmd: 'prd', sub: 'v1.0', agent: 'solution', skill: 'prd-v10', approval: null,
    description: '生成 PRD v1.0' },
  { cmd: 'prd', sub: 'diff', agent: 'solution', skill: 'prd-diff', approval: null,
    description: 'PRD diff' },
  { cmd: 'research', sub: 'new', agent: 'solution', skill: 'research-notebook', approval: null,
    description: '新建调研' },
  { cmd: 'research', sub: 'update', agent: 'solution', skill: 'research-notebook', approval: null,
    description: '更新调研' },
  { cmd: 'disc', sub: 'start', agent: 'solution', skill: 'discovery', approval: null,
    description: '启动 Discovery' },
  { cmd: 'disc', sub: 'set', agent: 'solution', skill: 'discovery', approval: null,
    description: '设置 Discovery' },

  // ========== 开发 ==========
  { cmd: 'demo', sub: 'new', agent: 'coding', skill: 'react-demo', approval: null,
    description: '新建 React demo' },
  { cmd: 'demo', sub: 'refactor', agent: 'coding', skill: 'react-design', approval: null,
    description: '重构 demo' },
  { cmd: 'demo', sub: 'approve', agent: 'chief', skill: 'approval-handle', approval: 'demo-approve',
    description: '审批 demo' },
  { cmd: 'demo', sub: 'request-changes', agent: 'coding', skill: 'react-design', approval: null,
    description: '请求修改' },
  { cmd: 'demo', sub: 'run', agent: 'coding', skill: 'codespace-build', approval: null,
    description: '运行 demo' },

  // ========== 交付与运维 ==========
  { cmd: 'poc', sub: 'start', agent: 'delivery', skill: 'poc-plan', approval: null,
    description: '启动 POC' },
  { cmd: 'poc', sub: 'deploy', agent: 'chief', skill: 'approval-handle', approval: 'prod-deploy',
    description: '部署到生产(需审批)' },
  { cmd: 'incident', sub: '*', agent: 'delivery', skill: 'incident', approval: null,
    description: '处理事故' },

  // ========== 客户成功 ==========
  { cmd: 'cs', sub: 'document', agent: 'cs', skill: 'knowledge-redact', approval: null,
    description: '客户文档脱敏' },
  { cmd: 'cs', sub: 'health', agent: 'cs', skill: 'health-report', approval: null,
    description: '客户健康度报告' },
  { cmd: 'cs', sub: 'qbr', agent: 'cs', skill: 'qbr', approval: null,
    description: 'QBR 报告' },

  // ========== 财务 ==========
  { cmd: 'invoice', sub: 'request', agent: 'finance', skill: 'invoice-request', approval: 'invoice-approval',
    description: '申请开票(需审批)' },
  { cmd: 'invoice', sub: 'remind', agent: 'finance', skill: 'reminder', approval: null,
    description: '催收提醒' },

  // ========== 总控 / 审批 ==========
  { cmd: 'state', sub: '*', agent: 'chief', skill: 'status-read', approval: null,
    description: '查看 Agent 状态' },
  { cmd: 'restart', sub: '*', agent: 'chief', skill: 'restart', approval: null,
    description: '重启 Agent' },
  { cmd: 'cost', sub: '*', agent: 'chief', skill: 'cost-read', approval: null,
    description: '查看成本' },
  { cmd: 'memory', sub: '*', agent: 'chief', skill: 'memory-read', approval: null,
    description: '查看记忆' },
  { cmd: 'approve', sub: '*', agent: 'approver', skill: 'approval-handle', approval: null,
    description: '批准审批项',
    channelHint: ['审批中心'] },
  { cmd: 'reject', sub: '*', agent: 'approver', skill: 'approval-handle', approval: null,
    description: '拒绝审批项' },
  { cmd: 'defer', sub: '*', agent: 'approver', skill: 'approval-handle', approval: null,
    description: '延迟审批项' },
  { cmd: 'deliver', sub: '*', agent: 'renderer', skill: 'platform-deliver', approval: null,
    description: '投递到预览频道' },
];

/**
 * 复杂任务 = Team(多 Agent 协作)
 *
 * 当单个 command 需要多个 agent 协作时,用 team 编排
 */
export const COMMAND_TEAMS = [
  {
    id: 'lead-to-contract',
    description: '线索 → 商机 → 报价 → 合同 全流程',
    trigger: /^!lead-to-contract\s+(.+)/,
    steps: [
      { agent: 'sales', skill: 'lead-capture', label: '1. 创建线索' },
      { agent: 'sales', skill: 'qualification', label: '2. 资质评估' },
      { agent: 'quote', skill: 'estimate', label: '3. 报价生成' },
      { agent: 'contract', skill: 'contract-summarize', label: '4. 合同摘要' },
    ],
    finalApproval: 'contract-sign',
  },
  {
    id: 'idea-to-publish',
    description: '灵感 → 素材 → 渲染 → 发布 全流程',
    trigger: /^!idea-to-publish\s+(.+)/,
    steps: [
      { agent: 'distill', skill: 'distill-brief', label: '1. 内容 brief' },
      { agent: 'renderer', skill: 'platform-render', label: '2. 平台渲染' },
      { agent: 'qa', skill: 'qa-report', label: '3. QA 检查' },
      { agent: 'publisher', skill: 'platform-publish', label: '4. 发布' },
    ],
    finalApproval: 'publish-domestic',
  },
  {
    id: 'pr-full-cycle',
    description: '项目立项 → 计划 → POC → 部署 全流程',
    trigger: /^!pr-full-cycle\s+(.+)/,
    steps: [
      { agent: 'pm', skill: 'project-bootstrap', label: '1. 项目立项' },
      { agent: 'project', skill: 'plan-build', label: '2. 计划构建' },
      { agent: 'solution', skill: 'prd-v10', label: '3. PRD v1.0' },
      { agent: 'delivery', skill: 'poc-plan', label: '4. POC 计划' },
      { agent: 'qa', skill: 'test-plan', label: '5. 测试计划' },
    ],
    finalApproval: 'prod-deploy',
  },
];

/**
 * CommandRouter:处理 Discord 命令路由
 */
export class CommandRouter {
  constructor({ agentRegistry, log = () => {} }) {
    this.registry = agentRegistry;
    this.log = log;
    this.byKey = new Map(); // "cmd::sub" -> def
    this.teamsByPattern = [];

    for (const def of COMMAND_AGENT_MAP) {
      const key = `${def.cmd}::${def.sub ?? '*'}`;
      this.byKey.set(key, def);
      if (def.sub === '*') {
        // 通配符也算匹配
        this.byKey.set(`${def.cmd}::*`, def);
      }
    }

    for (const team of COMMAND_TEAMS) {
      this.teamsByPattern.push(team);
    }
  }

  /**
   * 路由一个命令文本
   * @returns {RoutingResult | TeamExecutionPlan | null}
   */
  route(text) {
    const cmd = parseCommand(text);
    if (!cmd) return null;

    // 检查是否是 team 命令
    for (const team of this.teamsByPattern) {
      const m = text.match(team.trigger);
      if (m) {
        return {
          type: 'team',
          team,
          command: cmd,
          match: m,
        };
      }
    }

    // 单 agent 命令
    const key = `${cmd.name}::${cmd.sub ?? '*'}`;
    let def = this.byKey.get(key);
    if (!def && cmd.sub) {
      // 尝试通配
      def = this.byKey.get(`${cmd.name}::*`);
    }
    if (!def) return null;

    return {
      type: 'single',
      command: cmd,
      agent: def.agent,
      skill: def.skill,
      approval: def.approval,
      description: def.description,
      channelHint: def.channelHint,
    };
  }

  /**
   * 列出所有命令(用于 !help)
   */
  listCommands() {
    return COMMAND_AGENT_MAP.map(d => ({
      cmd: d.cmd,
      sub: d.sub,
      agent: d.agent,
      description: d.description,
      approval: d.approval,
      signature: d.sub && d.sub !== '*'
        ? `!${d.cmd} ${d.sub}`
        : `!${d.cmd}`,
    }));
  }

  /**
   * 列出所有 team
   */
  listTeams() {
    return COMMAND_TEAMS.map(t => ({
      id: t.id,
      description: t.description,
      steps: t.steps.map(s => `${s.label} (${s.agent}/${s.skill})`),
    }));
  }

  /**
   * 检查 agent 是否支持某个 skill
   */
  canHandle(agentId, skill) {
    const def = this.registry.get(agentId);
    if (!def) return false;
    return def.skills?.includes(skill) ?? false;
  }
}