// ~/pi-discord-agents/multi-agent-status.mjs
// 多 Agent 系统状态监控脚本
// 显示 Agent 注册情况、Session 池、压缩情况

import { AgentRegistry } from './src/orchestrator/agent-registry.mjs';
import { SessionPool } from './src/orchestrator/session-pool.mjs';

const log = (...args) => console.log(...args);

console.log('\n🎯 多 Agent 系统状态\n');
console.log('═'.repeat(70));

// ---- Agent Registry ----
log('\n📋 Agent Registry:');
const registry = new AgentRegistry({ log });
registry.loadFromRegistryJson();

const groups = registry.groupByCategory();
for (const [cat, agents] of Object.entries(groups)) {
  log(`\n  📂 ${cat}`);
  for (const a of agents) {
    const channels = a.channels?.length ?? 0;
    const skills = a.skills?.length ?? 0;
    log(`     ${a.emoji} ${a.displayName.padEnd(22)} (${a.id.padEnd(20)}) 频道:${channels} skill:${skills}`);
  }
}

const hiddenCount = Array.from(registry.agents.values()).filter(a => a.hidden).length;
log(`\n  (兼容旧 Agent: ${hiddenCount} 个 hidden)\n`);

// ---- Session Pool ----
log('\n📦 Session Pool:');
const pool = new SessionPool({
  rootDir: process.cwd(),
  log: () => {},  // 静默
  persistDir: process.env.SESSION_PERSIST_DIR || 'data/multi-agent-sessions',
});

const sessions = pool.list();
if (sessions.length === 0) {
  log('   (暂无活跃 session)');
} else {
  log(`\n   活跃 session: ${sessions.length} 个\n`);
  // 按 channel 分组
  const byChannel = {};
  for (const s of sessions) {
    const ch = s.channelId;
    if (!byChannel[ch]) byChannel[ch] = [];
    byChannel[ch].push(s);
  }
  for (const [ch, list] of Object.entries(byChannel)) {
    log(`   📺 ${ch}: ${list.length} 个 session`);
    for (const s of list) {
      log(`      · ${s.userId} (agent=${s.agentId}) turns=${s.turns} tokens=${s.tokenEstimate} compressed=${s.compressedCount}x`);
    }
  }
}

const totalTokens = sessions.reduce((sum, s) => sum + s.tokenEstimate, 0);
log(`\n   📊 总 Token 估算: ${totalTokens.toLocaleString()}\n`);

// ---- 配置建议 ----
log('\n⚙️  当前压缩配置 (来自 .env 或默认):');
log(`   SESSION_MAX_TURNS=${process.env.SESSION_MAX_TURNS ?? '20 (默认)'}`);
log(`   SESSION_MAX_TOKENS=${process.env.SESSION_MAX_TOKENS ?? '60000 (默认)'}`);
log(`   SESSION_KEEP_RECENT=${process.env.SESSION_KEEP_RECENT ?? '5 (默认)'}`);
log(`   SESSION_IDLE_MINUTES=${process.env.SESSION_IDLE_MINUTES ?? '30 (默认)'}`);

pool.shutdown();
log('\n' + '═'.repeat(70));
log('\n✅ 状态检查完成\n');