// ~/pi-discord-agents/src/discord-client.mjs
// Discord 客户端:启动 / 监听 / 发消息 / 上传图片 / 反应 emoji
import { Client, GatewayIntentBits, Partials, ChannelType } from 'discord.js';

export function createDiscordClient({ token, onMessage }) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.once('ready', (c) => {
    console.log(`[discord] 已登录 🌟 ${c.user.tag}`);
    onMessage?.('ready', { client: c });
  });

  client.on('messageCreate', (msg) => {
    onMessage?.('message', { message: msg });
  });

  // 内部方法:获取 channel
  async function _fetchChannel(channelId) {
    return await client.channels.fetch(channelId);
  }

  return {
    client,
    login: async () => { await client.login(token); },
    destroy: async () => { await client.destroy(); },
    async send(channelId, text, ref = null) {
      const ch = await _fetchChannel(channelId);
      if (!ch || ch.type !== ChannelType.GuildText) return null;
      const opts = {};
      if (text.length > 1990) text = text.slice(0, 1980) + '…';
      opts.content = text;
      if (ref) {
        opts.reply = { messageReference: ref.id, failIfNotExists: false };
      }
      return await ch.send(opts);
    },
    async react(message, emoji) {
      try { await message.react(emoji); } catch {}
    },
    async removeReact(message, emoji) {
      try {
        const r = message.reactions.cache.get(emoji);
        if (r) await r.remove();
      } catch {}
    },
    async sendPng(channelId, pngBuffer, caption) {
      const ch = await _fetchChannel(channelId);
      if (!ch || ch.type !== ChannelType.GuildText) return null;
      return await ch.send({
        files: [{
          attachment: pngBuffer,
          name: 'token-usage.png',
          description: 'Token 用量图表'
        }],
        content: caption || ''
      });
    },

    // ---- 投票按钮支持 ----

    /** 发带按钮的消息。buttons: [{customId, label, style, emoji?}] */
    async sendWithButtons(channelId, text, buttons = [], ref = null) {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
      const ch = await _fetchChannel(channelId);
      if (!ch || ch.type !== ChannelType.GuildText) return null;
      const row = new ActionRowBuilder();
      for (const b of buttons.slice(0, 5)) {
        const btn = new ButtonBuilder()
          .setCustomId(b.customId)
          .setLabel(b.label || b.customId);
        const style = (b.style || 'secondary').toLowerCase();
        if (style === 'primary') btn.setStyle(ButtonStyle.Primary);
        else if (style === 'success') btn.setStyle(ButtonStyle.Success);
        else if (style === 'danger') btn.setStyle(ButtonStyle.Danger);
        else btn.setStyle(ButtonStyle.Secondary);
        if (b.emoji) btn.setEmoji(b.emoji);
        if (b.disabled) btn.setDisabled(true);
        row.addComponents(btn);
      }
      const opts = {
        content: text,
        components: [row],
      };
      if (ref) opts.reply = { messageReference: ref.id, failIfNotExists: false };
      return await ch.send(opts);
    },

    /** 发 embed 卡片 */
    async sendEmbed(channelId, embed) {
      const ch = await _fetchChannel(channelId);
      if (!ch || ch.type !== ChannelType.GuildText) return null;
      if (!ch || ch.type !== ChannelType.GuildText) return null;
      return await ch.send({ embeds: [embed] });
    },

    /** 发 DM（私信）给用户 */
    async sendDM(userId, text) {
      try {
        const user = await Promise.race([
          client.users.fetch(userId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('user fetch timeout')), 10000))
        ]).catch(() => null);
        if (!user) return null;
        return await Promise.race([
          user.send(text),
          new Promise((_, reject) => setTimeout(() => reject(new Error('DM send timeout')), 30000))
        ]);
      } catch (e) {
        this.log?.(`[discord] DM 失败 userId=${userId}: ${e.message}`);
        return null;
      }
    },

    /** 发 DM 文件附件 */
    async sendDMFile(userId, filePath, filename, caption) {
      try {
        const { readFile } = await import('node:fs/promises');
        const user = await Promise.race([
          client.users.fetch(userId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('user fetch timeout')), 10000))
        ]).catch(() => null);
        if (!user) return null;
        const buffer = await Promise.race([
          readFile(filePath),
          new Promise((_, reject) => setTimeout(() => reject(new Error('read timeout')), 10000))
        ]).catch(() => null);
        if (!buffer) return null;
        const content = caption || '';
        const sendPromise = content.length > 1980
          ? user.send(content.slice(0, 1970) + '…')
          : user.send({ content, files: [{ attachment: buffer, name: filename }] });
        const sent = await Promise.race([
          sendPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('DM file timeout')), 60000))
        ]).catch(() => null);
        if (content.length > 1980 && sent) {
          const fileSent = await Promise.race([
            user.send({ files: [{ attachment: buffer, name: filename }] }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('DM file timeout')), 60000))
          ]).catch(() => null);
          return fileSent;
        }
        return sent;
      } catch (e) {
        this.log?.(`[discord] DM 文件失败 userId=${userId}: ${e.message}`);
        return null;
      }
    },

    /** 发文件附件（带超时） */
    async sendFile(channelId, filePath, filename, caption) {
      const { readFile } = await import('node:fs/promises');
      // 带超时的 channel fetch
      const ch = await Promise.race([
        client.channels.fetch(channelId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('fetch timeout')), 10000))
      ]).catch(() => null);
      if (!ch || ch.type !== ChannelType.GuildText) return null;
      const buffer = await Promise.race([
        readFile(filePath),
        new Promise((_, reject) => setTimeout(() => reject(new Error('read timeout')), 10000))
      ]).catch(() => null);
      if (!buffer) return null;
      const content = caption || '';
      try {
        const sendOpts = content.length > 1990
          ? { content: content.slice(0, 1980) + '…' }
          : { content, files: [{ attachment: buffer, name: filename }] };
        // 大文件上传需要更长时间，设置 60s 超时
        const sendPromise = ch.send(sendOpts);
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('send timeout 60s')), 60000));
        const sent = await Promise.race([sendPromise, timeout]);
        // 如果是分片发送（先发文字再发文件）
        if (content.length > 1990) {
          const filePromise = ch.send({ files: [{ attachment: buffer, name: filename }] });
          const fileTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('file send timeout 60s')), 60000));
          return await Promise.race([filePromise, fileTimeout]);
        }
        return sent;
      } catch (e) {
        this.log(`[sendFile] error: ${e.message}`);
        return null;
      }
    },

    /** 发 embed 卡片 + 按钮 */
    async sendEmbedWithButtons(channelId, embed, buttons = []) {
      const ch = await _fetchChannel(channelId);
      if (!ch || ch.type !== ChannelType.GuildText) return null;
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
      const opts = { embeds: [embed] };
      if (buttons.length) {
        const row = new ActionRowBuilder();
        for (const b of buttons.slice(0, 5)) {
          const btn = new ButtonBuilder()
            .setCustomId(b.customId)
            .setLabel(b.label || b.customId);
          const style = (b.style || 'secondary').toLowerCase();
          if (style === 'primary') btn.setStyle(ButtonStyle.Primary);
          else if (style === 'success') btn.setStyle(ButtonStyle.Success);
          else if (style === 'danger') btn.setStyle(ButtonStyle.Danger);
          else btn.setStyle(ButtonStyle.Secondary);
          if (b.emoji) btn.setEmoji(b.emoji);
          row.addComponents(btn);
        }
        opts.components = [row];
      }
      return await ch.send(opts);
    },

    /** 给按钮发回应(临时消息,只有点的人看到) */
    async replyToInteraction(interaction, content, ephemeral = true) {
      try {
        if (ephemeral) return await interaction.reply({ content, ephemeral: true });
        return await interaction.update({ content, components: interaction.message.components });
      } catch (e) {
        // 如果已经 reply 过,改用 followUp
        try { return await interaction.followUp({ content, ephemeral }); } catch {}
      }
    },

    /** 订阅按钮点击事件 */
    onButtonInteraction(handler) {
      const wrapped = async (interaction) => {
        if (!interaction.isButton()) return;
        try { await handler(interaction); } catch (e) { console.error('[discord] button handler error:', e.message); }
      };
      client.on('interactionCreate', wrapped);
      return () => client.off('interactionCreate', wrapped);
    },

    // ---- 频道管理(需要 MANAGE_CHANNELS 权限)----

    /** 拿一个 guild(用于建频道) */
    async getGuild(guildId) {
      return await client.guilds.fetch(guildId);
    },

    /** 列出 guild 下所有频道 */
    async listChannels(guildId) {
      const guild = await client.guilds.fetch(guildId);
      const channels = await guild.channels.fetch();
      return Array.from(channels.values()).map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parentId: c.parentId,
        position: c.position,
      }));
    },

    /** 创建 category(GUILD_CATEGORY = 4) */
    async createCategory(guildId, { name, topic, position } = {}) {
      const guild = await client.guilds.fetch(guildId);
      const ch = await guild.channels.create({
        name,
        type: ChannelType.GuildCategory,
        topic: topic || null,
        position: typeof position === 'number' ? position : undefined,
        reason: '「遐思」Group 由 setup-xiasi-group.mjs 创建',
      });
      return { id: ch.id, name: ch.name, type: ch.type };
    },

    /** 在指定 category 下创建文本频道(GUILD_TEXT = 0) */
    async createTextChannel(guildId, { name, parentId, topic, position } = {}) {
      const guild = await client.guilds.fetch(guildId);
      const ch = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: parentId || null,
        topic: topic || null,
        position: typeof position === 'number' ? position : undefined,
        reason: '「遐思」子频道 由 setup-xiasi-group.mjs 创建',
      });
      return { id: ch.id, name: ch.name, type: ch.type, parentId: ch.parentId };
    },

    /** 按名字找一个已存在的 category(返回第一个匹配) */
    async findCategoryByName(guildId, name) {
      const list = await this.listChannels(guildId);
      const found = list.find((c) => c.type === ChannelType.GuildCategory && c.name === name);
      return found || null;
    },

    /** 按 name + parentId 找一个已存在的 text channel */
    async findTextChannelByName(guildId, name, parentId = null) {
      const list = await this.listChannels(guildId);
      return list.find((c) =>
        c.type === ChannelType.GuildText &&
        c.name === name &&
        (parentId ? c.parentId === parentId : true)
      ) || null;
    },
  };
}
