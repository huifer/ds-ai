// ~/pi-discord-agents/src/dreaming/dreaming-pi.mjs
// 「遐思」专属 Pi RPC 子进程 — 独立于主对话 pi。
//
// 为什么独立:
//   1. 不污染主 session(梦的 prompt 不会出现在用户对话历史里)
//   2. 不被用户消息插队(03:30 跑梦时用户在睡觉)
//   3. 独立的 session 日志(sessions/dreams/),梦失败可单独排查
//   4. 独立 model 切换灵活性(虽然 v1 用同一个)
//
// 接口:
//   - start() / stop()
//   - dreamPrompt(prompt, opts) → 在新 session 里跑 prompt,等 message_end,返回文本
//   - onEvent(handler)        → 订阅所有事件流(可选,用于日志)

import { join } from 'node:path';
import { RpcClient } from '@earendil-works/pi-coding-agent';
import { PATHS } from './paths.mjs';

const PI_BIN_DIR = '/Users/zhangsan/.nvm/versions/node/v24.15.0/lib/node_modules/@earendil-works/pi-coding-agent';
const PI_CLI = join(PI_BIN_DIR, 'dist', 'cli.js');

export async function createDreamingPi({
  cliPath = PI_CLI,
  cwd = PATHS.root,
  provider = 'minimax-cn',
  model = null,
  sessionDir = PATHS.dreamsSessionDir,
  env = {},
  log = () => {},
} = {}) {
  const client = new RpcClient({
    cliPath,
    cwd,
    provider,
    model,
    env: {
      HTTP_PROXY: 'http://127.0.0.1:7897',
      HTTPS_PROXY: 'http://127.0.0.1:7897',
      ALL_PROXY: 'socks5://127.0.0.1:7897',
      ...env,
    },
    args: [
      '--mode', 'rpc',
      '--session-dir', sessionDir,
      '--name', `xiasi-${new Date().toISOString().slice(0, 10)}`,
    ],
  });

  const handlers = [];
  const broadcast = (ev) => {
    for (const h of handlers) {
      try { h(ev); } catch (e) { log('[dreaming-pi] handler error:', e.message); }
    }
  };
  client.onEvent(broadcast);

  // 启动 + 等首次 agent_start(就绪信号)
  await new Promise((resolveStart, rejectStart) => {
    let settled = false;
    const onReady = (ev) => {
      if (ev.type === 'agent_start' && !settled) {
        settled = true;
        log('[dreaming-pi] ready (agent_start received)');
        resolveStart();
      }
    };
    handlers.push(onReady);
    client.start().catch(rejectStart);
    // 兜底超时(有些 Pi 版本可能不发 agent_start)
    setTimeout(() => {
      if (!settled) {
        settled = true;
        log('[dreaming-pi] start 超时(假设已就绪)');
        resolveStart();
      }
    }, 8000);
  });

  // ---- 核心方法 ----

  /**
   * 启动一个新 session,跑 prompt,等完成,返回 assistant 文本 + 用量。
   *
   * @returns {Promise<{ text: string, usage: object|null, events: any[] }>}
   */
  async function dreamPrompt(prompt, {
    dreamId = 'unknown',
    dreamType = 'unknown',
    timeoutMs = 14 * 60 * 1000, // 14 分钟,留 1 分钟给 cleanup
  } = {}) {
    log(`[dreaming-pi:${dreamType}] ${dreamId} prompt len=${prompt.length}`);

    // 先开新 session,让本次梦有独立 session file
    try {
      const res = await client.newSession();
      log(`[dreaming-pi] new_session cancelled=${res?.cancelled}`);
    } catch (e) {
      log(`[dreaming-pi] new_session 失败(继续): ${e.message}`);
    }

    // promptAndWait 会自动等 agent 回到 idle,然后返回 events 数组
    let events;
    try {
      events = await client.promptAndWait(prompt, [], timeoutMs);
    } catch (e) {
      log(`[dreaming-pi:${dreamType}] ${dreamId} promptAndWait 失败: ${e.message}`);
      throw e;
    }

    // 从 events 里提取最后一条 assistant 文本 + usage
    let text = '';
    let usage = null;
    for (const ev of events) {
      if (ev.type === 'message_end' && ev.message?.role === 'assistant') {
        const content = ev.message.content || [];
        text = content.filter(c => c?.type === 'text').map(c => c.text).join('');
        usage = ev.message.usage || usage;
      }
    }

    // 兜底:events 里没拿到,直接 getMessages
    if (!text) {
      try {
        const msgs = await client.getMessages();
        const lastAssistant = [...(msgs || [])].reverse().find(m => m.role === 'assistant');
        if (lastAssistant) {
          text = (lastAssistant.content || [])
            .filter(c => c?.type === 'text').map(c => c.text).join('');
          usage = lastAssistant.usage || usage;
        }
      } catch (e) {
        log(`[dreaming-pi] getMessages 兜底失败: ${e.message}`);
      }
    }

    log(`[dreaming-pi:${dreamType}] ${dreamId} 完成 text=${text.length} chars events=${events.length}`);
    return { text, usage, events };
  }

  async function stop() {
    try { await client.stop(); } catch (e) { log('[dreaming-pi] stop 失败:', e.message); }
  }

  return {
    start: async () => {},
    stop,
    dreamPrompt,
    onEvent: (h) => handlers.push(h),
    raw: client,
  };
}