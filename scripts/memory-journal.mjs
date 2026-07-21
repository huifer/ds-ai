// ~/pi-discord-agents/src/memory-journal.mjs
// 每日对话捕获:把每条 Discord 消息 + Pi 关键事件写入 journal/YYYY-MM-DD.jsonl
// 这是给"自动记忆蒸馏"用的原料,而不是结构化记忆本身。
import { existsSync, mkdirSync, appendFileSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

export function createMemoryJournal({ memoryStore, log = () => {} } = {}) {
  const journalDir = join(memoryStore.getStoreDir(), '..', 'journal');

  function dateKey(date = new Date()) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function journalFile(dateKeyStr = null) {
    return join(journalDir, `${dateKeyStr || dateKey()}.jsonl`);
  }

  function append(event) {
    if (!event || !event.type) return;
    try {
      mkdirSync(journalDir, { recursive: true });
      const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n';
      appendFileSync(journalFile(), line, 'utf8');
    } catch (e) {
      log(`[journal] append 失败: ${e.message}`);
    }
  }

  // 常用 capture 方法
  function captureUserMessage(msg) {
    if (!msg || msg.author?.bot) return;
    append({
      type: 'user_message',
      channelId: msg.channelId,
      messageId: msg.id,
      author: msg.author?.username,
      authorId: msg.author?.id,
      content: (msg.content || '').slice(0, 4000),
    });
  }
  function captureAssistantMessage(text, msg) {
    if (!text) return;
    append({
      type: 'assistant_message',
      channelId: msg?.channelId,
      messageId: msg?.id,
      content: text.slice(0, 8000),
    });
  }
  function captureToolUse(toolName, args, result) {
    append({
      type: 'tool_use',
      tool: toolName,
      args: typeof args === 'string' ? args.slice(0, 2000) : JSON.stringify(args || {}).slice(0, 2000),
      result: typeof result === 'string' ? result.slice(0, 2000) : JSON.stringify(result || {}).slice(0, 2000),
    });
  }
  function captureUserCommand(cmd, args) {
    append({ type: 'user_command', command: cmd, args });
  }
  function captureMemoryEvent(event) {
    append({ type: 'memory_event', ...event });
  }

  // 读出今日所有 events(按时间排序)
  function readDay(dateKeyStr = null) {
    const path = journalFile(dateKeyStr);
    if (!existsSync(path)) return [];
    const events = [];
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { events.push(JSON.parse(line)); } catch {}
    }
    return events;
  }

  // 列出最近 N 天的 journal 文件
  function listDays(maxDays = 7) {
    if (!existsSync(journalDir)) return [];
    const out = [];
    const now = new Date();
    for (let i = 0; i < maxDays; i++) {
      const d = new Date(now - i * 86400_000);
      const key = dateKey(d);
      const path = journalFile(key);
      if (existsSync(path)) {
        out.push({ date: key, path, size: statSync(path).size });
      }
    }
    return out;
  }

  // 蒸馏:让 Pi 从今天的 journal 中提取值得永久记住的内容
  // 实际蒸馏由 LLM 调用(见 src/memory-distiller.mjs)
  function feedForDistillation(dateKeyStr = null) {
    const events = readDay(dateKeyStr);
    return events.map((e) => {
      if (e.type === 'user_message') return `[USER ${e.ts}] ${e.author || '?'}: ${e.content || ''}`;
      if (e.type === 'assistant_message') return `[ASSISTANT ${e.ts}]: ${(e.content || '').slice(0, 500)}`;
      if (e.type === 'tool_use') return `[TOOL ${e.ts} ${e.tool}]: ${e.args || ''}`;
      if (e.type === 'user_command') return `[CMD ${e.ts}]: !${e.command} ${e.args || ''}`;
      if (e.type === 'memory_event') return `[MEM ${e.ts} ${e.action} ${e.subject || ''}]: ${e.content || ''}`;
      return `[${e.type} ${e.ts}]: ${JSON.stringify(e).slice(0, 300)}`;
    }).join('\n');
  }

  return {
    append,
    captureUserMessage, captureAssistantMessage, captureToolUse, captureUserCommand, captureMemoryEvent,
    readDay, listDays, feedForDistillation,
    journalDir,
  };
}
