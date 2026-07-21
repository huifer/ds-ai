// ~/pi-discord-agents/src/orchestrator/agent-registry.mjs
// AgentRegistry:从 agent-core/agents/registry.json 加载真实 Agent 配置
//
// 关键改进:
//   1. 加载真实的 registry.json(19 个 agent)
//   2. 整合 skill-loader 加载真实的 skill .md 指令
//   3. 整合 channel-map 完成频道→Agent 反向映射
//   4. 复用现有 SkillLoader 实例(可热加载)
//   5. 整合 memory-scope 真实权限校验

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { SkillLoader } from '../runtime/skill-loader.mjs';
import { MemoryScope } from '../runtime/memory-scope.mjs';

/**
 * Agent → emoji 映射(给 Discord 显示用)
 */
const AGENT_EMOJI = {
  chief: '🎯',
  orchestrator: '🎯',
  intake: '📥',
  distill: '🧪',
  renderer: '🎨',
  publisher: '📤',
  qa: '🧐',
  privacy: '🛡️',
  'fact-check': '🔍',
  sales: '💰',
  solution: '💡',
  cost: '💵',
  quote: '📊',
  bid: '🏆',
  contract: '📜',
  pm: '📦',
  project: '📦',
  delivery: '🚀',
  cs: '🎓',
  finance: '💳',
  coding: '👨‍💻',
  dev: '👨‍💻',
  planner: '🧠',
  approver: '✅',
  'eng-kb': '📚',
  seo: '📈',
  marketing: '📣',
  'domestic-editor': '✍️',
  'overseas-editor': '🌍',
  asset: '🗄️',
  dreaming: '🌙',
};

/**
 * Agent → category 映射
 */
const AGENT_CATEGORY = {
  chief: '00-总控',
  orchestrator: '00-总控',
  planner: '00-总控',
  approver: '00-总控',
  intake: '40-内容流水线',
  distill: '40-内容流水线',
  renderer: '40-内容流水线',
  publisher: '40-内容流水线',
  qa: '40-内容流水线',
  privacy: '40-内容流水线',
  'fact-check': '40-内容流水线',
  sales: '10-企业服务',
  solution: '10-企业服务',
  cost: '10-企业服务',
  quote: '10-企业服务',
  bid: '10-企业服务',
  contract: '10-企业服务',
  pm: '10-企业服务',
  project: '10-企业服务',
  delivery: '10-企业服务',
  cs: '10-企业服务',
  finance: '10-企业服务',
  coding: '20-技术产品',
  dev: '20-技术产品',
  'eng-kb': '20-技术产品',
  seo: '30-增长商业',
  marketing: '30-增长商业',
  'domestic-editor': '40-国内总编',
  'overseas-editor': '50-海外总编',
  asset: '60-资产中心',
  dreaming: '遐思',
};

/**
 * 合成 agent 定义（channels-map.json 中声明但 registry.json 中未包含的）
 */
const SYNTHETIC_AGENT_DEFS = {
  dev: {
    displayName: 'Developer',
    description: '通用开发支持：代码评审、调试、技术咨询、架构讨论。',
    skills: ['code-review', 'debug', 'architecture'],
    memory: { readScopes: ['coding', 'fde-knowledge', 'current-project'], writeScope: 'coding' },
    tools: ['shell', 'pnpm'],
    channels: { main: 'CH_DEV_SOFTWARE' },
  },
  seo: {
    displayName: 'SEO/GEO',
    description: 'SEO/GEO 关键词研究、内容优化、外链策略、生成式引擎可见性。',
    skills: ['keyword-research', 'serp-analyze', 'geo-optimize', 'backlink-strategy'],
    memory: { readScopes: ['company', 'business', 'industry'], writeScope: 'agent-internal' },
    tools: ['web-search', 'tavily'],
    channels: { main: 'CH_SEO_GEO' },
  },
  marketing: {
    displayName: 'Marketing',
    description: '营销策略、增长复盘、市场调研、转化率优化。',
    skills: ['campaign-plan', 'market-research', 'growth-review'],
    memory: { readScopes: ['company', 'business', 'industry'], writeScope: 'agent-internal' },
    tools: ['web-search'],
    channels: { main: 'CH_MARKETING_GROWTH' },
  },
  dreaming: {
    displayName: 'Dreaming (遐思)',
    description: '主动联想、记忆蒸馏、产物生成（连珠、归藏、铭台）。',
    skills: ['lian-zhu', 'gui-cang', 'ming-tai'],
    memory: { readScopes: ['company', 'business', 'coding', 'content', 'sales', 'agent-internal'], writeScope: 'agent-internal' },
    tools: ['memory-search'],
    channels: { main: 'CH_XIASI' },
  },
  asset: {
    displayName: 'Asset Manager',
    description: '资产中心管理：文件归档、记忆治理、灵感捕捉、语义检索。',
    skills: ['file-manage', 'memory-manage', 'idea-capture', 'search'],
    memory: { readScopes: ['company', 'business', 'content'], writeScope: 'agent-internal' },
    tools: ['file', 'memory'],
    channels: { main: 'CH_INBOX' },
  },
  orchestrator: {
    displayName: 'Orchestrator',
    description: '主入口编排器：理解意图、拆分任务、协调多个专业 Agent。',
    skills: ['route', 'delegate', 'status', 'memory-read'],
    memory: { readScopes: ['company', 'business', 'agent-internal'], writeScope: 'agent-internal' },
    tools: ['agent-dispatch'],
    channels: { main: 'CH_ENTRY' },
  },
};

/**
 * Agent → 中文 category 名称
 */
const CATEGORY_LABEL = {
  '00-总控': '总控',
  '10-企业服务': '企业服务',
  '20-技术产品': '技术产品',
  '30-增长商业': '增长商业',
  '40-内容流水线': '内容流水线',
  '40-国内总编': '国内总编',
  '50-海外总编': '海外总编',
  '60-资产中心': '资产中心',
  '遐思': '遐思',
};

/**
 * Agent → system prompt 模板(基于真实配置生成)
 */
function buildSystemPrompt(agentDef) {
  const skillsList = agentDef.skills
    .map(s => s.split('/').pop()?.replace('.skill.md', '') ?? s)
    .join(', ');

  return `# ${agentDef.displayName} Agent

## 角色
${agentDef.description}

## 可用 Skill
${skillsList}

## 工具
${(agentDef.tools ?? []).join(', ')}

## 记忆权限
- 读: ${(agentDef.memory?.readScopes ?? []).join(', ')}
- 写: ${agentDef.memory?.writeScope ?? '(无)'}

## 行为准则
1. 严格按 Skill 文件的指令执行任务
2. 使用指定工具完成操作
3. 重要信息按权限写入对应 scope 的记忆
4. 不确定时询问用户而不是猜`;
}

/**
 * 规范化频道名(去除 emoji 前缀、变体符号)
 */
export function normalizeChannelName(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '')
    .replace(/^[\s\-_:·•]+/, '')
    .replace(/[\s\-_:·•]+$/, '')
    .trim();
}

/**
 * AgentRegistry
 */
export class AgentRegistry {
  constructor({ rootDir, log = () => {}, skillLoader = null, memoryScope = null } = {}) {
    this.rootDir = rootDir ?? resolve(process.cwd());
    this.log = log;
    this.skillLoader = skillLoader ?? new SkillLoader({ root: this.rootDir });
    this.memoryScope = memoryScope ?? new MemoryScope({ root: this.rootDir });

    this.agents = new Map();      // id -> def
    this.byChannel = new Map();   // channelName -> agentId
    this.bySkill = new Map();     // skillName -> agentId[]
    this.skillContent = new Map(); // skillName -> {body, agentId, path}

    // 频道 ID → 频道名 反向映射(运行时注入)
    this.idToName = new Map();
  }

  /**
   * 从 registry.json 加载所有 agent
   */
  loadFromRegistryJson(registryPath = 'agent-core/agents/registry.json', channelsMapPath = 'agent-core/agents/channels-map.json') {
    const absPath = resolve(this.rootDir, registryPath);
    if (!existsSync(absPath)) {
      throw new Error(`registry not found: ${absPath}`);
    }
    const data = JSON.parse(readFileSync(absPath, 'utf8'));
    this.log(`[agent-registry] 从 ${registryPath} 加载 ${data.agents.length} 个 agent`);

    // 加载扩展频道映射(可选)
    let channelsMap = {};
    const cmAbsPath = resolve(this.rootDir, channelsMapPath);
    if (existsSync(cmAbsPath)) {
      channelsMap = JSON.parse(readFileSync(cmAbsPath, 'utf8')).agents ?? {};
      this.log(`[agent-registry] 从 ${channelsMapPath} 加载 ${Object.keys(channelsMap).length} 个 agent 的扩展频道映射`);
    }

    for (const raw of data.agents) {
      const def = this._normalize(raw, channelsMap[raw.id]);
      this.register(def);
    }

    // 注册合成 agent（channels-map.json 中声明但 registry.json 中未包含的）
    for (const [agentId, channelsInfo] of Object.entries(channelsMap)) {
      if (this.agents.has(agentId)) continue;
      const syntheticRaw = SYNTHETIC_AGENT_DEFS[agentId];
      if (!syntheticRaw) continue;
      const merged = {
        id: agentId,
        ...syntheticRaw,
      };
      const def = this._normalize(merged, channelsInfo);
      def.synthetic = true;
      this.register(def);
      this.log(`[agent-registry] 注册合成 agent: ${agentId} (${def.skills.length} skills, ${def.channels.length} channels)`);
    }

    return this.agents.size;
  }

  /**
   * 标准化 agent 配置
   */
  _normalize(raw, extraChannelsMap = null) {
    const rawSkills = raw.skills ?? [];
    const skills = rawSkills.map(s => {
      const base = String(s).split('/').pop() ?? '';
      return base.replace('.skill.md', '');
    });

    // 如果是合成 agent(skills 已经是短名),补充完整路径
    const skillPaths = rawSkills.length > 0 && rawSkills[0].includes('/')
      ? rawSkills  // 真实 agent:已经是完整路径
      : rawSkills.map(s => `agent-core/agents/${raw.id}/skills/${s}.skill.md`);

    // 合并 registry.json 的 main channel + channels-map.json 的扩展
    const registryChannels = this._resolveChannels(raw);
    const extraChannels = extraChannelsMap?.channels ?? [];
    const mergedChannels = [...new Set([...registryChannels, ...extraChannels])];

    return {
      id: raw.id,
      displayName: raw.displayName,
      emoji: AGENT_EMOJI[raw.id] ?? '🤖',
      category: AGENT_CATEGORY[raw.id] ?? 'compat',
      description: raw.description,
      systemPrompt: buildSystemPrompt(raw),
      channels: mergedChannels,
      channelsById: raw.channels ?? {},
      extraChannels,
      role: extraChannelsMap?.role ?? raw.description,
      skills,
      skillPaths,
      memory: raw.memory ?? { readScopes: [], writeScope: null },
      tools: raw.tools ?? [],
      runtime: raw.runtime ?? {},
      model: raw.model ?? {},
      hidden: false,
      priority: 50,
    };
  }

  /**
   * 把 registry.json 的 {channels: {main: 'CH_FOO'}} 转成频道名列表
   * 需要 channel ID → name 映射(通过 bindChannelIds 注入)
   */
  _resolveChannels(raw) {
    const channels = raw.channels ?? {};
    const names = [];
    for (const [, envKey] of Object.entries(channels)) {
      // envKey 是 'CH_FOO' 这种形式,通过 process.env 拿 ID
      const chId = process.env[envKey];
      if (!chId) continue;
      const chName = this.idToName.get(chId);
      if (chName) names.push(chName);
    }
    return names;
  }

  /**
   * 注入频道 ID → 频道名 映射
   */
  bindChannelIds(idToNameMap) {
    this.idToName.clear();
    for (const [id, name] of Object.entries(idToNameMap)) {
      this.idToName.set(id, name);
    }
    // 重新 resolve 所有 agent 的 channels
    for (const def of this.agents.values()) {
      const registryChannels = this._resolveChannels({ channels: def.channelsById });
      def.channels = [...new Set([...registryChannels, ...(def.extraChannels ?? [])])];
      // 重建频道索引
      for (const ch of def.channels) {
        this.byChannel.set(ch, def.id);
        const normalized = normalizeChannelName(ch);
        if (normalized && normalized !== ch) {
          this.byChannel.set(normalized, def.id);
        }
      }
    }
  }

  /**
   * 注册一个 Agent(完整配置)
   */
  register(def) {
    if (!def.id) throw new Error('agent def.id required');
    if (this.agents.has(def.id)) {
      this.log(`[agent-registry] 覆盖已存在的 agent: ${def.id}`);
    }
    this.agents.set(def.id, def);

    // 建立频道索引
    if (def.channels) {
      for (const ch of def.channels) {
        this.byChannel.set(ch, def.id);
        const normalized = normalizeChannelName(ch);
        if (normalized && normalized !== ch) {
          this.byChannel.set(normalized, def.id);
        }
      }
    }

    // 建立 skill 索引
    if (def.skills) {
      for (const skill of def.skills) {
        if (!this.bySkill.has(skill)) this.bySkill.set(skill, []);
        this.bySkill.get(skill).push(def.id);
      }
    }

    return def;
  }

  /**
   * 通过 id 获取 agent
   */
  get(agentId) {
    return this.agents.get(agentId) ?? null;
  }

  /**
   * 通过频道名获取 agent
   */
  getByChannel(channelName) {
    if (!channelName) return null;
    if (this.byChannel.has(channelName)) return this.byChannel.get(channelName);
    const normalized = normalizeChannelName(channelName);
    if (this.byChannel.has(normalized)) return this.byChannel.get(normalized);
    // 包含匹配(子串)
    for (const [key, agentId] of this.byChannel.entries()) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return agentId;
      }
    }
    return null;
  }

  /**
   * 通过频道 ID 获取 agent
   */
  getByChannelId(channelId) {
    const name = this.idToName.get(channelId);
    if (!name) return null;
    return this.getByChannel(name);
  }

  /**
   * 获取 agent 的主频道 ID
   * registry.json 中 channels.main 对应的环境变量名 → process.env[envKey] → ID
   */
  getPrimaryChannelId(agentId) {
    const def = this.agents.get(agentId);
    if (!def) return null;
    const channelsById = def.channelsById ?? {};
    const mainKey = channelsById.main ?? channelsById['main'];
    if (!mainKey) return null;
    return process.env[mainKey] ?? null;
  }

  /**
   * 获取 agent 的主频道名称
   */
  getPrimaryChannelName(agentId) {
    const id = this.getPrimaryChannelId(agentId);
    if (!id) return null;
    return this.idToName.get(id) ?? null;
  }

  /**
   * 通过 skill 查找 agent
   */
  getBySkill(skill) {
    const ids = this.bySkill.get(skill) ?? [];
    return ids.map(id => this.agents.get(id)).filter(Boolean);
  }

  /**
   * 加载某个 agent 的 skill 指令(用于注入 prompt)
   */
  loadSkillInstructions(agentId, skillName) {
    const def = this.agents.get(agentId);
    if (!def) return null;
    const skillPath = def.skillPaths.find(p => {
      const base = String(p).split('/').pop() ?? '';
      return base === `${skillName}.skill.md` || base.replace('.skill.md', '') === skillName;
    });
    if (!skillPath) return null;
    try {
      return this.skillLoader.load(skillPath);
    } catch (e) {
      this.log(`[agent-registry] 加载 skill 失败: ${skillPath} (${e.message})`);
      return null;
    }
  }

  /**
   * 加载 agent 的所有 skill 指令(用于 system prompt)
   */
  loadAllSkills(agentId) {
    const def = this.agents.get(agentId);
    if (!def) return [];
    const result = [];
    for (const skillPath of def.skillPaths ?? []) {
      try {
        const s = this.skillLoader.load(skillPath);
        result.push(s);
      } catch (e) {
        this.log(`[agent-registry] 跳过 skill: ${skillPath} (${e.message})`);
      }
    }
    return result;
  }

  /**
   * 列出所有 agent
   */
  list({ includeHidden = false, category = null } = {}) {
    const result = [];
    for (const def of this.agents.values()) {
      if (!includeHidden && def.hidden) continue;
      if (category && def.category !== category) continue;
      result.push(def);
    }
    return result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * 按 category 分组
   */
  groupByCategory() {
    const groups = new Map();
    for (const def of this.agents.values()) {
      if (def.hidden) continue;
      if (!groups.has(def.category)) groups.set(def.category, []);
      groups.get(def.category).push(def);
    }
    return Object.fromEntries(groups);
  }

  /**
   * 校验 memory 权限
   */
  canReadScope(agentId, scope) {
    const def = this.agents.get(agentId);
    if (!def) return false;
    return (def.memory?.readScopes ?? []).includes(scope);
  }

  canWriteScope(agentId, scope) {
    const def = this.agents.get(agentId);
    if (!def) return false;
    return def.memory?.writeScope === scope;
  }

  /**
   * 获取 agent 的详细状态(用于 !state)
   */
  describe(agentId) {
    const def = this.agents.get(agentId);
    if (!def) return null;
    return {
      id: def.id,
      displayName: def.displayName,
      emoji: def.emoji,
      category: CATEGORY_LABEL[def.category] ?? def.category,
      description: def.description,
      skills: def.skills,
      skillCount: def.skills.length,
      channels: def.channels,
      channelCount: def.channels.length,
      tools: def.tools,
      memory: def.memory,
      model: def.model,
      runtime: def.runtime,
    };
  }
}