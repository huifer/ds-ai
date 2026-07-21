// ~/pi-discord-agents/src/orchestrator/agent-manager.mjs
// MultiAgentManager:多 Agent 系统的核心调度器
//
// 职责:
//   1. 接收路由结果,从 SessionPool 取/建 session
//   2. 意图检测 + 调用对应 Agent 的 Pi RPC
//   3. 注入上下文(摘要 + 最近轮次 + 记忆)
//   4. 自动压缩(轮次/token 触发)
//   5. 跨 Agent 协调(orchestrator 调用其他 agent)

import { SessionPool } from './session-pool.mjs';
import { ContextCompressor, HybridStrategy } from './context-compressor.mjs';
import { AgentRegistry } from './agent-registry.mjs';
import { Router } from './router.mjs';
import { MemoryBridge } from './memory-bridge.mjs';

/**
 * IntentMatcher:把自然语言意图映射到可执行的 Agent/Skill
 *
 * 设计原则:
 * - 在 LLM 调用前检测高价值意图（如"新客户"、"新项目"）
 * - 如果匹配到强意图，在 prompt 中注入"执行指令"
 * - 让 LLM 知道该调用哪个 skill，而不是泛泛地聊天
 */
export class IntentMatcher {
  constructor({ log = () => {} }) {
    this.log = log;

    // 强意图规则:自然语言模式 → { agent, skill, command, label }
    this.patterns = [
      // === 销售线索 ===
      {
        agent: 'sales',
        keywords: ['客户', '客户想', '客户需要', '有个客户', '潜在客户', '新客户', '商机', '有意向', '预算', '合作', '采购'],
        exclude: ['跟进', '查一下', '已有'],
        skill: 'lead-capture',
        command: '!lead new',
        label: '新销售线索',
        priority: 1,
        nextSteps: [
          '提取客户公司名、联系人、预算、需求',
          '在 data/business/leads/ 下创建 LEAD-YYYYMMDD-XXXX.json 记录',
          '如果用户提供了具体产品名称（如"AI 污水处理平台"）+ 预算 + 客户信息，判定为「完整商业机会」，额外执行:',
          '  a) 在 data/projects/ 下创建项目目录（如 ai-water-treatment-platform/）',
          '  b) 生成 PRD.md（产品需求文档，包含:背景、目标、功能范围、技术要求、里程碑、预算分解）',
          '  c) 生成初步报价 QUOTE.md（三档方案: 基础版约30%预算/标准版约70%预算/旗舰版满预算，每档含模块列表+总价+适用场景）',
          '  d) 将 LEAD、PRD、QUOTE 放在同一项目目录下，统一管理',
          '回复用户: 告知线索已录入 + 生成的文档清单，并说明下一步（等待用户确认后可启动合同流程）',
        ],
      },
      // === 投标 ===
      {
        agent: 'bid',
        keywords: ['投标', '招标', '竞标', '标书', '中标', 'rfi', 'rfp', '招标书'],
        skill: 'tender-ingestion',
        command: '!bid start',
        label: '新投标项目',
        priority: 1,
        nextSteps: [
          '在 data/business/bids/ 下创建投标记录',
          '生成招标信息摘要',
          '回复用户: 告知投标已创建，并给出竞标截止时间和所需材料清单',
        ],
      },
      // === 报价 ===
      {
        agent: 'quote',
        keywords: ['报价', '价格', '多少钱', '套餐', '收费', '定价', '费用'],
        exclude: ['历史报价', '查报价'],
        skill: 'quote-draft',
        command: '!quote draft',
        label: '报价请求',
        priority: 1,
        nextSteps: [
          '根据客户需求和预算，生成报价文档（必须包含三档方案: 基础版/标准版/旗舰版）',
          '在 data/projects/ai-产品拼音名/ 下保存报价 QUOTE.md',
          '回复用户: 告知报价已生成，简要说明三档方案区别和适用场景',
        ],
      },
      // === 项目启动 ===
      {
        agent: 'pm',
        keywords: ['新项目', '项目启动', '开始项目', '立项', '要做个项目'],
        skill: 'project-bootstrap',
        command: '!pr new',
        label: '新项目立项',
        priority: 1,
        nextSteps: [
          '提取项目名称、目标、交付物、里程碑',
          '创建项目目录和立项文档',
          '回复用户: 告知项目已立项，并给出项目计划和下一步行动',
        ],
      },
      // === PRD/方案 ===
      {
        agent: 'solution',
        keywords: ['prd', '产品需求', '设计方案', '方案设计', '产品设计', '需求文档', '功能设计'],
        skill: 'prd-v10',
        command: '!prd v1.0',
        label: 'PRD/方案设计',
        priority: 1,
        nextSteps: [
          '生成完整的 PRD 文档，包含背景、目标、功能、里程碑',
          '导出为 Markdown 文件保存到项目目录',
          '回复用户: 告知 PRD 已生成，并说明需要评审的内容',
        ],
      },
      // === 代码/bug ===
      {
        agent: 'dev',
        keywords: ['代码', 'bug', '报错', '函数', '接口', 'api', '部署', '测试', '重构', '性能', '优化'],
        skill: 'code-review',
        command: null,
        label: '开发任务',
        priority: 1,
      },
      // === SEO/增长 ===
      {
        agent: 'seo',
        keywords: ['seo', '关键词', '排名', '外链', 'backlink', 'serp', '搜索排名', 'google seo'],
        skill: 'seo-audit',
        command: null,
        label: 'SEO 分析',
        priority: 1,
      },
      // === 合同 ===
      {
        agent: 'contract',
        keywords: ['合同', '协议', '条款', '法务', '合规'],
        skill: 'contract-review',
        command: '!contract new',
        label: '合同处理',
        priority: 1,
        nextSteps: [
          '生成合同草稿或条款摘要',
          '识别风险条款和需要谈判的点',
          '回复用户: 告知合同处理结果，并说明需要法务审核的条款',
        ],
      },
    ];
  }

  /**
   * 检测文本是否匹配某个强意图
   */
  match(text, currentAgentId) {
    const lower = text.toLowerCase();

    // 标准关键词匹配（仅用于路由，不做复杂意图分析）
    for (const p of this.patterns) {
      if (currentAgentId && currentAgentId !== p.agent) continue;
      const matchedKeywords = p.keywords.filter(k => lower.includes(k.toLowerCase()));
      if (matchedKeywords.length === 0) continue;
      if (p.exclude && p.exclude.some(e => lower.includes(e.toLowerCase()))) continue;

      this.log(`[intent-matcher] 匹配: agent=${p.agent} skill=${p.skill} label=${p.label} keywords=${matchedKeywords.join(',')}`);

      return {
        matched: true,
        agent: p.agent,
        skill: p.skill,
        command: p.command,
        label: p.label,
        reason: `匹配关键词: ${matchedKeywords.join(', ')}`,
        matchedKeywords,
        nextSteps: p.nextSteps ?? null,
      };
    }

    return { matched: false };
  }

  /**
   * 根据匹配结果，构建增强 prompt
   */
  buildEnhancedPrompt(text, matchResult) {
    if (!matchResult.matched) return null;

    const skillHint = matchResult.command
      ? `建议执行命令: \`${matchResult.command}\`（调用 skill: ${matchResult.skill}）`
      : `建议方向: 调用 ${matchResult.skill} skill 处理`;

    const parts = [
      `意图检测: **${matchResult.label}**`,
      `匹配理由: ${matchResult.reason}`,
      '',
      skillHint,
      '',
      '【执行要求】',
      '1. 不要只回复文字，要实际执行工作',
      '2. 能创建记录就创建记录，能生成文档就生成文档',
      '3. 重要判断规则:',
      '   - 如果用户提供「产品名称」+「预算」+「客户信息」→ 这是「完整商业机会」',
      '     → 必须生成: LEAD 记录 + PRD 文档 + 初步报价（三档方案）',
      '     → 产品名转拼音作为目录: data/projects/ai-产品拼音名/',
      '     → 目录命名规则: 「ai-」+ 中文产品名全拼（如「AI污水处理平台」→ ai-shuiwu-chuli-pingtai）',
      '   - 如果只提供零散信息 → 按实际提供的字段创建记录，不追问已提供的信息',
      '4. 优先使用 bash/file 工具输出结构化结果',
      '5. 报价文档必须包含三档方案:',
      '   - 基础版（约占预算 30%）: 核心功能，满足基本需求',
      '   - 标准版（约占预算 70%）: 完整功能，适合大多数客户',
      '   - 旗舰版（占满预算 100%）: 全部功能 + 定制开发 + 高级服务',
      '   每档都要有：模块列表、总价估算、适用场景说明',
      '5. 产物文件命名规范（重要！必须严格遵守）:',
      '   - 项目目录: 统一使用「ai-」前缀 + 中文产品名拼音（如 ai-shuiwu-chuli-pingtai），禁止用英文或混合命名',
      '   - LEAD: data/business/leads/LEAD-YYYYMMDD-XXXX.json',
      '   - PRD: data/projects/ai-产品拼音名/PRD.md',
      '   - Quote: data/projects/ai-产品拼音名/QUOTE.md',
      '   - 示例: 产品名「AI 污水处理平台」→ 目录: ai-shuiwu-chuli-pingtai/',
      '   - 同一产品只创建一版目录，不要重复创建新目录（如已有 ai-shuiwu-chuli-pingtai 则更新现有文件）',
    ];

    // 加入下一步指引
    if (matchResult.nextSteps && matchResult.nextSteps.length > 0) {
      parts.push('');
      parts.push('【系统将自动执行以下步骤】');
      for (const step of matchResult.nextSteps) {
        parts.push('  - ' + step);
      }
    }

    parts.push('');
    parts.push('用户原始输入: ' + text);
    parts.push('');
    parts.push('【关键指令】请仔细分析用户消息：');
    parts.push('1. 如果用户提供了字段值（如「公司：XXX」「联系人：XXX」「电话：XXX」等），请直接提取并使用');
    parts.push('2. 不要重复询问用户已经提供的字段');
    parts.push('3. 如果信息不完整，只询问缺失的关键字段');
    parts.push('4. 回复要简洁，优先执行工作（创建记录、生成文档），其次才是对话');

    return parts.join('\n');
  }
}

export class MultiAgentManager {
  constructor({
    rootDir,
    piBridge,
    log = () => {},
    sessionPoolOpts = {},
    compressionStrategy = null,
    memoryStore = null,
    memoryContext = null,
  }) {
    this.rootDir = rootDir;
    this.piBridge = piBridge;
    this.log = log;

    // 初始化组件
    this.registry = new AgentRegistry({ rootDir, log });
    this.registry.loadFromRegistryJson();

    this.sessionPool = new SessionPool({
      rootDir,
      log,
      ...sessionPoolOpts,
    });

    this.strategy = compressionStrategy ?? new HybridStrategy({ piBridge, log });
    this.compressor = new ContextCompressor({
      sessionPool: this.sessionPool,
      strategy: this.strategy,
      log,
    });

    this.router = new Router({
      agentRegistry: this.registry,
      sessionPool: this.sessionPool,
      log,
    });

    // Intent Matcher
    this.intentMatcher = new IntentMatcher({ log });

    // Memory Bridge
    this.memoryBridge = new MemoryBridge({
      rootDir,
      agentRegistry: this.registry,
      memoryStore,
      memoryContext,
      log,
    });
    this.memoryBridge.injectConfig();

    // 健康状态
    this.startedAt = new Date().toISOString();
    this.callCount = 0;
    this.errorCount = 0;
  }

  /**
   * 处理一条 Discord 消息(主入口)
   * @param {object} msg
   * @param {function} onProgress - 进度回调，接收 { stage, message, progress } 用于实时更新消息
   */
  async handleMessage(msg, onProgress = null) {
    const { channelId, channelName, userId, text } = msg;
    const progress = (message, stage, total = 5, detail = '') => {
      if (onProgress) onProgress({ stage, total, message, detail });
    };

    // 1. 路由
    const route = await this.router.route({ channelId, channelName, userId, text });
    const agentDef = this.registry.get(route.agentId);
    const agentName = agentDef?.displayName ?? route.agentId ?? 'Agent';
    progress(`🎯 正在分析用户需求...`, 1, 5, `目标 Agent: ${agentName}`);
    this.log(`[multi-agent] 路由: channel=${channelName} -> agent=${route.agentId} (${route.reason}, conf=${route.confidence.toFixed(2)})`);

    // 2. 获取或创建 session
    const session = this.sessionPool.getOrCreate({
      channelId,
      userId,
      topicKey: this.router._extractTopicKey(text),
      agentId: route.agentId,
    });

    // 3. 获取 agent 定义
    if (!agentDef) {
      return {
        reply: `[multi-agent] Agent ${route.agentId} 未找到`,
        agentId: route.agentId,
        sessionKey: route.sessionKey,
      };
    }

    // 4. 意图检测
    const intentMatch = this.intentMatcher.match(text, route.agentId);
    if (intentMatch.matched) {
      progress(`🔍 检测到意图: **${intentMatch.label}**，准备执行 ${intentMatch.skill}...`, 2, 5, `匹配 ${intentMatch.matchedKeywords?.join(', ')}`);
      this.log(`[multi-agent] 强意图命中: ${intentMatch.label} -> ${intentMatch.skill}`);
    } else {
      progress(`🔍 通用对话模式，跳过强意图匹配`, 2, 5, `Agent: ${agentName}`);
    }

    // 5. 构造 prompt + 记忆检索
    progress(`🧠 检索相关记忆和上下文...`, 3, 5, `Session: ${session.key}`);
    const contextStr = this.sessionPool.buildContext(session.key);
    const memoryContext = await this._buildMemoryContext(route.agentId, text);
    let intentHint = '';
    if (intentMatch.matched) {
      intentHint = this.intentMatcher.buildEnhancedPrompt(text, intentMatch);
    }
    const prompt = this._buildPrompt(agentDef, contextStr, memoryContext, text, intentHint);

    // 6. 调用 LLM（执行工作）
    const execLabel = intentMatch.matched
      ? `⚙️ 执行 ${intentMatch.label}...`
      : `⚙️ 执行 ${agentName}...`;
    progress(execLabel, 4, 5, intentMatch.matched ? `调用 skill: ${intentMatch.skill}` : `Agent: ${agentName}`);
    this.callCount += 1;
    let reply = '';
    try {
      reply = await this.piBridge.prompt(agentDef.systemPrompt, prompt, { timeoutMs: 300_000 });
      if (!reply) reply = '(无响应)';
    } catch (e) {
      this.errorCount += 1;
      this.log(`[multi-agent] LLM 错误: ${e.message}`);
      reply = `执行失败: ${e.message}`;
    }

    // 7. 记录到 session
    progress(`💾 保存本次对话到历史记录...`, 5, 5, `Token: ~${SessionPool.estimateTokens(text) + SessionPool.estimateTokens(reply)}`);
    const userTokens = SessionPool.estimateTokens(text);
    const replyTokens = SessionPool.estimateTokens(reply);
    await this.sessionPool.addTurn(session.key, 'user', text, userTokens);
    const compressResult = await this.sessionPool.addTurn(session.key, 'assistant', reply, replyTokens);

    // 确保 reply 是字符串
    const safeReply = typeof reply === 'string' ? reply : JSON.stringify(reply ?? '(无内容)');

    return {
      reply: safeReply,
      agentId: route.agentId,
      agentDisplayName: agentDef.displayName,
      sessionKey: session.key,
      compressed: compressResult.compressed,
      compressionReason: compressResult.reason,
      intentMatch,
    };
  }

  /**
   * 构造发给 LLM 的完整 prompt
   */
  _buildPrompt(agentDef, sessionContext, memoryContext, userText, intentHint = null) {
    const parts = [];

    if (sessionContext) {
      parts.push('# 对话上下文\n' + sessionContext);
    }

    if (memoryContext) {
      parts.push('# 记忆检索\n' + memoryContext);
    }

    if (intentHint) {
      parts.push('# 意图检测结果\n' + intentHint);
    }

    parts.push('# 用户输入\n' + userText);

    return parts.join('\n\n---\n\n');
  }

  /**
   * 构建记忆上下文
   */
  async _buildMemoryContext(agentId, userText) {
    if (!this.memoryBridge) return '';
    try {
      return await this.memoryBridge.buildAgentContext(agentId, userText, { limit: 5 });
    } catch (e) {
      this.log(`[multi-agent] 记忆上下文失败: ${e.message}`);
      return '';
    }
  }

  /**
   * 注入 memory-context(可选,运行时设置)
   */
  setMemoryContext(memoryContext) {
    this.memoryContext = memoryContext;
    if (this.memoryBridge) {
      this.memoryBridge.memoryContext = memoryContext;
    }
  }

  /**
   * 列出所有 session
   */
  listSessions() {
    return this.sessionPool.list();
  }

  /**
   * 强制压缩一个 session
   */
  async compressSession(sessionKey) {
    return await this.compressor.forceCompress(sessionKey);
  }

  /**
   * 批量压缩所有 session
   */
  async compressAllSessions() {
    return await this.compressor.compressAll();
  }

  /**
   * 获取系统状态
   */
  getStatus() {
    const sessions = this.sessionPool.list();
    const totalTokens = sessions.reduce((sum, s) => sum + s.tokenEstimate, 0);
    const sessionsByAgent = {};
    for (const s of sessions) {
      const aid = s.agentId || 'unknown';
      sessionsByAgent[aid] = (sessionsByAgent[aid] ?? 0) + 1;
    }
    return {
      startedAt: this.startedAt,
      uptimeSec: Math.floor((Date.now() - new Date(this.startedAt).getTime()) / 1000),
      callCount: this.callCount,
      errorCount: this.errorCount,
      agentCount: this.registry.list().length,
      sessionCount: sessions.length,
      totalTokenEstimate: totalTokens,
      sessionsByAgent,
      agents: this.registry.list().map(a => ({
        id: a.id,
        name: a.displayName,
        channels: a.channels,
        primary: a.primary ?? false,
      })),
    };
  }

  /**
   * 关闭
   */
  async shutdown() {
    this.sessionPool.shutdown();
    this.log(`[multi-agent] shutdown · ${this.callCount} calls, ${this.errorCount} errors`);
  }
}
