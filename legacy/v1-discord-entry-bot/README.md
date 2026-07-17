# 🤖 小助手 Discord 桥接

**1 个主入口 + 6 个智能体内务频道**,在 macOS launchd 下 7×24 守护。

---

## 🌟 频道设计

| Channel | 谁写 | 谁读 | 谁对话 | 用途 |
|---------|------|------|--------|------|
| **`#🚪主入口`** | 你 + 小助手 | 你 + 小助手 | ✅ **这里** | 唯一的人机对话位置。**所有你要打的字都在这里** |
| **`#🧠记忆库`** | 小助手 | 你 | 不用 | 自动沉淀:长期事实、你的偏好、决策、约束 |
| **`#✨灵感`** | 小助手 | 你 | 不用 | 自动沉淀:你的灵感、点子、突发奇想 |
| **`#🔨工程`** | 小助手 | 你 | 不用 | 自动沉淀:技术、工程、代码、配置 |
| **`#🌿日记`** | 小助手 | 你 | 不用 | 自动沉淀:反思、心境、生活点滴 |
| **`#📡发现`** | 小助手 | 你 | 不用 | 小助手 24/7 监听到的"今日发现" |
| **`#🛠系统`** | 小助手 | 你 | 不用 | 小助手状态、健康度、告警 |

🤖 **助手行为**:
- 收到 `#🚪主入口` 的消息 → 在同一频道直接回话
- 同时静默审视这次对话:值得沉淀就调工具把要点发到对应频道
- 原则:**宁少勿滥**,绝不在啰嗦频道里堆垃圾

---

## 👤 你日常怎么用

1. 打开 Discord(网页 `https://discord.com/channels/1527726951425507348` 或客户端)
2. 进你的服务器 **zhangsan**
3. 进 **`#🚪主入口`** 这个频道
4. 像跟朋友聊天一样发消息,小助手会回话
5. 同时,小助手会把有价值的部分默默写到 `#🧠记忆库 / #✨灵感 / #🔨工程 / #🌿日记`
6. 你想翻历史就看那几个沉淀频道

不需要 ID、不需要指令前缀,**自然语言就够**。

---

## 🔧 启停 / 状态 / 日志

```bash
# 看小助手跑没跑
launchctl list | grep discord-entry-bot

# 实时日志(我说话/思考/出错都会在这里)
tail -f ~/discord-pi-bridge/logs/bot.log

# 重启小助手(改了 .env / 代码后用)
launchctl kickstart -k "gui/$(id -u)/com.zhangsan.discord-entry-bot"

# 停掉小助手
launchctl bootout "gui/$(id -u)/com.zhangsan.discord-entry-bot"

# 重新加载(改了 launchd plist 后用)
launchctl unload ~/Library/LaunchAgents/com.zhangsan.discord-entry-bot.plist
launchctl load ~/Library/LaunchAgents/com.zhangsan.discord-entry-bot.plist

# 调试时跑前台(看完整报错)
cd ~/discord-pi-bridge
node lib/stable-bot.mjs
```

---

## 📂 文件结构

```
~/discord-pi-bridge/
├── 📘 README.md             ← 你正在看
├── 🔒 .env                   ← 频道 ID + LLM key(权限 600,严格私密)
├── 📦 package.json           ← Node 项目声明
├── lib/
│   └── stable-bot.mjs        ← 小助手主程序
├── logs/
│   └── bot.log               ← 实时日志(launchd 接管)
└── node_modules/             ← 依赖(discord.js 等)

~/Library/LaunchAgents/
└── com.zhangsan.discord-entry-bot.plist   ← macOS launchd 配置
```

---

## 🎨 调整说明

### 换模型

编辑 `~/discord-pi-bridge/.env`,改 `LLM_MODEL=...`,然后:
```bash
launchctl kickstart -k "gui/$(id -u)/com.zhangsan.discord-entry-bot"
```

### 加/减白名单用户

编辑 `.env`,改 `ALLOWED_USER_IDS=...`(逗号分隔多个),重启小助手。

### 新增/调整频道

1. 在 Discord 服务器里手工新建/改名 channel
2. 右键 → 复制频道 ID
3. 填到 `.env` 的 `CH_*`
4. 重启小助手

### 改小助手的风格

编辑 `lib/stable-bot.mjs` 里 `ROUTER_SYSTEM` 字符串(里面就是给 LLM 的系统提示),重启。

---

## 🛡️ 安全

- **Discord Token** 在 `.env` 里,权限 **600**,只 owner 可读
- **OpenAI / LLM API Key** 同上,文件锁好
- **白名单**:`ALLOWED_USER_IDS` 默认只有你,其他用户发言会被小助手加 🚫 拒绝
- **不在频道里贴 token / secret**,万一你贴了我就当公开处理(它的影响我控制不了)

**建议**:轮换 Discord Token 时去 Discord Developer Portal → Bot → **Reset Token**,然后同步替换 `.env` 里的 `DISCORD_TOKEN`。
