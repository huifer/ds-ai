// ~/pi-discord-agents/extensions/discord-tools.mjs
// Pi Extension — 提供 3 个 Discord 工具,由 entry-bot 用 `--extension` 加载。
//
// 工具执行在 Pi 子进程里,所以:
//   - 它自己连 Discord(同 token,Discord 允许多连接,工具只 SEND 不 listen)
//   - 从 env / .env 里拿 cfg
//   - 这避免了 "tool call 跨进程 IPC" 的复杂性
import { Type } from '@sinclair/typebox';
import { ChannelType } from 'discord.js';
import { getDiscord, resolveChannelId, DISCORD_CHANNEL_CATEGORIES } from './discord-tools-shared.mjs';

export default function (pi) {
  // ----- discord_post_message -----
  pi.registerTool({
    name: 'discord_post_message',
    label: 'discord_post_message',
    description:
      '把内容主动发到指定 Discord channel。' +
      'category 可选值:' + DISCORD_CHANNEL_CATEGORIES.join(' / ') + ';' +
      '或直接传 channel_id(优先级高于 category)。' +
      '一般用于把知识沉淀、系统告警、RSS hub、每日总结、GitHub 待办、Token 用量或机会 brief 推到对应 channel。' +
      '显式 category 未配置时会报错,不会误发到 #主入口。',
    parameters: Type.Object({
      category: Type.Optional(Type.String({
        description: `类别名(自动映射到对应 channel)。可选值: ${DISCORD_CHANNEL_CATEGORIES.join(' / ')}。`,
      })),
      channel_id: Type.Optional(Type.String({ description: '直接的 Discord channel ID(优先级高于 category)。' })),
      content: Type.String({ description: '要发送的内容。' }),
    }),
    execute: async (_id, args, _signal, _onUpdate) => {
      try {
        const { client, cfg } = await getDiscord();
        const channelId = resolveChannelId(args, cfg);
        if (!channelId) {
          const target = args.category ? `category=${args.category}` : '默认 entry channel';
          return { content: [{ type: 'text', text: `未找到可用频道(${target}),请检查 .env 和频道映射` }], isError: true };
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
        if (!channelId) {
          return { content: [{ type: 'text', text: `未找到可用频道${args.category ? `: ${args.category}` : ''}` }], isError: true };
        }
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

  // 接入内容工具集：HTML/渲染发布、业务候选卡、按钮回调派发（原 registerDiscordContentTools 为 dead code，现接入生效）
  registerDiscordContentTools(pi, async () => {
    const { client, cfg } = await getDiscord();
    return { client, cfg, sendWithButtons };
  });
}

// ===== 7 个新工具（阶段 1 Day 3）=====

function makeButton(customId, label, style = 'secondary', emoji) {
  return { customId, label, style, emoji };
}

// 把 makeButton 生成的按钮数组发到 Discord（discord.js ActionRow + Button）
async function sendWithButtons(channelId, content, buttons, embed) {
  const { client } = await getDiscord();
  const ch = await client.channels.fetch(channelId);
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
  const styleMap = { primary: ButtonStyle.Primary, secondary: ButtonStyle.Secondary, success: ButtonStyle.Success, danger: ButtonStyle.Danger };
  const row = new ActionRowBuilder();
  for (const b of (buttons || [])) {
    const btn = new ButtonBuilder().setCustomId(b.customId).setLabel(b.label).setStyle(styleMap[b.style] ?? ButtonStyle.Secondary);
    if (b.emoji) btn.setEmoji(b.emoji);
    row.addComponents(btn);
  }
  const payload = {};
  if (content) payload.content = content;
  if (row.components.length) payload.components = [row];
  if (embed) payload.embeds = [embed];
  return ch.send(payload);
}

async function uploadFileToChannel(client, channelId, { path, name, description, content }) {
  const ch = await client.channels.fetch(channelId);
  if (!ch || ch.type !== ChannelType.GuildText) {
    throw new Error(`channel not text: ${channelId}`);
  }
  if (content) {
    return ch.send({
      files: [{ attachment: Buffer.from(content, 'utf8'), name, description }],
    });
  }
  return ch.send({
    files: [{ attachment: path, name, description }],
  });
}

function registerDiscordContentTools(pi, getClient) {
  // ----- discord_post_html -----
  pi.registerTool({
    name: 'discord_post_html',
    label: 'discord_post_html',
    description: '把 HTML 渲染成品发到指定 channel。自动尝试上传为 .html 附件；超过 10MB 时退化为 embed + caption。',
    parameters: Type.Object({
      channelId: Type.String(),
      htmlPath: Type.Optional(Type.String({ description: 'HTML 文件绝对路径。' })),
      html: Type.Optional(Type.String({ description: 'HTML 文本。' })),
      title: Type.String(),
      summary: Type.Optional(Type.String()),
      footer: Type.Optional(Type.String({ description: '默认 Zenbuild · 2026' })),
    }),
    execute: async (_id, args) => {
      try {
        const { client } = await getClient();
        const fileName = `${slugify(args.title)}.html`;
        const content = args.html ?? null;
        let msg;
        if (args.htmlPath) {
          msg = await uploadFileToChannel(client, args.channelId, {
            path: args.htmlPath,
            name: fileName,
            description: args.title,
            content,
          });
        } else if (content) {
          msg = await uploadFileToChannel(client, args.channelId, {
            path: undefined,
            name: fileName,
            description: args.title,
            content,
          });
        } else {
          throw new Error('必须提供 htmlPath 或 html');
        }
        if (args.summary) {
          await msg.reply({ content: args.summary }).catch(() => {});
        }
        return { content: [{ type: 'text', text: `posted HTML to ${args.channelId}, messageId=${msg.id}` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `discord_post_html 失败: ${e.message}` }], isError: true };
      }
    },
  });

  // ----- discord_post_render -----
  pi.registerTool({
    name: 'discord_post_render',
    label: 'discord_post_render',
    description: '把渲染图（PNG / PDF）发到指定 channel。',
    parameters: Type.Object({
      channelId: Type.String(),
      pngPath: Type.Optional(Type.String()),
      pdfPath: Type.Optional(Type.String()),
      caption: Type.Optional(Type.String()),
    }),
    execute: async (_id, args) => {
      try {
        const { client } = await getClient();
        const ch = await client.channels.fetch(args.channelId);
        const files = [];
        if (args.pngPath) files.push({ attachment: args.pngPath, name: basename(args.pngPath), description: 'Rendered PNG' });
        if (args.pdfPath) files.push({ attachment: args.pdfPath, name: basename(args.pdfPath), description: 'Rendered PDF' });
        const sent = await ch.send({ files, content: args.caption ?? '' });
        return { content: [{ type: 'text', text: `posted render to ${args.channelId}, messageId=${sent.id}` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `discord_post_render 失败: ${e.message}` }], isError: true };
      }
    },
  });

  // ----- discord_post_business_card -----
  pi.registerTool({
    name: 'discord_post_business_card',
    label: 'discord_post_business_card',
    description: '在指定 channel 推业务候选卡（含 Approve / Reject / Defer 按钮）。',
    parameters: Type.Object({
      channelId: Type.String(),
      title: Type.String(),
      summary: Type.String(),
      fields: Type.Optional(Type.Array(Type.Object({
        name: Type.String(),
        value: Type.String(),
        inline: Type.Optional(Type.Boolean()),
      }))),
      objectId: Type.String({ description: 'APR / LEAD / QTE / OPP / PRJ / CTR / BID / INV 编号' }),
      risk: Type.Optional(Type.Union([Type.Literal('low'), Type.Literal('medium'), Type.Literal('high')])),
    }),
    execute: async (_id, args) => {
      try {
        const { client, sendWithButtons } = await getClient();
        const buttons = [
          makeButton(`card-approve:${args.objectId}`, 'Approve', 'success'),
          makeButton(`card-reject:${args.objectId}`, 'Reject', 'danger'),
          makeButton(`card-defer:${args.objectId}`, 'Defer', 'secondary'),
        ];
        const embed = {
          title: args.title,
          description: args.summary,
          color: args.risk === 'high' ? 0xef4444 : args.risk === 'medium' ? 0xf59e0b : 0x22d3ee,
          fields: args.fields ?? [],
          footer: { text: `objectId: ${args.objectId}` },
        };
        const sent = await sendWithButtons(args.channelId, '', buttons, null);
        // sendWithButtons 不支持 embed；通过二次发送 embed 替代
        const ch = await client.channels.fetch(args.channelId);
        const follow = await ch.send({ embeds: [embed], components: sent.components });
        return { content: [{ type: 'text', text: `posted business card to ${args.channelId}, messageId=${follow.id}` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `discord_post_business_card 失败: ${e.message}` }], isError: true };
      }
    },
  });

  // ----- discord_post_demo_card -----
  pi.registerTool({
    name: 'discord_post_demo_card',
    label: 'discord_post_demo_card',
    description: '在 #fde-客户交付 推 Demo ready 卡片（含 Approve / Request Changes / Open Preview / Download）。',
    parameters: Type.Object({
      channelId: Type.String(),
      prjId: Type.String(),
      alias: Type.String(),
      industry: Type.String(),
      previewPath: Type.Optional(Type.String()),
      pngPath: Type.Optional(Type.String()),
      pdfPath: Type.Optional(Type.String()),
      distZipPath: Type.Optional(Type.String()),
      notes: Type.Optional(Type.String()),
    }),
    execute: async (_id, args) => {
      try {
        const { client, sendWithButtons } = await getClient();
        const buttons = [
          makeButton(`demo-approve:${args.prjId}`, 'Approve Demo', 'success'),
          makeButton(`demo-changes:${args.prjId}`, 'Request Changes', 'danger'),
          makeButton(`demo-preview:${args.prjId}`, 'Open Live Preview', 'primary'),
          makeButton(`demo-download:${args.prjId}`, 'Download Build', 'secondary'),
        ];
        const sent = await sendWithButtons(args.channelId, '', buttons, null);
        const ch = await client.channels.fetch(args.channelId);
        const embed = {
          title: `Demo ready · ${args.alias}`,
          description: `Project \`${args.prjId}\` · industry=${args.industry}\n${args.notes ?? ''}`,
          color: 0x22d3ee,
          fields: [
            { name: 'PRJ', value: args.prjId, inline: true },
            { name: 'Alias', value: args.alias, inline: true },
            { name: 'Industry', value: args.industry, inline: true },
          ],
        };
        const follow = await ch.send({ embeds: [embed], components: sent.components });
        if (args.pngPath) await uploadFileToChannel(client, args.channelId, { path: args.pngPath, name: basename(args.pngPath) });
        if (args.pdfPath) await uploadFileToChannel(client, args.channelId, { path: args.pdfPath, name: basename(args.pdfPath) });
        if (args.distZipPath) await uploadFileToChannel(client, args.channelId, { path: args.distZipPath, name: basename(args.distZipPath) });
        return { content: [{ type: 'text', text: `posted demo card to ${args.channelId}, messageId=${follow.id}` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `discord_post_demo_card 失败: ${e.message}` }], isError: true };
      }
    },
  });

  // ----- discord_post_prd -----
  pi.registerTool({
    name: 'discord_post_prd',
    label: 'discord_post_prd',
    description: '在 #项目管理 推 PRD 文档（v0.1 / v1.0 / diff）。',
    parameters: Type.Object({
      channelId: Type.String(),
      prjId: Type.String(),
      version: Type.String({ description: 'v0.1 / v1.0 / v1.1' }),
      prdPath: Type.String(),
      diffPath: Type.Optional(Type.String()),
    }),
    execute: async (_id, args) => {
      try {
        const { client } = await getClient();
        const embed = {
          title: `PRD ${args.version} · ${args.prjId}`,
          description: `Updated PRD: ${basename(args.prdPath)}${args.diffPath ? `\nDiff: ${basename(args.diffPath)}` : ''}`,
          color: 0x0f172a,
        };
        const ch = await client.channels.fetch(args.channelId);
        const sent = await ch.send({ embeds: [embed] });
        await uploadFileToChannel(client, args.channelId, { path: args.prdPath, name: basename(args.prdPath) });
        if (args.diffPath) {
          await uploadFileToChannel(client, args.channelId, { path: args.diffPath, name: basename(args.diffPath) });
        }
        return { content: [{ type: 'text', text: `posted PRD to ${args.channelId}, messageId=${sent.id}` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `discord_post_prd 失败: ${e.message}` }], isError: true };
      }
    },
  });

  // ----- discord_post_kanban -----
  pi.registerTool({
    name: 'discord_post_kanban',
    label: 'discord_post_kanban',
    description: '在 #项目管理 推 Kanban 卡片（项目状态变化）。',
    parameters: Type.Object({
      channelId: Type.String(),
      prjId: Type.String(),
      alias: Type.String(),
      industry: Type.String(),
      stage: Type.String({ description: 'setup / demo / research / build / closed' }),
      summary: Type.Optional(Type.String()),
    }),
    execute: async (_id, args) => {
      try {
        const { client } = await getClient();
        const embed = {
          title: `[${args.stage.toUpperCase()}] ${args.prjId} · ${args.alias}`,
          description: `Industry: ${args.industry}\n${args.summary ?? ''}`,
          color: stageColor(args.stage),
          fields: [
            { name: 'PRJ', value: args.prjId, inline: true },
            { name: 'Alias', value: args.alias, inline: true },
            { name: 'Stage', value: args.stage, inline: true },
          ],
          footer: { text: 'updated at ' + new Date().toISOString() },
        };
        const ch = await client.channels.fetch(args.channelId);
        const sent = await ch.send({ embeds: [embed] });
        return { content: [{ type: 'text', text: `posted kanban to ${args.channelId}, messageId=${sent.id}` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `discord_post_kanban 失败: ${e.message}` }], isError: true };
      }
    },
  });

  // ----- handleButtonInteraction（按钮回调派发到 AgentManager）-----
  pi.registerTool({
    name: 'discord_dispatch_button',
    label: 'discord_dispatch_button',
    description: '统一处理 Discord 按钮回调，把按钮 customId 派发回 AgentManager。',
    parameters: Type.Object({
      customId: Type.String(),
      userId: Type.String(),
    }),
    execute: async (_id, args) => {
      const [kind, objectId] = args.customId.split(':');
      const map = {
        'card-approve': { agentId: 'chief', skill: 'approval-handle', decision: 'approve' },
        'card-reject': { agentId: 'chief', skill: 'approval-handle', decision: 'reject' },
        'card-defer': { agentId: 'chief', skill: 'approval-handle', decision: 'defer' },
        'demo-approve': { agentId: 'chief', skill: 'approval-handle', decision: 'approve-demo' },
        'demo-changes': { agentId: 'coding', skill: 'react-design', decision: 'request-changes' },
        'demo-preview': { agentId: 'coding', skill: 'codespace-build', decision: 'preview' },
        'demo-download': { agentId: 'coding', skill: 'codespace-build', decision: 'zip' },
      };
      const route = map[kind];
      if (!route) {
        return { content: [{ type: 'text', text: `unknown button: ${kind}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true, route, objectId, userId: args.userId }) }] };
    },
  });
}

function stageColor(stage) {
  return {
    setup: 0x64748b,
    demo: 0x22d3ee,
    research: 0xfacc15,
    build: 0x10b981,
    closed: 0x475569,
  }[stage] ?? 0x0f172a;
}

function basename(p) {
  return String(p).split(/[\\/]/).pop();
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'demo';
}

export { registerDiscordContentTools };
