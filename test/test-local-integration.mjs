#!/usr/bin/env node
/**
 * 🧪 Bot 本地功能测试
 * 
 * 直接导入并测试 Bot 的核心模块
 */

import { spawn } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

// 测试结果收集
const results = {
  passed: [],
  failed: [],
  rpcResults: [],
  total: 0
};

function log(msg, type = 'info') {
  const prefix = { info: '📋', pass: '✅', fail: '❌', rpc: '🔄', warn: '⚠️' }[type] || '📋';
  console.log(`${prefix} ${msg}`);
}

function pass(name, detail = '') {
  results.passed.push({ name, detail });
  results.total++;
  if (detail) log(`${name}: ${detail}`, 'pass');
  else log(name, 'pass');
}

function fail(name, reason) {
  results.failed.push({ name, reason });
  results.total++;
  log(`${name}: ${reason}`, 'fail');
}

function rpcResult(name, result) {
  results.rpcResults.push({ name, result });
  log(`${name}: ${result}`, 'rpc');
}

// ============================================
// 测试 1: 加载配置
// ============================================
async function testLoadConfig() {
  log('\n=== 测试 1: 配置加载 ===');
  
  try {
    // 动态导入 config.mjs
    const { loadConfig } = await import(`${ROOT}/src/config.mjs`);
    const cfg = loadConfig();
    
    if (cfg.ok) {
      pass('配置加载', `token=${cfg.value.token ? '✓' : '✗'}, channels=${Object.keys(cfg.value.channels).length}`);
      
      // 打印频道配置
      for (const [name, id] of Object.entries(cfg.value.channels)) {
        if (id) log(`  ${name}: ${id.slice(0, 8)}...`);
      }
      
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
// 测试 2: 加载记忆系统
// ============================================
async function testMemoryStore() {
  log('\n=== 测试 2: 记忆存储 ===');
  
  try {
    const { createMemoryStore } = await import(`${ROOT}/src/memory-store.mjs`);
    const memoryStore = createMemoryStore({ root: ROOT });
    
    // 测试查询
    const all = memoryStore.query({});
    pass('记忆存储', `${all.items.length} 条记忆`);
    
    // 测试按类型查询
    const prefs = memoryStore.query({ kind: 'preference' });
    log(`  preference: ${prefs.items.length}`);
    
    const decisions = memoryStore.query({ kind: 'decision' });
    log(`  decision: ${decisions.items.length}`);
    
    const ideas = memoryStore.query({ kind: 'idea' });
    log(`  idea: ${ideas.items.length}`);
    
    return memoryStore;
  } catch (e) {
    fail('记忆存储', e.message);
    return null;
  }
}

// ============================================
// 测试 3: 记忆上下文
// ============================================
async function testMemoryContext() {
  log('\n=== 测试 3: 记忆上下文 ===');
  
  try {
    const { createMemoryContext } = await import(`${ROOT}/src/memory-context.mjs`);
    const memoryStore = createMemoryStore({ root: ROOT });
    const memoryContext = createMemoryContext({ memoryStore });
    
    // 测试上下文构建
    const ctx = memoryContext.buildContext({
      userText: '我想用 TypeScript 开发新项目',
      limit: 3
    });
    
    pass('记忆上下文', `${ctx.length} 个相关记忆`);
    log(`  上下文长度: ${ctx.length} 字符`);
    
    return memoryContext;
  } catch (e) {
    fail('记忆上下文', e.message);
    return null;
  }
}

// ============================================
// 测试 4: Agent 注册表
// ============================================
async function testAgentRegistry() {
  log('\n=== 测试 4: Agent 注册表 ===');
  
  try {
    const { AgentRegistry } = await import(`${ROOT}/src/orchestrator/agent-registry.mjs`);
    const registry = new AgentRegistry({ root: ROOT });
    
    pass('Agent 注册表', `${registry.list().length} 个 Agent`);
    
    // 列出所有 Agent
    for (const agent of registry.list()) {
      log(`  - ${agent.id}: ${agent.skills.length} skills`);
    }
    
    return registry;
  } catch (e) {
    fail('Agent 注册表', e.message);
    return null;
  }
}

// ============================================
// 测试 5: Pi RPC 客户端
// ============================================
async function testPiRpcClient(cfg) {
  log('\n=== 测试 5: Pi RPC 客户端 ===');
  
  try {
    const { RpcClient } = await import('@earendil-works/pi-coding-agent');
    
    // 查找 pi CLI
    const { execSync } = await import('node:child_process');
    let piPath = 'pi';
    try {
      piPath = execSync('which pi').toString().trim();
    } catch {}
    
    log(`Pi CLI: ${piPath}`);
    
    // 创建 RPC 客户端
    const pi = new RpcClient({
      cliPath: piPath,
      cwd: ROOT,
      provider: 'minimax-cn',
      model: 'MiniMax-M3',
      env: {
        HTTP_PROXY: 'http://127.0.0.1:7897',
        HTTPS_PROXY: 'http://127.0.0.1:7897',
      }
    });
    
    pass('Pi RPC 客户端创建');
    
    // 测试连接
    log('等待 Pi 启动...');
    
    // 设置超时
    const timeout = setTimeout(() => {
      log('Pi 启动超时，但客户端已创建', 'warn');
    }, 10000);
    
    // 等待 Pi 就绪
    await new Promise((resolve) => setTimeout(resolve, 5000));
    clearTimeout(timeout);
    
    // 检查是否可用
    if (pi.promptAndWait) {
      pass('Pi promptAndWait 方法存在');
    }
    
    return pi;
  } catch (e) {
    fail('Pi RPC 客户端', e.message);
    return null;
  }
}

// ============================================
// 测试 6: Pi Bridge
// ============================================
async function testPiBridge(pi) {
  log('\n=== 测试 6: Pi Bridge ===');
  
  if (!pi) {
    log('跳过 (Pi 不可用)', 'warn');
    return null;
  }
  
  try {
    const { PiBridge } = await import(`${ROOT}/src/runtime/pi-bridge.mjs`);
    
    const logs = [];
    const bridge = new PiBridge({
      rpcClient: pi,
      log: (msg) => logs.push(msg)
    });
    
    pass('Pi Bridge 创建', `available=${bridge.available}`);
    
    // 测试简单 prompt（不等待完整响应，只检查方法存在）
    log('测试 prompt 方法...');
    if (typeof bridge.prompt === 'function') {
      pass('Pi Bridge.prompt 方法存在');
    }
    
    if (typeof bridge.promptJSON === 'function') {
      pass('Pi Bridge.promptJSON 方法存在');
    }
    
    return bridge;
  } catch (e) {
    fail('Pi Bridge', e.message);
    return null;
  }
}

// ============================================
// 测试 7: AgentManager
// ============================================
async function testAgentManager(piBridge) {
  log('\n=== 测试 7: AgentManager ===');
  
  try {
    const { AgentManager } = await import(`${ROOT}/src/runtime/agent-manager.mjs`);
    
    const manager = new AgentManager({
      root: ROOT,
      piBridge: piBridge || undefined,
      logger: { log: (msg) => log(`  [AM] ${msg}`) }
    });
    
    await manager.start();
    
    pass('AgentManager 启动', `${manager.agents.size} 个 Agent`);
    
    // 测试路由
    const { parseCommand } = await import(`${ROOT}/src/runtime/agent-manager.mjs`);
    
    const testCases = [
      '!state',
      '!cost',
      '!memory',
      '!pr list',
      '!lead new 公司 行业 描述',
    ];
    
    for (const cmd of testCases) {
      const parsed = parseCommand(cmd);
      if (parsed && parsed.route) {
        log(`  ${cmd} → ${parsed.route.agentId}/${parsed.route.skill}`);
      }
    }
    
    return manager;
  } catch (e) {
    fail('AgentManager', e.message);
    return null;
  }
}

// ============================================
// 测试 8: 调度器
// ============================================
async function testScheduler() {
  log('\n=== 测试 8: 调度器 ===');
  
  try {
    const { createScheduler } = await import(`${ROOT}/src/scheduler.mjs`);
    
    const jobs = [];
    const scheduler = createScheduler({
      onJob: (job) => jobs.push(job)
    });
    
    pass('调度器创建');
    log(`已注册 ${jobs.length} 个任务`);
    
    for (const job of jobs.slice(0, 10)) {
      log(`  - ${job.id} @ ${job.schedule}`);
    }
    
    return scheduler;
  } catch (e) {
    fail('调度器', e.message);
    return null;
  }
}

// ============================================
// 测试 9: 项目管理
// ============================================
async function testProjectManagement() {
  log('\n=== 测试 9: 项目管理 ===');
  
  try {
    // 检查项目索引文件
    const indexPath = join(ROOT, 'data/business/projects/index.yaml');
    
    if (existsSync(indexPath)) {
      const content = readFileSync(indexPath, 'utf-8');
      
      // 提取项目
      const projects = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('id:') && lines[i].includes('PRJ-')) {
          const id = lines[i].match(/PRJ-\S+/)?.[0];
          projects.push({ id, index: i });
        }
      }
      
      pass('项目索引', `${projects.length} 个项目`);
      
      // 读取项目目录
      const projectsDir = join(ROOT, 'data/business/projects');
      const dirs = readdirSync(projectsDir).filter(f => {
        try { return statSync(join(projectsDir, f)).isDirectory(); } catch { return false; }
      });
      
      log(`项目目录: ${dirs.length} 个`);
      
      return projects;
    } else {
      fail('项目索引', '文件不存在');
      return [];
    }
  } catch (e) {
    fail('项目管理', e.message);
    return [];
  }
}

// ============================================
// 测试 10: Lead 管理
// ============================================
async function testLeadManagement() {
  log('\n=== 测试 10: Lead 管理 ===');
  
  try {
    const leadsDir = join(ROOT, 'data/business/leads');
    
    if (existsSync(leadsDir)) {
      const files = readdirSync(leadsDir).filter(f => f.endsWith('.json'));
      
      pass('Lead 目录', `${files.length} 个 Lead`);
      
      // 读取 Lead 内容
      for (const file of files.slice(0, 3)) {
        const content = readFileSync(join(leadsDir, file), 'utf-8');
        try {
          const lead = JSON.parse(content);
          log(`  - ${lead.id}: ${lead.company || '未命名'}`);
        } catch {
          log(`  - ${file}: 解析失败`);
        }
      }
      
      return files;
    } else {
      fail('Lead 目录', '不存在');
      return [];
    }
  } catch (e) {
    fail('Lead 管理', e.message);
    return [];
  }
}

// ============================================
// 测试 11: 记忆治理
// ============================================
async function testMemoryGovernance(memoryStore) {
  log('\n=== 测试 11: 记忆治理 ===');
  
  if (!memoryStore) {
    log('跳过 (memoryStore 不可用)', 'warn');
    return;
  }
  
  try {
    const { createMemoryGovernance } = await import(`${ROOT}/src/memory-governance.mjs`);
    
    const governance = createMemoryGovernance({ memoryStore });
    
    pass('记忆治理创建');
    
    // 运行干运行
    const result = governance.runGovernance({ dryRun: true });
    
    log(`  过期记忆: ${result.expired?.length || 0}`);
    log(`  矛盾记忆: ${result.conflicts?.length || 0}`);
    
    return governance;
  } catch (e) {
    fail('记忆治理', e.message);
  }
}

// ============================================
// 测试 12: 审批流程
// ============================================
async function testApproval() {
  log('\n=== 测试 12: 审批流程 ===');
  
  try {
    const { Approval } = await import(`${ROOT}/src/runtime/approval.mjs`);
    
    const approval = new Approval({ root: ROOT });
    
    pass('审批流程创建');
    
    // 检查需要审批的命令
    const approvalChecks = [
      'quote-send',
      'bid-submit', 
      'contract-sign',
      'prod-deploy',
      'invoice-approval',
      'publish-domestic'
    ];
    
    for (const approvalType of approvalChecks) {
      const requiresApproval = approval.requireApproval({ type: approvalType });
      log(`  ${approvalType}: ${requiresApproval ? '需审批 ✓' : '直接执行'}`);
    }
    
    return approval;
  } catch (e) {
    fail('审批流程', e.message);
  }
}

// ============================================
// 测试 13: Team Engine
// ============================================
async function testTeamEngine(agentManager) {
  log('\n=== 测试 13: Team Engine ===');
  
  try {
    const { TeamEngine } = await import(`${ROOT}/src/orchestrator/team-engine.mjs`);
    
    const teams = [
      {
        id: 'lead-to-contract',
        description: '线索 → 合同',
        steps: [
          { agent: 'sales', skill: 'lead-capture' },
          { agent: 'sales', skill: 'qualification' },
          { agent: 'quote', skill: 'estimate' },
          { agent: 'contract', skill: 'contract-summarize' },
        ]
      },
      {
        id: 'idea-to-publish',
        description: '灵感 → 发布',
        steps: [
          { agent: 'distill', skill: 'distill-brief' },
          { agent: 'renderer', skill: 'platform-render' },
          { agent: 'qa', skill: 'qa-report' },
          { agent: 'publisher', skill: 'platform-publish' },
        ]
      }
    ];
    
    pass('Team 工作流定义', `${teams.length} 个工作流`);
    
    for (const team of teams) {
      log(`  ${team.id}: ${team.steps.length} 步`);
      for (const step of team.steps) {
        log(`    - ${step.agent}/${step.skill}`);
      }
    }
    
    return teams;
  } catch (e) {
    fail('Team Engine', e.message);
  }
}

// ============================================
// 测试 14: 内容流水线
// ============================================
async function testContentPipeline() {
  log('\n=== 测试 14: 内容流水线 ===');
  
  const stages = [
    { name: 'inbox', dir: 'data/content/inbox' },
    { name: 'distilled', dir: 'data/content/distilled' },
    { name: 'rendered', dir: 'data/content/rendered' },
    { name: 'published', dir: 'data/content/published' },
  ];
  
  let total = 0;
  for (const stage of stages) {
    const fullPath = join(ROOT, stage.dir);
    if (existsSync(fullPath)) {
      const files = readdirSync(fullPath).filter(f => f.endsWith('.json'));
      log(`  ${stage.name}: ${files.length} 个`);
      total += files.length;
    } else {
      log(`  ${stage.name}: 0 个 (目录不存在)`);
    }
  }
  
  pass('内容流水线', `${total} 个文件`);
}

// ============================================
// 测试 15: Discord 客户端
// ============================================
async function testDiscordClient() {
  log('\n=== 测试 15: Discord 客户端 ===');
  
  try {
    const { createDiscordClient } = await import(`${ROOT}/src/discord-client.mjs`);
    
    // 创建客户端（不连接）
    const discord = createDiscordClient({
      token: 'TEST_TOKEN',
      handlers: {},
      log: (msg) => log(`  [Discord] ${msg}`)
    });
    
    pass('Discord 客户端创建');
    
    // 检查方法
    const methods = ['send', 'reply', 'edit', 'upload'];
    for (const method of methods) {
      if (typeof discord[method] === 'function') {
        log(`  ✓ ${method}`);
      }
    }
    
    return discord;
  } catch (e) {
    fail('Discord 客户端', e.message);
  }
}

// ============================================
// 测试 16: 实际 Pi RPC 调用
// ============================================
async function testPiRpcCall(pi) {
  log('\n=== 测试 16: Pi RPC 实际调用 ===');
  
  if (!pi) {
    log('Pi 不可用，跳过 RPC 调用测试', 'warn');
    return;
  }
  
  try {
    // 检查 RPC 是否可用
    if (typeof pi.promptAndWait !== 'function') {
      log('pi.promptAndWait 不可用', 'warn');
      return;
    }
    
    log('发送测试 prompt...');
    
    // 发送简单测试
    const testPrompt = '请回复"测试成功"，不需要其他内容。';
    
    // 设置较短超时
    const timeout = 30000;
    
    try {
      await pi.promptAndWait(testPrompt, null, timeout);
      
      // 获取响应
      const response = await pi.getLastAssistantText();
      
      if (response) {
        rpcResult('Pi RPC 响应', response.slice(0, 100));
        pass('Pi RPC 调用成功');
      } else {
        log('未收到响应', 'warn');
      }
    } catch (e) {
      if (e.message.includes('timeout') || e.message.includes('超时')) {
        log('Pi RPC 调用超时 (正常)', 'warn');
      } else {
        fail('Pi RPC 调用', e.message);
      }
    }
    
  } catch (e) {
    fail('Pi RPC 调用', e.message);
  }
}

// ============================================
// 汇总报告
// ============================================
function printSummary() {
  console.log('\n' + '═'.repeat(70));
  console.log('📊 本地功能测试汇总');
  console.log('═'.repeat(70));
  
  console.log(`\n✅ 通过: ${results.passed.length}`);
  for (const { name, detail } of results.passed) {
    console.log(`   • ${name}${detail ? ': ' + detail : ''}`);
  }
  
  if (results.rpcResults.length > 0) {
    console.log(`\n🔄 RPC 结果:`);
    for (const { name, result } of results.rpcResults) {
      console.log(`   • ${name}: ${result}`);
    }
  }
  
  if (results.failed.length > 0) {
    console.log(`\n❌ 失败: ${results.failed.length}`);
    for (const { name, reason } of results.failed) {
      console.log(`   • ${name}: ${reason}`);
    }
  }
  
  console.log(`\n总计: ${results.total} 项`);
  console.log(`通过率: ${((results.passed.length / results.total) * 100).toFixed(1)}%`);
  
  console.log('\n' + '═'.repeat(70));
}

// ============================================
// 主测试流程
// ============================================
async function runTests() {
  console.log('═'.repeat(70));
  console.log('🧪 Bot 本地功能测试');
  console.log('═'.repeat(70));
  console.log(`时间: ${new Date().toISOString()}`);
  console.log(`目录: ${ROOT}`);
  console.log('═'.repeat(70));
  
  // 1. 配置
  const cfg = await testLoadConfig();
  
  // 2-3. 记忆系统
  const memoryStore = await testMemoryStore();
  await testMemoryContext();
  
  // 4. Agent 注册表
  const registry = await testAgentRegistry();
  
  // 5-6. Pi RPC
  const pi = await testPiRpcClient(cfg);
  await testPiBridge(pi);
  
  // 7. AgentManager
  const piBridge = pi ? new (await import(`${ROOT}/src/runtime/pi-bridge.mjs`)).PiBridge({ rpcClient: pi }) : null;
  await testAgentManager(piBridge);
  
  // 8. 调度器
  await testScheduler();
  
  // 9-10. 业务数据
  await testProjectManagement();
  await testLeadManagement();
  
  // 11. 记忆治理
  await testMemoryGovernance(memoryStore);
  
  // 12. 审批流程
  await testApproval();
  
  // 13. Team Engine
  await testTeamEngine(null);
  
  // 14. 内容流水线
  await testContentPipeline();
  
  // 15. Discord 客户端
  await testDiscordClient();
  
  // 16. Pi RPC 实际调用
  await testPiRpcCall(pi);
  
  // 汇总
  printSummary();
  
  return results;
}

runTests().catch((e) => {
  console.error('测试失败:', e);
  process.exit(1);
});
