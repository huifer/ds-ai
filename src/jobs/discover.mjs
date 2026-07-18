// src/jobs/discover.mjs
// 偶发需求发现任务 —— 由 Pi agent 主导,结构化工具采集 + AI 合成。
//
// 架构(强制要求):
//   - 所有数据采集必须通过 discover_* 工具(HN / GitHub / Reddit / Probe)
//   - **绝对不要**在 prompt 里写 raw shell(curl ... | python3 ...)
//   - AI 推理(聚类 / 合成 / 写 brief)必须在 Pi agent 自己的 LLM 上下文里完成
//   - 数据采集工具是 zero-config 的,不要试图加 key / 装包
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

export function buildDiscoverPrompt({ topic, dateKey, channelCategory = 'signal' }) {
  if (!topic || !topic.trim()) throw new Error('buildDiscoverPrompt: topic 必填');
  const dk = dateKey || todayKey();
  const slug = slugify(topic);
  const outPath = `data/discovery/${dk}-${slug}.md`;
  return `🔍 **【偶发需求发现 · ${topic}】** 日期=${dk}

> 这是手动触发的需求发现任务。**所有 AI 推理在你的 LLM 上下文里完成**,所有数据采集通过你已加载的 \`discover_*\` 工具完成。
> **禁止**: 在 shell 里写 raw \`curl ... | python3 ...\`。

## 你已加载的工具(必须用,不要绕)

| 工具 | 用途 |
|---|---|
| \`discover_search_hn({query, min_points, limit})\` | HN Algolia 搜索,按 engagement 排序,零 key |
| \`discover_get_hn_thread({item_id, max_depth, max_comments})\` | 拿 HN 单帖 + 嵌套评论,零 key |
| \`discover_search_github_repos({query, limit})\` | GitHub 仓库搜索(gh CLI),按 stars 排序 |
| \`discover_search_reddit_rss({subreddit, limit, time})\` | Reddit 子版 top,**经常 403,失败如实记** |
| \`discover_probe_sources({})\` | 探测 HN/GitHub/Reddit 当前可用性 |

## 严格 8 步流程

### 第 1 步 · Topic Brain
在你的 LLM 上下文里把 topic 拆成:
- 核心实体(人 / 公司 / 产品 / 技术名)
- 3-5 个子话题角度
- 每角度 2-3 个搜索 query

### 第 2 步 · HN Hunter
对每个 query 调 \`discover_search_hn\`,合并去重,按 engagement 倒序。选前 3-5 条,**每条用 \`discover_get_hn_thread\` 拿评论**做 Best Takes。

### 第 3 步 · GitHub Hunter
调 \`discover_search_github_repos\`,过滤 90 天内有 push 的 repo。

### 第 4 步 · Reddit Hunter
对相关子版各调一次 \`discover_search_reddit_rss\`。Reddit 经常 403,失败就跳过。

### 第 5 步 · Source Probe
调 \`discover_probe_sources\` 一次,结果用于第 7 步的"执行透明度"段。

### 第 6 步 · Cross-source Clustering
把第 2-4 步信号合并成 3-5 个 cluster。每 cluster:主题一句话 + 跨源证据表 + engagement 总和 + 1 条 Best Take quote。

### 第 7 步 · 写 brief
调用 \`write_file\`,path: \`${outPath}\`,content 含:TL;DR 3-5 条 + 跨源聚类 + 项目机会 + 执行透明度。

### 第 8 步 · 推 Discord
\`discord_post_message\` category=\`${channelCategory}\`,prefix=\`🔍 **【Discover · ${topic} · ${dk}】**\`。

## 硬约束
- 必须用中文,专有名词/URL/repo 名保留原文
- 不要写 raw curl/python3,只用具工具
- 不要自动跑 cron
- 不要编造 engagement 数字
- Reddit 失败就跳过
- brief 上限 200 行
- 必须调用 discover_probe_sources

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
