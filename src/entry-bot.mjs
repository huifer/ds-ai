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
import { appendFileSync } from 'node:fs';

import { RpcClient } from '@earendil-works/pi-coding-agent';
import { loadConfig, PATHS } from './config.mjs';
import { createDiscordClient } from './discord-client.mjs';
import { createScheduler } from './scheduler.mjs';
import { createMemoryStore } from './memory-store.mjs';
import { createMemoryJournal } from './memory-journal.mjs';
import { createMemoryMirror } from './memory-mirror.mjs';
import { createMemoryDistiller } from './memory-distiller.mjs';
import { createMemoryContext } from './memory-context.mjs';
import { createMemoryGovernance } from './memory-governance.mjs';
import { createMemoryQuality } from './memory-quality.mjs';
import { createEmbedder } from './embedder.mjs';
import { AgentManager, parseCommand } from './runtime/agent-manager.mjs';
import { handleAgentResult as agentResultHandler } from './runtime/agent-result.mjs';
import { PiBridge } from './runtime/pi-bridge.mjs';
import { LocalDraftPublisher } from './publishers/local-draft.mjs';
import { deliverToDiscord, deliverBatch } from './runtime/commands/deliver.mjs';
import { runRssJob, RSS_JOB_ID, RSS_JOB_SCHEDULE } from './jobs/rss-daily.mjs';
import { runDailySummaryJob, DAILY_JOB_ID, DAILY_JOB_SCHEDULE } from './jobs/daily-summary.mjs';
import { runTokenUsageJob, USAGE_JOB_ID, USAGE_JOB_SCHEDULE, handleUsageCommand as runUsageHandler } from './jobs/token-usage.mjs';

// ---- 多 Agent 系统集成 ----
import { AgentRegistry as MultiAgentRegistry } from './orchestrator/agent-registry.mjs';
import { SessionPool } from './orchestrator/session-pool.mjs';
import { ContextCompressor, HybridStrategy } from './orchestrator/context-compressor.mjs';
import { MultiAgentManager } from './orchestrator/agent-manager.mjs';
import { TeamEngine } from './orchestrator/team-engine.mjs';
import { MemoryBridge } from './orchestrator/memory-bridge.mjs';
import {
  addWatchedRepo,
  readWatchFile,
  removeWatchedRepo,
} from './gh-watch.mjs';
import {
  createDreamingPi,
  createDreamer,
  createArtifacts,
  createBudget,
  createDiary,
  loadXiasiConfig,
  describeXiasiConfig,
} from './dreaming/index.mjs';

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
const TOOLS_EXT = join(ROOT, 'extensions', 'discord-tools.mjs');
const FILE_EXT = join(ROOT, 'extensions', 'file-tools.mjs');
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

  // 把 .env 所有变量加载到 process.env（cron 和频道路由需要）
  for (const [k, v] of Object.entries(cfgRes._env ?? {})) {
    if (!process.env[k]) process.env[k] = v;
  }
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

  // ---- 4. 记忆系统初始化 ----
  let memoryStore = null;
  let memoryJournal = null;
  let memoryMirror = null;
  let memoryDistiller = null;
  let memoryContext = null;
  let memoryGovernance = null;
  let memoryQuality = null;
  let embedder = null;

  try {
    embedder = await createEmbedder({ log });
    memoryStore = await createMemoryStore({ rootDir: ROOT, embedder, log });
    memoryJournal = createMemoryJournal({ memoryStore, log });
    memoryMirror = createMemoryMirror({ memoryStore, discord, channelId: cfg.channels.memory, log });
    memoryDistiller = createMemoryDistiller({ memoryStore, journal: memoryJournal, embedder, discord, cfg, log });
    memoryContext = createMemoryContext({ memoryStore, embedder, log });
    memoryGovernance = createMemoryGovernance({ memoryStore, log });
    memoryQuality = createMemoryQuality({ memoryStore, log });
    log('记忆系统已初始化');
  } catch (e) {
    log(`记忆系统初始化失败: ${e.message}`);
  }

  // ---- 5. Pi RPC 客户端 ----
  // ---- 4.5 「遐思」配置 + artifacts/budget 模块(不依赖 Pi) ----
  const xc = loadXiasiConfig();
  log(`遐思配置: ${describeXiasiConfig(xc)}`);

  const artifacts = await createArtifacts({ log });
  const budget    = createBudget({ dailyLimit: xc.dailyTokenBudget, tzOffsetHours: xc.tzOffsetHours, log });
  log(`遐思: artifacts 模块就绪 · budget 模块就绪 (enabled=${xc.enabled})`);

  // ---- 5. Pi RPC 客户端 ----
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
      CH_SYSTEM: cfg.channels.system,
      CH_RSS:    cfg.channels.rss,
      CH_DAILY:  cfg.channels.daily,
      CH_GH:     cfg.channels.gh,
      CH_USAGE:  cfg.channels.usage,
      CH_OPPORTUNITY: cfg.channels.opportunity,
      // 代理(launchd 进程没继承系统代理)
      HTTP_PROXY: 'http://127.0.0.1:7897',
      HTTPS_PROXY: 'http://127.0.0.1:7897',
      ALL_PROXY: 'socks5://127.0.0.1:7897',
    },
    args: [
      '--mode', 'rpc',
      '--extension', TOOLS_EXT,
      '--extension', FILE_EXT,
      '--session-dir', SESSION_DIR,
      '--name', `discord-bridge-${new Date().toISOString().slice(0, 10)}`,
    ],
  });

  // ---- 4.5.5 多 Agent 系统初始化(灰度切换)----
  let multiAgentEnabled = process.env.MULTI_AGENT_ENABLED !== 'false'; // 默认启用
  let multiAgentManager = null;
  let teamEngine = null;

  if (multiAgentEnabled) {
    try {
      const multiAgentRegistry = new MultiAgentRegistry({ rootDir: ROOT, log });

      // 加载 Discord 频道映射(从运行时环境变量推算 ID → 名称)
      const chIdToName = {};
      for (const [k, v] of Object.entries(process.env)) {
        if (k.startsWith('CH_') && /^\d{17,20}$/.test(v ?? '')) {
          // 需要运行时通过 Discord API 获取名字,这里用 CH_<NAME> 作为 fallback
          chIdToName[v] = k.replace(/^CH_/, '').toLowerCase().replace(/_/g, '-');
        }
      }
      multiAgentRegistry.bindChannelIds(chIdToName);
      multiAgentRegistry.loadFromRegistryJson();
      log(`多 Agent registry 加载: ${multiAgentRegistry.list().length} 个 agent`);

      const sessionPool = new SessionPool({
        rootDir: ROOT,
        log,
        persistDir: process.env.SESSION_PERSIST_DIR || 'data/multi-agent-sessions',
        maxTurnsBeforeCompress: parseInt(process.env.SESSION_MAX_TURNS || '20', 10),
        maxTokensBeforeCompress: parseInt(process.env.SESSION_MAX_TOKENS || '60000', 10),
        keepRecentTurns: parseInt(process.env.SESSION_KEEP_RECENT || '5', 10),
        idleMinutesBeforeArchive: parseInt(process.env.SESSION_IDLE_MINUTES || '30', 10),
      });

      const piBridge = new PiBridge({ rpcClient: pi, log });
      const strategy = new HybridStrategy({ piBridge, log });

      multiAgentManager = new MultiAgentManager({
        rootDir: ROOT,
        piBridge,
        log,
        sessionPoolOpts: {},
        compressionStrategy: strategy,
      });
      // 复用现有 memoryContext
      if (typeof memoryContext !== 'undefined' && memoryContext) {
        multiAgentManager.setMemoryContext(memoryContext);
      }

      teamEngine = new TeamEngine({
        registry: multiAgentRegistry,
        sessionPool,
        multiAgentManager,
        log,
        rootDir: ROOT,
      });

      log(`✅ 多 Agent 系统已启用 (sessions=${sessionPool.list().length}, agents=${multiAgentRegistry.list().length})`);
    } catch (e) {
      log(`⚠️ 多 Agent 系统初始化失败,降级到原有逻辑: ${e.message}`);
      multiAgentEnabled = false;
    }
  } else {
    log('多 Agent 系统未启用 (MULTI_AGENT_ENABLED=false)');
  }

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

      // 记录 assistant 回复到 journal
      if (memoryJournal) {
        const replyTo = pendingReply || { id: currentMessageId, channelId: cfg.channels.entry };
        memoryJournal.captureAssistantMessage(text, replyTo);
      }

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

  // ---- AgentManager ----
  const piBridge = new PiBridge({ rpcClient: pi, log });
  const publisher = new LocalDraftPublisher({ root: ROOT, log });
  const agentManager = new AgentManager({ root: ROOT, piBridge, publisher });
  try {
    await agentManager.start();
    log(`AgentManager 就绪 · ${agentManager.agents.size} agents · piBridge.available=${piBridge.available} · publisher=${publisher.name}`);
  } catch (e) {
    log(`AgentManager 初始化失败(非致命): ${e.message}`);
  }

  // ---- 6.5 「遐思」:独立 Pi 子进程 + dreamer ----
  let dreamingPi = null;
  let dreamer     = null;
  let reporter    = null;
  let xiasiVotes  = null;
  if (xc.enabled) {
    try {
      log('启动 dreaming-pi 子进程…');
      dreamingPi = await createDreamingPi({
        provider: cfg.provider || 'minimax-cn',
        model:    cfg.model || null,
        env: {
          DISCORD_TOKEN: cfg.token,
          CH_XIASI: cfg.channels.xiasi,
        },
        log,
      });
      dreamer = await createDreamer({
        cfg: { ...cfg, dreaming: xc },
        dreamingPi,
        discord,
        memoryStore,
        journal: memoryJournal,
        embedder,
        artifacts,
        budget,
        diary: createDiary({ dreamingPi, log, tzOffsetHours: xc.tzOffsetHours }),
        log,
      });
      log(`dreamer 就绪 · types=${xc.types.join(',')}`);
      // PR4: reporter + votes
      const { createReporter } = await import('./dreaming/report.mjs');
      reporter = createReporter({ artifacts, log, tzOffsetHours: xc.tzOffsetHours });
      const { createVotes } = await import('./dreaming/votes.mjs');
      xiasiVotes = createVotes({ log });
      log(`reporter + votes 就绪`);
      // PR4: 反向只读打通 — 把 artifacts 注入 memory-context
      if (memoryContext) {
        memoryContext.setDreamArtifacts(artifacts);
        log('memory-context 已注入 dreamArtifacts(反向只读打通)');
      }
    } catch (e) {
      log(`「遐思」初始化失败(非致命,dreaming 会跳过): ${e.message}`);
    }
  } else {
    log('「遐思」未启用(XIASI_ENABLED=false)');
  }

  // ---- 7.5. 调度器:RSS hub + 每日总结 ----
  const sched = createScheduler({ log });
  sched.register({
    id: RSS_JOB_ID,
    hour: RSS_JOB_SCHEDULE.hour,
    minute: RSS_JOB_SCHEDULE.minute,
    tzOffsetHours: RSS_JOB_SCHEDULE.tzOffsetHours,
    run: ({ dateKey }) => runRssJob({ dateKey, pi, discord, log }),
  });
  sched.register({
    id: DAILY_JOB_ID,
    hour: DAILY_JOB_SCHEDULE.hour,
    minute: DAILY_JOB_SCHEDULE.minute,
    tzOffsetHours: DAILY_JOB_SCHEDULE.tzOffsetHours,
    run: ({ dateKey }) => runDailySummaryJob({ dateKey, pi, discord, log }),
  });
  sched.register({
    id: USAGE_JOB_ID,
    hour: USAGE_JOB_SCHEDULE.hour,
    minute: USAGE_JOB_SCHEDULE.minute,
    tzOffsetHours: USAGE_JOB_SCHEDULE.tzOffsetHours,
    run: ({ dateKey }) => runTokenUsageJob({
      dateKey,
      days: cfg.usageDays || 14,
      pi, discord, log,
      channelId: cfg.channels.usage,
    }),
  });
// ---- 每日任务 to-do list(用 child_process 跑独立脚本)----
  sched.register({
    id: 'gh-todo-daily',
    hour: 10,
    minute: 0,
    tzOffsetHours: 8,
    run: async () => {
      const { spawn } = await import('node:child_process');
      const script = join(ROOT, 'scripts', 'push-gh-list.mjs');
      log('[gh-todo-daily] 触发,跑 ' + script);
      const child = spawn('node', [script], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '', err = '';
      child.stdout.on('data', d => { out += d; });
      child.stderr.on('data', d => { err += d; });
      child.on('close', code => {
        log('[gh-todo-daily] exit=' + code);
        if (out) log('[gh-todo-daily] stdout: ' + out.trim().split('\n').slice(-3).join(' | '));
        if (err) log('[gh-todo-daily] stderr: ' + err.trim().split('\n').slice(-3).join(' | '));
      });
    },
  });
  // ---- 记忆蒸馏任务 (每日 23:30) ----
  if (memoryDistiller) {
    memoryDistiller.setPi(pi);
    sched.register({
      id: 'distillation-daily',
      hour: 23,
      minute: 30,
      tzOffsetHours: 8,
      run: async ({ dateKey }) => {
        log(`[distillation-daily] 触发蒸馏: ${dateKey}`);
        try {
          const result = await memoryDistiller.distillNow({
            reason: 'scheduled',
            dateKeyStr: dateKey,
            pi,
          });
          log(`[distillation-daily] 完成: ${result.count} 条记忆`);
        } catch (e) {
          log(`[distillation-daily] 失败: ${e.message}`);
        }
      },
    });
    log('记忆蒸馏任务已注册 (每日 23:30)');
  }

  // ---- 记忆治理任务 (每周日凌晨 2:00) ----
  if (memoryGovernance) {
    sched.register({
      id: 'memory-governance-weekly',
      dayOfWeek: 0,  // 周日
      hour: 2,
      minute: 0,
      tzOffsetHours: 8,
      run: async () => {
        log('[governance-weekly] 执行每周治理...');
        try {
          const result = await memoryGovernance.runGovernance({ dryRun: false });
          log(`[governance-weekly] 完成: 过期=${result.expired}, 归档=${result.archived}, 删除=${result.deleted}`);
        } catch (e) {
          log(`[governance-weekly] 失败: ${e.message}`);
        }
      },
    });
    log('记忆治理任务已注册 (每周日凌晨 2:00)');
  }

  // ---- 记忆质量更新任务 (每周日凌晨 3:00) ----
  if (memoryQuality) {
    sched.register({
      id: 'memory-quality-weekly',
      dayOfWeek: 0,  // 周日
      hour: 3,
      minute: 0,
      tzOffsetHours: 8,
      run: async () => {
        log('[quality-weekly] 批量更新置信度...');
        try {
          const result = await memoryQuality.batchUpdate({ dryRun: false });
          log(`[quality-weekly] 完成: 扫描=${result.scanned}, 更新=${result.updated}, 跳过=${result.skipped}`);
        } catch (e) {
          log(`[quality-weekly] 失败: ${e.message}`);
        }
      },
    });
    log('记忆质量更新任务已注册 (每周日凌晨 3:00)');
  }

  // ---- 7.6 「遐思」调度任务(每天 03:30 / 03:45 / 04:00)----
  if (dreamer && xc.enabled) {
    const xiasiJobs = [
      { id: 'xiasi-lian-zhu', type: 'lian-zhu', hour: 3, minute: 30 },
      { id: 'xiasi-gui-cang', type: 'gui-cang', hour: 3, minute: 45 },
      { id: 'xiasi-ming-tai', type: 'ming-tai', hour: 4, minute: 0 },
    ];
    for (const job of xiasiJobs) {
      sched.register({
        id: job.id,
        hour: job.hour,
        minute: job.minute,
        tzOffsetHours: xc.tzOffsetHours || 8,
        run: async () => {
          log(`[${job.id}] 触发`);
          try {
            const r = await dreamer.run({ type: job.type, triggeredBy: 'scheduled' });
            log(`[${job.id}] 完成 status=${r.status} artifacts=${r.artifactCount}`);
          } catch (e) {
            log(`[${job.id}] 失败: ${e.message}`);
          }
        },
      });
    }
    log(`「遐思」调度任务已注册: ${xiasiJobs.map(j => `${j.id}@${j.hour}:${String(j.minute).padStart(2,'0')}`).join(', ')}`);

    // PR4: 周报(每周日 08:00) + 月报(每月 1 日 08:00)
    sched.register({
      id: 'xiasi-weekly-report',
      dayOfWeek: 0,
      hour: 8,
      minute: 0,
      tzOffsetHours: xc.tzOffsetHours || 8,
      run: async () => {
        log('[xiasi-weekly-report] 触发');
        try {
          const text = await reporter.weeklyReport();
          if (discord?.send) await discord.send(xc.channelId, text.slice(0, 1900));
          log('[xiasi-weekly-report] ✓ 已推送');
        } catch (e) {
          log(`[xiasi-weekly-report] 失败: ${e.message}`);
        }
      },
    });
    sched.register({
      id: 'xiasi-monthly-report',
      // 用 day=1 无法精确表达「每月1号」,改为每天跑,内部判断
      hour: 8,
      minute: 30,
      tzOffsetHours: xc.tzOffsetHours || 8,
      run: async () => {
        // 只在每月 1 号执行
        const d = new Date();
        const utcMs = d.getTime() + d.getTimezoneOffset() * 60_000 + 8 * 3600_000;
        const tzDate = new Date(utcMs);
        if (tzDate.getUTCDate() !== 1) return;
        log('[xiasi-monthly-report] 触发(每月1号)');
        try {
          const text = await reporter.monthlyReport();
          if (discord?.send) await discord.send(xc.channelId, text.slice(0, 1900));
          log('[xiasi-monthly-report] ✓ 已推送');
        } catch (e) {
          log(`[xiasi-monthly-report] 失败: ${e.message}`);
        }
      },
    });
    log('遐思周报(周日 08:00) + 月报(每月1号 08:30) 已注册');
  }

  // ---- AgentManager cron: intake / distill / qa ----
  if (agentManager.agents.size > 0) {
    sched.register({
      id: 'content-intake', hour: 23, minute: 50, tzOffsetHours: 8,
      run: async () => {
        log('[content-intake] 触发');
        try {
          const r = await agentManager.dispatch({
            source: 'cron', channelId: process.env.CH_DAILY_MATERIAL,
            userId: 'system', text: '!intake now --source="scheduled intake"',
          });
          log(`[content-intake] ${r.status} ${r.result?.materialId ?? r.error ?? ''}`);
        } catch (e) { log(`[content-intake] 失败: ${e.message}`); }
      },
    });
    sched.register({
      id: 'content-distill', hour: 0, minute: 0, tzOffsetHours: 8,
      run: async () => {
        log('[content-distill] 触发');
        try {
          const r = await agentManager.dispatch({
            source: 'cron', channelId: process.env.CH_DOMESTIC_MAIN,
            userId: 'system', text: '!distill now',
          });
          log(`[content-distill] ${r.status} ${r.result?.candidateId ?? r.error ?? ''}`);
        } catch (e) { log(`[content-distill] 失败: ${e.message}`); }
      },
    });
    sched.register({
      id: 'content-qa', hour: 22, minute: 0, tzOffsetHours: 8,
      run: async () => {
        log('[content-qa] 触发');
        try {
          const r = await agentManager.dispatch({
            source: 'cron', channelId: process.env.CH_AGENT_STATUS,
            userId: 'system', text: '!qa last',
          });
          log(`[content-qa] ${r.status} ${r.result?.qaId ?? r.error ?? ''}`);
        } catch (e) { log(`[content-qa] 失败: ${e.message}`); }
      },
    });
    // 06:00 自动渲染最新 candidate + 投递到预览频道
    sched.register({
      id: 'content-render', hour: 6, minute: 0, tzOffsetHours: 8,
      run: async () => {
        log('[content-render] 触发');
        try {
          const r = await agentManager.dispatch({
            source: 'cron', channelId: process.env.CH_DOMESTIC_MAIN,
            userId: 'system', text: '!auto-render',
          });
          if (r.status === 'OK' && r.result?.renderIds?.length) {
            const batch = await deliverBatch({ rndIds: r.result.renderIds, discord, env: process.env });
            log(`[content-render] rendered ${r.result.rendered}/${r.result.total} · delivered ${batch.ok}/${batch.total}`);
          } else {
            log(`[content-render] ${r.status} ${r.error ?? r.result?.results?.map(x => x.error).filter(Boolean).join(', ') ?? ''}`);
          }
        } catch (e) { log(`[content-render] 失败: ${e.message}`); }
      },
    });
    log('AgentManager cron 已注册: intake@23:50, distill@00:00, render+deliver@06:00, qa@22:00');
  }

  sched.start();
  log(`调度器已启动 · jobs: ${sched.list().map((j) => `${j.id}@${j.hour}:${String(j.minute).padStart(2,'0')}`).join(', ')}`);

  // ---- 8. 处理 Discord 用户消息 ----

  // ---- 8a. !help 命令处理 ----
  async function handleHelpCommand(msg, text) {
    const args = text.trim().split(/\s+/).slice(1);
    const topic = args[0]?.toLowerCase() || '';

    // 无参数显示总览
    if (!topic || topic === 'help' || topic === '?') {
      const helpText = 
        '📚 **命令帮助**\n\n' +
        '发送 `!help <命令名>` 查看详细用法\n\n' +
        '**可用命令**:\n' +
        '• `!help` — 显示此帮助\n' +
        '• `!watch` — 仓库监控管理\n' +
        '• `!archive` — 显式知识归档\n' +
        '• `!usage` — Token 使用量报告\n' +
        '• `!distill` — 手动触发记忆蒸馏\n' +
        '• `!memory` — 记忆管理\n' +
        '• `!opportunity` — 机会发现调研\n\n' +
        '**频道说明**:\n' +
        '• `#主入口` 📝 — 唯一对话入口\n' +
        '• `#记忆库` 🧠 — 长期事实/偏好\n' +
        '• `#灵感` ✨ — 创意/灵感点子\n' +
        '• `#工程` 🔨 — 技术结论/代码决策\n' +
        '• `#系统` 🛠 — 系统告警/诊断\n' +
        '• `#资讯` 📰 — RSS hub 每日推送 (12:00)\n' +
        '• `#每日总结` 🌙 — 每日总结推送 (23:00)\n' +
        '• `#每日任务` 🎯 — GitHub 待办 (10:00)\n' +
        '• `#用量` 📊 — Token 使用量报告 (12:30)\n' +
        '• `#机会` 💡 — 机会发现调研 brief\n\n' +
        '查看完整文档: `docs/COMMANDS.md`';
      await msg.reply(helpText).catch(() => {});
      return;
    }

    // 命令详细帮助
    const commandHelp = {
      watch: 
        '🎯 **!watch 命令** — 仓库监控管理\n\n' +
        '**用法**:\n' +
        '• `!watch list` — 查看监控池中的仓库列表\n' +
        '• `!watch add <owner/repo>` — 添加仓库到监控池\n' +
        '• `!watch remove <owner/repo>` — 从监控池移除仓库\n' +
        '• `!watch help` — 显示帮助信息\n\n' +
        '**示例**:\n' +
        '`!watch add rust-lang/rust`\n' +
        '`!watch remove vercel/next.js`\n\n' +
        '**自动任务**:\n' +
        '每天 10:00 自动生成 GitHub Issue 待办并推送到 `#🎯 每日任务`',

      archive: 
        '🗂️ **!archive 命令** — 显式知识归档\n\n' +
        '**用法**:\n' +
        '• `!archive memory <内容>` — 归档长期事实/偏好 → `#🧠 记忆库`\n' +
        '• `!archive ideas <内容>` — 归档灵感/点子 → `#✨ 灵感`\n' +
        '• `!archive build <内容>` — 归档工程结论 → `#🔨 工程`\n' +
        '• `!archive help` — 显示帮助信息\n\n' +
        '**示例**:\n' +
        '`!archive memory 我偏好使用 Rust 构建高性能服务`\n' +
        '`!archive ideas 可以做一个 AI 驱动的代码审查工具`\n' +
        '`!archive build 使用 axum + tokio 的异步 Web 框架`\n\n' +
        '**别名支持**:\n' +
        '• memory: 记忆、记忆库\n' +
        '• ideas: idea、灵感、点子\n' +
        '• build: 工程、代码',

      usage: 
        '📊 **!usage 命令** — Token 使用量报告\n\n' +
        '**用法**:\n' +
        '• `!usage` — 14 天详细报告（推送到 `#📊 用量`）\n' +
        '• `!usage 7/30/90` — 指定窗口天数\n' +
        '• `!usage today` — 今日 vs 昨日对比\n' +
        '• `!usage month` — 本月累计统计\n' +
        '• `!usage model` — 按 model 拆分统计（Top 25）\n' +
        '• `!usage agent` — 按 agent 拆分统计\n' +
        '• `!usage cost` — 只看成本统计\n' +
        '• `!usage help` — 显示帮助信息\n\n' +
        '**示例**:\n' +
        '`!usage 7`\n' +
        '`!usage today`\n' +
        '`!usage model`\n\n' +
        '**自动任务**:\n' +
        '每天 12:30 自动推送 14 天报告到 `#📊 用量`',

      distill: 
        '🧠 **!distill 命令** — 手动触发记忆蒸馏\n\n' +
        '**用法**:\n' +
        '• `!distill` — 立即触发蒸馏（使用今日 journal）\n' +
        '• `!distill help` — 显示帮助信息\n\n' +
        '**蒸馏规则**:\n' +
        '• 从今日对话中提取 0-5 条记忆\n' +
        '• 严格查重：相似度阈值 0.9\n' +
        '• 质量优先：宁缺毋滥\n' +
        '• 结果自动推送到 `#🧠 记忆库`\n\n' +
        '**自动任务**:\n' +
        '每天 23:30 自动蒸馏',

      memory: 
        '🧠 **!memory 命令** — 记忆管理\n\n' +
        '**统计**:\n' +
        '• `!memory stats` — 查看记忆统计信息\n\n' +
        '**查询**:\n' +
        '• `!memory search <关键词>` — 搜索记忆\n' +
        '• `!memory show <subject>` — 显示记忆详情\n\n' +
        '**维护**:\n' +
        '• `!memory report` — 生成记忆质量报告\n' +
        '• `!memory cleanup` — 手动清理过期记忆\n' +
        '• `!memory help` — 显示帮助信息\n\n' +
        '**示例**:\n' +
        '`!memory search rust`\n' +
        '`!memory show 我的编码偏好`\n\n' +
        '**自动任务**:\n' +
        '• 每日 23:30：自动蒸馏\n' +
        '• 每周日 02:00：自动治理（过期/归档/删除）\n' +
        '• 每周日 03:00：批量更新置信度',

      opportunity: 
        '💡 **!opportunity 命令** — 机会发现调研\n\n' +
        '**用法**:\n' +
        '• `!opportunity <topic>` — 触发机会发现，brief 推送到 `#💡 机会`\n' +
        '• `!opportunity <topic> <channel>` — 推送到指定频道\n' +
        '• `!opportunity help` — 显示帮助信息\n\n' +
        '**可用频道**:\n' +
        'opportunity、build、ideas、memory\n\n' +
        '**示例**:\n' +
        '`!opportunity AI Agent 开发工具`\n' +
        '`!opportunity Rust Web 框架 ideas`\n\n' +
        '**调研流程**:\n' +
        '1. 数据采集：HN Algolia / gh CLI / 中文 RSS / Reddit\n' +
        '2. AI 推理：聚类 / 合成 / 写 brief\n' +
        '3. 输出：5 个 cluster + SaaS/App 创业灵感 + 链接清单\n' +
        '4. 自动推送到 `#主入口` + 目标频道\n\n' +
        '**预计耗时**: 1-3 分钟',
    };

    if (commandHelp[topic]) {
      await msg.reply(commandHelp[topic]).catch(() => {});
    } else {
      await msg.reply(
        `未知命令: \`!${topic}\`\n\n` +
        '可用命令: help、watch、archive、usage、distill、memory、opportunity\n\n' +
        '发送 `!help` 查看总览'
      ).catch(() => {});
    }
  }

  // ---- 8b. AgentManager 结果处理器 (委托给 agent-result.mjs) ----
  async function handleAgentResult(result, msg) {
    await agentResultHandler({
      result, msg, discord, log,
      env: process.env,
      channels: {
        approvalCenter: process.env.CH_APPROVAL_CENTER,
        projectMgmt: process.env.CH_PROJECT_MGMT,
        fdeDelivery: process.env.CH_FDE_DELIVERY,
        dailyMaterial: process.env.CH_DAILY_MATERIAL,
        agentStatus: process.env.CH_AGENT_STATUS,
        // 预览频道（国内）
        CH_DOMESTIC_PREVIEW_WECHAT: process.env.CH_DOMESTIC_PREVIEW_WECHAT,
        CH_DOMESTIC_PREVIEW_XHS: process.env.CH_DOMESTIC_PREVIEW_XHS,
        CH_DOMESTIC_PREVIEW_VIDEO: process.env.CH_DOMESTIC_PREVIEW_VIDEO,
        CH_DOMESTIC_PREVIEW_DOUYIN: process.env.CH_DOMESTIC_PREVIEW_DOUYIN,
        // 预览频道（海外）
        CH_OS_PREVIEW_X: process.env.CH_OS_PREVIEW_X,
        CH_OS_PREVIEW_PH: process.env.CH_OS_PREVIEW_PH,
        CH_OS_PREVIEW_NEWSLETTER: process.env.CH_OS_PREVIEW_NEWSLETTER,
        CH_OS_PREVIEW_YOUTUBE: process.env.CH_OS_PREVIEW_YOUTUBE,
        CH_OS_PREVIEW_LINKEDIN: process.env.CH_OS_PREVIEW_LINKEDIN,
        // 发布频道（国内）
        CH_DOMESTIC_PUBLISH_WECHAT: process.env.CH_DOMESTIC_PUBLISH_WECHAT,
        CH_DOMESTIC_PUBLISH_XHS: process.env.CH_DOMESTIC_PUBLISH_XHS,
        CH_DOMESTIC_PUBLISH_VIDEO: process.env.CH_DOMESTIC_PUBLISH_VIDEO,
        CH_DOMESTIC_PUBLISH_DOUYIN: process.env.CH_DOMESTIC_PUBLISH_DOUYIN,
        // 发布频道（海外）
        CH_OS_PUBLISH_X: process.env.CH_OS_PUBLISH_X,
        CH_OS_PUBLISH_PH: process.env.CH_OS_PUBLISH_PH,
        CH_OS_PUBLISH_NEWSLETTER: process.env.CH_OS_PUBLISH_NEWSLETTER,
        // 总编频道
        CH_DOMESTIC_MAIN: process.env.CH_DOMESTIC_MAIN,
        CH_OS_MAIN: process.env.CH_OS_MAIN,
        CH_NEWS_FEED: process.env.CH_NEWS_FEED,
      },
    });
  }

  // ---- 8c. 处理 Discord 用户消息 ----
  async function handleUserMessage(msg) {
    if (msg.author?.bot) return;
    log(`[discord] 收到消息 channel=${msg.channelId} user=${msg.author.username}: "${(msg.content || '').slice(0, 40)}"`);
    const text = (msg.content || '').trim();

    // ---- 多 Agent 系统:Team 协作命令 ----
    if (multiAgentEnabled && teamEngine && text.startsWith('!')) {
      const teamMatch = teamEngine.match(text);
      if (teamMatch) {
        await discord.react(msg, '🤝').catch(() => {});
        try {
          const result = await teamEngine.execute({
            teamId: teamMatch.team.id,
            originalInput: teamMatch.args.join(' '),
            userId: msg.author.id,
            channelId: msg.channelId,
          });

          // 回复 Team 执行结果
          const statusEmoji = {
            success: '✅',
            awaiting_approval: '⏸️',
            failed: '❌',
            running: '🔄',
          }[result.status] ?? 'ℹ️';

          const summary = `# Team 执行${statusEmoji} - ${teamMatch.team.id}\n` +
            `ID: \`${result.id}\`\n` +
            `状态: ${result.status}\n` +
            `耗时: ${result.completedAt ? ((new Date(result.completedAt) - new Date(result.startedAt)) / 1000).toFixed(1) : '?'}s\n` +
            `步骤: ${result.stepResults.length}\n\n` +
            result.stepResults.map((r, i) => {
              const icon = r.status === 'OK' ? '✅' : r.status === 'ERROR' ? '❌' : '⏭️';
              return `${icon} ${r.label ?? `步骤${i+1}`} → ${r.status}`;
            }).join('\n');

          await msg.reply(summary.slice(0, 1900)).catch(() => {});

          // 如果有最终结果摘要,作为 follow-up
          if (result.finalResult?.summary) {
            const followUp = result.finalResult.summary.slice(0, 1500);
            await msg.channel.send(followUp).catch(() => {});
          }

          if (result.status === 'awaiting_approval' && result.finalResult?.approvalType) {
            await msg.channel.send(`⏸️ 等待审批: \`${result.finalResult.approvalType}\`\n请到审批中心查看: <#${env.CH_APPROVAL_CENTER}>`).catch(() => {});
          }
        } catch (e) {
          log(`Team 执行异常: ${e.message}`);
          await msg.reply(`❌ Team 执行失败: ${e.message}`).catch(() => {});
        }
        await discord.removeReact(msg, '🤝').catch(() => {});
        return;
      }
    }

    // ---- 多 Agent 系统:自由文本路由(主入口或业务频道)----
    if (multiAgentEnabled && multiAgentManager && !text.startsWith('!')) {
      const channelName = msg.channel?.name;
      const isMainEntry = msg.channelId === process.env.CH_ENTRY;
      const isBusinessChannel = multiAgentManager.registry.getByChannel(channelName);

      // 只在主入口和已映射的业务频道走多 Agent
      if (isMainEntry || isBusinessChannel) {
        await discord.react(msg, '🤖').catch(() => {});
        try {
          const result = await multiAgentManager.handleMessage({
            channelId: msg.channelId,
            channelName,
            userId: msg.author.id,
            userName: msg.author.username,
            text,
          });

          // 回复
          const displayName = result.agentDisplayName ?? result.agentId;
          let replyText = `🤖 **${displayName}**:\n\n${result.reply}`;
          if (result.compressed) {
            replyText += `\n\n🗜️ _上下文已自动压缩_`;
          }

          await msg.reply(replyText.slice(0, 1900)).catch(() => {});
        } catch (e) {
          log(`多 Agent 处理失败: ${e.message}`);
          await msg.reply(`❌ 多 Agent 错误: ${e.message.slice(0, 200)}`).catch(() => {});
        }
        await discord.removeReact(msg, '🤖').catch(() => {});
        return; // 不再走后续原有逻辑
      }
    }

    // ---- AgentManager 路由（任何频道都可以发 Agent 命令）----
    if (text.startsWith('!')) {
      const cmd = parseCommand(text);

      // ---- !deliver: 推送渲染到预览频道 ----
      if (cmd?.name === 'deliver') {
        const rndId = cmd.args.rnd ?? (cmd.sub && cmd.sub !== '*' ? cmd.sub : undefined);
        try { await discord.react(msg, '⏳'); } catch {}
        try {
          const result = await deliverToDiscord({ rndId, discord, env: process.env });
          if (result.ok) {
            await msg.reply(`✅ 已推送到预览频道 · ${result.platform} · ${result.messageCount} 条消息`).catch(() => {});
          } else {
            await msg.reply(`❌ ${result.error}`).catch(() => {});
          }
        } catch (e) {
          log(`deliver 失败: ${e.message}`);
          await msg.reply(`⚠️ ${e.message}`).catch(() => {});
        }
        try { await discord.removeReact(msg, '⏳'); } catch {}
        return;
      }

      if (cmd?.route) {
        if (cfg.allowedUserIds.length && !cfg.allowedUserIds.includes(msg.author.id)) {
          await discord.react(msg, '🚫');
          return;
        }
        try { await discord.react(msg, '⏳'); } catch {}
        try {
          const result = await agentManager.dispatch({
            source: 'discord',
            channelId: msg.channelId,
            userId: msg.author.id,
            text,
          });
          await handleAgentResult(result, msg);

          // ---- auto-render 后自动投递到预览频道 ----
          if (cmd.name === 'auto-render' && result?.status === 'OK' && result.result?.renderIds?.length) {
            try {
              const batch = await deliverBatch({ rndIds: result.result.renderIds, discord, env: process.env });
              log(`auto-deliver: ${batch.ok}/${batch.total} 已推送`);
            } catch (e) {
              log(`auto-deliver 失败: ${e.message}`);
            }
          }
        } catch (e) {
          log(`AgentManager dispatch 失败: ${e.message}`);
          await msg.reply(`⚠️ ${e.message}`).catch(() => {});
        }
        try { await discord.removeReact(msg, '⏳'); } catch {}
        return;
      }
    }

    // ---- 以下主要处理 #主入口 的消息,但 !xiasi / !ask-xiasi 命令可在任何 channel ----
    const isXiasiCommand = text.startsWith('!xiasi') || text.startsWith('!ask-xiasi');
    if (!isXiasiCommand && msg.channelId !== cfg.channels.entry) return;
    if (cfg.allowedUserIds.length && !cfg.allowedUserIds.includes(msg.author.id)) {
      await discord.react(msg, '🚫');
      return;
    }

    // ---- 7a. !help 显示帮助 ----
    if (text === '!help' || text.startsWith('!help ') || text.startsWith('!help\t')) {
      await handleHelpCommand(msg, text);
      return;
    }

    // ---- 7b. !watch 仓库监控池管理 ----
    if (text === '!watch' || text.startsWith('!watch ') || text.startsWith('!watch\t')) {
      await handleWatchCommand(msg, text);
      return;
    }

    // ---- 7c. !archive 显式知识归档 ----
    if (text === '!archive' || text.startsWith('!archive ') || text.startsWith('!archive\t')) {
      await handleArchiveCommand(msg, text);
      return;
    }

    // ---- 7d. !usage ... 直接同步处理,不走 LLM ----
    if (text === '!usage' || text.startsWith('!usage ') || text.startsWith('!usage\t')) {
      await handleUsageCommand(msg, text);
      return;
    }

    // ---- 7e. !distill 手动触发记忆蒸馏 ----
    if (text === '!distill' || text.startsWith('!distill ') || text.startsWith('!distill\t')) {
      await handleDistillCommand(msg, text);
      return;
    }

    // ---- 7f. !memory 记忆管理 ----
    if (text === '!memory' || text.startsWith('!memory ') || text.startsWith('!memory\t')) {
      await handleMemoryCommand(msg, text);
      return;
    }

    // ---- 7g. !opportunity <topic> [channel] spawn Pi subprocess 跑偶发机会发现 ----
    if (text === '!opportunity' || text.startsWith('opportunity ') || text.startsWith('opportunity\t')) {
      await handleOpportunityCommand(msg, text);
      return;
    }

    // ---- 7h. !xiasi 遐思状态/触发 ----
    if (text === '!xiasi' || text.startsWith('!xiasi ') || text.startsWith('!xiasi\t')) {
      await handleXiasiCommand(msg, text);
      return;
    }

    // ---- 7i. !ask-xiasi 从梦境产物中检索洞察 ----
    if (text.startsWith('!ask-xiasi') || text.startsWith('!ask-xiasi ')) {
      await handleAskXiasi(msg, text.replace(/^!ask-xiasi\s*/, '').trim());
      return;
    }

    const userText = `[Discord 用户 ${msg.author.username} 在 #主入口]\n\n${text}`;
    log(`收到 Discord (${msg.author.username}): "${msg.content.slice(0, 80)}"`);

    // 构建记忆上下文
    let memoryContextStr = '';
    if (memoryContext) {
      try {
        memoryContextStr = await memoryContext.buildContext({
          userText: text,
          limit: 8,
        });
        if (memoryContextStr) {
          log(`[memory] 注入上下文: ${memoryContextStr.length} 字符`);
        }
      } catch (e) {
        log(`[memory] 上下文注入失败: ${e.message}`);
      }
    }

    // 记录用户消息到 journal
    if (memoryJournal) {
      memoryJournal.captureUserMessage(msg);
    }

    try { await discord.react(msg, '⏳'); } catch {}
    pendingReply = msg;
    try {
      // RPC 模式:RPC 命令是 reload-safe 的,不需要重试
      // 如果 Pi 正在 streaming,需要带 streamingBehavior
      const fullText = memoryContextStr ? `${memoryContextStr}\n\n${userText}` : userText;
      await pi.prompt(fullText);
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

  async function handleWatchCommand(msg, text) {
    const parts = text.trim().split(/\s+/).filter(Boolean);
    const action = (parts[1] || 'help').toLowerCase();

    if (action === 'help' || action === '?') {
      await msg.reply(
        '🎯 **!watch 命令**\n\n' +
        '• `!watch list` — 查看仓库监控池\n' +
        '• `!watch add owner/repo` — 添加仓库\n' +
        '• `!watch remove owner/repo` — 移除仓库\n\n' +
        '仓库池会在每天 10:00 自动生成 GitHub Issue 待办并推送到 #每日任务。',
      ).catch(() => {});
      return;
    }

    try {
      if (action === 'list') {
        const { repos } = readWatchFile();
        const body = repos.length
          ? repos.map((repo, i) => `${i + 1}. \`${repo}\``).join('\n')
          : '（仓库池为空）';
        await msg.reply(`🎯 **GitHub 仓库监控池**（${repos.length} 个）\n\n${body}`).catch(() => {});
        return;
      }

      if ((action === 'add' || action === 'remove') && parts.length !== 3) {
        await msg.reply(`用法: \`!watch ${action} owner/repo\``).catch(() => {});
        return;
      }

      if (action === 'add') {
        const result = addWatchedRepo(parts[2]);
        const status = result.added ? '✅ 已加入' : 'ℹ️ 已在监控池中';
        await msg.reply(`${status}: \`${result.repo}\`\n当前共 **${result.repos.length}** 个仓库。`).catch(() => {});
        return;
      }

      if (action === 'remove') {
        const result = removeWatchedRepo(parts[2]);
        const status = result.removed ? '✅ 已移除' : 'ℹ️ 监控池中没有这个仓库';
        await msg.reply(`${status}: \`${result.repo}\`\n当前共 **${result.repos.length}** 个仓库。`).catch(() => {});
        return;
      }

      await msg.reply('未知 !watch 子命令。发送 `!watch help` 查看用法。').catch(() => {});
    } catch (e) {
      log(`[watch] ${e.message}`);
      await msg.reply(`⚠️ !watch 执行失败: ${e.message}`).catch(() => {});
    }
  }

  async function handleArchiveCommand(msg, text) {
    const match = text.trim().match(/^!archive\s+(\S+)(?:\s+([\s\S]+))?$/i);
    const aliases = {
      memory: 'memory', '记忆': 'memory', '记忆库': 'memory',
      ideas: 'ideas', 'idea': 'ideas', '灵感': 'ideas', '点子': 'ideas',
      build: 'build', '工程': 'build', '代码': 'build',
    };
    const rawCategory = match?.[1]?.toLowerCase();
    const category = aliases[rawCategory];
    const content = match?.[2]?.trim();

    if (!category || !content || rawCategory === 'help' || rawCategory === '?') {
      await msg.reply(
        '🗂️ **!archive 命令**\n\n' +
        '• `!archive memory <内容>` — 归档长期事实/偏好\n' +
        '• `!archive ideas <内容>` — 归档灵感/点子\n' +
        '• `!archive build <内容>` — 归档工程结论\n' +
        '• `!archive help` — 查看帮助',
      ).catch(() => {});
      return;
    }

    const channelId = cfg.channels[category];
    if (!channelId) {
      await msg.reply(`⚠️ 频道未配置: ${category}`).catch(() => {});
      return;
    }

    try {
      const icon = cfg.labels?.[category] || '📝';
      const sent = await discord.send(channelId, `${icon} ${content}`);
      if (!sent) throw new Error('目标不是可写的文字频道');
      await msg.reply(`✅ 已归档到 <#${channelId}>`).catch(() => {});
    } catch (e) {
      log(`[archive] category=${category} ${e.message}`);
      await msg.reply(`⚠️ 归档失败: ${e.message}`).catch(() => {});
    }
  }

  // ---- 7d. !usage 命令处理(走 ccusage + ECharts 渲染,不走 LLM) ----
  //   !usage                  默认 14 天详细报告(推 #📊 用量)
  //   !usage 7/30/90          指定窗口天数
  //   !usage today            今日 vs 昨日
  //   !usage month            本月累计
  //   !usage model            按 model 拆
  //   !usage agent            按 agent 拆
  //   !usage cost             只看 cost
  //   !usage help             帮助
  async function handleUsageCommand(msg, text) {
    try { await discord.react(msg, '⏳'); } catch {}
    const parts = text.split(/\s+/).filter(Boolean);
    const sub = (parts[1] || '').toLowerCase();
    if (sub === 'help' || sub === '?') {
      await msg.reply(
        '📊 **!usage 命令**\n\n' +
        '• `!usage` — 14 天详细报告(推 #📊 用量,ECharts PNG 图)\n' +
        '• `!usage 7/30/90` — 指定窗口天数\n' +
        '• `!usage today` — 今日 vs 昨日对比\n' +
        '• `!usage month` — 本月累计\n' +
        '• `!usage model` — 按 model 拆(Top 25)\n' +
        '• `!usage agent` — 按 agent 拆(claude / pi / opencode / codex / gemini)\n' +
        '• `!usage cost` — 只看成本\n' +
        '• `!usage help` — 本帮助'
      ).catch(() => {});
      try { await discord.removeReact(msg, '⏳'); } catch {}
      return;
    }
    const r = await runUsageHandler({ args: sub, discord, log, cfg });
    try { await discord.removeReact(msg, '⏳'); } catch {}
    if (r?.reply) {
      await msg.reply(r.reply).catch(async () => {
        await discord.send(msg.channelId, r.reply).catch(() => {});
      });
    }
  }

  // ---- 7e. !opportunity 命令处理 ----
  //  拦截主入口的 !opportunity 调用,
  //  spawn 一次性 Pi subprocess 跑 8 步 pipeline,Pi 用结构化工具采集 + 自己的 LLM 合成。
  //  跑完后 Pi 会自己推 entry channel + 目标 channel(默认 #💡 机会),brief 落 data/opportunity/。
  //
  //  为什么不走主 Pi(长期 running 的那个):
  //   - 主 Pi 在 streaming user message,新 prompt 会打断
  //   - opportunity 要 1-3 分钟,阻塞用户后续消息
  //   - 一次性 subprocess 更稳:失败不影响主 Pi 状态
  async function handleOpportunityCommand(msg, text) {
    const parts = text.split(/\s+/).filter(Boolean);
    const topic = parts.slice(1).join(' ').trim();

    if (!topic || topic === 'help' || topic === '?') {
      await msg.reply(
        '💡 **!opportunity 命令 · 偶发机会发现**\n\n' +
        '**用法**\n' +
        '• `!opportunity <topic>` — 触发机会发现,brief 推 #💡 机会\n' +
        '• `!opportunity <topic> <channel>` — 推指定频道\n' +
        '  (可用:opportunity / build / ideas / memory)\n' +
        '• `!opportunity help` — 本帮助\n\n' +
        '**特点**\n' +
        '• spawn 一次性 Pi subprocess,加载 discover-tools extension\n' +
        '• 数据采集走 HN Algolia / gh CLI / 中文 RSS / Reddit(零 key)\n' +
        '• AI 推理(聚类 / 合成 / 写 brief)在 Pi agent 自己的 LLM\n' +
        '• 输出含 5 个 cluster + SaaS/App 创业灵感 + 链接清单\n' +
        '• 跑完自动推 entry channel + 目标频道 + 落 data/opportunity/\n\n' +
        '**预计耗时** 1-3 分钟',
      ).catch(() => {});
      return;
    }

    // 解析可选 channelCategory(最后一个词,且匹配已知 channel 名)。
    const knownCats = ['opportunity', 'build', 'ideas', 'memory'];
    let channelCategory = 'opportunity';
    let topicOnly = topic;
    const tokens = topic.split(/\s+/);
    const lastToken = tokens[tokens.length - 1]?.toLowerCase();
    if (lastToken && knownCats.includes(lastToken) && tokens.length > 1) {
      channelCategory = lastToken;
      topicOnly = tokens.slice(0, -1).join(' ');
    }
    if (!topicOnly.trim()) {
      await msg.reply('用法: `!opportunity <topic> [channel]`').catch(() => {});
      return;
    }
    if (!cfg.channels[channelCategory]) {
      await msg.reply(`⚠️ 目标频道未配置: \`#${channelCategory}\`，请检查 .env`).catch(() => {});
      return;
    }

    try { await discord.react(msg, '⏳'); } catch {}
    log(`!opportunity triggered: topic="${topicOnly}" channel=${channelCategory}`);

    // 给用户立刻反馈
    await msg.reply(
      `💡 **机会发现已触发**\n\n` +
      `**Topic**: \`${topicOnly}\`\n` +
      `**Target channel**: #${channelCategory}\n` +
      `**预计耗时**: 1-3 分钟\n\n` +
      `Pi agent 跑完会自动推 entry channel + #${channelCategory}。你不用等。`
    ).catch(() => {});

    // spawn 一次性 Pi subprocess(完全复用 trigger-job.mjs)
    const child = spawn('node', [
      join(ROOT, 'scripts/trigger-job.mjs'),
      'opportunity',
      topicOnly,
      channelCategory,
    ], {
      cwd: ROOT,
      env: {
        ...process.env,
        HTTP_PROXY: 'http://127.0.0.1:7897',
        HTTPS_PROXY: 'http://127.0.0.1:7897',
        ALL_PROXY: 'socks5://127.0.0.1:7897',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderrBuf = '';
    child.stdout.on('data', () => { /* 透传 */ });
    child.stderr.on('data', (d) => { stderrBuf += d.toString(); });
    child.on('close', async (code) => {
      try { await discord.removeReact(msg, '⏳'); } catch {}
      if (code === 0) {
        log(`!opportunity subprocess exited OK`);
      } else {
        log(`!opportunity subprocess failed: code=${code} stderr=${stderrBuf.slice(0, 500)}`);
        try {
          await msg.reply(
            `😵 **opportunity 失败**\n\n` +
            `\`trigger-job.mjs\` 退出码 \`${code}\`\n` +
            `\`\`\`\n${stderrBuf.slice(0, 1500)}\n\`\`\`\n\n` +
            `看 \`logs/trigger.log\` 完整日志`,
          );
        } catch {}
      }
    });
    child.on('error', async (e) => {
      log(`!opportunity spawn error: ${e.message}`);
      try { await discord.removeReact(msg, '⏳'); } catch {}
      try { await msg.reply(`😵 spawn trigger-job 失败: ${e.message}`); } catch {}
    });
  }

  // ---- 8. !distill 命令处理 ----
  async function handleDistillCommand(msg, text) {
    const args = text.trim().split(/\s+/).slice(1);
    const sub = args[0]?.toLowerCase() || '';

    if (sub === 'help' || sub === '?' || !sub) {
      await msg.reply(
        '🧠 **!distill 命令 · 手动触发记忆蒸馏**\n\n' +
        '**用法**\n' +
        '• `!distill` — 立即触发蒸馏（使用今日 journal）\n' +
        '• `!distill help` — 本帮助\n\n' +
        '**说明**\n' +
        '• 蒸馏会从今日对话中提取 0-5 条值得永久记住的信息\n' +
        '• 提取的记忆会自动推到 #记忆库\n' +
        '• 严格查重：相似度阈值 0.9\n' +
        '• 质量优先：宁缺毋滥\n\n' +
        '**自动蒸馏**\n' +
        '• 每天 23:30 自动蒸馏\n' +
        '• 蒸馏结果会自动推到 #记忆库\n\n' +
        '**预计耗时** 30-60 秒'
      ).catch(() => {});
      return;
    }

    if (!memoryDistiller) {
      await msg.reply('⚠️ 记忆系统未初始化').catch(() => {});
      return;
    }

    try { await discord.react(msg, '⏳'); } catch {}
    log(`[!distill] 手动触发蒸馏`);

    try {
      const result = await memoryDistiller.distillNow({
        reason: 'manual',
        pi,
      });

      try { await discord.removeReact(msg, '⏳'); } catch {}

      if (result.ok) {
        const summary = `✅ 蒸馏完成\n\n提取 ${result.count} 条记忆`;
        await msg.reply(summary).catch(() => {});
        log(`[!distill] 完成: ${result.count} 条记忆`);
      } else {
        const reason = result.reason || '未知错误';
        await msg.reply(`⚠️ 蒸馏失败: ${reason}`).catch(() => {});
        log(`[!distill] 失败: ${reason}`);
      }
    } catch (e) {
      try { await discord.removeReact(msg, '⏳'); } catch {}
      await msg.reply(`😵 蒸馏失败: ${e.message}`).catch(() => {});
      log(`[!distill] 异常: ${e.message}`);
    }
  }

  // ---- 9. !memory 命令处理 ----
  async function handleMemoryCommand(msg, text) {
    const args = text.trim().split(/\s+/).slice(1);
    const sub = args[0]?.toLowerCase() || '';

    if (sub === 'help' || sub === '?' || !sub) {
      await msg.reply(
        '🧠 **!memory 命令 · 记忆管理**\n\n' +
        '**统计**\n' +
        '• `!memory stats` — 查看记忆统计\n' +
        '**查询**\n' +
        '• `!memory search <关键词>` — 搜索记忆\n' +
        '• `!memory show <subject>` — 显示记忆详情\n' +
        '**维护**\n' +
        '• `!memory report` — 质量报告\n' +
        '• `!memory cleanup` — 手动清理\n' +
        '• `!memory help` — 本帮助\n\n\n' +
        '**自动治理**\n' +
        '• 每日 23:30: 自动蒸馏\n' +
        '• 每周日 02:00: 自动治理\n' +
        '• 每周日 03:00: 更新置信度\n'
      ).catch(() => {});
      return;
    }

    if (!memoryStore) {
      await msg.reply('⚠️ 记忆系统未初始化').catch(() => {});
      return;
    }

    try { await discord.react(msg, '⏳'); } catch {}

    if (sub === 'stats') {
      try {
        const stats = await memoryStore.stats();
        const lines = [
          '📊 **记忆统计**',
          `总计: ${stats.total}`,
          `活跃: ${stats.byKind ? Object.values(stats.byKind).reduce((a, b) => a + b, 0) : 0}`,
          '\n**按类型**:\n',
          ...(stats.byKind ? Object.entries(stats.byKind).map(([kind, count]) => `  - ${kind}: ${count}`) : []),
          '\n**索引**:\n',
          `  向量数: ${stats.vectorCount}`,
          `  最后更新: ${stats.lastUpdate || '无'}`,
        ];
        const reply = lines.join('\n');
        await msg.reply(reply.slice(0, 1900)).catch(() => {});
        log(`[!memory stats] 统计已发送`);
      } catch (e) {
        await msg.reply(`⚠️ 查询失败: ${e.message}`).catch(() => {});
        log(`[!memory stats] 失败: ${e.message}`);
      }
    } else if (sub === 'search') {
      const query = args.slice(1).join(' ');
      try {
        const results = await memoryStore.query({
          contains: query,
          limit: 10,
        });
        if (results.items.length === 0) {
          await msg.reply('未找到相关记忆').catch(() => {});
        } else {
          const lines = [
            `🔍 **搜索: "${query}"**\n\n找到 ${results.items.length} 条记忆:\n`,
            ...results.items.map(m => `  - [${m.kind}] \`${m.subject}\`\n    ${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}`),
          ];
          await msg.reply(lines.join('\n').slice(0, 1900)).catch(() => {});
        }
        log(`[!memory search] 搜索 "${query}": ${results.items.length} 条`);
      } catch (e) {
        await msg.reply(`⚠️ 搜索失败: ${e.message}`).catch(() => {});
        log(`[!memory search] `);
      }
    } else if (sub === 'show') {
      const subject = args.slice(1).join(' ');
      if (!subject) {
        await msg.reply('⚠️ 请指定要显示的记忆 subject').catch(() => {});
      } else {
        try {
          const results = await memoryStore.query({ subject });
          if (results.items.length === 0) {
            await msg.reply(`未找到记忆: \`${subject}\``).catch(() => {});
          } else {
            const mem = results.items[0];
            const lines = [
              '📝 **记忆详情**\\n',
              `ID: \`${mem.id}\``,
              `类型: ${mem.kind}`,
              `Subject: ${mem.subject}`,
              `置信度: ${mem.confidence?.toFixed(2) || 'N/A'}`,
              `状态: ${mem.status}`,
              `访问次数: ${mem.accessCount || 0}`,
              `标签: [${(mem.tags || []).join(', ')}]`,
              `内容:\n${mem.content}`,
              `更新时间: ${mem.updatedAt?.slice(0, 19) || 'N/A'}`,
            ];
            await msg.reply(lines.join('\n').slice(0, 1900)).catch(() => {});
          }
          log(`[!memory show] 显示记忆: ${subject}`);
        } catch (e) {
          await msg.reply(`⚠️ 查询失败: ${e.message}`).catch(() => {});
          log(`[!memory show] 失败: ${e.message}`);
        }
      }
    } else if (sub === 'report') {
      try {
        if (!memoryQuality) {
          await msg.reply('⚠️ 质量模块未初始化').catch(() => {});
          return;
        }
        const report = await memoryQuality.report();
        const lines = [
          '📊 **记忆质量报告**\\n',
          '\n**置信度分布**\\n',
          `  高 (>= 0.8): ${report.confidence.high}`,
          `  中 (0.6-0.8): ${report.confidence.medium}`,
          `  低 (< 0.6): ${report.confidence.low}`,
          '\n**访问分布**\\n',
          `  从未: ${report.access.never}`,
          `  低频 (1-3): ${report.access.low}`,
          `  中频 (4-10): ${report.access.medium}`,
          `  高频 (>10): ${report.access.high}`,
          '\n**建议**\\n',
          ...report.recommendations.map(r => `  [${r.type}] ${r.message}`),
        ];
        await msg.reply(lines.join('\n').slice(0, 1900)).catch(() => {});
        log(`[!memory report] 报告已发送`);
      } catch (e) {
        await msg.reply(`⚠️ 生成报告失败: ${e.message}`).catch(() => {});
        log(`[!memory report] 失败: ${e.message}`);
      }
    } else if (sub === 'cleanup') {
      try {
        if (!memoryGovernance) {
          await msg.reply('⚠️ 治理模块未初始化').catch(() => {});
          return;
        }
        const result = await memoryGovernance.manualCleanup({ days: 90, force: false });
        const lines = [
          '🧹 **记忆清理完成**\n',
          `扫描: ${result.scanned}`,
          `过期: ${result.expired}`,
          `归档: ${result.archived}`,
        ];
        await msg.reply(lines.join('\n').slice(0, 1900)).catch(() => {});
        log(`[!memory cleanup] 清理完成`);
      } catch (e) {
        await msg.reply(`⚠️ 清理失败: ${e.message}`).catch(() => {});
        log(`[!memory cleanup] 失败: ${e.message}`);
      }
    } else {
      await msg.reply(
        '未知 !memory 子命令，发送 `!memory help` 查看帮助\n' +
        '可用命令: stats, search, show, report, cleanup, help'
      ).catch(() => {});
    }

    try { await discord.removeReact(msg, '⏳'); } catch {}
  }

  // ---- 7h1. !xiasi 命令(PR4 完整版)----
  async function handleXiasiCommand(msg, text) {
    const args = text.replace(/^!xiasi\s*/, '').trim().split(/\s+/);
    const sub = (args[0] || 'status').toLowerCase();

    // on / off 紧急开关
    if (sub === 'on' || sub === 'off') {
      xc.enabled = sub === 'on';
      await msg.reply(sub === 'on' ? '🌙 「遐思」已启用' : '🌙 「遐思」已关闭(本次进程有效)').catch(() => {});
      log(`[xiasi] enabled=${xc.enabled}`);
      return;
    }

    if (!dreamer) {
      await msg.reply('🌙 「遐思」未初始化(dreaming-pi 启动失败或未启用)').catch(() => {});
      return;
    }

    // ---- archive <id> ----
    if (sub === 'archive') {
      const id = args[1];
      if (!id) {
        await msg.reply('用法:!xiasi archive <artifact-id>').catch(() => {});
        return;
      }
      try {
        const r = await artifacts.archive(id);
        if (r.ok) {
          await msg.reply(`🗂 已归档 \`${id}\``).catch(() => {});
          log(`[xiasi] archived ${id}`);
        } else {
          await msg.reply(`🌧 归档失败:${r.error || 'not found'}`).catch(() => {});
        }
      } catch (e) {
        await msg.reply(`🌧 归档出错:${e.message}`).catch(() => {});
      }
      return;
    }

    // ---- report [weekly|monthly] ----
    if (sub === 'report') {
      const which = (args[1] || 'weekly').toLowerCase();
      if (!reporter) {
        await msg.reply('🌧 报表模块未初始化').catch(() => {});
        return;
      }
      try {
        const text = which === 'monthly'
          ? await reporter.monthlyReport()
          : await reporter.weeklyReport();
        await msg.reply(text.slice(0, 1900)).catch(() => {});
        log(`[xiasi] ${which} report sent`);
      } catch (e) {
        log(`[xiasi] ${which} report 失败:`, e.message);
        await msg.reply(`🌧 报表生成失败:${e.message}`).catch(() => {});
      }
      return;
    }

    // ---- 默认 status(纯本地查询,不开 LLM)----
    try {
      const s = await dreamer.status({ limit: 5 });
      const b = s.budget;
      const lines = [
        '🌙 **「遐思」状态**',
        `enabled: ${s.enabled}`,
        b ? `budget: ${b.total.toLocaleString()} / ${b.dailyLimit.toLocaleString()} tokens · remaining=${b.remaining.toLocaleString()} · over=${b.over}` : 'budget: n/a',
        '',
        '**最近 5 次梦:**',
      ];
      if (!s.runs.length) {
        lines.push('_还没有跑过梦_');
      } else {
        for (const r of s.runs) {
          const dur = r.durationMs ? `${Math.round(r.durationMs / 1000)}s` : '?';
          const icon = r.status === 'completed' ? '✅' : r.status === 'failed' ? '🌧️' : '⏳';
          lines.push(`${icon} \`${r.id}\` · ${r.type} · ${dur} · ${r.artifactCount} 产物`);
        }
      }
      lines.push('');
      lines.push('**命令:** `!xiasi status|on|off|archive <id>|report [weekly|monthly]`');
      await msg.reply(lines.join('\n')).catch(() => {});
    } catch (e) {
      log('[xiasi] status 失败:', e.message);
      await msg.reply(`🌙 「遐思」状态查询失败: ${e.message}`).catch(() => {});
    }
  }

  // ---- 7i2. !ask-xiasi:从梦境产物检索洞察 ----
  async function handleAskXiasi(msg, question) {
    if (!question) {
      await msg.reply('用法:!ask-xiasi <你的问题>').catch(() => {});
      return;
    }
    if (!artifacts) {
      await msg.reply('🌧 产物模块未初始化').catch(() => {});
      return;
    }
    try {
      // 检索所有类型的最近产物,取 top-5
      const all = [];
      for (const t of ['lian-zhu', 'gui-cang', 'ming-tai']) {
        try {
          const items = await artifacts.listMeta({ type: t, limit: 20 });
          all.push(...items);
        } catch {}
      }
      if (!all.length) {
        await msg.reply('🌙 遐思还没有任何产物,先做几场梦吧。').catch(() => {});
        return;
      }
      // 按评分排序
      all.sort((a, b) => (b.scores?.total || 0) - (a.scores?.total || 0));
      const top5 = all.slice(0, 5);
      const context = top5.map((a, i) =>
        `[${i + 1}] (${a.type}) ${a.title || '无标题'} · ${a.theme || '?'} · 评分 ${(a.scores?.total || 0).toFixed(2)}\n${a.text ? a.text.slice(0, 200) : '(无正文)'}`
      ).join('\n\n');

      // 让 Pi 综合回答
      const prompt = `用户问:"${question}"

以下是「遐思」系统的 top-5 洞察产物,请基于这些内容回答用户的问题。如果某条洞察与问题相关,引用它;如果不相关,忽略。用中文回答,简洁有力。

${context}`;
      const res = await pi.promptAndWait(prompt, null, 60_000);
      await msg.reply(res).catch(() => {});
      log(`[ask-xiasi] 回答了问题:"${question.slice(0, 40)}"`);
    } catch (e) {
      log(`[ask-xiasi] 失败:`, e.message);
      await msg.reply(`🌧 检索失败:${e.message}`).catch(() => {});
    }
  }

  // ---- 7j. Discord 按钮交互(votes + archive)----
  discord.onButtonInteraction(async (interaction) => {
    const customId = interaction.customId;

    // ---- 审批按钮：apr:approve:<id> / apr:reject:<id> / apr:defer:<id> ----
    if (customId.startsWith('apr:')) {
      const [, decision, id] = customId.split(':');
      try {
        const result = await agentManager.dispatch({
          source: 'discord',
          channelId: interaction.channelId,
          userId: interaction.user.id,
          text: `!${decision} ${id}`,
        });
        const ok = result.result?.result?.ok ?? result.result?.ok ?? false;
        const label = decision === 'approve' ? '批准' : decision === 'reject' ? '拒绝' : '延期';
        await discord.replyToInteraction(interaction,
          ok ? `✅ 已${label} \`${id}\`` : `⚠️ 操作失败: ${result.error ?? result.result?.error ?? 'unknown'}`);
        log(`[apr:${decision}] ${interaction.user.id} → ${id} ok=${ok}`);
      } catch (e) {
        await discord.replyToInteraction(interaction, `⚠️ ${e.message}`);
      }
      return;
    }

    if (!customId.startsWith('xiasi:')) return;

    try { await interaction.deferReply({ ephemeral: true }); } catch {}

    const parts = customId.split(':');
    const action = parts[1]; // vote | archive
    const userId = interaction.user.id;

    if (action === 'vote' && xiasiVotes) {
      const kind = parts[2]; // up | down | star
      const artifactId = parts[3];
      if (!kind || !artifactId) {
        await discord.replyToInteraction(interaction, '❌ 无效的按钮参数');
        return;
      }
      const result = await xiasiVotes.vote({ artifactId, userId, kind });
      const c = result.current;
      const state = result.toggledOff ? '(取消投票)' : '(已投票)';
      await discord.replyToInteraction(interaction,
        `✅ ${state} \`${artifactId}\`\n👍 ${c.up} · 👎 ${c.down} · ⭐ ${c.star}`);
      log(`[xiasi:vote] ${userId} ${kind} ${artifactId} toggled=${result.toggledOff}`);
    }

    if (action === 'archive') {
      const artifactId = parts[2];
      if (!artifactId) {
        await discord.replyToInteraction(interaction, '❌ 无效的归档按钮参数');
        return;
      }
      try {
        const r = await artifacts.archive(artifactId);
        await discord.replyToInteraction(interaction,
          r.ok ? `🗂 已归档 \`${artifactId}\`` : `🌧 归档失败:${r.error || 'not found'}`);
      } catch (e) {
        await discord.replyToInteraction(interaction, `🌧 归档出错:${e.message}`);
      }
    }
  });

  // ---- 10. 优雅退出 ----
  async function shutdown(sig) {
    log(`收到 ${sig}, 关闭中…`);
    try { sched.stop(); } catch {}
    try { if (agentManager) await agentManager.shutdown(); } catch {}
    try { if (dreamer) await dreamer.shutdown(); } catch {}
    try { if (dreamingPi) await dreamingPi.stop(); } catch {}
    try { await pi.stop(); } catch {}
    try { await discord.destroy(); } catch {}
    if (memoryStore) await memoryStore.compact();
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
