#!/usr/bin/env node
/**
 * 🧪 Bot 命令测试脚本
 * 
 * 使用 discord.js 直接向 Bot 发送命令并验证响应
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

// 加载配置
const ROOT = resolve(homedir(), 'pi-discord-agents');
const ENV_PATH = resolve(ROOT, '.env');

function parseEnvText(text) {
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = parseEnvText(readFileSync(ENV_PATH, 'utf8'));

// 测试结果收集
const results = {
  passed: [],
  failed: [],
  pending: [],
  total: 0
};

// 待测试命令列表（分批次）
const TEST_BATCHES = [
  {
    name: '第一批：核心基础命令',
    commands: [
      { cmd: '!state', desc: '查看 Agent 状态' },
      { cmd: '!cost', desc: '查看成本' },
      { cmd: '!memory', desc: '查看记忆' },
      { cmd: '!pr list', desc: '列出项目' },
      { cmd: '!restart', desc: '重启指令' },
      { cmd: '!status', desc: 'Bot 状态' },
    ]
  },
  {
    name: '第二批：Lead 流程',
    commands: [
      { cmd: '!lead list', desc: '列出线索' },
    ]
  },
  {
    name: '第三批：项目流程',
    commands: [
      { cmd: '!pr list', desc: '列出项目' },
    ]
  }
];

// 创建一个简单的 Discord 客户端用于发送消息
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let pendingReplies = new Map(); // messageId -> { cmd, startTime, batch }

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendCommand(cmd, desc) {
  const channelId = env.CH_ENTRY;
  const channel = await client.channels.fetch(channelId);
  if (!channel) {
    console.error(`❌ 无法获取频道 ${channelId}`);
    return null;
  }
  
  try {
    const message = await channel.send(cmd);
    console.log(`📤 发送: ${cmd} (${desc})`);
    return message.id;
  } catch (e) {
    console.error(`❌ 发送失败: ${e.message}`);
    return null;
  }
}

function analyzeResponse(response) {
  const text = response.toLowerCase();
  
  if (text.includes('error') || text.includes('错误') || text.includes('unknown')) {
    return { status: 'fail', reason: '返回错误' };
  }
  if (text.includes('ok') || text.includes('✅') || text.includes('via=pi-rpc') || text.includes('completed')) {
    return { status: 'pass', reason: '正常响应' };
  }
  if (text.length < 5) {
    return { status: 'pending', reason: '响应过短，需人工确认' };
  }
  return { status: 'pass', reason: '有内容响应' };
}

async function handleMessage(msg) {
  // 忽略 Bot 自己的消息
  if (msg.author.bot) return;
  
  // 查找对应的待回复消息
  const refMsgId = msg.reference?.messageId;
  if (!refMsgId) return;
  
  const pending = pendingReplies.get(refMsgId);
  if (!pending) return;
  
  const elapsed = Date.now() - pending.startTime;
  const response = msg.content.slice(0, 800);
  
  console.log(`📥 收到回复 (${elapsed}ms):`);
  console.log(`   ${response.substring(0, 150)}${response.length > 150 ? '...' : ''}`);
  
  const analysis = analyzeResponse(response);
  
  results.total++;
  
  if (analysis.status === 'pass') {
    results.passed.push(pending.cmd);
    console.log(`   ✅ ${analysis.reason}`);
  } else if (analysis.status === 'fail') {
    results.failed.push({ cmd: pending.cmd, reason: analysis.reason });
    console.log(`   ❌ ${analysis.reason}`);
  } else {
    results.pending.push({ cmd: pending.cmd, reason: analysis.reason });
    console.log(`   ⚠️ ${analysis.reason}`);
  }
  
  pendingReplies.delete(refMsgId);
}

async function runTests() {
  console.log('═'.repeat(60));
  console.log('🧪 Bot 命令测试');
  console.log('═'.repeat(60));
  console.log(`频道 ID: ${env.CH_ENTRY}`);
  console.log(`Guild ID: ${env.GUILD_ID || '未设置'}`);
  console.log('');
  
  // 登录
  console.log('🔄 正在连接 Discord...');
  await client.login(env.DISCORD_TOKEN);
  console.log('✅ Discord 已连接\n');
  
  // 等待就绪
  await sleep(2000);
  
  // 设置消息监听
  client.on('messageCreate', handleMessage);
  
  // 逐批次测试
  for (const batch of TEST_BATCHES) {
    console.log('\n' + '─'.repeat(50));
    console.log(`📦 ${batch.name}`);
    console.log('─'.repeat(50));
    
    for (const test of batch.commands) {
      const fullCmd = test.params ? `${test.cmd} ${test.params}` : test.cmd;
      
      const msgId = await sendCommand(fullCmd, test.desc);
      if (msgId) {
        pendingReplies.set(msgId, {
          cmd: fullCmd,
          startTime: Date.now(),
          batch: batch.name
        });
      }
      
      // 等待响应（15 秒超时）
      const startWait = Date.now();
      while (pendingReplies.has(msgId) && (Date.now() - startWait) < 15000) {
        await sleep(1000);
      }
      
      if (pendingReplies.has(msgId)) {
        console.log(`   ⏰ 超时`);
        results.failed.push({ cmd: fullCmd, reason: '超时' });
        results.total++;
        pendingReplies.delete(msgId);
      }
      
      // 命令间隔
      await sleep(2000);
    }
  }
  
  // 打印汇总
  console.log('\n' + '═'.repeat(60));
  console.log('📊 测试汇总');
  console.log('═'.repeat(60));
  console.log(`通过: ${results.passed.length}`);
  console.log(`失败: ${results.failed.length}`);
  console.log(`待确认: ${results.pending.length}`);
  console.log(`总计: ${results.total}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ 失败:');
    for (const f of results.failed) {
      console.log(`  • ${f.cmd}: ${f.reason}`);
    }
  }
  
  if (results.pending.length > 0) {
    console.log('\n⚠️ 待确认:');
    for (const p of results.pending) {
      console.log(`  • ${p.cmd}: ${p.reason}`);
    }
  }
  
  console.log('\n✅ 通过的命令:');
  for (const p of results.passed) {
    console.log(`  • ${p}`);
  }
  
  console.log('═'.repeat(60));
  
  // 退出
  await sleep(2000);
  await client.destroy();
  process.exit(0);
}

runTests().catch(e => {
  console.error('测试失败:', e);
  process.exit(1);
});
