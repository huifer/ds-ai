// src/jobs/rss-daily.mjs
// RSS hub 任务 —— 每天北京时间 12:00 触发
//
// 工作流:
//   1. 调 src/rss-fetcher.mjs 抓 ~42 个 RSS / Atom feed(Node fetch,绕过 web_search)
//   2. 读 ~/summary 画像,提炼 relevance 评分
//   3. 整理为 md,落到 data/rss/YYYY-MM-DD.md
//   4. 同步推到 Discord #📰 资讯
//
// 关键设计:全程不调 web_search / minimax_web_search / web_fetch
//   (它们都依赖 Ollama,鉴权失败;改用 RSS feed 抓取 + 本地 AI 解读)
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');
const SUMMARY_DIR = resolve(homedir(), 'summary');
const DATA_DIR = resolve(ROOT, 'data', 'rss');

export const RSS_JOB_ID = 'rss-daily';
export const RSS_JOB_SCHEDULE = { hour: 12, minute: 0, tzOffsetHours: 8 };

export function buildRssPrompt({ dateKey }) {
  const summaryHint = existsSync(SUMMARY_DIR)
    ? `**用户画像已就绪**: \`${SUMMARY_DIR}\`\n  - profile/: 6 份人物画像\n  - work/: 12 份工作内容(产品矩阵/技术栈/AI 工具用法)`
    : '⚠️ 用户画像目录不存在,直接根据"用户画像概要"段判断';

  return `🌅 **【每日定时任务 · RSS Hub 启动】** 日期=${dateKey} 北京时间 12:00

${summaryHint}

---

## 你的任务(5 步严格顺序)

### 第 1 步 · 读画像(用 bash + cat)
\`\`\`bash
for f in /Users/zhangsan/summary/profile/01-identity-and-background.md \\
         /Users/zhangsan/summary/profile/06-strengths-blind-spots.md \\
         /Users/zhangsan/summary/work/10-product-portfolio.md \\
         /Users/zhangsan/summary/work/19-tech-stack.md \\
         /Users/zhangsan/summary/work/20-ai-tool-usage.md \\
         /Users/zhangsan/summary/work/21-business-model.md; do
  echo "=== \$f ==="; cat "\$f"
done
\`\`\`

### 第 2 步 · 抓 RSS(走 fetcher,严禁 web_search)
\`\`\`bash
cd ~/pi-discord-agents
node src/rss-fetcher.mjs --window=24 --max=6 > /tmp/rss-${dateKey}.json 2> /tmp/rss-${dateKey}.err
node -e "const d=require('/tmp/rss-${dateKey}.json'); console.log(JSON.stringify(d.stats));"
\`\`\`
预期:42 sources / 40+ ok / 100+ items / 5~15s。

然后 \`read_file(path: "/tmp/rss-${dateKey}.json")\` 把数据读进上下文。

### 第 3 步 · 解读 + 排序
- 按 layer 分组(HF / OpenAI / Cloudflare / Anthropic / AI-Agent / SaaS / Media / CN / GitHub / Tech)
- 同 layer 内按 relevance(high/mid/low)× weight 排序
- 每层最多 5~8 条

### 第 4 步 · 整理为 md
\`\`\`markdown
# RSS 资讯日报 · ${dateKey}

> 画像驱动 / 北京时间 12:00 推送 / 数据源 42 个 RSS / Atom feed

## 今日要点(3~5 条)

1. **<标题>** — <一句话> · 源:<layer> · relevance:high

## Hugging Face
## OpenAI
## Cloudflare
## Anthropic
## AI / Agent / 研究
## 出海 SaaS
## 图片 / 媒体 / 视频
## 中文媒体
## GitHub / 工具栈
## 通用科技 / ML

## 一句话洞察
<核心信号一句话>

---
_数据源: ~/pi-discord-agents/config/rss-sources.json_
\`\`\`

### 第 5 步 · 落本地 md + 推 Discord
1. \`write_file(path: "data/rss/${dateKey}.md", content: <第 4 步 markdown>)\`
2. \`discord_post_message(category: "rss", content: <第 4 步 markdown>)\`

---

## 硬约束

- **必须用中文**
- **不要**在 markdown 内容里用 emoji
- **必须**只用 \`src/rss-fetcher.mjs\` 抓数据,严禁 web_search / web_fetch / Ollama
- **不要**编造 URL
- 完成后在 entry channel 输出 \`RSS Hub ${dateKey} 完成 ✅\`

开始。`;
}

export async function runRssJob({ dateKey, pi, discord, log }) {
  log(`[rss-daily] 触发 ${dateKey}`);
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const prompt = buildRssPrompt({ dateKey });
  try {
    await pi.prompt(prompt);
    log(`[rss-daily] Pi prompt 已注入`);
  } catch (e) {
    log(`[rss-daily] Pi prompt 失败:`, e?.message || e);
  }
}
