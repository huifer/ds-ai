// ~/pi-discord-agents/src/dreaming/phases/light.mjs
// Light 阶段 — 信号收集(PR2 真实现)。
//
// 职责:
//   1. 拉近 windowDays 天的 journal 对话流
//   2. 采样主记忆(随机 + kind 平衡)
//   3. 扫情绪信号(emoji + 关键词,纯本地,不开 LLM)
//   4. 把"对话信号"和"记忆候选"打包返回,REM 阶段用
//
// PR2 简化:不做 embedding 聚类、不做主题提取。
// PR3 增强:加 embedding 主题聚类 + 主题档案关联。

const POSITIVE_EMOJI = ['👍', '❤️', '🎉', '✨', '🚀', '🌟', '💪', '😊', '😄', '🥳'];
const NEGATIVE_EMOJI = ['😢', '😭', '😞', '😔', '😩', '😫', '😡', '🤬', '💔', '😵'];

const STRESS_KEYWORDS = [
  '崩溃', '焦虑', '担心', '卡住', '搞不定', '烦', '气', 'deadline',
  '来不及', '加班', '疲惫', '累死', '扛不住', '救命',
];
const CALM_KEYWORDS = [
  '搞定', '完成', 'ok', '好了', '舒服', '满意', '顺利', '清晰', '想通',
  '原来如此', '哈哈', '不错', 'good',
];

function scanMood(journalEvents) {
  let pos = 0, neg = 0;
  const text = journalEvents.map(e => e.content || '').join(' ');
  for (const e of POSITIVE_EMOJI) pos += (text.match(new RegExp(e, 'g')) || []).length;
  for (const e of NEGATIVE_EMOJI) neg += (text.match(new RegExp(e, 'g')) || []).length;
  const stress = STRESS_KEYWORDS.reduce((s, k) => s + (text.includes(k) ? 1 : 0), 0);
  const calm   = CALM_KEYWORDS.reduce((s, k) => s + (text.includes(k) ? 1 : 0), 0);

  const score = (calm + pos) - (stress + neg);
  let mood = 'neutral';
  if (score >= 3) mood = 'bright';
  else if (score <= -3) mood = 'heavy';
  else if (stress > calm) mood = 'tense';

  return { mood, score, posEmoji: pos, negEmoji: neg, stress, calm };
}

function sampleMemories(memoryStore, { maxCandidates = 30, kinds = null, limit = 20 } = {}) {
  if (!memoryStore) return [];
  return Promise.resolve().then(async () => {
    try {
      // 拉一批 recent 记忆作为候选池
      const r = await memoryStore.query({
        mode: 'recent',
        kinds,
        limit: maxCandidates,
      });
      return (r.items || []).slice(0, limit).map((m) => ({
        id: m.id,
        kind: m.kind,
        subject: m.subject,
        content: m.content,
        tags: m.tags || [],
        confidence: m.confidence || 0,
        updatedAt: m.updatedAt,
      }));
    } catch (e) {
      return [];
    }
  });
}

function getJournalText(journal, windowDays) {
  if (!journal) return { text: '', events: [] };
  const events = [];
  for (const day of (journal.listDays?.(windowDays) || [])) {
    try {
      const evs = journal.readDay(day.date);
      events.push(...evs);
    } catch {}
  }
  // 按时间排序
  events.sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));
  // 转成 text(简短)
  const text = events
    .filter(e => e.type === 'user_message' || e.type === 'assistant_message')
    .map(e => {
      const role = e.type === 'user_message' ? `[你 ${e.ts?.slice(11,16) || ''}]` : `[Pi ${e.ts?.slice(11,16) || ''}]`;
      const c = String(e.content || '').slice(0, 300);
      return `${role} ${c}`;
    })
    .join('\n');
  return { text, events };
}

export async function collect({ type, journal, memoryStore, log = () => {} } = {}) {
  const windowDays = 7;

  log(`[light:${type}] windowDays=${windowDays}`);

  // 1. journal 文本
  const { text: journalText, events } = getJournalText(journal, windowDays);

  // 2. 情绪
  const mood = scanMood(events);

  // 3. 记忆候选(混合 kind 平衡)
  const kinds = ['preference', 'decision', 'fact', 'project', 'constraint', 'reflection', 'idea'];
  const candidates = await sampleMemories(memoryStore, { kinds, limit: 25 });

  log(`[light:${type}] journal=${journalText.length} chars · candidates=${candidates.length} · mood=${mood.mood}(${mood.score})`);

  return {
    signals: events.length,
    candidates,
    mood,
    windowDays,
    journalText: journalText.slice(0, 6000), // 限长,避免 prompt 爆炸
    hasJournal: journalText.length > 0,
    hasCandidates: candidates.length > 0,
  };
}