// ~/pi-discord-agents/verify-agents.mjs
// 真实环境验证:Agent 注册频道 vs Discord 实际频道
// 检查每个 Agent 的频道配置是否在 Discord 真实存在

import { readFileSync, existsSync } from 'node:fs';
import { AgentRegistry } from './src/orchestrator/agent-registry.mjs';

const log = (...args) => console.log(...args);

// ---- 1. 加载 .env 中的所有 CH_ 频道 ID ----
function loadEnv() {
  const envText = readFileSync('.env', 'utf8');
  const out = {};
  for (const raw of envText.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

// ---- 2. 加载 Discord 真实频道 ID → name 映射 ----
function loadDiscordChannels() {
  if (!existsSync('/tmp/ch-id-to-name.json')) {
    log('⚠️  请先运行: bash fetch-discord-channels.sh 获取真实频道');
    return {};
  }
  return JSON.parse(readFileSync('/tmp/ch-id-to-name.json', 'utf8'));
}

const env = loadEnv();
const discordChannels = loadDiscordChannels();

// ---- 3. 反向映射: 频道名字 → 频道 ID ----
const nameToId = {};
for (const [id, name] of Object.entries(discordChannels)) {
  nameToId[name] = id;
}

log('\n🎯 Agent 频道配置验证\n');
log('═'.repeat(80));

const registry = new AgentRegistry({ log });
registry.loadFromRegistryJson();

let totalChannels = 0;
let matchedChannels = 0;
let missingChannels = [];
const chIdToAgent = {}; // 用于反向映射

// ---- 4. 对每个 Agent,检查其声明的频道是否在 Discord 中存在 ----
for (const agent of registry.list({ includeHidden: true })) {
  if (!agent.channels || agent.channels.length === 0) continue;

  log(`\n${agent.emoji} ${agent.displayName} (${agent.id})`);
  for (const chName of agent.channels) {
    totalChannels++;
    const chId = nameToId[chName];

    if (chId) {
      matchedChannels++;
      chIdToAgent[chId] = agent.id;
      log(`   ✅ #${chName} → ${chId}`);

      // 检查 .env 中是否有对应配置
      const envKey = `CH_${chName.toUpperCase().replace(/-/g, '_').replace(/[^A-Z0-9_]/g, '')}`;
      const envVal = env[envKey];
      if (envVal && envVal === chId) {
        log(`      ↳ .env ${envKey} ✓ 匹配`);
      } else if (envVal) {
        log(`      ⚠️  .env ${envKey}=${envVal} 与 Discord 不一致`);
      } else {
        // 尝试找其他可能的 CH_ key
        const altKey = Object.keys(env).find(k =>
          k.startsWith('CH_') && env[k] === chId
        );
        if (altKey) {
          log(`      ↳ .env ${altKey} ✓ 匹配`);
        }
      }
    } else {
      missingChannels.push({ agentId: agent.id, channelName: chName });
      log(`   ❌ #${chName} → 在 Discord 中找不到!`);
    }
  }
}

// ---- 5. 总结 ----
log('\n' + '═'.repeat(80));
log(`\n📊 验证总结:`);
log(`   Agent 声明频道: ${totalChannels}`);
log(`   Discord 中存在: ${matchedChannels}`);
log(`   缺失频道: ${missingChannels.length}`);

if (missingChannels.length > 0) {
  log(`\n❌ 缺失的频道:`);
  for (const m of missingChannels) {
    log(`   - ${m.agentId}: #${m.channelName}`);
  }
}

// ---- 6. 列出 Discord 上有但 Agent 未声明的频道 ----
const declaredChannelNames = new Set();
for (const a of registry.list({ includeHidden: true })) {
  for (const c of a.channels ?? []) declaredChannelNames.add(c);
}

const undeclared = [];
for (const [id, name] of Object.entries(discordChannels)) {
  if (!declaredChannelNames.has(name)) {
    undeclared.push({ id, name });
  }
}

log(`\n📋 Discord 上有但 Agent 未声明的频道: ${undeclared.length}`);
if (undeclared.length > 0 && undeclared.length < 30) {
  for (const u of undeclared.slice(0, 20)) {
    log(`   - #${u.name} (${u.id})`);
  }
  if (undeclared.length > 20) {
    log(`   ... 还有 ${undeclared.length - 20} 个`);
  }
}

// ---- 7. 列出 Discord 上有但 .env 没配置的频道 ----
const envChannels = new Set();
for (const [k, v] of Object.entries(env)) {
  if (k.startsWith('CH_') && /^\d{17,20}$/.test(v)) envChannels.add(v);
}
const notInEnv = [];
for (const [id, name] of Object.entries(discordChannels)) {
  if (!envChannels.has(id)) notInEnv.push({ id, name });
}

log(`\n📋 Discord 上有但 .env 没配置的频道: ${notInEnv.length}`);
for (const n of notInEnv.slice(0, 20)) {
  log(`   - #${n.name} (${n.id})`);
}

log('\n' + '═'.repeat(80));
log(`\n✅ 验证完成\n`);

// 导出映射供其他脚本使用
import { writeFileSync } from 'node:fs';
writeFileSync('data/ch-id-to-agent.json', JSON.stringify(chIdToAgent, null, 2));
log(`💾 频道→Agent 映射已保存到 data/ch-id-to-agent.json\n`);