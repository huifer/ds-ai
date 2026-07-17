# 🤖 pi-discord-bridge

**Discord ↔ Pi Agent (RPC mode) 桥接 daemon** — 单入口对话 + 多频道沉淀 + 7×24 守护。

> v2 架构:用 Pi 官方的 RPC 子进程模式,**不再用 TUI + tmux**。零 `ctx stale`,零 5 次重试,
> 启动从 ~10s 降到 ~200ms,assistant 输出支持流式转发。

---

## 📂 目录结构

```
pi-discord-bridge/
│
├── 🤖 src/                          ← Node daemon 主程序(我们写的)
│   ├── entry-bot.mjs                  主编排:连 Discord + spawn Pi RPC + 事件转发
│   ├── discord-client.mjs             discord.js 客户端封装工厂(无业务)
│   └── config.mjs                     .env 解析 + 频道配置
│
├── 🧩 extensions/                   ← Pi 扩展(被 Pi 子进程加载)
│   ├── discord-tools.mjs              3 个工具:post_message / archive / send_image
│   └── discord-tools-shared.mjs       cfg 解析 + 懒加载 Discord client
│
├── 🚀 scripts/                      ← 启动 / 控制 / 测试
│   ├── launch.sh                      launchd 主用
│   ├── dev.sh                         前台跑(调试用)
│   ├── status.sh                      健康度
│   ├── stop.sh                        完整停止
│   └── smoke-test.mjs                 跳过 Discord,纯 RPC + extension 链路测试
│
├── 📋 logs/                         ← 运行时日志
│   ├── orchestrator.log               entry-bot + Pi 子进程输出
│   ├── launchd.out.log                launchd stdout
│   └── launchd.err.log                launchd stderr
│
├── 📁 sessions/                     ← Pi session jsonl(持久化对话历史)
│
├── 🔒 .env                          ← Discord Token + 7 个 channel ID
├── 📝 .env.example                  ← 配置模板
├── 📦 package.json                  ← npm 依赖(discord.js + pi-coding-agent)
│
└── 🔗 links/                       ← Pi Agent 资源 symlink
    ├── auth.json    -> ~/.pi/agent/auth.json         (LLM API keys)
    ├── settings.json -> ~/.pi/agent/settings.json
    ├── models.json  -> ~/.pi/agent/models.json
    ├── skills/      -> ~/.pi/agent/skills/           (lark-* 等)
    ├── npm/         -> ~/.pi/agent/npm/
    ├── git/         -> ~/.pi/agent/git/
    ├── bin/         -> ~/.pi/agent/bin/
    ├── sessions/    -> ~/.pi/agent/sessions/
    └── extensions/  -> ~/.pi/agent/extensions/
```

---

## 🌐 关联文件(本目录之外)

| 路径 | 说明 |
|------|------|
| `~/Library/LaunchAgents/com.zhangsan.pi-discord-agents.plist` | macOS launchd |
| `~/.pi/agent/skills/headless-pi-discord-bridge/SKILL.md` | 复用本架构的规范 |

---

## 🔧 常用命令

```bash
~/pi-discord-bridge/scripts/status.sh              # 看健康度、进程、日志
tail -f ~/pi-discord-bridge/logs/orchestrator.log  # 实时日志
~/pi-discord-bridge/scripts/dev.sh                 # 前台跑(开发调试)
~/pi-discord-bridge/scripts/stop.sh                # 完全停止
launchctl kickstart -k "gui/$(id -u)/com.zhangsan.pi-discord-agents"  # 重启
node ~/pi-discord-bridge/scripts/smoke-test.mjs "ping?"  # 不连 Discord,只测 RPC + extension
```

---

## 🎯 架构对比

| | v1 (TUI + tmux) ❌ | v2 (RPC) ✅ |
|---|---|---|
| 启动延迟 | ~10s (`script -q` + Pi TUI) | ~200ms |
| `ctx stale` 错误 | 有(session 切换/reload 期间) | **没有**(RPC 设计就是 reload-safe) |
| 5 次重试退避 | 需要(治症状) | 不需要 |
| 流式输出 | 没有(只能"发一次等整段") | **天然支持** (`text_delta` 实时) |
| tmux / 假 TTY | 需要 | 不需要 |
| 与 Pi 进程关系 | extension hook 进 TUI | daemon spawn 子进程 |

---

## 🧬 实现要点

### 1. daemon ↔ Pi 通讯:`RpcClient`

```js
import { RpcClient } from '@earendil-works/pi-coding-agent';
const pi = new RpcClient({
  cliPath: '/abs/.../dist/cli.js',
  cwd: '/abs/.../pi-discord-bridge',
  provider: 'minimax-cn',
  model: 'MiniMax-M3',
  env: { DISCORD_TOKEN: cfg.token, CH_ENTRY: cfg.channels.entry, ... },
  args: ['--mode', 'rpc', '--extension', '<tools.mjs>', '--session-dir', '<sessions>'],
});
await pi.start();
```

### 2. 事件流:`message_update.text_delta` → `message_end` 整段转发

```js
let buf = '';
let lastFlush = '';
pi.onEvent(ev => {
  if (ev.type === 'message_update' && ev.assistantMessageEvent?.type === 'text_delta') {
    buf += ev.assistantMessageEvent.delta;  // 可以选择实时推送流式
  }
  if (ev.type === 'message_end' && ev.message?.role === 'assistant') {
    const text = ev.message.content.filter(c => c.type === 'text').map(c => c.text).join('');
    if (text && text !== lastFlush) {
      lastFlush = text;
      discord.send(channelId, text, originalUserMsg);  // 带 reply ref
    }
    buf = '';
  }
});
```

### 3. 工具放 Pi 子进程里

`extensions/discord-tools.mjs` 被 `--extension` 加载,在子进程里执行。
工具自己连 Discord(同 token,Discord 允许多连接),从 env 拿 cfg。

---

## 🛡️ 安全 / 白名单

- **Discord Token** `.env`,权限 600
- **白名单** `ALLOWED_USER_IDS`,默认只有你(在 `.env` 里)
- 其他用户发消息会被 bot 加 🚫

---

## 🚧 维护

- **改 `src/` 或 `extensions/`** → `launchctl kickstart -k ...` 重启 daemon
- **改 `.env`** → 同上
- **改 launchd plist(代理端口、Throttle)** → `launchctl unload ... && load ...`
- **转 Discord Token** → `.env` 改 + kickstart
- **加 LLM key** → 写到 `~/.pi/agent/auth.json`(Pi 子进程会自己读)
