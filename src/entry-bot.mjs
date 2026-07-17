// ~/pi-discord-agents/src/entry-bot.mjs
// Daemon 主程序 — Discord <-> Pi RPC 桥
//
// 架构:
//   - Node 进程,launchd 拉起,7×24 运行
//   - 内嵌 Discord 客户端:收 #主入口 用户消息、推 assistant 文本回复
//   - 内嵌 Pi RPC 子进程:用 child_process.spawn 启动 `pi --mode rpc --extension <tools>`
//   - Discord 消息 → client.prompt()
//   - Pi 事件流(message_update text_delta) → 实时拼装,message_end 时整段 push 回 Discord
//
// 比 TUI 模式强在哪:
//   - 没有 ctx stale(session reload 安全,RPC 命令本身就是 reload-safe)
//   - 没有 tmux / 假 TTY
//   - 流式 text_delta 可直接转发(打字机式输出)
//   - 启动 ~200ms,不是 ~10s+
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { existsSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';

import { RpcClient } from '@earendil-works/pi-coding-agent';
import { loadConfig, PATHS } from './config.mjs';
import { createDiscordClient } from './discord-client.mjs';
import { getDiscord } from '../extensions/discord-tools-shared.mjs';

// ---- 全局代理:launchd 启的进程没有 macOS 系统代理配置 ----
try {
  const { bootstrap } = await import('global-agent');
  bootstrap();
} catch {}

// ---- 路径 ----
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PI_BIN_DIR = '/Users/zhangsan/.nvm/versions/node/v24.15.0/lib/node_modules/@earendil-works/pi-coding-agent';
const PI_CLI = join(PI_BIN_DIR, 'dist', 'cli.js');
const PI_NODE = '/Users/zhangsan/.nvm/versions/node/v24.15.0/bin/node';
const TOOLS_EXT = join(ROOT, 'extensions', 'discord-tools.mjs');
const SESSION_DIR = join(ROOT, 'sessions');

// ---- 日志:带时间戳,全走同一个 orchestrator.log ----
function log(...args) {
  const ts = new Date().toISOString().slice(11, 19);
  const msg = `[entry-bot ${ts}] ${args.join(' ')}\n`;
  process.stdout.write(msg);
  try { appendFileSync(PATHS.log, msg); } catch {}
}

// ---- main ----
async function main() {
  // ---- 1. 配置 ----
  const cfgRes = loadConfig();
  if (!cfgRes.ok) { console.error('配置加载失败:', cfgRes.error); process.exit(1); }
  const cfg = cfgRes.value;
  log(`配置已加载 · entry channel=${cfg.channels.entry}`);

  // ---- 2. Discord 客户端 ----
  const discord = createDiscordClient({
    token: cfg.token,
    onMessage: (kind, payload) => {
      if (kind === 'ready') {
        log('Discord gateway ready');
        discordReadyResolver?.();
        if (cfg.channels.entry) {
          discord.send(cfg.channels.entry,
            '🌟 **主入口已就绪(RPC 模式)**\n\n消息直接发这里。\n其他频道是沉淀位置,你不用管。'
          ).catch(() => {});
        }
      }
      if (kind === 'message') handleUserMessage(payload.message);
    },
  });

  // ---- 3. 启动 Discord(等 ready)----
  let discordReadyResolver;
  const discordReady = new Promise((r) => { discordReadyResolver = r; });
  try {
    await discord.login();
  } catch (e) {
    log('Discord 登录失败:', e.message);
    process.exit(1);
  }
  await discordReady;
  log('Discord 已 ready');

  // ---- 4. Pi RPC 客户端 ----
  log('启动 Pi RPC 子进程…');
  const pi = new RpcClient({
    cliPath: PI_CLI,
    cwd: ROOT,             // 用项目根目录,bash/edit 工具用到时一致
    provider: cfg.provider || 'minimax-cn',
    model: cfg.model || 'MiniMax-M3',
    env: {
      // 把 token + channel IDs 传给 Pi 子进程(工具会用到)
      DISCORD_TOKEN: cfg.token,
      CH_ENTRY: cfg.channels.entry,
      CH_MEMORY: cfg.channels.memory,
      CH_IDEAS:  cfg.channels.ideas,
      CH_BUILD:  cfg.channels.build,
      CH_JOURNAL: cfg.channels.journal,
      CH_SIGNAL: cfg.channels.signal,
      CH_SYSTEM: cfg.channels.system,
      // 代理(launchd 进程没继承系统代理)
      HTTP_PROXY: 'http://127.0.0.1:7897',
      HTTPS_PROXY: 'http://127.0.0.1:7897',
      ALL_PROXY: 'socks5://127.0.0.1:7897',
    },
    args: [
      '--mode', 'rpc',
      '--extension', TOOLS_EXT,
      '--session-dir', SESSION_DIR,
      '--name', `discord-bridge-${new Date().toISOString().slice(0, 10)}`,
    ],
  });

  // ---- 5. 订阅 Pi 事件 ----
  // 流式文本:累积每个 message 的 text_delta,完整消息到达时整段推到 Discord
  let pendingReply = null;             // 等待中的 Discord 消息(用来加 reply ref)
  let assistantBuffer = '';            // 当前 assistant message 缓冲
  let currentMessageId = null;         // 当前 Pi message 的 id(message_start 给,text_delta 推)
  let lastFlushedText = '';            // 防 message_end 重复发

  pi.onEvent((ev) => {
    // 防止还没 ready 就开始工作
    if (ev.type === 'agent_start') {
      // Pi 开始处理
    }
    if (ev.type === 'message_start' && ev.message?.role === 'assistant') {
      currentMessageId = ev.message.id ?? `m_${Date.now()}`;
      assistantBuffer = '';
    }
    if (ev.type === 'message_update' && ev.message?.role === 'assistant') {
      const delta = ev.assistantMessageEvent;
      if (!delta) return;
      if (delta.type === 'text_delta') {
        assistantBuffer += delta.delta;
      }
    }
    if (ev.type === 'message_end' && ev.message?.role === 'assistant') {
      // 整段 assistant 文本就绪,推到 Discord
      const text = (ev.message.content ?? [])
        .filter((c) => c?.type === 'text')
        .map((c) => c.text)
        .join('');
      if (!text || text === lastFlushedText) return;
      lastFlushedText = text;
      log(`Pi 输出 (${text.length} chars)`);
      (async () => {
        try {
          if (pendingReply) {
            await discord.send(cfg.channels.entry, text, pendingReply);
            try { await discord.removeReact(pendingReply, '⏳'); } catch {}
          } else {
            await discord.send(cfg.channels.entry, text);
          }
        } catch (e) {
          log('推送 Discord 失败:', e.message);
        }
      })();
      assistantBuffer = '';
    }
    if (ev.type === 'tool_execution_end' && ev.toolName?.startsWith('discord_')) {
      log(`工具执行完成: ${ev.toolName}`);
    }
    if (ev.type === 'extension_error') {
      log(`扩展错误: ${ev.error}`);
    }
  });

  // ---- 6. 启动 Pi ----
  pi.start().then(() => {
    log('Pi RPC 启动完成');
  }).catch((e) => {
    log('Pi RPC 启动失败:', e.message);
    process.exit(1);
  });

  // 等 Pi ready:第一波事件到达
  await new Promise((r) => setTimeout(r, 300));
  log('entry-bot 完全就绪');

  // ---- 7. 处理 Discord 用户消息 ----
  async function handleUserMessage(msg) {
    if (msg.author?.bot) return;
    if (msg.channelId !== cfg.channels.entry) return;
    if (cfg.allowedUserIds.length && !cfg.allowedUserIds.includes(msg.author.id)) {
      await discord.react(msg, '🚫');
      return;
    }
    const userText = `[Discord 用户 ${msg.author.username} 在 #主入口]\n\n${msg.content}`;
    log(`收到 Discord (${msg.author.username}): "${msg.content.slice(0, 80)}"`);
    try { await discord.react(msg, '⏳'); } catch {}
    pendingReply = msg;
    try {
      // RPC 模式:RPC 命令是 reload-safe 的,不需要重试
      // 如果 Pi 正在 streaming,需要带 streamingBehavior
      await pi.prompt(userText);
      log(`已 prompt 注入 Pi`);
    } catch (e) {
      log('prompt 失败:', e.message);
      try { await discord.react(msg, '❌'); } catch {}
      try {
        await msg.reply('😵 Pi 暂时连不上,请稍后再发一次。');
      } catch {}
      pendingReply = null;
    }
  }

  // ---- 8. 优雅退出 ----
  async function shutdown(sig) {
    log(`收到 ${sig}, 关闭中…`);
    try { await pi.stop(); } catch {}
    try { await discord.destroy(); } catch {}
    log('已关闭');
    process.exit(0);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

// 让 unhandled 错误不至于让进程静默死掉
process.on('unhandledRejection', (e) => log('unhandledRejection:', e?.message || e));
process.on('uncaughtException', (e) => log('uncaughtException:', e?.message || e));

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
