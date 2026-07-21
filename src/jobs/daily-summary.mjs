// src/jobs/daily-summary.mjs
// 每日总结任务 —— 每天北京时间 23:00 触发
//
// 工作流:
//   1. 读今天(.workbuddy / .zcode / .pi / .gemini / .kiro / .claude)的 chat history
//   2. Pi Agent 提炼"今天干了啥 / 做了哪些决定 / 阻塞是什么"
//   3. 整理为 md,落到 data/daily-summary/YYYY-MM-DD.md
//   4. 同步推到 Discord #🌙 每日总结 频道
//
// 数据源路径(全部在 ~/ 下):
//   ~/.workbuddy/logs/         workbuddy 工具日志
//   ~/.workbuddy/memory/       workbuddy 记忆
//   ~/.zcode/v2/               zcode 会话目录
//   ~/.zcode/cli/              zcode cli 配置
//   ~/.pi/agent/sessions/      Pi Agent 会话 jsonl
//   ~/.pi/agent/skills/        Pi Agent skill 配置
//   ~/.gemini/antigravity/     gemini antigravity
//   ~/.kiro/                   kiro 项目配置 + sessions
//   ~/.claude/history.jsonl    Claude Code 主历史(每条一次 prompt)
//   ~/.claude/sessions/        Claude Code session jsonl
//   ~/.claude/projects/        Claude Code 项目级
//
// 思路:不要逐个解析每个工具的私有格式,改用"今天修改过的文件"做信号源。
//   - find -mtime 0 列出今天所有被改的文件
//   - 每个有意义的目录再 cat 一遍今天的 chat history / log 片段
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');
const DATA_DIR = resolve(ROOT, 'data', 'daily-summary');

export const DAILY_JOB_ID = 'daily-summary';
export const DAILY_JOB_SCHEDULE = { hour: 23, minute: 0, tzOffsetHours: 8 };

export function buildDailySummaryPrompt({ dateKey }) {
  return `🌙 **【每日定时任务 · 每日总结启动】** 日期=${dateKey} 北京时间 23:00

---

## 你的任务

按下面 6 步**严格**执行,完成后输出 "每日总结 ${dateKey} 完成 ✅":

### 第 1 步 · 列出今天动过的文件
调用 \`bash\` 工具执行:

\`\`\`bash
# 今天修改过的文件(按 mtime 排序,排除明显的噪音)
find ~/.workbuddy ~/.zcode ~/.pi ~/.gemini ~/.kiro ~/.claude \\
  -type f -mtime 0 \\
  -not -path '*/node_modules/*' \\
  -not -path '*/.DS_Store' \\
  -not -path '*/cache/*' \\
  -not -path '*/file-history/*' \\
  -not -path '*/paste-cache/*' \\
  -not -path '*/session-env/*' \\
  -not -name '*.lock' \\
  2>/dev/null | head -200
\`\`\`

如果某些目录没有今天的改动,跳过即可(说明今天没用到)。

### 第 2 步 · 抽今天的关键 chat 内容
按下列顺序依次读取,**每个最多取 8000 字符**:

1. \`~/.claude/history.jsonl\` — 用 \`grep -E '"timestamp":"${dateKey}' | head -50\` 过滤今天的人类输入
2. \`~/.claude/sessions/\` 下今天 mtime 的 *.jsonl,用 \`head -c 8000\`
3. \`~/.pi/agent/sessions/\` 下今天 mtime 的 *.jsonl,取最近的 1~3 个会话
4. \`~/.workbuddy/logs/\` 今天 mtime 的日志(取最后 200 行)
5. \`~/.workbuddy/memory/\` 今天 mtime 的内容
6. \`~/.zcode/v2/\` 今天 mtime 的子目录内容
7. \`~/.kiro/\` 今天 mtime 的 steering / sessions
8. \`~/.gemini/antigravity/\` 今天 mtime 的内容

### 第 3 步 · 提炼"今天干了啥"
按下面维度提炼:

- **🛠 主要工作**:今天 3~8 条最重要的工作(改了什么 / 修了什么 / 写了什么)
- **💡 主要决定**:今天做了什么取舍 / 选型 / 优先级调整
- **🚧 阻塞 / 待办**:今天没解决的 / 推到明天的
- **📚 学到的**:今天的新知 / 新坑
- **🔁 反复模式**:今天反复在做的事情(可能暗示自动化机会)

### 第 4 步 · 整理为 md
模板(用中文,**不**用 emoji,Discord 推送时前缀 🌙):

\`\`\`markdown
# 每日总结 · ${dateKey}

> 数据源: ~/.workbuddy / ~/.zcode / ~/.pi / ~/.gemini / ~/.kiro / ~/.claude
> 生成时间: 北京时间 23:00 · 由 Pi Agent 自动汇总

## 今日概览(2~3 句)

<今天整体的画像:忙不忙 / 主线是什么>

## 🛠 主要工作

1. **<条目>** — <一句话描述> · 项目: <项目名 / 目录>
2. ...

## 💡 主要决定

- <决定 1>: <原因>
- <决定 2>: <原因>

## 🚧 阻塞 / 待办(明天继续)

- [ ] <阻塞 1>
- [ ] <阻塞 2>

## 📚 学到的 / 新坑

- <点 1>
- <点 2>

## 🔁 反复模式(自动化候选)

- <观察 1>
- <观察 2>

## 🌙 昨夜遐思

<如果 data/dreams/DREAMS.md 中有 ${dateKey} 的条目,读取后用 1-2 句话概括昨夜遐思的核心洞察。如果没有,写"昨夜无梦"。>

---
_数据切片: 共读取 X 个文件 / Y 字符 · 漏斗率 Z%_
\`\`\`

### 第 5 步 · 落本地 md
调用 \`write_file\` 工具:
- path: \`data/daily-summary/${dateKey}.md\`
- content: 第 4 步的完整 markdown(不带 🌙 前缀)

### 第 6 步 · 推 Discord
调用 \`discord_post_message\` 工具:
- category: \`daily\`
- content: 第 4 步的完整 markdown(工具自动分片)

---

## 硬约束

- **必须用中文**
- **不要**用 emoji(🌙 是 Discord prefix,内容里别再加 🎉 之类的)
- **必须** 包含数字(读了多少文件 / 多少字符 / 多少条人工输入)
- **不要** 漏掉阻塞 / 待办 — 这是明天开工的入口
- 完成后在 entry channel 输出 \`每日总结 ${dateKey} 完成 ✅ (读了 N 个文件, M 字符)\`

开始。`;
}

export async function runDailySummaryJob({ dateKey, pi, discord, log }) {
  log(`[daily-summary] 触发 ${dateKey}`);
  if (!(await import('node:fs')).existsSync(DATA_DIR)) {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(DATA_DIR, { recursive: true });
  }
  const prompt = buildDailySummaryPrompt({ dateKey });
  try {
    await pi.prompt(prompt);
    log(`[daily-summary] Pi prompt 已注入`);
  } catch (e) {
    log(`[daily-summary] Pi prompt 失败:`, e?.message || e);
  }
}