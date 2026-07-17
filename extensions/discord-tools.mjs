// ~/pi-discord-agents/extensions/discord-tools.mjs
// Pi Extension — 提供 3 个 Discord 工具,由 entry-bot 用 `--extension` 加载。
//
// 工具执行在 Pi 子进程里,所以:
//   - 它自己连 Discord(同 token,Discord 允许多连接,工具只 SEND 不 listen)
//   - 从 env / .env 里拿 cfg
//   - 这避免了 "tool call 跨进程 IPC" 的复杂性
import { Type } from '@sinclair/typebox';
import { ChannelType } from 'discord.js';
import { getDiscord, resolveChannelId } from './discord-tools-shared.mjs';

export default function (pi) {
  // ----- discord_post_message -----
  pi.registerTool({
    name: 'discord_post_message',
    label: 'discord_post_message',
    description:
      '把内容主动发到指定 Discord channel。' +
      'category 可选值:memory / ideas / build / journal / signal / system / entry;' +
      '或直接传 channel_id(优先级高于 category)。' +
      '一般用于把 #发现 信号、#系统 告警推到指定 channel。',
    parameters: Type.Object({
      category: Type.Optional(Type.String({ description: '类别名(自动映射到对应 channel)。' })),
      channel_id: Type.Optional(Type.String({ description: '直接的 Discord channel ID(优先级高于 category)。' })),
      content: Type.String({ description: '要发送的内容。' }),
    }),
    execute: async (_id, args, _signal, _onUpdate) => {
      try {
        const { client, cfg } = await getDiscord();
        const channelId = resolveChannelId(args, cfg);
        if (!channelId) {
          return { content: [{ type: 'text', text: '未指定 channel 且 entry channel 未配置' }], isError: true };
        }
        const icon = cfg.labels?.[args.category] || '📝';
        const body = `${icon} ${args.content}`;
        const ch = await client.channels.fetch(channelId);
        if (!ch || ch.type !== ChannelType.GuildText) {
          return { content: [{ type: 'text', text: 'channel not found or not text channel' }], isError: true };
        }
        // 超长内容分片发送(Discord 单条消息 2000 字符上限)
        const MAX = 1900;
        const messageIds = [];
        if (body.length <= MAX) {
          const sent = await ch.send(body);
          messageIds.push(sent.id);
        } else {
          // 按 1900 字符切,优先在 \n\n 处切
          const chunks = [];
          let rest = body;
          while (rest.length > 0) {
            if (rest.length <= MAX) { chunks.push(rest); break; }
            let cut = rest.lastIndexOf('\n\n', MAX);
            if (cut < MAX * 0.5) cut = rest.lastIndexOf('\n', MAX);
            if (cut < MAX * 0.5) cut = MAX;
            chunks.push(rest.slice(0, cut));
            rest = rest.slice(cut).replace(/^\n+/, '');
          }
          for (let i = 0; i < chunks.length; i++) {
            const tag = chunks.length > 1 ? `\n\n_(${i + 1}/${chunks.length})_` : '';
            const sent = await ch.send(chunks[i] + tag);
            messageIds.push(sent.id);
            // 简单节流,避免 rate limit
            if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 250));
          }
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ ok: true, channelId, messageIds, chunks: messageIds.length, length: body.length }, null, 2) }],
        };
      } catch (e) {
        return { content: [{ type: 'text', text: `发送失败: ${e.message}` }], isError: true };
      }
    },
  });

  // ----- discord_archive_knowledge -----
  pi.registerTool({
    name: 'discord_archive_knowledge',
    label: 'discord_archive_knowledge',
    description:
      '把当前对话中值得长期保留的要点归档到对应沉淀 channel(category 必填)。' +
      'router 核心工具:审视用户消息后,如发现值得沉淀的要点,调用此工具。',
    parameters: Type.Object({
      category: Type.Union([
        Type.Literal('memory'),
        Type.Literal('ideas'),
        Type.Literal('build'),
        Type.Literal('journal'),
      ], { description: '沉淀类别' }),
      content: Type.String({ description: '一句话陈述要点。' }),
    }),
    execute: async (_id, args, _signal, _onUpdate) => {
      try {
        const { client, cfg } = await getDiscord();
        const channelId = cfg.channels?.[args.category];
        if (!channelId) {
          return { content: [{ type: 'text', text: `未知 category: ${args.category}` }], isError: true };
        }
        const icon = cfg.labels?.[args.category] || '📝';
        const body = `${icon} ${args.content}`;
        const ch = await client.channels.fetch(channelId);
        const sent = await ch.send(body.length > 1990 ? body.slice(0, 1980) + '…' : body);
        return {
          content: [{ type: 'text', text: JSON.stringify({ ok: true, channelId, messageId: sent.id, archived: args.category }, null, 2) }],
        };
      } catch (e) {
        return { content: [{ type: 'text', text: `归档失败: ${e.message}` }], isError: true };
      }
    },
  });

  // ----- discord_send_image -----
  pi.registerTool({
    name: 'discord_send_image',
    label: 'discord_send_image',
    description: '把一张图片发到指定 channel。支持 path / url / base64 来源。',
    parameters: Type.Object({
      category: Type.Optional(Type.String()),
      channel_id: Type.Optional(Type.String()),
      source: Type.Object({
        kind: Type.Union([Type.Literal('path'), Type.Literal('url'), Type.Literal('base64')]),
        value: Type.String(),
        mediaType: Type.Optional(Type.String()),
        filename: Type.Optional(Type.String()),
      }),
    }),
    execute: async (_id, args, _signal, _onUpdate) => {
      try {
        const { client, cfg } = await getDiscord();
        const channelId = resolveChannelId(args, cfg);
        const ch = await client.channels.fetch(channelId);
        if (!ch || ch.type !== ChannelType.GuildText) {
          return { content: [{ type: 'text', text: 'channel not found' }], isError: true };
        }
        const src = args.source;
        let sent;
        if (src.kind === 'url') {
          sent = await ch.send({ files: [src.value] });
        } else if (src.kind === 'base64') {
          const buf = Buffer.from(src.value, 'base64');
          sent = await ch.send({ files: [{ attachment: buf, name: src.filename || 'image.png' }] });
        } else {
          sent = await ch.send({ files: [{ attachment: src.value }] });
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ ok: true, messageId: sent.id }, null, 2) }],
        };
      } catch (e) {
        return { content: [{ type: 'text', text: `发图失败: ${e.message}` }], isError: true };
      }
    },
  });
}
