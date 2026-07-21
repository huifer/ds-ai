// ~/pi-discord-agents/src/dreaming/diary.mjs
// 「遐思录」 — 让人工智能的梦有日记本。
//
// 设计:
//   - 每次 dreamer.run 完成后,让 Pi 写一段 3-5 行的日记风格文字
//   - append 到 data/dreams/DREAMS.md(原名保留,兼容旧路径)
//   - 风格:有"日记"质感,不是冷冰冰的日志
//
// 关键约束:
//   - 如果 dreamingPi 不可用,降级到模板字符串(不阻塞)
//   - 写入用 atomic rename,避免半文件
//   - 长度限制 ≤ 1500 字,避免单次梦撑爆日记

import { mkdirSync } from 'node:fs';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PATHS, TYPES } from './paths.mjs';

function pad2(n) { return String(n).padStart(2, '0'); }

function nowStr() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function todayStr(tzOffsetHours = 8) {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const tzMs = utcMs + tzOffsetHours * 3600_000;
  const d = new Date(tzMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

const MOOD_ICON = {
  bright: '🌅',
  neutral: '🌙',
  tense: '⛅',
  heavy: '🌧️',
};

function fallbackRender(entry) {
  // Pi 不可用时的兜底模板
  const t = TYPES[entry.type] || { cn: entry.type, emoji: '✨' };
  const lines = [];
  lines.push(`### ${t.emoji} 遐思·${t.cn} — ${entry.dateStr} · ${entry.durationStr}`);
  if (entry.theme) lines.push(`*主题:${entry.theme}*`);
  lines.push('');
  if (entry.artifactCount > 0) {
    lines.push(`今夜落定 ${entry.artifactCount} 条产物。`);
    if (entry.topInsight) lines.push(`\n> ${entry.topInsight}\n`);
  } else {
    lines.push('今夜空手而归,候选不够或 Pi 没说话。');
  }
  if (entry.scores && Object.keys(entry.scores).length) {
    const s = entry.scores;
    lines.push('');
    lines.push(`评分:新颖 ${s.novelty} · 连贯 ${s.coherence} · 实用 ${s.utility} · 扎根 ${s.grounding} · ✨惊喜 ${s.surprise} · 总分 ${s.total}`);
  }
  lines.push('');
  lines.push('─────────────────────────────────────');
  lines.push('');
  return lines.join('\n');
}

async function askPiToWrite(dreamingPi, entry, prompt) {
  if (!dreamingPi) return null;
  try {
    const res = await dreamingPi.dreamPrompt(prompt, {
      dreamId: `${entry.dreamId}-diary`,
      dreamType: `${entry.type}-diary`,
      timeoutMs: 3 * 60 * 1000,
    });
    if (res.text && res.text.trim().length > 30) return res.text.trim();
  } catch {}
  return null;
}

function buildDiaryPrompt(entry) {
  return `你是「遐思录」的写手。现在刚刚跑完一次 ${entry.type} 类型的梦,你负责用一段"日记"风格的文字把这次梦记录下来。

## 这次梦的事实
- 类型:${entry.type}
- 时间:${entry.dateStr} ${entry.durationStr}
- 产物数:${entry.artifactCount}
- 主题:${entry.theme || '无明确主题'}
- top insight:"${entry.topInsight || '(无)'}"
- 评分:新颖 ${entry.scores?.novelty} 连贯 ${entry.scores?.coherence} 实用 ${entry.scores?.utility} 扎根 ${entry.scores?.grounding} 总分 ${entry.scores?.total}

## 风格要求(必须遵守)

- 3-5 行,中文,有"日记"质感(第一人称叙述、可以有情绪、可以用比喻)
- 不要写"本次梦境 ID 是 xxx"的工程化语言
- 不要解释"我是 AI"
- 不要 markdown 标题(## / ###),只输出纯段落
- 可以用 1-2 个 emoji(克制,不要堆)
- 末尾留一行破折号 ───
- 总字数 ≤ 300 字

## 几种风格的参考(选一种或自创)

> 今夜又梦到老张的 Rust 异步代码,跟几周前的那些 todo 串联起来,像是同一条河的两个弯。
>
> ───

> 风平浪静的一夜,只拣到一条还算清醒的洞察。

> 今晚有点疲,但仍抓到 2 条值得留下来的东西。

## 边界

- 如果产物数为 0,直接写"今夜空手而归"类的话,不要硬凑内容。
- 如果主题/insight 都是空的,只记录这次梦的形式(时间/类型/产物数),不要编内容。

现在,落笔。`;
}

export function createDiary({ dreamingPi = null, log = () => {}, tzOffsetHours = 8 } = {}) {
  const file = PATHS.diary;

  async function append(entry) {
    // entry: { type, dreamId, dateStr, durationStr, theme, artifactCount, topInsight, scores }
    const dateStr = entry.dateStr || todayStr(tzOffsetHours);
    const timeStr = nowStr();

    let body;
    const piText = await askPiToWrite(dreamingPi, entry);
    if (piText) {
      // Pi 写的:用它的版本,但前面加一行 metadata header
      const t = TYPES[entry.type] || { cn: entry.type, emoji: '✨' };
      const headerLines = [];
      headerLines.push(`### ${t.emoji} 遐思·${t.cn} — ${dateStr} ${timeStr} · ${entry.durationStr || '?'}`);
      if (entry.theme) headerLines.push(`*主题:${entry.theme}*`);
      headerLines.push('');
      body = headerLines.join('\n') + '\n' + piText + '\n\n';
    } else {
      // fallback:模板
      body = fallbackRender({ ...entry, dateStr });
    }

    try {
      mkdirSync(dirname(file), { recursive: true });
      let prev = '';
      try { prev = await readFile(file, 'utf8'); } catch {}
      // 简单文件头(如果第一次写)
      let fullText;
      if (!prev.includes('# 🌙 遐思录')) {
        fullText = '# 🌙 遐思录\n\n' + body;
      } else {
        // 插入到第一个二级标题之前(保持倒序)
        const insertAt = prev.indexOf('\n## ');
        if (insertAt < 0) {
          fullText = prev + '\n' + body;
        } else {
          fullText = prev.slice(0, insertAt) + '\n' + body + prev.slice(insertAt);
        }
      }
      const tmp = file + '.tmp';
      await writeFile(tmp, fullText, 'utf8');
      await rename(tmp, file);
      log(`[diary] ✓ 写入 ${entry.type} 段(${body.length} 字符)`);
      return { ok: true, length: body.length, mode: piText ? 'pi' : 'fallback' };
    } catch (e) {
      log(`[diary] 写入失败: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }

  return {
    append,
    todayStr,
    file,
  };
}