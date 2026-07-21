import { Client, GatewayIntentBits } from 'discord.js';
import { readFileSync } from 'node:fs';

const envText = readFileSync('/Users/zhangsan/pi-discord-agents/.env', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guildId = env.GUILD_ID || '1527726951425507348';
  const guild = await client.guilds.fetch(guildId);

  console.log('\n📋 服务器频道列表：\n');

  const channels = await guild.channels.fetch();

  // 按 category 分组
  const categories = new Map();
  const uncategorized = [];

  // 先收集所有 category
  for (const [id, ch] of channels) {
    if (ch && ch.type === 4) { // GuildCategory
      categories.set(id, { name: ch.name, children: [] });
    }
  }

  // 再收集子频道
  for (const [id, ch] of channels) {
    if (!ch || !('name' in ch)) continue;
    if (ch.type === 4) continue; // skip category itself
    if (ch.parentId && categories.has(ch.parentId)) {
      categories.get(ch.parentId).children.push(ch);
    } else {
      uncategorized.push(ch);
    }
  }

  // 打印分组结果
  for (const [, cat] of categories) {
    if (cat.children.length === 0) continue;
    console.log(`📂 ${cat.name}`);
    console.log('─'.repeat(50));
    for (const ch of cat.children) {
      const name = ch.type === 2 ? `🔊 ${ch.name}` : `# ${ch.name}`;
      console.log(`  ${name.padEnd(25)} ${ch.id}`);
    }
    console.log('');
  }

  if (uncategorized.length > 0) {
    console.log(`📂 (未分组)`);
    console.log('─'.repeat(50));
    for (const ch of uncategorized) {
      const name = ch.type === 2 ? `🔊 ${ch.name}` : `# ${ch.name}`;
      console.log(`  ${name.padEnd(25)} ${ch.id}`);
    }
    console.log('');
  }

  console.log(`总计: ${Array.from(channels.values()).filter(c => c && 'name' in c && c.type !== 4).length} 个频道`);

  process.exit(0);
});

client.login(env.DISCORD_TOKEN);