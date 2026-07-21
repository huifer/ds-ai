#!/usr/bin/env node
/**
 * 🧪 工作流测试脚本 - 第一批：核心基础命令
 * 
 * 说明：
 * - 本地命令：可以直接本地验证
 * - Pi RPC 命令：需要向 Bot 发送消息测试
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 测试结果收集
const results = {
  passed: [],
  failed: [],
  skipped: [],
  total: 0
};

function log(msg, type = 'info') {
  const prefix = {
    info: '📋',
    pass: '✅',
    fail: '❌',
    skip: '⏭️',
    warn: '⚠️',
    rpc: '🔄'
  }[type] || '📋';
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
// 命令路由表（来自 command-router.mjs）
// ============================================
const COMMANDS = {
  // 内容流水线
  '!intake now': { agent: 'intake', type: 'pi-rpc', desc: '手动触发内容采集' },
  '!distill now': { agent: 'distill', type: 'pi-rpc', desc: '手动触发素材蒸馏' },
  '!brief': { agent: 'distill', type: 'pi-rpc', desc: '生成内容 brief' },
  '!render': { agent: 'renderer', type: 'pi-rpc', desc: '渲染内容到指定平台' },
  '!publish': { agent: 'publisher', type: 'pi-rpc', desc: '发布到指定平台(需审批)' },
  '!qa last': { agent: 'qa', type: 'pi-rpc', desc: '查看 QA 报告' },
  '!qa plan': { agent: 'qa', type: 'pi-rpc', desc: '生成测试计划' },
  '!qa accept': { agent: 'qa', type: 'pi-rpc', desc: '验收测试' },
  '!qa defect': { agent: 'qa', type: 'pi-rpc', desc: '上报缺陷' },
  
  // 项目管理
  '!pr new': { agent: 'pm', type: 'pi-rpc', desc: '创建新项目' },
  '!pr list': { agent: 'pm', type: 'pi-rpc', desc: '列出项目' },
  '!build stage': { agent: 'pm', type: 'pi-rpc', desc: '推进阶段门' },
  '!pm plan': { agent: 'project', type: 'pi-rpc', desc: '构建项目计划' },
  '!pm weekly': { agent: 'project', type: 'pi-rpc', desc: '生成周报' },
  '!pm risk': { agent: 'project', type: 'pi-rpc', desc: '风险管理 RAID' },
  
  // 销售与合同
  '!lead new': { agent: 'sales', type: 'pi-rpc', desc: '录入新线索' },
  '!lead list': { agent: 'sales', type: 'pi-rpc', desc: '列出线索' },
  '!lead qualify': { agent: 'sales', type: 'pi-rpc', desc: '线索资质评估' },
  '!quote draft': { agent: 'quote', type: 'pi-rpc', desc: '起草报价' },
  '!quote set': { agent: 'quote', type: 'pi-rpc', desc: '设置折扣' },
  '!quote approve': { agent: 'chief', type: 'pi-rpc', desc: '审批报价(需审批)' },
  '!bid start': { agent: 'bid', type: 'pi-rpc', desc: '启动投标' },
  '!bid compliance': { agent: 'bid', type: 'pi-rpc', desc: '投标合规检查' },
  '!bid submit': { agent: 'chief', type: 'pi-rpc', desc: '提交投标(需审批)' },
  '!contract new': { agent: 'contract', type: 'pi-rpc', desc: '新建合同摘要' },
  '!contract risk': { agent: 'contract', type: 'pi-rpc', desc: '合同风险登记' },
  '!contract sign': { agent: 'chief', type: 'pi-rpc', desc: '签合同(需审批)' },
  
  // 解决方案
  '!prd v0.1': { agent: 'solution', type: 'pi-rpc', desc: '生成 PRD v0.1' },
  '!prd v1.0': { agent: 'solution', type: 'pi-rpc', desc: '生成 PRD v1.0' },
  '!prd diff': { agent: 'solution', type: 'pi-rpc', desc: 'PRD diff' },
  '!research new': { agent: 'solution', type: 'pi-rpc', desc: '新建调研' },
  '!disc start': { agent: 'solution', type: 'pi-rpc', desc: '启动 Discovery' },
  
  // 开发
  '!demo new': { agent: 'coding', type: 'pi-rpc', desc: '新建 React demo' },
  '!demo run': { agent: 'coding', type: 'pi-rpc', desc: '运行 demo' },
  
  // 交付与运维
  '!poc start': { agent: 'delivery', type: 'pi-rpc', desc: '启动 POC' },
  '!poc deploy': { agent: 'chief', type: 'pi-rpc', desc: '部署到生产(需审批)' },
  '!incident': { agent: 'delivery', type: 'pi-rpc', desc: '处理事故' },
  
  // 客户成功
  '!cs document': { agent: 'cs', type: 'pi-rpc', desc: '客户文档脱敏' },
  '!cs health': { agent: 'cs', type: 'pi-rpc', desc: '客户健康度报告' },
  '!cs qbr': { agent: 'cs', type: 'pi-rpc', desc: 'QBR 报告' },
  
  // 财务
  '!invoice request': { agent: 'finance', type: 'pi-rpc', desc: '申请开票(需审批)' },
  '!invoice remind': { agent: 'finance', type: 'pi-rpc', desc: '催收提醒' },
  
  // 总控 / 审批
  '!state': { agent: 'chief', type: 'pi-rpc', desc: '查看 Agent 状态' },
  '!restart': { agent: 'chief', type: 'pi-rpc', desc: '重启 Agent' },
  '!cost': { agent: 'chief', type: 'pi-rpc', desc: '查看成本' },
  '!memory': { agent: 'chief', type: 'pi-rpc', desc: '查看记忆' },
  '!approve': { agent: 'approver', type: 'pi-rpc', desc: '批准审批项' },
  '!reject': { agent: 'approver', type: 'pi-rpc', desc: '拒绝审批项' },
  
  // 遐思命令（本地实现）
  '!xiasi': { agent: 'xiasi', type: 'local', desc: '遐思主命令' },
  '!memory stats': { agent: 'chief', type: 'local', desc: '记忆统计' },
  '!memory search': { agent: 'chief', type: 'local', desc: '记忆搜索' },
  '!memory show': { agent: 'chief', type: 'local', desc: '记忆详情' },
  '!memory report': { agent: 'chief', type: 'local', desc: '记忆报告' },
  '!memory cleanup': { agent: 'chief', type: 'local', desc: '记忆清理' },
  '!opportunity': { agent: 'sales', type: 'local', desc: '商机管理' },
};

// ============================================
// 测试 1: 命令路由验证
// ============================================
function testCommandRouting() {
  log('\n--- 测试 1: 命令路由表 ---');
  try {
    const localCmds = Object.entries(COMMANDS).filter(([, v]) => v.type === 'local');
    const rpcCmds = Object.entries(COMMANDS).filter(([, v]) => v.type === 'pi-rpc');
    
    log(`总命令数: ${Object.keys(COMMANDS).length}`);
    log(`  - 本地命令: ${localCmds.length}`);
    log(`  - Pi RPC 命令: ${rpcCmds.length}`);
    
    pass(`命令路由表 - ${Object.keys(COMMANDS).length} 个命令`);
  } catch (e) {
    fail('命令路由表', e.message);
  }
}

// ============================================
// 测试 2: 核心目录结构
// ============================================
function testDirectoryStructure() {
  log('\n--- 测试 2: 核心目录结构 ---');
  try {
    const dirs = [
      'data/business',
      'data/memory',
      'data/sessions',
      'data/dreams',
      'logs',
      'src/orchestrator',
      'config',
    ];
    
    let allExist = true;
    for (const dir of dirs) {
      const fullPath = path.join(__dirname, dir);
      if (fs.existsSync(fullPath)) {
        log(`  ✓ ${dir}/`);
      } else {
        log(`  ✗ ${dir}/ 不存在`, 'warn');
        allExist = false;
      }
    }
    
    if (allExist) {
      pass('核心目录结构完整');
    } else {
      fail('核心目录结构', '部分目录缺失');
    }
  } catch (e) {
    fail('核心目录结构', e.message);
  }
}

// ============================================
// 测试 3: 配置文件
// ============================================
function testConfig() {
  log('\n--- 测试 3: 配置文件 ---');
  try {
    // .env 文件
    const envFile = path.join(__dirname, '.env');
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf-8');
      const hasDiscord = content.includes('DISCORD_BOT_TOKEN');
      const hasPi = content.includes('PI_SESSION_DIR') || content.includes('PI_RPC_PORT');
      
      if (hasDiscord && hasPi) {
        pass('.env 配置完整 (Discord + Pi)');
      } else {
        log(`  - Discord: ${hasDiscord ? '✓' : '✗'}`, 'warn');
        log(`  - Pi: ${hasPi ? '✓' : '✗'}`, 'warn');
        fail('.env', '部分配置缺失');
      }
    } else {
      fail('.env', '文件不存在');
    }
  } catch (e) {
    fail('配置文件', e.message);
  }
}

// ============================================
// 测试 4: 记忆系统
// ============================================
function testMemory() {
  log('\n--- 测试 4: 记忆系统 ---');
  try {
    const memoryDir = path.join(__dirname, 'data', 'memory');
    const subdirs = ['store', 'journal', 'snapshots'];
    
    for (const subdir of subdirs) {
      const subPath = path.join(memoryDir, subdir);
      if (fs.existsSync(subPath)) {
        const files = fs.readdirSync(subPath);
        log(`  ✓ ${subdir}/ (${files.length} 项)`);
      }
    }
    
    // 检查 store 中的记忆
    const storePath = path.join(memoryDir, 'store');
    if (fs.existsSync(storePath)) {
      const memDirs = fs.readdirSync(storePath).filter(f => 
        fs.statSync(path.join(storePath, f)).isDirectory()
      );
      log(`记忆总数: ${memDirs.length}`);
      
      if (memDirs.length > 0) {
        pass('记忆系统正常');
      } else {
        skip('记忆系统', '暂无记忆数据');
      }
    }
  } catch (e) {
    fail('记忆系统', e.message);
  }
}

// ============================================
// 测试 5: Token 使用记录
// ============================================
function testTokenUsage() {
  log('\n--- 测试 5: Token 使用记录 ---');
  try {
    const costDir = path.join(__dirname, 'data', 'token-usage');
    if (fs.existsSync(costDir)) {
      const files = fs.readdirSync(costDir).filter(f => f.endsWith('.md'));
      log(`记录文件: ${files.length}`);
      
      if (files.length > 0) {
        // 读取最新的记录
        const latest = files.sort().pop();
        const content = fs.readFileSync(path.join(costDir, latest), 'utf-8');
        
        if (content.includes('#') && content.includes('Token')) {
          const lines = content.split('\n');
          log(`最新记录: ${latest}`);
          
          // 提取关键数据
          const totalMatch = content.match(/\*\*总 (?:token|Token):\*\* ([0-9.]+[BMK]?)/i);
          const costMatch = content.match(/\*\*总 cost\*\*[^:]*:\*\* \$?([0-9.]+)/i);
          
          if (totalMatch) log(`  - 总 Token: ${totalMatch[1]}`);
          if (costMatch) log(`  - 总 Cost: $${costMatch[1]}`);
          
          pass('Token 使用记录正常');
        } else {
          fail('Token 记录', '文件格式异常');
        }
      }
    }
  } catch (e) {
    fail('Token 使用记录', e.message);
  }
}

// ============================================
// 测试 6: 日志系统
// ============================================
function testLogs() {
  log('\n--- 测试 6: 日志系统 ---');
  try {
    const logDir = path.join(__dirname, 'logs');
    if (fs.existsSync(logDir)) {
      const logFiles = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
      log(`日志文件: ${logFiles.length}`);
      
      if (logFiles.length > 0) {
        const latest = logFiles.sort().pop();
        const stat = fs.statSync(path.join(logDir, latest));
        const sizeKB = (stat.size / 1024).toFixed(1);
        log(`最新日志: ${latest} (${sizeKB} KB)`);
        pass('日志系统正常');
      }
    }
  } catch (e) {
    fail('日志系统', e.message);
  }
}

// ============================================
// 测试 7: 项目数据
// ============================================
function testProjects() {
  log('\n--- 测试 7: 项目数据 ---');
  try {
    const projectsDir = path.join(__dirname, 'data', 'business', 'projects');
    if (fs.existsSync(projectsDir)) {
      const indexFile = path.join(projectsDir, 'index.yaml');
      if (fs.existsSync(indexFile)) {
        const content = fs.readFileSync(indexFile, 'utf-8');
        const projectMatches = content.match(/id:\s*PRJ-/g);
        const count = projectMatches ? projectMatches.length : 0;
        log(`项目数: ${count}`);
        
        if (count > 0) {
          pass(`项目数据正常 (${count} 个项目)`);
        } else {
          skip('项目数据', '暂无项目');
        }
      }
    }
  } catch (e) {
    fail('项目数据', e.message);
  }
}

// ============================================
// 测试 8: Agent 运行时
// ============================================
function testAgentRuntime() {
  log('\n--- 测试 8: Agent 运行时 ---');
  try {
    const runtimeDir = path.join(__dirname, 'data', 'agent-runtime');
    if (fs.existsSync(runtimeDir)) {
      const files = fs.readdirSync(runtimeDir);
      log(`运行时文件: ${files.length}`);
      
      if (files.length > 0) {
        pass('Agent 运行时目录正常');
      } else {
        skip('Agent 运行时', '暂无运行时数据');
      }
    }
    
    // 检查 sessions
    const sessionsDir = path.join(__dirname, 'data', 'sessions');
    if (fs.existsSync(sessionsDir)) {
      const sessionDirs = fs.readdirSync(sessionsDir).filter(f => 
        fs.statSync(path.join(sessionsDir, f)).isDirectory()
      );
      log(`活跃会话: ${sessionDirs.length}`);
    }
  } catch (e) {
    fail('Agent 运行时', e.message);
  }
}

// ============================================
// 测试 9: Pi RPC 连接状态
// ============================================
function testPiRpc() {
  log('\n--- 测试 9: Pi RPC 连接 ---');
  try {
    const configPath = path.join(__dirname, '.env');
    const content = fs.readFileSync(configPath, 'utf-8');
    
    const hasRpcPort = content.includes('PI_RPC_PORT');
    const hasSessionDir = content.includes('PI_SESSION_DIR');
    
    if (hasRpcPort && hasSessionDir) {
      pass('Pi RPC 配置存在');
      log('需要实际向 Bot 发送命令验证连接', 'rpc');
    } else {
      fail('Pi RPC', '配置不完整');
    }
  } catch (e) {
    fail('Pi RPC', e.message);
  }
}

// ============================================
// 汇总测试结果
// ============================================
function printSummary() {
  console.log('\n' + '═'.repeat(60));
  log('📊 测试汇总 - 第一批：核心基础命令');
  console.log('═'.repeat(60));
  log(`通过: ${results.passed.length}`);
  log(`失败: ${results.failed.length}`);
  log(`跳过: ${results.skipped.length}`);
  log(`总计: ${results.total}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ 失败项:');
    for (const { name, reason } of results.failed) {
      console.log(`  • ${name}: ${reason}`);
    }
  }
  
  console.log('\n' + '═'.repeat(60));
  log('📝 下一步: 需要向 Bot 发送实际命令测试');
  console.log('═'.repeat(60));
  log('\n参考命令列表（按批次）:\n');
  
  const batches = [
    { name: '第一批 - 核心命令', cmds: ['!state', '!cost', '!status', '!pr list', '!restart', '!memory'] },
    { name: '第二批 - Lead 流程', cmds: ['!lead new <公司> <行业> <描述>', '!lead list', '!lead qualify <LEAD-ID>'] },
    { name: '第三批 - 项目流程', cmds: ['!pr new <公司> <行业> <描述>', '!prd v0.1 <PRJ-ID>', '!pm plan <PRJ-ID>'] },
  ];
  
  for (const batch of batches) {
    console.log(`\n${batch.name}:`);
    for (const cmd of batch.cmds) {
      console.log(`  • ${cmd}`);
    }
  }
  
  console.log('\n' + '═'.repeat(60));
}

// ============================================
// 主测试流程
// ============================================
async function runTests() {
  console.log('═'.repeat(60));
  log('🧪 工作流测试 - 第一批：核心基础命令');
  console.log('═'.repeat(60));
  
  testCommandRouting();
  testDirectoryStructure();
  testConfig();
  testMemory();
  testTokenUsage();
  testLogs();
  testProjects();
  testAgentRuntime();
  testPiRpc();
  
  printSummary();
  
  return results;
}

runTests().catch(console.error);
