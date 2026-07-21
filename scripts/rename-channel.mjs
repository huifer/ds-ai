import { Client, GatewayIntentBits } from 'discord.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
const env = Object.fromEntries(readFileSync(resolve(homedir(), 'pi-discord-agents', '.env'), 'utf8')
  .split('\n').filter(l => l && !l.startsWith('#'))
  .map(l => l.split('=').map(s => s.trim()))
  .map(([k, ...rest]) => [k, rest.join('=').replace(/^['"]|['"]$/g, '')]));
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
await client.login(env.DISCORD_TOKEN);
const ch = await client.channels.fetch(env.CH_TREND);
console.log('before:', ch.name);
await ch.setName('用量', 'rename to 用量 per user request');
console.log('after:', ch.name);
await client.destroy();
