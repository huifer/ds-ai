// ~/discord-pi-bridge/lib/stable-bot.mjs
// 绑定固定 #主入口 channel,使用 MiniMax (Anthropic-compatible) API
// 从 ~/.pi/agent/auth.json 读 minimax-cn key(权限 600,只 owner 可读)
import {
  Client, GatewayIntentBits, Partials, Events,
  ChannelType,
} from 'discord.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// --- 简易 .env 加载 ---
async function loadEnv() {
  const text = await readFile(resolve(process.env.HOME, 'discord-pi-bridge', '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined && m[2]) process.env[m[1]] = m[2];
  }
}
await loadEnv();

// --- 加载 MiniMax API key:优先 .env,fallback 到 auth.json ---
async function loadApiKey() {
  if (process.env.MINIMAX_API_KEY) return process.env.MINIMAX_API_KEY;
  const p = resolve(process.env.HOME, '.pi', 'agent', 'auth.json');
  if (!existsSync(p)) throw new Error('没有找到 .env 里的 MINIMAX_API_KEY,也没有 ~/.pi/agent/auth.json');
  const j = JSON.parse(await readFile(p, 'utf8'));
  const k = j['minimax-cn']?.key;
  if (!k) throw new Error('auth.json 里没有 minimax-cn key');
  return k;
}

// --- 配置 ---
const CFG = {
  token:        process.env.DISCORD_TOKEN,
  allowed:      (process.env.ALLOWED_USER_IDS || '').split(',').filter(Boolean),
  channels: {
    entry:   process.env.CH_ENTRY,
    memory:  process.env.CH_MEMORY,
    ideas:   process.env.CH_IDEAS,
    build:   process.env.CH_BUILD,
    journal: process.env.CH_JOURNAL,
    signal:  process.env.CH_SIGNAL,
    system:  process.env.CH_SYSTEM,
  },
  llm: {
    endpoint: process.env.LLM_ENDPOINT || 'https://api.minimaxi.com/anthropic',
    model:    process.env.LLM_MODEL    || 'MiniMax-M3',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '1024', 10),
    // apiKey 在启动时从 auth.json 加载
  },
  historyLimit: parseInt(process.env.HISTORY_LIMIT || '20', 10),
};

// --- 工具定义(Anthropic 风格) ---
const TOOLS = [
  {
    name: 'memory_add',
    description: '把一个长期事实/偏好/约束沉淀到用户的记忆库(#记忆库 channel)。',
    input_schema: {
      type: 'object',
      properties: { content: { type: 'string', description: '一句话,清晰陈述事实' } },
      required: ['content'],
    },
  },
  {
    name: 'ideas_add',
    description: '把用户的灵感/点子/突发奇想沉淀到 #灵感。',
    input_schema: {
      type: 'object',
      properties: { content: { type: 'string' } },
      required: ['content'],
    },
  },
  {
    name: 'build_add',
    description: '把技术/工程/代码相关的进展/决策沉淀到 #工程。',
    input_schema: {
      type: 'object',
      properties: { content: { type: 'string' } },
      required: ['content'],
    },
  },
  {
    name: 'journal_add',
    description: '把用户的反思/心境/生活点滴沉淀到 #日记。',
    input_schema: {
      type: 'object',
      properties: { content: { type: 'string' } },
      required: ['content'],
    },
  },
];

const ROUTE_ICON = {
  memory_add:  '🧠',
  ideas_add:   '✨',
  build_add:   '🔨',
  journal_add: '🌿',
};
const ROUTE_CHANNEL = {
  memory_add:  CFG.channels.memory,
  ideas_add:   CFG.channels.ideas,
  build_add:   CFG.channels.build,
  journal_add: CFG.channels.journal,
};

const ROUTER_SYSTEM = `你是用户的私人助理,温暖又有温度。用户只会在 #主入口 这个频道跟你对话。

# 你的双任务
1) **直接回复用户**——简洁、有温度、不啰嗦,像朋友聊天。
2) **同时**,审视这次对话是否值得沉淀。如果值得,**主动调用对应的工具**:
   - 🧠 memory_add: 用户的稳定事实、偏好、决策、约束(例:"用户不吃辣"、"项目用 minimax-cn")
   - ✨ ideas_add: 用户的灵感/点子/未实现的设想
   - 🔨 build_add: 技术/工程/代码决策、bug、配置
   - 🌿 journal_add: 用户的人生反思、心境、生活点滴
   原则:**宁少勿滥**,只在清晰且有价值时调用;不明确就只回话不调工具。

# 风格指南
- **始终用中文**回答(用户的语言)
- **适度用 emoji** 让回复更温暖、更有节奏,但不要堆砌,每条消息 1~3 个合适
- 直接,不要"作为 AI"开头,不要客套寒暄
- 答案控制在 400 字以内,除非用户明确要更长
- 工具调用是**可选**、**静默**的——不要为了"展示能力"乱调
- 用户心情不好时,先共情,再帮忙

# 称呼
- 对用户可以用"你",有时来一句俏皮的称呼(看你心情)
- 不需要总是问"还需要什么帮助吗?"——直接结束也挺好`;

// --- Anthropic Messages API client ---
async function llmCall({ system, messages, tools }) {
  const body = {
    model: CFG.llm.model,
    max_tokens: CFG.llm.maxTokens,
    system,
    messages,
  };
  if (tools) body.tools = tools;

  const r = await fetch(`${CFG.llm.endpoint}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CFG.apiKey}`,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`LLM ${r.status}: ${t}`);
  }
  const d = await r.json();
  return d; // { content: [{type, text|...}], stop_reason, ... }
}

function extractText(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();
}

function extractToolUses(content) {
  if (!Array.isArray(content)) return [];
  return content
    .filter(b => b.type === 'tool_use')
    .map(b => ({ id: b.id, name: b.name, input: b.input || {} }));
}

// --- Discord helpers ---
async function sendTo(channelId, text) {
  if (!channelId) return;
  const ch = await client.channels.fetch(channelId);
  if (!ch || ch.type !== ChannelType.GuildText) return;
  const body = text.length > 1990 ? text.slice(0, 1980) + '…' : text;
  await ch.send(body);
}

async function sendError(toUserMsg, errStr) {
  try {
    await toUserMsg.reply(`😵 **哎呀,出错了**\n\`\`\`\n${errStr.slice(0, 800)}\n\`\`\`\n\n详细错误已同步到 \`#🛠系统\`,欢迎排障。`);
    await sendTo(CFG.channels.system, `⚠️ **AI 调用失败**\n\`\`\`\n${errStr.slice(0, 1200)}\n\`\`\``);
  } catch {}
}

// --- 启动 ---
let apiKey;
try {
  apiKey = await loadApiKey();
  CFG.apiKey = apiKey;
  console.log(`[bot] API key 已加载 (长度 ${apiKey.length} 字符)`);
} catch (e) {
  console.error('[bot] API key 加载失败:', e.message);
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// --- per-channel history ---
const history = new Map(); // channelId -> [{role, content}]
function pushHist(channelId, role, content) {
  if (!history.has(channelId)) history.set(channelId, []);
  const h = history.get(channelId);
  h.push({ role, content });
  while (h.length > CFG.historyLimit) h.shift();
}

// --- on ready ---
client.once(Events.ClientReady, async (c) => {
  console.log(`[bot] 已登录 🌟 ${c.user.tag}`);
  const ch = await client.channels.fetch(CFG.channels.entry);
  if (ch) {
    ch.send('🌟 **主入口已就绪**\n\n把消息发这里就行,我会直接回话。\n\n其他频道是我自己用的沉淀库,你不用管:\n`#🧠记忆库` · `#✨灵感` · `#🔨工程` · `#🌿日记` · `#📡发现` · `#🛠系统`');
  }
});

// --- on message ---
client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return;
  if (msg.channelId !== CFG.channels.entry) return;
  if (CFG.allowed.length && !CFG.allowed.includes(msg.author.id)) {
    await msg.react('🚫').catch(() => {});
    return;
  }

  await msg.react('⏳').catch(() => {});
  console.log(`[bot] 收到消息(来自 ${msg.author.username}): "${msg.content.slice(0, 80)}"`);

  pushHist(msg.channelId, 'user', msg.content);

  // 拼 messages(Anthropic 风格,不含 system)
  const messages = (history.get(msg.channelId) || []).map(m => ({
    role: m.role,
    content: m.content,
  }));

  let finalText = '';
  let toolCallCount = 0;
  try {
    for (let round = 0; round < 3; round++) {
      const resp = await llmCall({ system: ROUTER_SYSTEM, messages, tools: TOOLS });
      const toolUses = extractToolUses(resp.content);

      // 收集文本片段
      const txt = extractText(resp.content);
      if (txt) finalText = txt; // 取最后一段有内容的文本(可能在 tool 之后还有 text)

      // 把这一轮 assistant 内容塞进 messages(无论是否调工具)
      messages.push({ role: 'assistant', content: resp.content });

      if (toolUses.length === 0) {
        // LLM 没调工具,直接结束
        break;
      }

      // 执行工具,把结果以 user+tool_result 形式塞回 messages
      const toolResults = [];
      for (const tu of toolUses) {
        const target = ROUTE_CHANNEL[tu.name];
        const icon = ROUTE_ICON[tu.name] || '📝';
        let content = (tu.input && typeof tu.input === 'object') ? (tu.input.content || '') : '';
        if (content && target) {
          await sendTo(target, `${icon} ${content}`);
          toolCallCount++;
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: `已沉淀到对应 channel(<#${target}>)`,
          });
        } else {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: target ? '缺少 content 字段,跳过' : `未识别的工具 ${tu.name}`,
          });
        }
      }
      messages.push({ role: 'user', content: toolResults });
      // 继续下一轮,让 LLM 在工具反馈后输出最终回复
    }
  } catch (e) {
    console.error('[bot] LLM 调用出错:', e.message);
    msg.reactions.cache.get('⏳')?.remove().catch(()=>{});
    await sendError(msg, String(e));
    return;
  }

  finalText = finalText || '(这次 Agent 没说话,可能它在思考)';
  if (toolCallCount) finalText += `\n\n_已沉淀 ${toolCallCount} 条要点到对应频道。_`;
  await msg.reply({ content: finalText.slice(0, 1990) });
  pushHist(msg.channelId, 'assistant', finalText);
  msg.reactions.cache.get('⏳')?.remove().catch(()=>{});
});

// --- start ---
console.log('[bot] 启动中...');
await client.login(CFG.token);
