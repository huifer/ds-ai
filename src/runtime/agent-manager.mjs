// ~/pi-discord-agents/src/runtime/agent-manager.mjs
// AgentManager 运行时
// 负责 19 个 Agent 的注册、Session 隔离、Skill 加载、Memory Scope、错误回退。
// 由 src/entry-bot.mjs 启动时构造并 start()。
// call() 分发：本地实现（invokeLocalSkill / _dispatchContent）优先，未命中走 Pi RPC（_invokeViaPi）。

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

import { SkillLoader } from './skill-loader.mjs';
import { SessionStore } from './session-store.mjs';
import { MemoryScope } from './memory-scope.mjs';
import { Approval } from './approval.mjs';

const ROOT = resolve(process.cwd());

export class AgentManager {
  constructor({ root = ROOT, registryPath, logger = console, piBridge, publisher } = {}) {
    this.root = root;
    this.registryPath = registryPath ?? resolve(root, 'agent-core/agents/registry.json');
    this.logger = logger;
    this.piBridge = piBridge ?? null;
    this.publisher = publisher ?? null;
    this.agents = new Map();
    this.skillLoader = new SkillLoader({ root });
    this.sessionStore = new SessionStore({ root });
    this.memoryScope = new MemoryScope({ root });
    this.approval = new Approval({ root });
    this.startedAt = null;
  }

  async start() {
    this.startedAt = new Date().toISOString();
    this.logger.log?.(`[agent-manager] start at ${this.startedAt}`);
    const registry = this.loadRegistry();
    for (const def of registry.agents) {
      this.registerAgent(def);
    }
    await this.skillLoader.warmup();
    this.logger.log?.(`[agent-manager] registered ${this.agents.size} agents`);
  }

  registerAgent(def) {
    this.validateAgent(def);
    this.agents.set(def.id, {
      def,
      state: 'idle',
      lastRunAt: null,
      lastError: null,
      sessionCount: 0,
      tokenUsage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      costUsd: 0,
    });
  }

  validateAgent(def) {
    const required = ['id', 'displayName', 'runtime', 'skills', 'memory', 'channels'];
    for (const k of required) {
      if (!def[k]) throw new Error(`agent def missing field: ${k}`);
    }
    if (!def.runtime.sessionScope) throw new Error(`agent ${def.id} missing sessionScope`);
    if (!def.memory.writeScope) throw new Error(`agent ${def.id} missing writeScope`);
  }

  loadRegistry() {
    if (!existsSync(this.registryPath)) {
      throw new Error(`agent registry not found: ${this.registryPath}`);
    }
    return JSON.parse(readFileSync(this.registryPath, 'utf8'));
  }

  resolveSessionKey(agentId, opts = {}) {
    const def = this.agents.get(agentId);
    if (!def) throw new Error(`agent not found: ${agentId}`);
    switch (def.def.runtime.sessionScope) {
      case 'persistent':
        return `${agentId}:global`;
      case 'daily': {
        const today = new Date().toISOString().slice(0, 10);
        return `${agentId}:day:${today}`;
      }
      case 'per-thread': {
        const t = opts.threadKey ?? 'no-thread';
        return `${agentId}:thread:${t}`;
      }
      case 'per-artifact': {
        const a = opts.artifactId ?? 'no-artifact';
        return `${agentId}:artifact:${a}`;
      }
      case 'per-project': {
        const p = opts.prjId ?? 'no-project';
        return `${agentId}:project:${p}`;
      }
      default:
        throw new Error(`agent ${agentId} invalid sessionScope`);
    }
  }

  agentHasSkill(agentId, skill) {
    const slot = this.agents.get(agentId);
    if (!slot) return false;
    return slot.def.skills.some((s) => {
      const base = String(s).split('/').pop() ?? '';
      const short = base.replace(/\.skill\.md$/, '');
      return s === skill || base === skill || short === skill;
    });
  }

  async invokeLocalSkill(agentId, skill, payload) {
    try {
      if (agentId === 'pm' && skill === 'project-bootstrap') {
        const { projectBootstrap } = await import('./commands/project-bootstrap.mjs');
        const args = payload?.args ?? {};
        const alias = args.alias ?? args._positional?.[0];
        const industry = args.industry ?? args._positional?.[1];
        const requirement = args.requirement ?? (args._positional ? args._positional.slice(2).join(' ') : '');
        if (!alias || !industry || !requirement) {
          throw new Error(`!pr new 缺少参数：alias=${alias} industry=${industry} requirement=${requirement}; full args=${JSON.stringify(args)}`);
        }
        return { status: 'OK', agentId, skill, result: await projectBootstrap({ alias, industry, requirement, channel: payload?.channelId }) };
      }
      if (agentId === 'pm' && skill === 'project-list') {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const indexPath = path.resolve(this.root, 'data/business/projects/index.yaml');
        return { status: 'OK', agentId, skill, output: fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '' };
      }
      if (agentId === 'coding' && skill === 'react-demo') {
        const { reactDemoNew } = await import('./commands/react-demo.mjs');
        const args = payload?.args ?? {};
        const prjId = args.prjId ?? args._positional?.[0];
        const alias = args.alias;
        const industry = args.industry;
        if (!prjId) throw new Error('!demo new 缺少 prjId');
        return { status: 'OK', agentId, skill, result: await reactDemoNew({ prjId, alias, industry }) };
      }
      if (agentId === 'chief' && skill === 'approval-handle') {
        const args = payload?.args ?? {};
        const id = args.id ?? args._id ?? args._positional?.[0];
        if (!id) throw new Error('!approve / !reject / !defer 缺少 id');
        // 决策：approve 默认；reject / defer 来自 cmd.name
        const decision = payload?.decision
          ?? (['reject', 'defer'].includes(payload?.cmdName) ? payload.cmdName : 'approve');
        const userId = payload?.userId ?? 'unknown';
        const result = await this.approval.grant(id, decision, userId, args.note);
        return { status: 'OK', agentId, skill, result };
      }
      if (agentId === 'chief' && skill === 'status-read') {
        // !state —— 只读汇总所有 Agent 的运行状态
        const rows = this.getStatus().map((s) => {
          const err = s.lastError ? ` · ⚠️${String(s.lastError).slice(0, 50)}` : '';
          return `${(s.agentId || '').padEnd(12)} ${(s.state || '').padEnd(8)} runs=${s.sessionCount ?? 0}${err}`;
        });
        return {
          status: 'OK', agentId, skill,
          output: ['agent         state    info', ...rows].join('\n'),
        };
      }
      if (agentId === 'chief' && skill === 'cost-read') {
        // !cost —— 只读：最新 token 用量报告摘要
        const fs = await import('node:fs');
        const path = await import('node:path');
        const dir = path.resolve(this.root, 'data/token-usage');
        let out = '(暂无 token 用量报告；运行 !usage 生成)';
        try {
          const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().reverse();
          if (files.length) {
            const text = fs.readFileSync(path.join(dir, files[0]), 'utf8');
            out = `# 最新用量报告 (${files[0]})\n\n` + text.slice(0, 1500)
              + (text.length > 1500 ? '\n\n…(截断，完整报告见 data/token-usage/)' : '');
          }
        } catch {}
        return { status: 'OK', agentId, skill, output: out };
      }
      // ===== 内容流水线 =====
      const contentResult = await this._dispatchContent(agentId, skill, payload);
      if (contentResult) return contentResult;
    } catch (e) {
      return { status: 'ERROR', agentId, skill, error: e.message };
    }
    return null;
  }

  // 通用 Pi RPC 分发：未实现本地 handler 的 skill，交给 Pi Agent 执行。
  // 读 registry 声明的 skill 文件作为指令；skill 文件缺失则用通用指令降级。
  async _invokeViaPi(agentId, skill, payload, sessionKey) {
    const slot = this.agents.get(agentId);
    const skillPath = slot.def.skills.find((s) => {
      const base = String(s).split('/').pop() ?? '';
      const short = base.replace(/\.skill\.md$/, '');
      return base === skill || short === skill || base === `${skill}.skill.md`;
    });
    let instructions = '';
    if (skillPath) {
      try { instructions = this.skillLoader.load(skillPath).body; } catch {}
    }
    const userText = String(payload?.text ?? '').replace(/^!\S+(\s+\S+)?\s*/, '').trim() || '(无附加输入)';
    const systemPrompt = [
      `你是 ${slot.def.displayName || agentId} Agent（id=${agentId}），正在执行 skill "${skill}"。`,
      instructions
        ? `# Skill 指令\n${instructions}`
        : `# 通用指令\n根据你的职责完成以下任务；如需持久化，用 file/bash 工具写入 data/business/ 相应目录。`,
      '完成后用清晰的结构化文本回复。',
    ].join('\n\n');
    let reply = null;
    try {
      reply = await this.piBridge.prompt(systemPrompt, userText);
    } catch (e) {
      return {
        status: 'ERROR', agentId, skill,
        error: `Pi RPC 调用失败: ${e.message}`,
        sessionKey, hash: createHash('sha1').update(sessionKey).digest('hex'),
      };
    }
    return {
      status: 'OK', agentId, skill,
      result: { output: reply || '(Pi Agent 无响应)', via: 'pi-rpc', skillFile: skillPath || null },
      sessionKey, hash: createHash('sha1').update(sessionKey).digest('hex'),
    };
  }

  async _dispatchContent(agentId, skill, payload) {
    const CONTENT_AGENTS = new Set(['intake', 'distill', 'privacy', 'fact-check', 'renderer', 'publisher', 'qa']);
    if (!CONTENT_AGENTS.has(agentId)) return null;
    const content = await import('./commands/content.mjs');
    const args = payload?.args ?? {};
    // 按 (agentId, skill) 精确分发：只有显式声明的组合才执行；
    // 未匹配返回 null → call() 返回"未实现"错误，避免 skill 被忽略导致错位执行
    // （原实现按 agentId switch，会把 !qa plan/accept/defect 全部错跑成 qaReport）。
    const text = payload?.text ?? '';

    if (agentId === 'intake' && skill === 'daily-intake') {
      return { status: 'OK', agentId, skill, result: await content.intakeNow({
        source: args.source ?? args._positional?.join(' ') ?? text.replace(/^!?\S+\s+\S+\s*/, ''),
        note: args.note,
        channelId: payload?.channelId,
        userId: payload?.userId,
      }) };
    }

    if (agentId === 'distill' && (skill === 'distill-run' || skill === 'distill-brief')) {
      return { status: 'OK', agentId, skill, result: await content.distillRun({
        matId: args.mat ?? args._positional?.[0],
        piBridge: this.piBridge,
      }) };
    }

    if (agentId === 'privacy' && skill === 'privacy-redact') {
      return { status: 'OK', agentId, skill, result: await content.privacyCheck({
        cntId: args.cnt ?? args._positional?.[0],
      }) };
    }

    if (agentId === 'fact-check' && skill === 'fact-check') {
      return { status: 'OK', agentId, skill, result: await content.factCheck({
        cntId: args.cnt ?? args._positional?.[0],
        piBridge: this.piBridge,
      }) };
    }

    if (agentId === 'renderer' && skill === 'platform-render') {
      if (text.startsWith('!auto-render')) {
        const cntId = args.cnt ?? args._positional?.[0];
        const platforms = args.platforms?.split(',');
        return { status: 'OK', agentId, skill, result: await content.autoRender({ cntId, platforms, piBridge: this.piBridge }) };
      }
      return { status: 'OK', agentId, skill, result: await content.renderPlatform({
        cntId: args.cnt,
        platform: args.platform,
        piBridge: this.piBridge,
      }) };
    }

    if (agentId === 'publisher' && skill === 'platform-publish') {
      return { status: 'OK', agentId, skill, result: await content.publishPlatform({
        rndId: args.rnd,
        platform: args.platform,
        publisher: this.publisher,
      }) };
    }

    // qa: 本地仅处理 qa-report；test-plan / acceptance / defect 走 _invokeViaPi（Pi RPC）
    if (agentId === 'qa' && skill === 'qa-report') {
      return { status: 'OK', agentId, skill, result: await content.qaReport({
        pubId: args.pub ?? args._positional?.[0],
        range: args.range,
      }) };
    }

    return null;
  }

  async dispatch({ source, channelId, userId, text, threadKey, prjId, artifactId }) {
    if (!text) return { status: 'ERROR', error: 'EMPTY_MESSAGE' };
    const cmd = parseCommand(text);
    if (!cmd) {
      return { status: 'ERROR', error: 'UNKNOWN_COMMAND', raw: text };
    }
    const route = cmd.route;
    if (!route) return { status: 'ERROR', error: 'UNKNOWN_ROUTE', command: cmd.name, sub: cmd.sub };
    const { agentId, skill, approval } = route;
    const args = cmd.args ?? {};
    if (!this.agents.has(agentId)) {
      return { status: 'ERROR', error: 'AGENT_NOT_FOUND', agentId };
    }
    if (approval) {
      const objectId = cmd.args._id
        ?? cmd.args.rnd
        ?? cmd.args.cnt
        ?? cmd.args.prjId
        ?? cmd.args._positional?.[0]
        ?? (cmd.name + ':' + (cmd.sub ?? '*'));
      const result = await this.approval.check(approval, {
        producer: agentId,
        objectId,
        summary: `${cmd.name} ${cmd.sub} ${JSON.stringify(cmd.args)}`.slice(0, 240),
        evidence: cmd.args.evidence ? [cmd.args.evidence] : [],
      });
      if (result.status === 'NEED_APPROVAL') {
        return {
          status: 'NEED_APPROVAL',
          approvalKind: approval,
          approvalId: result.approval.id,
          channel: this.approval.configFor(approval)?.channel,
          agentId,
          skill,
          args,
          channelId,
        };
      }
      if (result.status === 'REJECTED' || result.status === 'EXPIRED') {
        return { status: result.status, agentId, skill, args, channelId };
      }
    }
    return this.call(agentId, skill, {
      source,
      channelId,
      userId,
      text,
      args,
      threadKey,
      prjId,
      artifactId,
      cmdName: cmd.name,
      decision: cmd.name === 'reject' ? 'reject' : cmd.name === 'defer' ? 'defer' : 'approve',
    });
  }

  async call(agentId, skill, payload) {
    const slot = this.agents.get(agentId);
    if (!slot) return { status: 'ERROR', error: 'AGENT_NOT_FOUND', agentId };
    if (!this.agentHasSkill(agentId, skill)) {
      return { status: 'ERROR', error: 'SKILL_NOT_FOUND', agentId, skill };
    }
    const sessionKey = this.resolveSessionKey(agentId, payload);
    await this.sessionStore.append(sessionKey, { role: 'user', payload });
    slot.state = 'running';
    slot.lastRunAt = new Date().toISOString();
    slot.sessionCount += 1;
    const local = await this.invokeLocalSkill(agentId, skill, payload);
    let result;
    if (local) {
      // 本地 Skill 实现命中：保留额外字段 (result / output 等)
      result = local;
      result.sessionKey = sessionKey;
      result.hash = createHash('sha1').update(sessionKey).digest('hex');
    } else if (this.piBridge && this.piBridge.available) {
      // 通用 Pi RPC 分发：无本地 handler 的 skill 交给 Pi Agent 执行
      // （读 registry 声明的 skill 文件作指令；缺失则通用指令降级）。
      // 这是无本地 handler 的 skill 获得真实行为的主路径（Pi RPC 通用分发）。
      result = await this._invokeViaPi(agentId, skill, payload, sessionKey);
    } else {
      // 未实现且 Pi RPC 不可用：明确返回错误，绝不伪装成成功。
      result = {
        status: 'ERROR',
        agentId,
        skill,
        error: `skill 未实现且 Pi RPC 不可用: ${agentId}/${skill}`,
        sessionKey,
        hash: createHash('sha1').update(sessionKey).digest('hex'),
      };
      slot.lastError = result.error;
    }
    slot.state = 'idle';
    await this.sessionStore.append(sessionKey, { role: 'agent', result });
    return result;
  }

  getStatus(agentId) {
    if (!agentId) {
      return Array.from(this.agents.entries()).map(([id, slot]) => ({
        agentId: id,
        state: slot.state,
        lastRunAt: slot.lastRunAt,
        lastError: slot.lastError,
        sessionCount: slot.sessionCount,
        tokenUsage: slot.tokenUsage,
        costUsd: slot.costUsd,
      }));
    }
    const slot = this.agents.get(agentId);
    if (!slot) return null;
    return { agentId, ...slot };
  }

  async shutdown() {
    this.logger.log?.('[agent-manager] shutdown');
    await this.sessionStore.flush();
  }
}

// ===== 命令解析 =====
const BUTTON_COMMANDS = new Set(['approve', 'reject', 'defer']);

export function parseCommand(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed.startsWith('!')) return null;
  // 按钮型命令：!approve / !reject / !defer <id>，第一个参数是 id，不作为 sub
  if (BUTTON_COMMANDS.has(trimmed.split(/\s+/)[0]?.replace(/^!/, ''))) {
    const name = trimmed.split(/\s+/)[0].replace(/^!/, '');
    const restStr = trimmed.replace(/^!\S+\s*/, '');
    const args = parseArgs(restStr);
    if (args._positional?.length) args.id = args._positional[0];
    return {
      raw: trimmed,
      name,
      sub: undefined,
      args,
      route: lookupRoute(name, undefined),
    };
  }
  const headMatch = trimmed.match(/^!(\S+)(?:\s+(\S+))?(?:\s+(.*))?$/s);
  if (!headMatch) return null;
  const [, name, subRaw, restStr = ''] = headMatch;
  if (!name) return null;
  // key=value 格式的 token 不当 sub，合并到 restStr
  let sub = subRaw;
  let rest = restStr;
  if (subRaw && subRaw.includes('=')) {
    rest = `${subRaw} ${restStr}`.trim();
    sub = undefined;
  }
  const args = parseArgs(rest);
  if (['approve', 'reject', 'defer'].includes(name) && args._positional?.length) {
    args.id = args._positional[0];
  }
  return {
    raw: trimmed,
    name,
    sub,
    args,
    route: lookupRoute(name, sub),
  };
}

function parseArgs(s) {
  const out = {};
  if (!s) return out;
  // 支持 --key=val, -key=val, key=val（无前缀也接受）
  const re = /-*([a-zA-Z][a-zA-Z0-9-]*)=(?:"([^"]*)"|(\S+))/g;
  let m;
  while ((m = re.exec(s))) {
    out[m[1]] = m[2] ?? m[3] ?? '';
  }
  const usedVals = new Set(Object.values(out));
  const quotedRe = /"([^"]*)"|'([^']*)'|(\S+)/g;
  while ((m = quotedRe.exec(s))) {
    const val = m[1] ?? m[2] ?? m[3];
    if (val == null) continue;
    if (val.includes('=')) continue; // key=value token 已被上面提取
    if (val.startsWith('-') && val.includes('=')) continue;
    if (usedVals.has(val)) continue;
    if (!out._positional) out._positional = [];
    out._positional.push(val);
  }
  return out;
}

const ROUTES = new Map();
function setRoute(name, sub, value) {
  const k = `${name}::${sub ?? '*'}`;
  ROUTES.set(k, value);
  if (sub) ROUTES.set(`${name}::*`, value);
}
function lookupRoute(name, sub) {
  if (sub) {
    return ROUTES.get(`${name}::${sub}`) ?? ROUTES.get(`${name}::*`) ?? null;
  }
  return ROUTES.get(`${name}::*`) ?? null;
}

setRoute('intake', 'now', { agentId: 'intake', skill: 'daily-intake', approval: null });
setRoute('distill', 'now', { agentId: 'distill', skill: 'distill-run', approval: null });
setRoute('render', '*', { agentId: 'renderer', skill: 'platform-render', approval: null });
setRoute('publish', '*', { agentId: 'publisher', skill: 'platform-publish', approval: 'publish-domestic' });
setRoute('qa', 'last', { agentId: 'qa', skill: 'qa-report', approval: null });
setRoute('brief', '*', { agentId: 'distill', skill: 'distill-brief', approval: null });
setRoute('privacy', 'check', { agentId: 'privacy', skill: 'privacy-redact', approval: null });
setRoute('fact', 'check', { agentId: 'fact-check', skill: 'fact-check', approval: null });
setRoute('auto-render', '*', { agentId: 'renderer', skill: 'platform-render', approval: null });
setRoute('render', 'html', { agentId: 'renderer', skill: 'platform-render', approval: null });
setRoute('pr', 'new', { agentId: 'pm', skill: 'project-bootstrap', approval: null });
setRoute('pr', 'list', { agentId: 'pm', skill: 'project-list', approval: null });
setRoute('prd', 'v0.1', { agentId: 'solution', skill: 'prd-v01', approval: null });
setRoute('prd', 'v1.0', { agentId: 'solution', skill: 'prd-v10', approval: null });
setRoute('prd', 'diff', { agentId: 'solution', skill: 'prd-diff', approval: null });
setRoute('demo', 'new', { agentId: 'coding', skill: 'react-demo', approval: null });
setRoute('demo', 'refactor', { agentId: 'coding', skill: 'react-design', approval: null });
setRoute('demo', 'approve', { agentId: 'chief', skill: 'approval-handle', approval: 'demo-approve' });
setRoute('demo', 'request-changes', { agentId: 'coding', skill: 'react-design', approval: null });
setRoute('demo', 'run', { agentId: 'coding', skill: 'codespace-build', approval: null });
setRoute('research', 'new', { agentId: 'solution', skill: 'research-notebook', approval: null });
setRoute('research', 'update', { agentId: 'solution', skill: 'research-notebook', approval: null });
setRoute('build', 'stage', { agentId: 'pm', skill: 'stage-gate', approval: null });
setRoute('cs', 'document', { agentId: 'cs', skill: 'knowledge-redact', approval: null });
setRoute('lead', 'new', { agentId: 'sales', skill: 'lead-capture', approval: null });
setRoute('lead', 'list', { agentId: 'sales', skill: 'lead-list', approval: null });
setRoute('lead', 'qualify', { agentId: 'sales', skill: 'qualification', approval: null });
setRoute('disc', 'start', { agentId: 'solution', skill: 'discovery', approval: null });
setRoute('disc', 'set', { agentId: 'solution', skill: 'discovery', approval: null });
setRoute('quote', 'draft', { agentId: 'quote', skill: 'estimate', approval: null });
setRoute('quote', 'set', { agentId: 'quote', skill: 'discount', approval: null });
setRoute('quote', 'approve', { agentId: 'chief', skill: 'approval-handle', approval: 'quote-send' });
setRoute('bid', 'start', { agentId: 'bid', skill: 'tender-ingestion', approval: null });
setRoute('bid', 'compliance', { agentId: 'bid', skill: 'compliance-matrix', approval: null });
setRoute('bid', 'submit', { agentId: 'chief', skill: 'approval-handle', approval: 'bid-submit' });
setRoute('contract', 'new', { agentId: 'contract', skill: 'contract-summarize', approval: null });
setRoute('contract', 'risk', { agentId: 'contract', skill: 'risk-register', approval: null });
setRoute('contract', 'sign', { agentId: 'chief', skill: 'approval-handle', approval: 'contract-sign' });
setRoute('pm', 'plan', { agentId: 'pm', skill: 'plan-build', approval: null });
setRoute('pm', 'weekly', { agentId: 'pm', skill: 'weekly-report', approval: null });
setRoute('pm', 'risk', { agentId: 'pm', skill: 'raid', approval: null });
setRoute('poc', 'start', { agentId: 'delivery', skill: 'poc-plan', approval: null });
setRoute('poc', 'deploy', { agentId: 'delivery', skill: 'deploy', approval: 'prod-deploy' });
setRoute('incident', '*', { agentId: 'delivery', skill: 'incident', approval: null });
setRoute('qa', 'plan', { agentId: 'qa', skill: 'test-plan', approval: null });
setRoute('qa', 'accept', { agentId: 'qa', skill: 'acceptance', approval: null });
setRoute('qa', 'defect', { agentId: 'qa', skill: 'defect', approval: null });
setRoute('cs', 'health', { agentId: 'cs', skill: 'health-report', approval: null });
setRoute('cs', 'qbr', { agentId: 'cs', skill: 'qbr', approval: null });
setRoute('invoice', 'request', { agentId: 'finance', skill: 'invoice-request', approval: 'invoice-approval' });
setRoute('invoice', 'remind', { agentId: 'finance', skill: 'reminder', approval: null });
setRoute('state', '*', { agentId: 'chief', skill: 'status-read', approval: null });
setRoute('restart', '*', { agentId: 'chief', skill: 'restart', approval: null });
setRoute('cost', '*', { agentId: 'chief', skill: 'cost-read', approval: null });
setRoute('memory', '*', { agentId: 'chief', skill: 'memory-read', approval: null });
setRoute('approve', '*', { agentId: 'chief', skill: 'approval-handle', approval: null });
setRoute('reject', '*', { agentId: 'chief', skill: 'approval-handle', approval: null });
setRoute('defer', '*', { agentId: 'chief', skill: 'approval-handle', approval: null });
