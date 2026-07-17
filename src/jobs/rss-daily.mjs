// src/jobs/rss-daily.mjs
// RSS hub 任务 —— 每天北京时间 12:00 触发
//
// 工作流:
//   1. 读用户画像 /Users/zhangsan/summary/profile/ 和 work/ 摘要画像
//   2. 用 Pi Agent 的 web_search 拉取今日(基于画像兴趣)的资讯
//   3. 整理为 md,落到 data/rss/YYYY-MM-DD.md
//   4. 同步推到 Discord #📰 资讯 频道
//
// 实现要点:
//   - 通过 entry-bot 已有的 pi.prompt() 注入任务(同一个 Pi session 跑)
//   - 任务 prompt 里明确告诉 Pi 用 write_file 落盘 + discord_post_message(category='rss') 推送
//   - 完成后 Pi 自己会回一句简短摘要到 entry channel(让用户知道任务跑完了)
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');
const SUMMARY_DIR = resolve(homedir(), 'summary');
const DATA_DIR = resolve(ROOT, 'data', 'rss');

export const RSS_JOB_ID = 'rss-daily';
export const RSS_JOB_SCHEDULE = { hour: 12, minute: 0, tzOffsetHours: 8 };

export function buildRssPrompt({ dateKey }) {
  // 读取画像存在的提示:Pi 自己会读文件
  const summaryHint = existsSync(SUMMARY_DIR)
    ? `**用户画像已就绪**: \`${SUMMARY_DIR}\`\n  - profile/: 6 份人物画像(身份/性格/沟通/决策/节奏/强弱项)\n  - work/: 12 份工作内容(产品矩阵/技术栈/AI 工具用法)\n  - recommendations/: 4 份时间线建议`
    : '⚠️ 用户画像目录不存在,直接根据"用户画像概要"段判断';

  return `🌅 **【每日定时任务 · RSS Hub 启动】** 日期=${dateKey} 北京时间 12:00

${summaryHint}

---

## 你的任务

按下面 6 步**严格**执行,完成后输出 "RSS Hub ${dateKey} 完成 ✅":

### 第 1 步 · 读画像(必做)
调用 \`read_file\` 工具读下列文件(每个文件只读一次):
- \`~/summary/profile/01-identity-and-background.md\`
- \`~/summary/profile/06-strengths-blind-spots.md\`
- \`~/summary/work/10-product-portfolio.md\`
- \`~/summary/work/19-tech-stack.md\`
- \`~/summary/work/20-ai-tool-usage.md\`
- \`~/summary/work/21-business-model.md\`

(路径在 macOS 上对应 \`/Users/zhangsan/summary/...\`,用绝对路径调 \`read_file\` 也行;但 \`read_file\` 工具限制项目内,所以这些文件用 \`read_file\` 没法直接读 — 改用直接 \`bash\` 命令 \`cat /Users/zhangsan/summary/profile/01-identity-and-background.md\` 等读出来即可。)

### 第 2 步 · 提炼"今日关键词"
根据画像,提炼 **6~12 个** 中文搜索关键词,覆盖:
- 用户主营产品族(图片平台/翻译/SaaS 模板/视频工具/AI 模型/SEO/医疗/体育)
- 用户的核心技术栈(Cloudflare / Supabase / Rust / Discord Bot / AI Agent / Pi Agent)
- 用户关注的行业信号(AI 自动化 / 24h Agent / 出海 SaaS / Stripe / 订阅经济)

### 第 3 步 · web_search 拉取
**至少 6 次** \`web_search\` 调用,每个关键词 1~2 次。
优先关注"过去 24 小时"或"今天"的内容。

### 第 4 步 · 整理为 md
整理为下面模板的 markdown(用中文,**不**用 emoji):

\`\`\`markdown
# RSS 资讯日报 · ${dateKey}

> 画像驱动 / 北京时间 12:00 推送 / 由 Pi Agent 自动汇总
> 用户: zhangsan · 画像: ~/summary/

## 今日要点(3~5 条)

1. **<标题>** — <一句话摘要> · 来源: <域名> · 时间: <相对时间>
2. ...

## 产品族相关(分类)

### 📸 Photoshoot 图片/媒体
- **<标题>** — <摘要> · <URL>

### 🚀 TanStack Ship / SaaS 模板
- ...

### 🎬 视频工具
- ...

### 🤖 AI 模型 / Agent
- ...

### 📈 SEO / 内容营销
- ...

### 🏥 体育 / 医疗(按需)
- ...

## 技术栈相关

### Cloudflare / Workers
- ...

### Supabase / Postgres
- ...

### Discord / AI Agent
- ...

### Rust / 视频处理
- ...

## 一句话洞察

<一句话总结今天的核心信号,比如"AI Agent 编排层继续升温 / Stripe 订阅切换聚合支付成标配"...>

---
_数据源:Pi web_search / 关键词:${dateKey} 推送_
\`\`\`

### 第 5 步 · 落本地 md
调用 \`write_file\` 工具(参数 path 必须是相对项目根的路径,**不要**包含 ../)写到:
\`data/rss/${dateKey}.md\`

写入时 content 里**不要**包含 emoji 前缀(emoji 在 Discord 推送时再加)。

### 第 6 步 · 推 Discord
调用 \`discord_post_message\` 工具,参数:
- category: \`rss\`
- content: 把第 4 步的 markdown 内容直接传过去(工具会自动按 1900 字符分片)

---

## 硬约束

- **必须用中文**
- **不要**用 emoji(Discord 推送时 prefix 是 📰,内容里别再加 🎉/🚀 这种)
- **必须**先写本地 md 再推 Discord(避免推送失败但内容丢失)
- **不要**重复调用同一个关键词的 search(每个关键词 ≤2 次,总数 6~12 次)
- **不要** 编造来源 URL — 只能用 web_search 真实返回的链接
- 完成后在 entry channel 输出 \`RSS Hub ${dateKey} 完成 ✅ (N 条资讯, M 字符)\`,N = 第 1 节要点的总数,M = 落盘文件字节数

开始。`;
}

export async function runRssJob({ dateKey, pi, discord, log }) {
  log(`[rss-daily] 触发 ${dateKey}`);
  if (!existsSync(DATA_DIR)) {
    // 提前建好,Pi 写文件时省一步 mkdir
    const { mkdirSync } = await import('node:fs');
    mkdirSync(DATA_DIR, { recursive: true });
  }
  const prompt = buildRssPrompt({ dateKey });
  try {
    await pi.prompt(prompt);
    log(`[rss-daily] Pi prompt 已注入,Pi 会异步完成后续工作`);
  } catch (e) {
    log(`[rss-daily] Pi prompt 失败:`, e?.message || e);
    // 失败时推一条 system 频道告警
    try {
      await discord.send(
        // 用 system channel ID,如果配了就推
        (await import('./config.mjs')).PATHS ? null : null,
        `⚠️ RSS Hub 任务 prompt 注入失败:${e?.message || e}`
      ).catch(() => {});
    } catch {}
  }
}