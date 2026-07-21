// ~/pi-discord-agents/extensions/memory-tools.mjs
// Pi 工具:长期记忆查询/写入/撤销。所有写入通过 src/memory-store.mjs,
// 也同步到 #记忆库 频道(mirror)。
import { Type } from '@sinclair/typebox';
import { MEMORY_KINDS } from '../src/memory-store.mjs';

export default function (pi) {
  let store = null;
  let mirror = null;
  let log = () => {};

  pi.registerContext = ({ memoryStore, memoryMirror, logFn }) => {
    store = memoryStore;
    mirror = memoryMirror;
    if (logFn) log = logFn;
  };

  if (!store) log('[memory-tools] 警告: store 未注入,memory 工具不可用');

  pi.registerTool({
    name: 'memory_upsert',
    label: 'memory_upsert',
    description:
      '把一条内容写入长期记忆。kind 必填。同 (scope, subject, kind) 已有 active 时自动修订(旧 superseded)。' +
      '每条记忆会成为 data/memory/store/<id>/{meta.json,content.md},你下次可以用 read_file 读 content.md 全文。',
    parameters: Type.Object({
      kind: Type.String({ enum: MEMORY_KINDS }),
      scope: Type.Optional(Type.String({ enum: ['global', 'user', 'project'] })),
      subject: Type.String({ description: '短键 (max 200 字符,推荐 2-4 个英文单词)' }),
      content: Type.String({ description: '主体内容 (max 8000 字符)' }),
      tags: Type.Optional(Type.Array(Type.String())),
      expires_at: Type.Optional(Type.String()),
      confidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
    }),
    execute: async (_id, args) => {
      if (!store) return { content: [{ type: 'text', text: 'memory store 未启用' }], isError: true };
      try {
        const expiresAt = args.expires_at ? new Date(args.expires_at) : null;
        const result = await store.upsert({
          kind: args.kind,
          scope: args.scope || 'user',
          subject: args.subject,
          content: args.content,
          tags: args.tags || [],
          expiresAt,
          confidence: args.confidence ?? 0.9,
        });
        if (mirror) {
          const entry = await store.readMeta(result.id);
          mirror.apply({ action: result.action === 'updated' ? 'updated' : 'created', entry })
            .catch((e) => log(`[memory-tools] mirror 失败: ${e.message}`));
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ ok: true, id: result.id, action: result.action, revision: result.revision, previousId: result.previousId }, null, 2) }],
        };
      } catch (e) {
        return { content: [{ type: 'text', text: `memory_upsert 失败: ${e.message}` }], isError: true };
      }
    },
  });

  pi.registerTool({
    name: 'memory_query',
    label: 'memory_query',
    description: '查询长期记忆。hybrid = 关键词+向量 RRF 合并。subject 精确匹配。',
    parameters: Type.Object({
      kind: Type.Optional(Type.String({ enum: MEMORY_KINDS })),
      kinds: Type.Optional(Type.Array(Type.String({ enum: MEMORY_KINDS }))),
      subject: Type.Optional(Type.String()),
      tags: Type.Optional(Type.Array(Type.String())),
      contains: Type.Optional(Type.String()),
      scope: Type.Optional(Type.String({ enum: ['global', 'user', 'project'] })),
      mode: Type.Optional(Type.String({ enum: ['hybrid', 'text', 'vector', 'recent', 'filter', 'history'] })),
      limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
      include_superseded: Type.Optional(Type.Boolean()),
    }),
    execute: async (_id, args) => {
      if (!store) return { content: [{ type: 'text', text: 'memory store 未启用' }], isError: true };
      try {
        const r = await store.query({
          kind: args.kind, kinds: args.kinds,
          subject: args.subject, tags: args.tags,
          contains: args.contains, scope: args.scope,
          mode: args.mode || (args.contains ? 'hybrid' : 'recent'),
          limit: args.limit || 12,
          includeSuperseded: args.include_superseded,
        });
        const summary = r.items.map((it) => ({
          id: it.id, kind: it.kind, scope: it.scope, subject: it.subject,
          content: it.content, tags: it.tags || [], status: it.status,
          revision: it.revision, score: it.score || null, updatedAt: it.updatedAt,
        }));
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, mode: r.mode, total: r.total, items: summary }, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `memory_query 失败: ${e.message}` }], isError: true };
      }
    },
  });

  pi.registerTool({
    name: 'memory_revoke',
    label: 'memory_revoke',
    description: '撤销一条记忆。#记忆库 对应消息会加 ⛔ reaction 并标注已撤销。',
    parameters: Type.Object({
      id: Type.Optional(Type.String()),
      subject: Type.Optional(Type.String()),
      scope: Type.Optional(Type.String({ enum: ['global', 'user', 'project'] })),
      kind: Type.Optional(Type.String({ enum: MEMORY_KINDS })),
      reason: Type.Optional(Type.String()),
    }),
    execute: async (_id, args) => {
      if (!store) return { content: [{ type: 'text', text: 'memory store 未启用' }], isError: true };
      if (!args.id && !args.subject) {
        return { content: [{ type: 'text', text: '需要 id 或 subject' }], isError: true };
      }
      try {
        const r = await store.revoke({
          id: args.id, subject: args.subject,
          scope: args.scope, kind: args.kind, reason: args.reason,
        });
        if (mirror && r.entries) {
          for (const e of r.entries) {
            mirror.apply({ action: 'revoked', entry: e, reason: args.reason || '' })
              .catch((err) => log(`[memory-tools] mirror revoke 失败: ${err.message}`));
          }
        }
        return { content: [{ type: 'text', text: JSON.stringify({ ok: r.ok, count: r.count, ids: r.ids }, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `memory_revoke 失败: ${e.message}` }], isError: true };
      }
    },
  });

  pi.registerTool({
    name: 'memory_recent',
    label: 'memory_recent',
    description: '列出最近更新的记忆。',
    parameters: Type.Object({
      kind: Type.Optional(Type.String({ enum: MEMORY_KINDS })),
      limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
    }),
    execute: async (_id, args) => {
      if (!store) return { content: [{ type: 'text', text: 'memory store 未启用' }], isError: true };
      try {
        const r = await store.query({ kind: args.kind, mode: 'recent', limit: args.limit || 10 });
        const items = r.items.map((it) => ({
          id: it.id, kind: it.kind, subject: it.subject,
          content: it.content.slice(0, 200), status: it.status, updatedAt: it.updatedAt,
        }));
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, items }, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `memory_revoke 失败: ${e.message}` }], isError: true };
      }
    },
  });

  pi.registerTool({
    name: 'memory_read',
    label: 'memory_read',
    description: '读取一条记忆的完整 content.md(给人看的 Markdown,带 frontmatter 和变更记录)。',
    parameters: Type.Object({ id: Type.String() }),
    execute: async (_id, args) => {
      if (!store) return { content: [{ type: 'text', text: 'memory store 未启用' }], isError: true };
      const content = await store.readContent(args.id);
      if (!content) return { content: [{ type: 'text', text: `memory ${args.id} 不存在` }], isError: true };
      return { content: [{ type: 'text', text: content }] };
    },
  });
}
