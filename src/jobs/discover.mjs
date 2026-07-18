// src/jobs/discover.mjs
// 偶发需求发现任务 —— 由 Pi agent 主导,结构化工具采集 + AI 合成。
//
// 设计目标(2026-07 升级):
//   - **中文内容优先**:可调用 discover_fetch_rss 拉 36氪/少数派/V2EX/掘金 等中文站
//   - **链接集中**:brief 末尾"🔗 全部链接"区,按 cluster 列出所有可点击 URL
//   - **Discord 友好**:禁止 markdown 表格,用 bullet + emoji + 分隔线
//   - **不堆数据**:每个 cluster ≤ 5 条核心证据,3-5 个 cluster 即可
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');
const DATA_DIR = resolve(ROOT, 'data', 'discovery');

export const DISCOVER_JOB_ID = 'discover';

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'topic';
}

function todayKey() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const tzMs = utcMs + 8 * 3600_000;
  const d = new Date(tzMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

// 常用中文技术 RSS feed(zero-key)
export const CHINESE_RSS_FEEDS = [
  { url: 'https://www.v2ex.com/index.xml', name: 'v2ex', desc: 'V2EX 最热' },
  { url: 'https://www.36kr.com/feed', name: '36kr', desc: '36氪 资讯' },
  { url: 'https://sspai.com/feed', name: 'sspai', desc: '少数派' },
  { url: 'https://www.huxiu.com/rss/0.xml', name: 'huxiu', desc: '虎嗅' },
  { url: 'https://www.infoq.cn/feed.xml', name: 'infoq-cn', desc: 'InfoQ 中国' },
  { url: 'https://rsshub.app/zhihu/hotlist', name: 'zhihu-hot', desc: '知乎热榜' },
  { url: 'https://rsshub.app/weibo/search/hot', name: 'weibo-hot', desc: '微博热搜' },
];

export function buildDiscoverPrompt({ topic, dateKey, channelCategory = 'signal' }) {
  if (!topic || !topic.trim()) throw new Error('buildDiscoverPrompt: topic 必填');
  const dk = dateKey || todayKey();
  const slug = slugify(topic);
  const outPath = `data/discovery/${dk}-${slug}.md`;

  // 中文 RSS 列表(嵌入 prompt,让 Pi 知道有哪些源可用)
  const feedList = CHINESE_RSS_FEEDS.map(f => `  - \`${f.name}\`: ${f.desc} → \`${f.url}\``).join('\n');

  return `🔍 **【偶发需求发现 · ${topic}】** 日期=${dk}

> 手动触发。**所有 AI 推理在你的 LLM 上下文里完成**,所有数据采集通过 \`discover_*\` 工具。
> **禁止**: raw shell(curl/python3)。**禁止**: markdown 表格(Discord 不渲染)。

## 你已加载的工具

- \`discover_search_hn({query, min_points, limit})\` — HN Algolia 搜索,按 engagement(英文)
- \`discover_get_hn_thread({item_id, max_depth, max_comments})\` — HN 单帖 + 嵌套评论(英文 Best Take)
- \`discover_search_github_repos({query, limit})\` — GitHub 仓库搜索,gh CLI(英文)
- \`discover_search_reddit_rss({subreddit, limit, time})\` — Reddit 子版 RSS(英文,经常 429)
- \`discover_fetch_rss({url, source_name, limit})\` — **通用 RSS 抓取,中文源主力**
- \`discover_probe_sources({})\` — 探测可用源

**推荐的中文 RSS feed 列表(全部 zero-key,可直接调 discover_fetch_rss)**:
${feedList}

## 严格 8 步流程

### 第 1 步 · Topic Brain

在 LLM 上下文把 topic 拆成:
- 核心实体(人 / 公司 / 产品 / 技术)
- **3-5 个搜索角度**(技术演进 / 用户痛点 / 商业模式 / 治理风险 / 替代品)
- **每角度 2-3 个 query**(中英文各 1,英文给 HN/GitHub,中文给 RSSHub/V2EX/36kr)

### 第 2 步 · HN Hunter
调 \`discover_search_hn\`(英文 query),取 top 5 按 engagement 排序。前 3 条用 \`discover_get_hn_thread\` 拿 Best Take。

### 第 3 步 · GitHub Hunter
调 \`discover_search_github_repos\`,过滤 90 天内有 push 的。

### 第 4 步 · 中文源 Hunter(**优先**)
按 topic 选 **2-3 个最相关的中文 feed** 调 \`discover_fetch_rss\`,每源取 top 5:
- **AI / 技术**:v2ex, infoq-cn, sspai
- **商业 / 创业**:36kr, huxiu
- **热点 / 大众**:zhihu-hot, weibo-hot
- **不相关就别调**,避免 noise

### 第 5 步 · Reddit Hunter(辅助)
对相关英文 sub(ClaudeCode / LocalLLaMA / cursor 等)各调一次 \`discover_search_reddit_rss\`。Reddit 经常 429,失败就跳过,**不要重试**。

### 第 6 步 · Source Probe
调 \`discover_probe_sources\`。结果用于最后"执行透明度"段。

### 第 7 步 · Cross-source Clustering(AI 推理)
合并所有信号 → **3-5 个 cluster**。每个 cluster:
- **主题一句话**(中文)
- **核心证据 bullet**(3-5 条,**必须带 URL**)
- **1 条 Best Take quote**(@author + 原贴 URL,**这是用户最关心的"原始信号"**)
- **engagement 总结**(HN points+cmts / GitHub stars / 中文 RSS 排名)

### 第 8 步 · 写 brief(Discord 友好版)

调用 \`write_file\` 写 \`${outPath}\`,content **严格**按下面模板:

\`\`\`markdown
# 🔍 Discover · ${topic} · ${dk}

> 窗口: ${dk} 前 30 天 | 来源: HN + GitHub + 中文 RSS + Reddit | 共 N 个 cluster


▬▬▬▬▬▬▬▬


## 📌 TL;DR

- **要点 1**(1 行 + engagement)
- **要点 2**(1 行 + engagement)
- **要点 3**(1 行 + engagement)


▬▬▬▬▬▬▬▬


## 🧩 Cluster 1 · [主题一句话]

**为什么重要**:(2-3 句话说清楚这个 cluster 跟"我要做什么"的关系)

**证据**

- [标题 — 来源(engagement)](URL)
- [标题 — 来源(engagement)](URL)
- [标题 — 来源(engagement)](URL)

**Best Take**: "> 真实评论节选(≤200 字)"
—— @author, [HN/Reddit 原贴](URL)


▬▬▬▬▬▬▬▬


## 🧩 Cluster 2 · [主题一句话]

**为什么重要**: ...

**证据**

- [标题 — 来源(engagement)](URL)
- ...

**Best Take**: "> ..."
—— @author, [原贴](URL)


▬▬▬▬▬▬▬▬


(继续 Cluster 3-5)


▬▬▬▬▬▬▬▬


## 🎯 给你(pi-discord-bridge)的具体机会

- **机会 1** · 简述 + 指向具体 cluster 的证据链接
- **机会 2** · 简述 + ...
- **机会 3** · 简述 + ...


▬▬▬▬▬▬▬▬


## 🔗 全部链接(去重)

按 cluster 分组,每条都是上面已经出现的真实链接:

**Cluster 1**
- [标题](URL)
- [标题](URL)

**Cluster 2**
- [标题](URL)

**中文源直链**
- [标题 — 36kr](URL)
- [标题 — V2EX](URL)


▬▬▬▬▬▬▬▬


## 📡 执行透明度

- HN Algolia: ✅ / ❌ (失败原因)
- GitHub GraphQL: ✅ / ❌
- 中文 RSS: 36kr ✅ / V2EX ✅ / sspai ❌ (超时)
- Reddit: r/ClaudeCode ✅ / r/LocalLLaMA ❌ (429)

\`\`\`

### 推送 Discord

调 \`discord_post_message\` category=\`${channelCategory}\`,content = 第 7 步的 markdown(自动按 1900 字符分片)。

prefix 加 \`🔍 **【Discover · ${topic} · ${dk}】**\`。


▬▬▬▬▬▬▬▬


## 硬约束(违反要重做)

- **必须用中文**(专有名词 / URL / repo 名 保留原文)
- **禁止 markdown 表格**(\`| col | col |\`)—— Discord 不渲染,会显示原始字符。**全用 bullet list**
- **禁止三个减号 \`---\` 分隔符** —— Discord 显示为原始字符 \`---\`,不渲染为横线。用空行 + ▬▬▬ 字符 或 单纯空行 + emoji header 自带视觉分隔
- **禁止 raw shell**(\`curl\` / \`python3\` 拼命令)
- **禁止编造 engagement** —— 工具返回啥写啥
- **每条证据必须带 URL** —— 不可点击的 bullet 等于废数据
- **每个 cluster ≤ 5 条证据** —— 多就压缩,不是全列
- **中文源至少 2 个**(topic 跟中文圈相关时) —— 这是用户最关心的内容
- **brief 长度 200 行内** —— 超了就压缩证据列表
- **必须调 discover_probe_sources**(brief 末尾"执行透明度"段用)

## Discord markdown 速查(避免踩坑)

✅ 用:**bold** \`code\` \`\`\`block\`\`\` # header ## sub - bullet 1. numbered > quote 🔗 emoji ▬ ▬ ▬ 字符分隔
❌ 不用:| table | col |(表格不渲染) <br>(不渲染) --- 三个减号(Discord 显示成原文,不渲染为分隔线) ~~strike~~
\`\`\`

开始。`;
}

export async function runDiscoverJob({ topic, dateKey, channelCategory = 'signal', pi, log }) {
  if (!pi) throw new Error('runDiscoverJob: pi 必填');
  log(`[discover] topic="${topic}" dateKey=${dateKey || 'today'} channel=${channelCategory}`);
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const prompt = buildDiscoverPrompt({ topic, dateKey, channelCategory });
  try {
    await pi.prompt(prompt);
    log(`[discover] prompt injected (${prompt.length} chars)`);
  } catch (e) {
    log(`[discover] failed:`, e?.message || e);
    throw e;
  }
}
