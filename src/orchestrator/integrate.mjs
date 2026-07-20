// ~/pi-discord-agents/src/orchestrator/integrate.mjs
// 集成层:把 MultiAgentManager 接入现有的 entry-bot
//
// 改造策略:渐进式迁移,不破坏现有功能
//   - 保留 entry-bot.mjs 现有的所有命令处理逻辑
//   - 在 handleUserMessage 里加上多 Agent 路由(只对自由文本生效)
//   - 频道消息优先走多 Agent; !command 类消息走旧的 AgentManager
//
// 这样用户感觉不到切换,但底层实现了多 Agent 隔离。

import { MultiAgentManager } from './agent-manager.mjs';

/**
 * 判断消息是否走多 Agent 路由
 * 条件:
 *   - 不是 ! 开头的命令(命令走旧 AgentManager)
 *   - 是文本消息(非附件/非回复)
 *   - 来自可路由的频道(主入口或业务频道)
 */
export function shouldRouteToMultiAgent(msg, registry) {
  const text = msg.content?.trim() ?? '';

  // 命令消息走旧 AgentManager
  if (text.startsWith('!')) return false;

  // 空消息不处理
  if (!text) return false;

  // 检查是否在可路由频道
  const channelName = msg.channel?.name ?? '';
  const isMainEntry = msg.channelId === process.env.CH_ENTRY;

  // 业务频道或主入口都走多 Agent
  if (isMainEntry) return true;

  // 业务频道有专属 Agent 也走多 Agent
  const agentId = registry.getByChannel(channelName);
  if (agentId) return true;

  // 其他频道(例如 xiasi 等被动频道)不处理
  return false;
}

/**
 * 处理消息(走多 Agent)
 */
export async function handleViaMultiAgent(manager, msg) {
  const channelName = msg.channel?.name ?? 'unknown';

  const result = await manager.handleMessage({
    channelId: msg.channelId,
    channelName,
    userId: msg.author.id,
    userName: msg.author.username,
    text: msg.content ?? '',
  });

  return result;
}

/**
 * 创建 MultiAgentManager 实例的统一入口
 */
export function createMultiAgentManager({ rootDir, piBridge, log }) {
  return new MultiAgentManager({
    rootDir,
    piBridge,
    log,
    sessionPoolOpts: {
      maxTurnsBeforeCompress: parseInt(process.env.SESSION_MAX_TURNS || '20', 10),
      maxTokensBeforeCompress: parseInt(process.env.SESSION_MAX_TOKENS || '60000', 10),
      keepRecentTurns: parseInt(process.env.SESSION_KEEP_RECENT || '5', 10),
      idleMinutesBeforeArchive: parseInt(process.env.SESSION_IDLE_MINUTES || '30', 10),
      persistDir: process.env.SESSION_PERSIST_DIR || 'data/multi-agent-sessions',
    },
  });
}