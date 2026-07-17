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

  return {
    client,
    login: async () => { await client.login(token); },
    destroy: async () => { await client.destroy(); },
    async send(channelId, text, ref = null) {
      const ch = await client.channels.fetch(channelId);
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
  };
}
