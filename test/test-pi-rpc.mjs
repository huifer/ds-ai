#!/usr/bin/env node
/**
 * 🧪 Pi RPC 命令测试
 * 
 * 测试 Pi RPC 调用的完整流程
 */

import { spawn } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

// 测试结果
const results = {
  passed: [],
  failed: [],
  rpcTests: [],
  total: 0
};

function log(msg, type = 'info') {
  const prefix = { info: '📋', pass: '✅', fail: '❌', rpc: '🔄', warn: '⚠️' }[type] || '📋';
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

function rpc(name, result) {
  results.rpcTests.push({ name, result });
  log(`${name}: ${result}`, 'rpc');
}

// ============================================
// 测试 Pi RPC 连接
// ============================================
async function testPiRpcConnection() {
  log('\n--- 测试 Pi RPC 连接 ---');
  
  // 检查 Pi 配置
  const envPath = join(ROOT, '.env');
  const env = parseEnv(readFileSync(envPath, 'utf-8'));
  
  if (env.PI_RPC_PORT) {
    log(`Pi RPC Port: ${env.PI_RPC_PORT}`);
    
    // 尝试连接
    try {
      const result = await testPiRpcPort(env.PI_RPC_PORT);
      if (result) {
        pass('Pi RPC 连接');
      } else {
        fail('Pi RPC 连接', '无法连接');
      }
    } catch (e) {
      fail('Pi RPC 连接', e.message);
    }
  } else {
    log('PI_RPC_PORT 未配置，尝试 Pi Session 模式', 'warn');
    
    // 检查 PI_SESSION_DIR
    if (env.PI_SESSION_DIR) {
      log(`PI_SESSION_DIR: ${env.PI_SESSION_DIR}`);
      const sessions = readdirSync(env.PI_SESSION_DIR).filter(f => 
        statSync(join(env.PI_SESSION_DIR, f)).isDirectory()
      );
      log(`活跃 Session: ${sessions.length}`);
      pass(`Pi Session 模式 (${sessions.length} 个 Session)`);
    } else {
      fail('Pi 配置', '未配置 PI_RPC_PORT 或 PI_SESSION_DIR');
    }
  }
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

import http from 'node:http';

async function testPiRpcPort(port) {
  return new Promise((resolve) => {
    
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/health',
      method: 'GET',
      timeout: 3000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch {
          resolve({ status: 'ok', raw: data });
        }
      });
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// ============================================
// 测试 Skill 文件
// ============================================
function testSkillFiles() {
  log('\n--- 测试 Skill 文件 ---');
  
  const skillDirs = [
    'agent-core/agents/skills',
    'extensions/skills',
  ];
  
  let totalSkills = 0;
  for (const dir of skillDirs) {
    const fullPath = join(ROOT, dir);
    if (existsSync(fullPath)) {
      const skills = readdirSync(fullPath).filter(f => f.endsWith('.md'));
      log(`${dir}: ${skills.length} 个 Skill`);
      totalSkills += skills.length;
    }
  }
  
  if (totalSkills > 0) {
    pass(`Skill 文件 (${totalSkills} 个)`);
  } else {
    fail('Skill 文件', '未找到 Skill');
  }
}

// ============================================
// 测试 Agent Session
// ============================================
function testAgentSessions() {
  log('\n--- 测试 Agent Session ---');
  
  const sessionsDir = join(ROOT, 'data/sessions');
  if (existsSync(sessionsDir)) {
    const sessions = readdirSync(sessionsDir).filter(f => 
      statSync(join(sessionsDir, f)).isDirectory()
    );
    
    log(`会话总数: ${sessions.length}`);
    
    // 检查每个会话
    for (const session of sessions.slice(0, 5)) {
      const sessionPath = join(sessionsDir, session);
      const files = readdirSync(sessionPath);
      log(`  - ${session}: ${files.length} 个文件`);
    }
    
    if (sessions.length > 0) {
      pass(`Agent Session (${sessions.length} 个)`);
    } else {
      skip('Agent Session', '暂无 Session');
    }
  }
}

function skip(name, reason) {
  log(`${name}: ${reason}`, 'warn');
}

// ============================================
// 测试 Pi Bridge
// ============================================
function testPiBridge() {
  log('\n--- 测试 Pi Bridge ---');
  
  const piBridgePath = join(ROOT, 'src/runtime/pi-bridge.mjs');
  if (existsSync(piBridgePath)) {
    const content = readFileSync(piBridgePath, 'utf-8');
    
    // 检查关键方法
    const methods = ['prompt', 'invokeSkill', 'call', 'getStatus'];
    for (const method of methods) {
      if (content.includes(method)) {
        log(`  ✓ ${method}`);
      }
    }
    
    pass('Pi Bridge 代码');
  } else {
    fail('Pi Bridge', '文件不存在');
  }
}

// ============================================
// 测试 Skill Loader
// ============================================
function testSkillLoader() {
  log('\n--- 测试 Skill Loader ---');
  
  const skillLoaderPath = join(ROOT, 'src/runtime/skill-loader.mjs');
  if (existsSync(skillLoaderPath)) {
    const content = readFileSync(skillLoaderPath, 'utf-8');
    
    // 检查关键方法
    const methods = ['loadSkill', 'getSkill', 'warmup', 'listSkills'];
    let methodCount = 0;
    for (const method of methods) {
      if (content.includes(method)) {
        methodCount++;
        log(`  ✓ ${method}`);
      }
    }
    
    if (methodCount >= 2) {
      pass(`Skill Loader (${methodCount} 个方法)`);
    }
  } else {
    fail('Skill Loader', '文件不存在');
  }
}

// ============================================
// 测试审批流程
// ============================================
function testApproval() {
  log('\n--- 测试审批流程 ---');
  
  const approvalPath = join(ROOT, 'src/runtime/approval.mjs');
  if (existsSync(approvalPath)) {
    const content = readFileSync(approvalPath, 'utf-8');
    
    // 检查关键方法
    const methods = ['requireApproval', 'approve', 'reject', 'list'];
    let methodCount = 0;
    for (const method of methods) {
      if (content.includes(method)) {
        methodCount++;
        log(`  ✓ ${method}`);
      }
    }
    
    pass(`审批流程 (${methodCount} 个方法)`);
  } else {
    fail('审批流程', '文件不存在');
  }
  
  // 检查审批数据
  const approvalDir = join(ROOT, 'data/approvals');
  if (existsSync(approvalDir)) {
    const files = readdirSync(approvalDir).filter(f => f.endsWith('.json'));
    log(`待审批: ${files.length} 个`);
  }
}

// ============================================
// 测试内容流水线
// ============================================
function testContentPipeline() {
  log('\n--- 测试内容流水线 ---');
  
  const pipelineDirs = [
    'data/content/inbox',
    'data/content/distilled',
    'data/content/rendered',
    'data/content/published',
  ];
  
  let totalFiles = 0;
  for (const dir of pipelineDirs) {
    const fullPath = join(ROOT, dir);
    if (existsSync(fullPath)) {
      const files = readdirSync(fullPath).filter(f => f.endsWith('.json'));
      log(`  ${dir}: ${files.length} 个文件`);
      totalFiles += files.length;
    }
  }
  
  if (totalFiles > 0) {
    pass(`内容流水线 (${totalFiles} 个文件)`);
  } else {
    skip('内容流水线', '暂无内容');
  }
}

// ============================================
// 测试 Scheduler
// ============================================
function testScheduler() {
  log('\n--- 测试调度器 ---');
  
  // 检查日志中的调度任务
  const logPath = join(ROOT, 'logs/orchestrator.log');
  if (existsSync(logPath)) {
    const content = readFileSync(logPath, 'utf-8');
    
    // 提取注册的调度任务
    const match = content.match(/jobs:\s*(.+)/);
    if (match) {
      const jobs = match[1].split(',').map(j => j.trim()).filter(Boolean);
      log(`调度任务: ${jobs.length} 个`);
      
      for (const job of jobs.slice(0, 10)) {
        log(`  - ${job}`);
      }
      
      pass(`调度器 (${jobs.length} 个任务)`);
    }
  } else {
    fail('调度器', '日志文件不存在');
  }
}

// ============================================
// 测试遐思系统
// ============================================
function testDreamingSystem() {
  log('\n--- 测试遐思系统 ---');
  
  const dreamingDir = join(ROOT, 'data/dreams');
  if (existsSync(dreamingDir)) {
    const files = readdirSync(dreamingDir).filter(f => f.endsWith('.json'));
    log(`梦境记录: ${files.length} 个`);
    
    if (files.length > 0) {
      // 读取最新的梦境
      const latest = files.sort().pop();
      const content = readFileSync(join(dreamingDir, latest), 'utf-8');
      try {
        const dream = JSON.parse(content);
        log(`最新梦境: ${dream.type || 'unknown'} (${dream.status || 'unknown'})`);
      } catch {
        log('最新梦境: 格式异常');
      }
      
      pass(`遐思系统 (${files.length} 个梦境)`);
    } else {
      skip('遐思系统', '暂无梦境');
    }
  }
}

// ============================================
// 汇总
// ============================================
function printSummary() {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Pi RPC 测试汇总');
  console.log('═'.repeat(60));
  console.log(`通过: ${results.passed.length}`);
  console.log(`失败: ${results.failed.length}`);
  console.log(`总计: ${results.total}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ 失败项:');
    for (const { name, reason } of results.failed) {
      console.log(`  • ${name}: ${reason}`);
    }
  }
  
  console.log('\n✅ 通过的测试:');
  for (const p of results.passed) {
    console.log(`  • ${p}`);
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('📝 完整测试建议:');
  console.log('═'.repeat(60));
  console.log(`
下一步需要在 Discord 频道手动测试以下命令:

第一批（本地命令）:
  !state      → 验证 Agent 状态表
  !cost       → 验证 Token 用量摘要
  !memory     → 验证记忆统计

第二批（Pi RPC 命令）:
  !pr list    → 验证项目列表
  !lead list  → 验证 Lead 列表
  !prd v0.1 <PRJ-ID>  → 验证 PRD 生成

第三批（审批流程）:
  !quote approve <PRJ-ID>  → 验证 NEED_APPROVAL
`);
}

// ============================================
// 主测试
// ============================================
async function runTests() {
  console.log('═'.repeat(60));
  log('🧪 Pi RPC 命令测试');
  console.log('═'.repeat(60));
  
  await testPiRpcConnection();
  testSkillFiles();
  testAgentSessions();
  testPiBridge();
  testSkillLoader();
  testApproval();
  testContentPipeline();
  testScheduler();
  testDreamingSystem();
  
  printSummary();
  
  return results;
}

runTests().catch(console.error);
