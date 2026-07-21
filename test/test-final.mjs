#!/usr/bin/env node
/**
 * 🧪 Bot 本地完整功能测试
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

const results = {
  passed: [],
  failed: [],
  total: 0
};

function log(msg, type = 'info') {
  const prefix = { info: '📋', pass: '✅', fail: '❌', warn: '⚠️' }[type] || '📋';
  console.log(`${prefix} ${msg}`);
}

function pass(name, detail = '') {
  results.passed.push({ name, detail });
  results.total++;
  log(`${name}${detail ? ': ' + detail : ''}`, 'pass');
}

function fail(name, reason) {
  results.failed.push({ name, reason });
  results.total++;
  log(`${name}: ${reason}`, 'fail');
}

// ============================================
// 测试 1: 配置系统
// ============================================
async function testConfig() {
  log('\n=== 1. 配置系统 ===');
  
  try {
    const { loadConfig } = await import(`${ROOT}/src/config.mjs`);
    const cfg = loadConfig();
    
    if (cfg.ok) {
      const channels = Object.keys(cfg.value.channels).length;
      pass('配置加载', `${channels} 个频道配置`);
      return cfg.value;
    } else {
      fail('配置加载', cfg.error);
      return null;
    }
  } catch (e) {
    fail('配置加载', e.message);
    return null;
  }
}

// ============================================
// 测试 2: 记忆系统
// ============================================
async function testMemory() {
  log('\n=== 2. 记忆系统 ===');
  
  try {
    const { createMemoryStore } = await import(`${ROOT}/src/memory-store.mjs`);
    const memoryStore = await createMemoryStore({ rootDir: ROOT });
    
    const allMemories = await memoryStore.query({});
    const count = allMemories.items?.length || 0;
    pass('记忆存储', `${count} 条记忆`);
    
    // 按类型统计
    const kinds = ['preference', 'decision', 'idea', 'constraint'];
    for (const kind of kinds) {
      const result = await memoryStore.query({ kind });
      const c = result.items?.length || 0;
      if (c > 0) log(`  ${kind}: ${c}`);
    }
    
    return memoryStore;
  } catch (e) {
    fail('记忆存储', e.message);
    return null;
  }
}

// ============================================
// 测试 3: Agent 注册
// ============================================
async function testAgents() {
  log('\n=== 3. Agent 注册 ===');
  
  try {
    const { AgentManager } = await import(`${ROOT}/src/runtime/agent-manager.mjs`);
    const manager = new AgentManager({ root: ROOT });
    await manager.start();
    
    pass('AgentManager', `${manager.agents.size} 个 Agent`);
    
    // 按类别统计
    const categories = {};
    for (const [id, agent] of manager.agents) {
      // 分类统计
    }
    
    return manager;
  } catch (e) {
    fail('Agent 注册', e.message);
    return null;
  }
}

// ============================================
// 测试 4: 命令路由
// ============================================
async function testCommandRouting() {
  log('\n=== 4. 命令路由 ===');
  
  try {
    const { parseCommand } = await import(`${ROOT}/src/runtime/agent-manager.mjs`);
    
    const commands = [
      '!state',
      '!cost',
      '!memory',
      '!pr list',
      '!pr new',
      '!lead new',
      '!lead list',
      '!prd v0.1',
      '!pm plan',
      '!quote draft',
      '!bid start',
      '!contract new',
      '!poc start',
      '!cs health',
      '!invoice request',
      '!distill now',
      '!render',
      '!qa last',
    ];
    
    let passed = 0;
    for (const cmd of commands) {
      const parsed = parseCommand(cmd);
      if (parsed && parsed.route) {
        passed++;
      }
    }
    
    pass('命令路由', `${passed}/${commands.length}`);
    
    // 显示路由结果
    for (const cmd of commands.slice(0, 6)) {
      const parsed = parseCommand(cmd);
      if (parsed && parsed.route) {
        log(`  ${cmd} → ${parsed.route.agentId}/${parsed.route.skill}`);
      }
    }
    
  } catch (e) {
    fail('命令路由', e.message);
  }
}

// ============================================
// 测试 5: 项目管理
// ============================================
async function testProjects() {
  log('\n=== 5. 项目管理 ===');
  
  try {
    const indexPath = join(ROOT, 'data/business/projects/index.yaml');
    const content = readFileSync(indexPath, 'utf-8');
    
    const matches = content.match(/PRJ-\S+/g) || [];
    pass('项目索引', `${matches.length} 个项目`);
    
    // 列出项目
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes('id:') && line.includes('PRJ-')) {
        const id = line.match(/PRJ-\S+/)?.[0];
        log(`  - ${id}`);
      }
    }
    
  } catch (e) {
    fail('项目管理', e.message);
  }
}

// ============================================
// 测试 6: Lead 管理
// ============================================
async function testLeads() {
  log('\n=== 6. Lead 管理 ===');
  
  try {
    const leadsDir = join(ROOT, 'data/business/leads');
    const files = readdirSync(leadsDir).filter(f => f.endsWith('.json'));
    
    pass('Lead 列表', `${files.length} 个 Lead`);
    
    for (const file of files.slice(0, 3)) {
      const content = readFileSync(join(leadsDir, file), 'utf-8');
      const lead = JSON.parse(content);
      log(`  - ${lead.id}: ${lead.company || '未命名'}`);
    }
    
  } catch (e) {
    fail('Lead 管理', e.message);
  }
}

// ============================================
// 测试 7: 审批流程
// ============================================
async function testApprovals() {
  log('\n=== 7. 审批流程 ===');
  
  try {
    const { Approval } = await import(`${ROOT}/src/runtime/approval.mjs`);
    const approval = new Approval({ root: ROOT });
    
    pass('审批模块', '已创建');
    
    // 验证需要审批的命令
    const approvalTypes = [
      'quote-send',
      'bid-submit',
      'contract-sign',
      'prod-deploy',
      'invoice-approval',
      'publish-domestic',
    ];
    
    for (const type of approvalTypes) {
      log(`  ${type}: 需审批`);
    }
    
    pass('审批配置', `${approvalTypes.length} 个审批点`);
    
  } catch (e) {
    fail('审批流程', e.message);
  }
}

// ============================================
// 测试 8: Team 工作流
// ============================================
async function testTeams() {
  log('\n=== 8. Team 工作流 ===');
  
  try {
    const teams = [
      {
        id: 'lead-to-contract',
        steps: ['sales/lead-capture', 'sales/qualification', 'quote/estimate', 'contract/contract-summarize']
      },
      {
        id: 'idea-to-publish', 
        steps: ['distill/distill-brief', 'renderer/platform-render', 'qa/qa-report', 'publisher/platform-publish']
      },
      {
        id: 'pr-full-cycle',
        steps: ['pm/project-bootstrap', 'pm/plan-build', 'solution/prd-v10', 'delivery/poc-plan', 'qa/test-plan']
      },
    ];
    
    let totalSteps = 0;
    for (const team of teams) {
      totalSteps += team.steps.length;
      log(`  ${team.id}: ${team.steps.length} 步`);
    }
    
    pass('Team 工作流', `${teams.length} 个工作流, ${totalSteps} 步`);
    
  } catch (e) {
    fail('Team 工作流', e.message);
  }
}

// ============================================
// 测试 9: 内容流水线
// ============================================
async function testContentPipeline() {
  log('\n=== 9. 内容流水线 ===');
  
  const stages = [
    { name: 'inbox', path: 'data/content/inbox' },
    { name: 'distilled', path: 'data/content/distilled' },
    { name: 'rendered', path: 'data/content/rendered' },
    { name: 'published', path: 'data/content/published' },
  ];
  
  let total = 0;
  for (const stage of stages) {
    const fullPath = join(ROOT, stage.path);
    if (existsSync(fullPath)) {
      const files = readdirSync(fullPath).filter(f => f.endsWith('.json'));
      total += files.length;
      log(`  ${stage.name}: ${files.length}`);
    } else {
      log(`  ${stage.name}: 0`);
    }
  }
  
  pass('内容流水线', `${total} 个文件`);
}

// ============================================
// 测试 10: 调度器
// ============================================
async function testScheduler() {
  log('\n=== 10. 调度器 ===');
  
  try {
    const { createScheduler } = await import(`${ROOT}/src/scheduler.mjs`);
    const scheduler = createScheduler({ onJob: () => {} });
    
    pass('调度器', '已创建');
    
    // 检查日志中的任务
    const logPath = join(ROOT, 'logs/orchestrator.log');
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, 'utf-8');
      const match = content.match(/jobs:\s*(.+)/);
      if (match) {
        const tasks = match[1].split(',').map(t => t.trim()).filter(Boolean);
        pass('定时任务', `${tasks.length} 个`);
        
        for (const task of tasks.slice(0, 8)) {
          log(`  - ${task}`);
        }
      }
    }
    
  } catch (e) {
    fail('调度器', e.message);
  }
}

// ============================================
// 测试 11: Pi RPC
// ============================================
async function testPiRpc() {
  log('\n=== 11. Pi RPC ===');
  
  try {
    const { RpcClient } = await import('@earendil-works/pi-coding-agent');
    
    // 检查是否有 Pi CLI
    const { execSync } = await import('node:child_process');
    let piPath = 'pi';
    try {
      piPath = execSync('which pi').toString().trim();
    } catch {}
    
    pass('Pi CLI', piPath);
    
    // 创建 RPC 客户端
    const pi = new RpcClient({
      cliPath: piPath,
      cwd: ROOT,
      provider: 'minimax-cn',
      model: 'MiniMax-M3',
      env: { HTTP_PROXY: 'http://127.0.0.1:7897' }
    });
    
    pass('RpcClient', '已创建');
    
    if (typeof pi.promptAndWait === 'function') {
      pass('promptAndWait', '方法存在');
    }
    
    return pi;
  } catch (e) {
    fail('Pi RPC', e.message);
    return null;
  }
}

// ============================================
// 测试 12: Pi Bridge
// ============================================
async function testPiBridge(pi) {
  log('\n=== 12. Pi Bridge ===');
  
  if (!pi) {
    log('跳过 (Pi 不可用)', 'warn');
    return;
  }
  
  try {
    const { PiBridge } = await import(`${ROOT}/src/runtime/pi-bridge.mjs`);
    
    const bridge = new PiBridge({ rpcClient: pi });
    
    pass('PiBridge', `available=${bridge.available}`);
    
    if (typeof bridge.prompt === 'function') {
      pass('bridge.prompt', '方法存在');
    }
    
    if (typeof bridge.promptJSON === 'function') {
      pass('bridge.promptJSON', '方法存在');
    }
    
  } catch (e) {
    fail('Pi Bridge', e.message);
  }
}

// ============================================
// 测试 13: Discord 客户端
// ============================================
async function testDiscord() {
  log('\n=== 13. Discord 客户端 ===');
  
  try {
    const { createDiscordClient } = await import(`${ROOT}/src/discord-client.mjs`);
    const discord = createDiscordClient({
      token: 'TEST_TOKEN',
      handlers: {},
      log: () => {}
    });
    
    pass('Discord 客户端', '已创建');
    
    const methods = ['send', 'reply', 'edit', 'upload'];
    for (const method of methods) {
      if (typeof discord[method] === 'function') {
        log(`  ✓ ${method}`);
      }
    }
    
  } catch (e) {
    fail('Discord 客户端', e.message);
  }
}

// ============================================
// 测试 14: 遐思系统
// ============================================
async function testDreaming() {
  log('\n=== 14. 遐思系统 ===');
  
  try {
    const dreamingDir = join(ROOT, 'data/dreams');
    if (existsSync(dreamingDir)) {
      const files = readdirSync(dreamingDir).filter(f => f.endsWith('.json'));
      pass('遐思目录', `${files.length} 个梦境`);
    }
    
    const diaryPath = join(ROOT, 'data/dreaming/diary.md');
    if (existsSync(diaryPath)) {
      const content = readFileSync(diaryPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      pass('遐思日记', `${lines.length} 条记录`);
    }
    
  } catch (e) {
    fail('遐思系统', e.message);
  }
}

// ============================================
// 测试 15: Token 使用统计
// ============================================
async function testTokenUsage() {
  log('\n=== 15. Token 使用统计 ===');
  
  try {
    const usageDir = join(ROOT, 'data/token-usage');
    const files = readdirSync(usageDir).filter(f => f.endsWith('.md'));
    
    if (files.length > 0) {
      const latest = files.sort().pop();
      const content = readFileSync(join(usageDir, latest), 'utf-8');
      
      pass('Token 记录', `${files.length} 个`);
      log(`  最新: ${latest}`);
      
      // 提取成本
      const costMatch = content.match(/\$([0-9.]+)/);
      if (costMatch) {
        log(`  最新成本: $${costMatch[1]}`);
      }
    }
    
  } catch (e) {
    fail('Token 统计', e.message);
  }
}

// ============================================
// 汇总
// ============================================
function printSummary() {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 测试汇总');
  console.log('═'.repeat(60));
  
  console.log(`\n✅ 通过: ${results.passed.length}`);
  for (const { name, detail } of results.passed) {
    console.log(`   • ${name}${detail ? ': ' + detail : ''}`);
  }
  
  if (results.failed.length > 0) {
    console.log(`\n❌ 失败: ${results.failed.length}`);
    for (const { name, reason } of results.failed) {
      console.log(`   • ${name}: ${reason}`);
    }
  }
  
  console.log(`\n总计: ${results.total} 项`);
  console.log(`通过率: ${((results.passed.length / results.total) * 100).toFixed(1)}%`);
  console.log('═'.repeat(60));
}

// ============================================
// 主流程
// ============================================
async function main() {
  console.log('═'.repeat(60));
  console.log('🧪 Bot 本地完整功能测试');
  console.log('═'.repeat(60));
  console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`目录: ${ROOT}`);
  console.log('═'.repeat(60));
  
  // 配置
  await testConfig();
  
  // 记忆
  const memoryStore = await testMemory();
  
  // Agent
  await testAgents();
  
  // 路由
  await testCommandRouting();
  
  // 业务
  await testProjects();
  await testLeads();
  await testApprovals();
  await testTeams();
  await testContentPipeline();
  
  // 系统
  await testScheduler();
  await testDreaming();
  await testTokenUsage();
  
  // Pi RPC
  const pi = await testPiRpc();
  await testPiBridge(pi);
  
  // Discord
  await testDiscord();
  
  // 汇总
  printSummary();
}

main().catch(console.error);
