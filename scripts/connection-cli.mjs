#!/usr/bin/env node
// scripts/connection-cli.mjs
// Connection 命令行工具 - 管理第三方服务连接
// 
// 用法:
//   node scripts/connection-cli.mjs list
//   node scripts/connection-cli.mjs auth strava
//   node scripts/connection-cli.mjs status strava
//   node scripts/connection-cli.mjs sync strava
//   node scripts/connection-cli.mjs remove strava
//   node scripts/connection-cli.mjs callback strava <code>

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// 加载环境变量
import { readFileSync } from 'fs';
const envFile = join(ROOT, '.env');
if (existsSync(envFile)) {
  const envContent = readFileSync(envFile, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

function existsSync(path) {
  try {
    require('fs').accessSync(path);
    return true;
  } catch {
    return false;
  }
}

import manager from '../src/connections/manager.mjs';

const args = process.argv.slice(2);
const command = args[0];
const serviceId = args[1];
const extra = args[2];

async function main() {
  try {
    await manager.init();
    
    switch (command) {
      case 'list':
        await cmdList();
        break;
        
      case 'auth':
        if (!serviceId) {
          console.error('Usage: connection-cli.mjs auth <service>');
          process.exit(1);
        }
        await cmdAuth(serviceId);
        break;
        
      case 'status':
        if (!serviceId) {
          console.error('Usage: connection-cli.mjs status <service>');
          process.exit(1);
        }
        await cmdStatus(serviceId);
        break;
        
      case 'sync':
        if (!serviceId) {
          console.error('Usage: connection-cli.mjs sync <service>');
          process.exit(1);
        }
        await cmdSync(serviceId);
        break;
        
      case 'remove':
      case 'disconnect':
        if (!serviceId) {
          console.error('Usage: connection-cli.mjs remove <service>');
          process.exit(1);
        }
        await cmdRemove(serviceId);
        break;
        
      case 'callback':
        if (!serviceId || !extra) {
          console.error('Usage: connection-cli.mjs callback <service> <code>');
          process.exit(1);
        }
        await cmdCallback(serviceId, extra);
        break;
        
      case 'help':
        printHelp();
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Connection CLI - 第三方服务连接管理

用法:
  node scripts/connection-cli.mjs <command> [args]

命令:
  list              列出所有可用服务和连接状态
  auth <service>    获取授权 URL
  status <service>  查看连接状态
  sync <service>    同步数据
  remove <service>  断开连接
  callback <service> <code>  处理 OAuth 回调
  help              显示帮助

示例:
  node scripts/connection-cli.mjs list
  node scripts/connection-cli.mjs auth strava
  node scripts/connection-cli.mjs status strava
  node scripts/connection-cli.mjs callback strava abc123
  `);
}

async function cmdList() {
  const services = manager.listServices();
  console.log('\n📋 可用服务:\n');
  
  for (const s of services) {
    const status = await manager.getStatus(s.id);
    const statusIcon = status.connected ? '✅' : '❌';
    const info = status.connected ? 
      ` - ${status.info?.name || status.info?.email || '已连接'}` : 
      ' - 未连接';
    console.log(`  ${statusIcon} ${s.icon} ${s.name}${info}`);
  }
  console.log('');
}

async function cmdAuth(serviceId) {
  try {
    const { authUrl, state } = await manager.getAuthUrl(serviceId);
    console.log(`\n🔗 授权 ${serviceId}\n`);
    console.log(`授权 URL:\n${authUrl}\n`);
    console.log(`State: ${state}`);
    console.log('\n请在浏览器中打开上述链接完成授权。\n');
    console.log('授权后，Strava 会重定向到回调 URL。');
    console.log('如果你配置的回调地址是 http://localhost:3000/auth/strava/callback');
    console.log('你需要手动运行以下命令完成授权：');
    console.log(`\n  node scripts/connection-cli.mjs callback ${serviceId} <授权码>\n`);
  } catch (e) {
    if (e.message.includes('already connected')) {
      console.log(`✅ ${serviceId} 已经连接，如需重新授权请先断开：`);
      console.log(`  node scripts/connection-cli.mjs remove ${serviceId}`);
    } else {
      throw e;
    }
  }
}

async function cmdStatus(serviceId) {
  const status = await manager.getStatus(serviceId);
  
  console.log(`\n📊 ${serviceId} 状态:\n`);
  
  if (status.connected) {
    console.log('  状态: ✅ 已连接');
    if (status.info) {
      for (const [key, value] of Object.entries(status.info)) {
        console.log(`  ${key}: ${value}`);
      }
    }
  } else {
    console.log('  状态: ❌ 未连接');
    if (status.error) {
      console.log(`  错误: ${status.error}`);
    }
    console.log(`\n  启用连接:`);
    console.log(`    node scripts/connection-cli.mjs auth ${serviceId}`);
  }
  console.log('');
}

async function cmdSync(serviceId) {
  console.log(`\n🔄 正在同步 ${serviceId}...\n`);
  
  try {
    const result = await manager.sync(serviceId);
    console.log('✅ 同步完成');
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('❌ 同步失败:', e.message);
  }
  console.log('');
}

async function cmdRemove(serviceId) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const answer = await new Promise(resolve => {
    rl.question(`\n⚠️ 确认断开 ${serviceId}？(yes/no) `, resolve);
  });
  rl.close();
  
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    const result = await manager.disconnect(serviceId);
    console.log(`\n✅ 已断开 ${serviceId}\n`);
  } else {
    console.log('\n已取消\n');
  }
}

async function cmdCallback(serviceId, code) {
  console.log(`\n🔑 处理 ${serviceId} 授权回调...\n`);
  
  try {
    const result = await manager.handleCallback(serviceId, code);
    console.log('✅ 授权成功！');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n现在可以开始使用了：');
    console.log(`  node scripts/connection-cli.mjs status ${serviceId}`);
    console.log(`  node scripts/connection-cli.mjs sync ${serviceId}`);
  } catch (e) {
    console.error('❌ 授权失败:', e.message);
  }
  console.log('');
}

main();
