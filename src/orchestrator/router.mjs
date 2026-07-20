// ~/pi-discord-agents/src/orchestrator/router.mjs
// Router:把 Discord 消息路由到对应的 Agent
//
// 三层路由策略:
//   1. 频道映射 (硬路由):频道名 → agent,O(1) 查找
//   2. 关键词匹配 (软路由):关键词 → agent,fuzzy 匹配
//   3. 意图推断 (智能路由):用轻量 LLM 判断意图,默认 fallback
import { SessionPool } from './session-pool.mjs';
//   1. 频道映射 (硬路由):频道名 → agent,O(1) 查找
//   2. 关键词匹配 (软路由):关键词 → agent,fuzzy 匹配
//   3. 意图推断 (智能路由):用轻量 LLM 判断意图,默认 fallback
//   1. 频道映射 (硬路由):频道名 → agent,O(1) 查找
//   2. 关键词匹配 (软路由):关键词 → agent,fuzzy 匹配
//   3. 意图推断 (智能路由):用轻量 LLM 判断意图,默认 fallback
//
// 设计目标:
//   - 主入口频道的消息走第 3 层(智能路由)
//   - 业务频道的消息走第 1 层(频道映射)
//   - 跨频道任务通过 orchestrator 协调

/**
 * 关键词映射规则
 * 关键词 → agent id
 * 注意:这里只匹配专业性强的关键词,通用词(如"你好")不匹配
 */
const KEYWORD_RULES = [
  // 开发相关 - 高权重
  { keywords: ['代码', 'bug', '报错', '调试', '重构', '函数', '架构', '性能优化', 'typescript', 'javascript', 'python', 'rust'],
    agent: 'dev', weight: 3 },
  { keywords: ['api', '接口', 'commit', 'merge', 'git', 'github', '代码评审', 'code review', 'pull request'],
    agent: 'dev', weight: 2 },
  { keywords: ['pr #', 'review my', '优化代码'],
    agent: 'dev', weight: 2.5 },

  // 销售相关 - 高权重
  { keywords: ['客户', '合同', '报价', '销售', '线索', '商机', '订单', '投标', '标书', '跟进', '客户成功'],
    agent: 'sales', weight: 3 },
  { keywords: ['crm', 'leads', 'lead'],
    agent: 'sales', weight: 2 },

  // 项目管理
  { keywords: ['项目计划', '里程碑', '进度', '风险', 'wbs', 'raid', '周报'],
    agent: 'project', weight: 2.5 },
  { keywords: ['项目'],
    agent: 'project', weight: 1.5 },

  // SEO
  { keywords: ['seo', '关键词', '排名', '外链', 'serp', '搜索结果', 'backlink', '搜索量', 'google'],
    agent: 'seo', weight: 3 },

  // Marketing
  { keywords: ['营销', 'campaign', '增长复盘', '转化率', 'roi', '投放', '复盘'],
    agent: 'marketing', weight: 3 },
  { keywords: ['增长'],
    agent: 'marketing', weight: 2 },

  // 内容编辑 - 国内 - 高权重
  { keywords: ['公众号', '小红书', '抖音', '视频号', '微信'],
    agent: 'domestic-editor', weight: 3.5 },
  { keywords: ['推文', '快讯', '公众号文章'],
    agent: 'domestic-editor', weight: 3 },

  // 内容编辑 - 海外 - 高权重(平台名以 2.5 平衡,避免压过代码)
  { keywords: ['twitter', 'tweet', 'x.com', 'producthunt', 'linkedin', 'newsletter', 'youtube'],
    agent: 'overseas-editor', weight: 2.5 },
  { keywords: ['launch', 'post', '海外发布', 'publish'],
    agent: 'overseas-editor', weight: 3 },

  // 审批
  { keywords: ['审批', '批准', 'approve', 'reject', '同意', '申请'],
    agent: 'approver', weight: 2 },
];

/**
 * Router
 */
export class Router {
  constructor({ agentRegistry, sessionPool, log = () => {} }) {
    this.registry = agentRegistry;
    this.sessionPool = sessionPool;
    this.log = log;
  }

  /**
   * 路由一条消息
   * @param {object} msg
   * @param {string} msg.channelId
   * @param {string} msg.channelName - 频道名(不含 emoji)
   * @param {string} msg.userId
   * @param {string} msg.text
   * @param {string} [msg.userRole] - 'admin' / 'user'
   * @returns {RoutingResult}
   */
  async route(msg) {
    const result = {
      agentId: null,
      confidence: 0,
      reason: '',
      sessionKey: null,
      fallback: false,
    };

    // 第 1 层:频道映射
    const channelAgent = this.registry.getByChannel(msg.channelName);
    if (channelAgent) {
      const def = this.registry.get(channelAgent);
      // 排除 hidden(老兼容 agent)
      // passive agent (如 dreaming) 仍然响应,但用较低优先级
      if (!def.hidden) {
        result.agentId = channelAgent;
        result.confidence = def.passive ? 0.7 : 0.9;
        result.reason = `channel_map:${msg.channelName}${def.passive ? '(passive)' : ''}`;
      }
    }

    // 第 2 层:关键词匹配(补充或纠正)
    const text = (msg.text ?? '').toLowerCase();
    if (text) {
      const keywordMatches = this._matchKeywordsAll(text);
      if (keywordMatches.length > 0) {
        // 汇总得分:同 agent 的关键词得分累加
        const agentScores = new Map();
        for (const m of keywordMatches) {
          agentScores.set(m.agent, (agentScores.get(m.agent) ?? 0) + m.weight);
        }
        // 找最高分
        let bestAgent = null;
        let bestScore = 0;
        let bestMatched = '';
        for (const [agent, score] of agentScores.entries()) {
          if (score > bestScore) {
            bestScore = score;
            bestAgent = agent;
            bestMatched = keywordMatches
              .filter(m => m.agent === agent)
              .map(m => m.matched).join(',');
          }
        }
        // 如果第 1 层没匹配,或第 1 层匹配的 agent 关键词得分低,用关键词结果
        if (!result.agentId || bestScore >= 2.5) {
          result.agentId = bestAgent;
          result.confidence = Math.max(result.confidence, Math.min(0.85, bestScore * 0.2));
          result.reason = result.reason
            ? `${result.reason} + keyword:${bestMatched}`
            : `keyword:${bestMatched}`;
        }
      }
    }

    // 第 3 层:如果还是没匹配上,且消息来自主入口,使用 orchestrator
    if (!result.agentId) {
      const isMainEntry = this._isMainEntry(msg.channelId, msg.channelName);
      if (isMainEntry) {
        result.agentId = 'orchestrator';
        result.confidence = 0.5;
        result.reason = 'main_entry_default';
      } else {
        // 其他频道默认走 orchestrator(可转交)
        result.agentId = 'orchestrator';
        result.confidence = 0.3;
        result.reason = 'unknown_channel_default';
        result.fallback = true;
      }
    }

    // 生成 session key
    const topicKey = this._extractTopicKey(msg.text);
    result.sessionKey = SessionPool.makeKey({
      channelId: msg.channelId,
      userId: msg.userId,
      topicKey,
      agentId: result.agentId,
    });

    return result;
  }

  /**
   * 关键词匹配 - 返回所有匹配
   */
  _matchKeywordsAll(text) {
    const matches = [];
    for (const rule of KEYWORD_RULES) {
      for (const kw of rule.keywords) {
        if (text.includes(kw.toLowerCase())) {
          matches.push({ agent: rule.agent, weight: rule.weight, matched: kw });
        }
      }
    }
    return matches;
  }

  /**
   * 关键词匹配(单条最佳,向后兼容)
   */
  _matchKeywords(text) {
    const all = this._matchKeywordsAll(text);
    if (all.length === 0) return null;
    return all.reduce((best, cur) => cur.weight > best.weight ? cur : best);
  }

  /**
   * 判断是否主入口频道
   */
  _isMainEntry(channelId, channelName) {
    // 主入口频道 ID 来自 .env 的 CH_ENTRY
    const entryChannelId = process.env.CH_ENTRY;
    if (entryChannelId && channelId === entryChannelId) return true;
    if (channelName === '主入口') return true;
    return false;
  }

  /**
   * 从文本提取话题 key(用于 session 隔离)
   * 简单策略:提取第一个名词/动名词,或检测主题切换关键词
   */
  _extractTopicKey(text) {
    if (!text) return '';

    // 主题切换信号
    const switchSignals = ['另外', '顺便', '换个话题', '聊一下', '接下来', '对了', '话说'];
    for (const sig of switchSignals) {
      if (text.startsWith(sig)) {
        // 切换主题:用时间戳做 key
        return `switch-${Date.now()}`;
      }
    }

    // 提取核心话题(简化版:取前 20 个字符)
    return text.slice(0, 20).replace(/\s+/g, '_');
  }

  /**
   * 列出所有可路由到的 agent 描述(给 LLM 用)
   */
  describeAgents() {
    const agents = this.registry.list({ includeHidden: false });
    return agents.map(a =>
      `- **${a.displayName}** (${a.id}): ${a.description} [频道: ${a.channels?.join(', ') || '无'}]`
    ).join('\n');
  }
}