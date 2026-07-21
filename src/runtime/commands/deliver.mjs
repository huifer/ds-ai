// ~/pi-discord-agents/src/runtime/commands/deliver.mjs
// 内容投递命令：把渲染结果推送到 Discord 预览频道
// 用户在 Discord 复制文本 / 下载 HTML → 手动去各平台发布
//
// 命令：
//   !deliver <rnd-id>          → 把渲染推送到对应预览频道
//   !deliver <cnt-id> --all    → 渲染全平台 + 全部推送（快捷）
//
// Discord 输出（每个平台）：
//   1. embed 卡片（标题/平台/字数/评分）
//   2. 可复制纯文本（代码块，分段）
//   3. HTML 文件附件

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadArtifact, latestArtifact, CONTENT_DIR_PATH } from './content.mjs';
import { getPreviewChannelId as resolvePreviewChannel } from '../channel-map.mjs';

// ===== 平台 → Discord 预览频道映射（委托给 channel-map.mjs）=====
export function platformToChannelId(platform, env = process.env) {
  return resolvePreviewChannel(platform, env);
}

export function listKnownPlatforms() {
  return ['wechat', 'xiaohongshu', 'video-account', 'douyin', 'x', 'ph', 'newsletter', 'youtube', 'linkedin'];
}

// ===== 从 HTML 提取纯文本 =====
function extractPlainText(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trim();
}

// ===== 根据平台格式化可复制文本 =====
function formatForPlatform(platform, candidate, plainText) {
  const title = candidate?.title ?? '';
  const content = candidate?.content ?? plainText;
  const brand = candidate?.llmEnhanced ? 'Zenbuild · 杭州 OPC 张三' : '杭州 OPC 张三';

  switch (platform) {
    case 'x': {
      // X/Twitter: 短文，280 字符参考（中文按字数）
      const body = plainText || content;
      let text = body.length > 250 ? body.slice(0, 250) + '…' : body;
      if (title && (title + text).length <= 270) text = `${title}\n\n${text}`;
      return text;
    }
    case 'xiaohongshu': {
      // 小红书：标题 + 正文，emoji 友好
      return `📌 ${title}\n\n${content}\n\n${brand}`;
    }
    case 'wechat': {
      // 微信公众号：markdown 格式正文
      return `# ${title}\n\n${content}\n\n---\n© ${brand}`;
    }
    case 'newsletter': {
      return `# ${title}\n\n${content}\n\n---\n${brand}\nAll rights reserved`;
    }
    case 'linkedin': {
      return `${title}\n\n${content}\n\n${brand}`;
    }
    case 'ph': {
      // Product Hunt: 简短描述
      const body = content.length > 300 ? content.slice(0, 300) + '…' : content;
      return `${title}\n\n${body}`;
    }
    default:
      return `# ${title}\n\n${plainText || content}`;
  }
}

// ===== 分段文本（Discord 2000 字符限制）=====
function splitText(text, maxLen = 1900) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  const lines = text.split('\n');
  let current = '';
  for (const line of lines) {
    if ((current + '\n' + line).length > maxLen) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// ===== 准备投递数据（纯数据，可测试）=====
export function prepareDelivery({ rndId }) {
  let render;
  if (rndId) {
    render = loadArtifact('renders', rndId);
  } else {
    render = latestArtifact('renders');
    if (!render) throw new Error('renders 为空，请先 !render');
  }

  const candidate = render.candidateId
    ? loadArtifact('candidates', render.candidateId)
    : null;

  // Markdown body 已是平台专用格式，直接用
  const body = render.body ?? render.html ?? '';

  const mdPath = resolve(CONTENT_DIR_PATH, 'renders', `${render.id}.md`);
  const htmlPath = resolve(CONTENT_DIR_PATH, 'renders', `${render.id}.html`);
  const pngPath = resolve(CONTENT_DIR_PATH, 'renders', `${render.id}.png`);
  const renderFormat = render.format ?? 'markdown';

  let attachmentPath = null;
  let attachmentExt = 'md';
  if (renderFormat === 'png' && existsSync(pngPath)) {
    attachmentPath = pngPath; attachmentExt = 'png';
  } else if (renderFormat === 'html' && existsSync(htmlPath)) {
    attachmentPath = htmlPath; attachmentExt = 'html';
  } else if (existsSync(mdPath)) {
    attachmentPath = mdPath; attachmentExt = 'md';
  } else if (existsSync(htmlPath)) {
    attachmentPath = htmlPath; attachmentExt = 'html';
  }

  return {
    renderId: render.id,
    candidateId: render.candidateId,
    platform: render.platform,
    format: renderFormat,
    title: candidate?.title ?? '(无标题)',
    score: candidate?.score ?? render.metadata?.score,
    llmEnhanced: candidate?.llmEnhanced ?? render.llmEnhanced ?? false,
    copyText: body,
    body,
    bodyLength: body.length,
    attachmentPath,
    attachmentExt,
    pngPath: renderFormat === 'png' ? (existsSync(pngPath) ? pngPath : null) : null,
    mdPath: existsSync(mdPath) ? mdPath : null,
    htmlPath: existsSync(htmlPath) ? htmlPath : null,
  };
}

// ===== 构建 Discord 消息序列（纯数据，可测试）=====
export async function buildDeliveryMessages(delivery) {
  const messages = [];

  // 图片平台：直接发 PNG
  if (delivery.format === 'png' && delivery.pngPath) {
    // 1. embed 卡片
    messages.push({
      type: 'embed',
      embed: {
        title: `📕 ${delivery.title}`,
        description: `平台: **${delivery.platform}** · 📸 PNG 卡片已生成`,
        color: 0xff2442,
        fields: [
          { name: 'RND', value: delivery.renderId, inline: true },
          { name: '评分', value: `${delivery.score?.total ?? '-'}/40`, inline: true },
        ],
        footer: { text: '👇 下方 PNG 图片可直接保存 → 发小红书/抖音/视频号' },
      },
    });
    // 2. PNG 图片
    const { readFileSync } = await import('node:fs');
    messages.push({
      type: 'image',
      buffer: readFileSync(delivery.pngPath),
      filename: `${delivery.renderId}.png`,
      caption: '📸 内容卡片（保存后直接发布）',
    });
    return messages;
  }

  // 文本平台：embed + Markdown + .md 文件
  // 1. embed 卡片
  messages.push({
    type: 'embed',
    embed: {
      title: `📄 ${delivery.title}`,
      description:
        `平台: **${delivery.platform}** · 字数: ${delivery.bodyLength}` +
        ` · ${delivery.llmEnhanced ? '🤖 LLM 生成' : '📝 模板渲染'}`,
      color: 0x6366f1,
      fields: [
        { name: 'RND', value: delivery.renderId, inline: true },
        { name: '评分', value: `${delivery.score?.total ?? '-'}/40`, inline: true },
        { name: '判定', value: delivery.score?.verdict ?? '-', inline: true },
      ],
      footer: { text: '👇 复制下方 Markdown → 粘贴到平台发布 · 或下载 .md 文件' },
    },
  });

  // 2. 可复制 Markdown 正文（分段）
  const chunks = splitText(delivery.copyText, 1900);
  for (let i = 0; i < chunks.length; i++) {
    const header = chunks.length > 1 ? `[${i + 1}/${chunks.length}]\n` : '';
    messages.push({
      type: 'text',
      content: `\`\`\`markdown\n${header}${chunks[i]}\n\`\`\``,
    });
  }

  // 3. 文件附件（Markdown 或 HTML）
  if (delivery.attachmentPath) {
    const isHtml = delivery.attachmentExt === 'html';
    messages.push({
      type: 'file',
      path: delivery.attachmentPath,
      filename: `${delivery.renderId}.${delivery.attachmentExt}`,
      caption: isHtml
        ? '📎 HTML 卡片（浏览器打开 → 截图 → 发小红书/抖音/视频号）'
        : '📎 Markdown 文件（可直接复制到公众号/Newsletter/LinkedIn 编辑器）',
    });
  }

  return messages;
}

// ===== 推送到 Discord（需要 discord 客户端）=====
export async function deliverToDiscord({ rndId, discord, env = process.env }) {
  const delivery = prepareDelivery({ rndId });
  const channelId = platformToChannelId(delivery.platform, env);
  if (!channelId) {
    return { ok: false, error: `找不到预览频道: ${delivery.platform}` };
  }

  const messages = await buildDeliveryMessages(delivery);
  const sent = [];
  for (const msg of messages) {
    try {
      if (msg.type === 'embed') {
        const { EmbedBuilder } = await import('discord.js');
        const eb = new EmbedBuilder();
        if (msg.embed.title) eb.setTitle(msg.embed.title.slice(0, 256));
        if (msg.embed.description) eb.setDescription(msg.embed.description.slice(0, 4096));
        if (typeof msg.embed.color === 'number') eb.setColor(msg.embed.color);
        if (msg.embed.fields?.length) {
          eb.addFields(msg.embed.fields.map((f) => ({
            name: (f.name ?? '').slice(0, 256),
            value: String(f.value ?? '').slice(0, 1024),
            inline: Boolean(f.inline),
          })));
        }
        if (msg.embed.footer?.text) eb.setFooter({ text: msg.embed.footer.text.slice(0, 2048) });
        sent.push({ type: 'embed', ok: true });
        await discord.sendEmbed(channelId, eb);
      } else if (msg.type === 'text') {
        sent.push({ type: 'text', ok: true });
        await discord.send(channelId, msg.content);
      } else if (msg.type === 'file') {
        sent.push({ type: 'file', ok: true });
        await discord.sendFile(channelId, msg.path, msg.filename, msg.caption);
      } else if (msg.type === 'image') {
        // PNG 图片直接发送（用户可直接看到效果）
        sent.push({ type: 'image', ok: true });
        const ch = await discord.client.channels.fetch(channelId);
        if (ch) {
          await ch.send({
            content: msg.caption || '',
            files: [{ attachment: msg.buffer, name: msg.filename }],
          });
        }
      }
    } catch (e) {
      sent.push({ type: msg.type, ok: false, error: e.message });
    }
  }

  return {
    ok: sent.every((s) => s.ok),
    channelId,
    channelEnvKey: delivery.platform,
    platform: delivery.platform,
    renderId: delivery.renderId,
    messageCount: messages.length,
    sent,
  };
}

// ===== 批量投递（auto-render 后用）=====
export async function deliverBatch({ rndIds, discord, env = process.env }) {
  const results = [];
  for (const rndId of rndIds) {
    try {
      results.push({ rndId, ok: true, ...(await deliverToDiscord({ rndId, discord, env })) });
    } catch (e) {
      results.push({ rndId, ok: false, error: e.message });
    }
  }
  return {
    total: rndIds.length,
    ok: results.filter((r) => r.ok).length,
    results,
  };
}
