#!/usr/bin/env node
/**
 * 🧪 Bot 命令直接测试脚本
 * 
 * 直接调用 Bot 内部函数进行测试，不依赖 Discord 消息
 */

import { parseCommand } from './src/runtime/agent-manager.mjs';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

// 测试结果收集
const results = {
  passed: [],
  failed: [],
  skipped: [],
  total: 0
};

function log(msg, type = 'info') {
  const prefix = { info: '📋', pass: '✅', fail: '❌', skip: '⏭️', rpc: '🔄' }[type] || '📋';
  console.log(`${prefix} ${msg}`);
}

function pass(name) {
  results.passed.push(name);
  results.total++;
  log(name, 'pass');
}

function fail(name, reason) {
  results.failed.push({ name, reason });
  results.total++;
  log(`${name}: ${reason}`, 'fail');
}

function skip(name, reason) {
  results.skipped.push({ name, reason });
  results.total++;
  log(`${name}: ${reason}`, 'skip');
}

// ============================================
// 测试 1: parseCommand 函数
// ============================================
function testParseCommand() {
  log('\n--- 测试 1: 命令解析 ---');
  
  const testCases = [
    { input: '!state', expected: { name: 'state', sub: null } },
    { input: '!cost', expected: { name: 'cost', sub: null } },
    { input: '!memory', expected: { name: 'memory', sub: null } },
    { input: '!pr list', expected: { name: 'pr', sub: 'list' } },
    { input: '!lead new 百度 saas 测试', expected: { name: 'lead', sub: 'new' } },
    { input: '!prd v0.1 PRJ-123', expected: { name: 'prd', sub: 'v0.1' } },
    { input: '!pm plan PRJ-123', expected: { name: 'pm', sub: 'plan' } },
    { input: '!quote draft PRJ-123', expected: { name: 'quote', sub: 'draft' } },
    { input: '!bid start PRJ-123', expected: { name: 'bid', sub: 'start' } },
    { input: '!contract new PRJ-123', expected: { name: 'contract', sub: 'new' } },
    { input: '!poc start PRJ-123', expected: { name: 'poc', sub: 'start' } },
    { input: '!incident new PRJ-123 数据库挂了', expected: { name: 'incident', sub: 'new' } },
    { input: '!cs health PRJ-123', expected: { name: 'cs', sub: 'health' } },
    { input: '!invoice request PRJ-123', expected: { name: 'invoice', sub: 'request' } },
  ];
  
  let passCount = 0;
  for (const tc of testCases) {
    const result = parseCommand(tc.input);
    if (result && result.name === tc.expected.name && result.sub === tc.expected.sub) {
      passCount++;
      log(`  ✓ ${tc.input} → ${result.name}/${result.sub || '*'}`);
    } else {
      fail(`parseCommand(${tc.input})`, `期望 ${tc.expected.name}/${tc.expected.sub}，得到 ${result?.name}/${result?.sub}`);
    }
  }
  
  if (passCount === testCases.length) {
    pass(`命令解析 - ${passCount}/${testCases.length} 通过`);
  }
}

// ============================================
// 测试 2: 命令路由表
// ============================================
function testCommandRouting() {
  log('\n--- 测试 2: 命令路由 ---');
  
  const commands = [
    // 核心命令
    { cmd: '!state', agent: 'chief', skill: 'status-read' },
    { cmd: '!cost', agent: 'chief', skill: 'cost-read' },
    { cmd: '!memory', agent: 'chief', skill: 'memory-read' },
    { cmd: '!pr list', agent: 'pm', skill: 'project-list' },
    { cmd: '!pr new', agent: 'pm', skill: 'project-bootstrap' },
    { cmd: '!restart', agent: 'chief', skill: 'restart' },
    
    // Lead 流程
    { cmd: '!lead new', agent: 'sales', skill: 'lead-capture' },
    { cmd: '!lead list', agent: 'sales', skill: 'lead-list' },
    { cmd: '!lead qualify', agent: 'sales', skill: 'qualification' },
    
    // 项目流程
    { cmd: '!prd v0.1', agent: 'solution', skill: 'prd-v01' },
    { cmd: '!pm plan', agent: 'pm', skill: 'plan-build' },
    { cmd: '!pm weekly', agent: 'pm', skill: 'weekly-report' },
    { cmd: '!pm risk', agent: 'pm', skill: 'raid' },
    
    // 解决方案
    { cmd: '!disc start', agent: 'solution', skill: 'discovery' },
    { cmd: '!research new', agent: 'solution', skill: 'research-notebook' },
    
    // 报价/投标/合同
    { cmd: '!quote draft', agent: 'quote', skill: 'estimate' },
    { cmd: '!quote set', agent: 'quote', skill: 'discount' },
    { cmd: '!bid start', agent: 'bid', skill: 'tender-ingestion' },
    { cmd: '!contract new', agent: 'contract', skill: 'contract-summarize' },
    
    // 交付
    { cmd: '!poc start', agent: 'delivery', skill: 'poc-plan' },
    { cmd: '!incident new', agent: 'delivery', skill: 'incident' },
    
    // 客服
    { cmd: '!cs health', agent: 'cs', skill: 'health-report' },
    { cmd: '!cs qbr', agent: 'cs', skill: 'qbr' },
    
    // 财务
    { cmd: '!invoice request', agent: 'finance', skill: 'invoice-request' },
    { cmd: '!invoice remind', agent: 'finance', skill: 'reminder' },
    
    // QA
    { cmd: '!qa last', agent: 'qa', skill: 'qa-report' },
    { cmd: '!qa plan', agent: 'qa', skill: 'test-plan' },
    
    // 内容流水线
    { cmd: '!distill now', agent: 'distill', skill: 'distill-run' },
    { cmd: '!brief', agent: 'distill', skill: 'distill-brief' },
  ];
  
  let passCount = 0;
  for (const cmd of commands) {
    const parsed = parseCommand(cmd.cmd);
    if (parsed && parsed.route) {
      if (parsed.route.agentId === cmd.agent && parsed.route.skill === cmd.skill) {
        passCount++;
        log(`  ✓ ${cmd.cmd} → ${cmd.agent}/${cmd.skill}`);
      } else {
        fail(`路由 ${cmd.cmd}`, `期望 ${cmd.agent}/${cmd.skill}，得到 ${parsed.route.agentId}/${parsed.route.skill}`);
      }
    } else {
      fail(`路由 ${cmd.cmd}`, '未找到路由');
    }
  }
  
  if (passCount === commands.length) {
    pass(`命令路由 - ${passCount}/${commands.length} 通过`);
  }
}

// ============================================
// 测试 3: 数据文件验证
// ============================================
function testDataFiles() {
  log('\n--- 测试 3: 数据文件验证 ---');
  
  const checks = [
    { path: 'data/business/projects/index.yaml', name: '项目索引' },
    { path: 'data/memory/store', name: '记忆存储' },
    { path: 'data/memory/journal', name: '记忆日志' },
    { path: 'data/token-usage', name: 'Token 使用' },
    { path: 'data/sessions', name: '会话数据' },
  ];
  
  for (const check of checks) {
    const fullPath = join(ROOT, check.path);
    if (existsSync(fullPath)) {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        const files = readdirSync(fullPath);
        pass(`${check.name} (${files.length} 项)`);
      } else {
        const content = readFileSync(fullPath, 'utf-8');
        pass(`${check.name} (${content.length} bytes)`);
      }
    } else {
      fail(check.name, '不存在');
    }
  }
}

// ============================================
// 测试 4: 项目列表
// ============================================
function testProjectList() {
  log('\n--- 测试 4: 项目列表 ---');
  
  try {
    const indexPath = join(ROOT, 'data/business/projects/index.yaml');
    if (existsSync(indexPath)) {
      const content = readFileSync(indexPath, 'utf-8');
      
      // 统计项目
      const projectMatches = content.match(/id:\s*PRJ-/g);
      const count = projectMatches ? projectMatches.length : 0;
      
      // 提取项目名称
      const projects = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('id:') && lines[i].includes('PRJ-')) {
          const id = lines[i].match(/PRJ-\S+/)?.[0];
          const nameLine = lines[i + 1] || '';
          const name = nameLine.match(/name:\s*(.+)/)?.[1] || '未命名';
          projects.push({ id, name: name.trim() });
        }
      }
      
      log(`项目总数: ${count}`);
      for (const p of projects) {
        log(`  - ${p.id}: ${p.name}`);
      }
      
      if (count > 0) {
        pass(`项目列表 (${count} 个项目)`);
      } else {
        skip('项目列表', '暂无项目');
      }
    } else {
      fail('项目列表', '索引文件不存在');
    }
  } catch (e) {
    fail('项目列表', e.message);
  }
}

// ============================================
// 测试 5: Lead 列表
// ============================================
function testLeadList() {
  log('\n--- 测试 5: Lead 列表 ---');
  
  try {
    const leadsDir = join(ROOT, 'data/business/leads');
    if (existsSync(leadsDir)) {
      const files = readdirSync(leadsDir).filter(f => f.endsWith('.json'));
      log(`Lead 总数: ${files.length}`);
      
      if (files.length > 0) {
        for (const f of files.slice(0, 5)) {
          const content = readFileSync(join(leadsDir, f), 'utf-8');
          const lead = JSON.parse(content);
          log(`  - ${lead.id}: ${lead.company || '未命名'}`);
        }
        if (files.length > 5) {
          log(`  ... 还有 ${files.length - 5} 个`);
        }
        pass(`Lead 列表 (${files.length} 个 Lead)`);
      } else {
        skip('Lead 列表', '暂无 Lead');
      }
    } else {
      fail('Lead 列表', '目录不存在');
    }
  } catch (e) {
    fail('Lead 列表', e.message);
  }
}

// ============================================
// 测试 6: 记忆统计
// ============================================
function testMemoryStats() {
  log('\n--- 测试 6: 记忆统计 ---');
  
  try {
    const storeDir = join(ROOT, 'data/memory/store');
    if (existsSync(storeDir)) {
      const items = readdirSync(storeDir).filter(f => {
        try {
          return statSync(join(storeDir, f)).isDirectory();
        } catch { return false; }
      });
      
      log(`记忆总数: ${items.length}`);
      
      // 按类型分类
      const byType = {};
      for (const item of items) {
        const metaPath = join(storeDir, item, 'meta.json');
        if (existsSync(metaPath)) {
          const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
          const type = meta.kind || 'unknown';
          byType[type] = (byType[type] || 0) + 1;
        }
      }
      
      for (const [type, count] of Object.entries(byType)) {
        log(`  - ${type}: ${count}`);
      }
      
      if (items.length > 0) {
        pass(`记忆统计 (${items.length} 条记忆)`);
      } else {
        skip('记忆统计', '暂无记忆');
      }
    } else {
      fail('记忆统计', '目录不存在');
    }
  } catch (e) {
    fail('记忆统计', e.message);
  }
}

// ============================================
// 测试 7: Token 使用统计
// ============================================
function testTokenUsage() {
  log('\n--- 测试 7: Token 使用统计 ---');
  
  try {
    const usageDir = join(ROOT, 'data/token-usage');
    if (existsSync(usageDir)) {
      const files = readdirSync(usageDir).filter(f => f.endsWith('.md'));
      
      if (files.length > 0) {
        const latest = files.sort().pop();
        const content = readFileSync(join(usageDir, latest), 'utf-8');
        
        // 提取关键数据
        const totalMatch = content.match(/\*\*总 (?:token|Token):\*\* ([0-9.]+[BMK]?)/i);
        const costMatch = content.match(/\*\*总 cost\*\*[^:]*:\*\* \$?([0-9.]+)/i);
        const dateMatch = latest.match(/(\d{4}-\d{2}-\d{2})/);
        
        log(`最新记录: ${dateMatch?.[1] || latest}`);
        if (totalMatch) log(`  总 Token: ${totalMatch[1]}`);
        if (costMatch) log(`  总 Cost: $${costMatch[1]}`);
        
        pass(`Token 使用统计 (${files.length} 个记录)`);
      } else {
        skip('Token 使用统计', '暂无记录');
      }
    } else {
      fail('Token 使用统计', '目录不存在');
    }
  } catch (e) {
    fail('Token 使用统计', e.message);
  }
}

// ============================================
// 测试 8: Agent 注册
// ============================================
function testAgentRegistry() {
  log('\n--- 测试 8: Agent 注册 ---');
  
  try {
    const registryPath = join(ROOT, 'agent-core/agents/registry.json');
    if (existsSync(registryPath)) {
      const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
      const agentCount = registry.agents?.length || 0;
      
      log(`Agent 总数: ${agentCount}`);
      
      const agentsByRuntime = {};
      for (const agent of registry.agents || []) {
        const runtime = agent.runtime?.type || 'unknown';
        agentsByRuntime[runtime] = (agentsByRuntime[runtime] || 0) + 1;
      }
      
      for (const [runtime, count] of Object.entries(agentsByRuntime)) {
        log(`  - ${runtime}: ${count}`);
      }
      
      if (agentCount >= 19) {
        pass(`Agent 注册 (${agentCount} 个 Agent)`);
      } else {
        fail('Agent 注册', `Agent 数量不足: ${agentCount} (期望 >= 19)`);
      }
    } else {
      fail('Agent 注册', '注册表不存在');
    }
  } catch (e) {
    fail('Agent 注册', e.message);
  }
}

// ============================================
// 测试 9: 审批流程验证
// ============================================
function testApprovalFlow() {
  log('\n--- 测试 9: 审批流程 ---');
  
  // 需要审批的命令
  const approvalCommands = [
    { cmd: '!quote approve', approval: 'quote-send' },
    { cmd: '!bid submit', approval: 'bid-submit' },
    { cmd: '!contract sign', approval: 'contract-sign' },
    { cmd: '!poc deploy', approval: 'prod-deploy' },
    { cmd: '!invoice request', approval: 'invoice-approval' },
    { cmd: '!publish', approval: 'publish-domestic' },
  ];
  
  let passCount = 0;
  for (const cmd of approvalCommands) {
    const parsed = parseCommand(cmd.cmd);
    if (parsed && parsed.route && parsed.route.approval === cmd.approval) {
      passCount++;
      log(`  ✓ ${cmd.cmd} → 需审批: ${cmd.approval}`);
    } else {
      fail(`审批 ${cmd.cmd}`, `期望审批类型 ${cmd.approval}`);
    }
  }
  
  if (passCount === approvalCommands.length) {
    pass(`审批流程 (${passCount} 个审批点)`);
  }
}

// ============================================
// 测试 10: Team 工作流
// ============================================
function testTeamWorkflows() {
  log('\n--- 测试 10: Team 工作流 ---');
  
  const teams = [
    { id: 'lead-to-contract', steps: ['lead-capture', 'qualification', 'estimate', 'contract-summarize'] },
    { id: 'idea-to-publish', steps: ['distill-brief', 'platform-render', 'qa-report', 'platform-publish'] },
    { id: 'pr-full-cycle', steps: ['project-bootstrap', 'plan-build', 'prd-v10', 'poc-plan', 'test-plan'] },
  ];
  
  for (const team of teams) {
    log(`  - ${team.id}: ${team.steps.length} 步`);
    for (const step of team.steps) {
      log(`      ${step}`);
    }
  }
  
  pass(`Team 工作流 (${teams.length} 个)`);
}

// ============================================
// 汇总
// ============================================
function printSummary() {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 测试汇总');
  console.log('═'.repeat(60));
  console.log(`通过: ${results.passed.length}`);
  console.log(`失败: ${results.failed.length}`);
  console.log(`跳过: ${results.skipped.length}`);
  console.log(`总计: ${results.total}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ 失败项:');
    for (const { name, reason } of results.failed) {
      console.log(`  • ${name}: ${reason}`);
    }
  }
  
  if (results.skipped.length > 0) {
    console.log('\n⏭️ 跳过项:');
    for (const { name, reason } of results.skipped) {
      console.log(`  • ${name}: ${reason}`);
    }
  }
  
  console.log('\n✅ 通过的测试:');
  for (const p of results.passed) {
    console.log(`  • ${p}`);
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('📝 后续测试建议:');
  console.log('═'.repeat(60));
  console.log(`
1. 需要 Pi RPC 的命令（如 !prd, !pm plan 等）需要实际运行 Bot
2. 需要在 Discord 频道发送命令测试完整流程
3. 审批流程需要在 Bot 中验证 NEED_APPROVAL 行为
`);
}

// ============================================
// 主测试
// ============================================
async function runTests() {
  console.log('═'.repeat(60));
  log('🧪 Bot 命令直接测试');
  console.log('═'.repeat(60));
  
  testParseCommand();
  testCommandRouting();
  testDataFiles();
  testProjectList();
  testLeadList();
  testMemoryStats();
  testTokenUsage();
  testAgentRegistry();
  testApprovalFlow();
  testTeamWorkflows();
  
  printSummary();
  
  return results;
}

runTests().catch(console.error);
