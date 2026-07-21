#!/usr/bin/env node
// scripts/connection-quickstart.mjs
// Connection 系统快速开始向导

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ENV_FILE = join(ROOT, '.env');

function print(msg) {
  console.log(msg);
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => {
    rl.question(question, resolve);
    rl.close();
  });
}

async function main() {
  print(`
╔═══════════════════════════════════════════════════════════════╗
║           Connection System - 快速开始向导                   ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Step 1: 检查 .env 配置
  print('📝 步骤 1: 检查环境配置\n');
  
  let envContent = '';
  if (existsSync(ENV_FILE)) {
    envContent = readFileSync(ENV_FILE, 'utf-8');
    print('  ✅ .env 文件已存在\n');
  } else {
    print('  ⚠️  .env 文件不存在，将创建...\n');
  }

  // Step 2: 获取 Strava API 凭据
  print('🚴 步骤 2: 配置 Strava API\n');
  print('  请访问: https://www.strava.com/settings/api\n');
  print('  创建应用后，复制以下信息:\n');

  const clientId = await ask('  Client ID: ');
  const clientSecret = await ask('  Client Secret: ');

  if (!clientId || !clientSecret) {
    print('\n❌ 缺少必要配置，取消操作\n');
    process.exit(1);
  }

  // Step 3: 更新 .env
  print('\n📝 步骤 3: 更新 .env 文件\n');

  let newEnvContent = envContent;
  
  // 添加或更新 STRAVA_CLIENT_ID
  if (newEnvContent.includes('STRAVA_CLIENT_ID=')) {
    newEnvContent = newEnvContent.replace(
      /STRAVA_CLIENT_ID=.*/,
      `STRAVA_CLIENT_ID=${clientId}`
    );
  } else {
    newEnvContent += `\nSTRAVA_CLIENT_ID=${clientId}`;
  }

  // 添加或更新 STRAVA_CLIENT_SECRET
  if (newEnvContent.includes('STRAVA_CLIENT_SECRET=')) {
    newEnvContent = newEnvContent.replace(
      /STRAVA_CLIENT_SECRET=.*/,
      `STRAVA_CLIENT_SECRET=${clientSecret}`
    );
  } else {
    newEnvContent += `\nSTRAVA_CLIENT_SECRET=${clientSecret}`;
  }

  // 添加或更新 STRAVA_REDIRECT_URI
  if (newEnvContent.includes('STRAVA_REDIRECT_URI=')) {
    newEnvContent = newEnvContent.replace(
      /STRAVA_REDIRECT_URI=.*/,
      'STRAVA_REDIRECT_URI=http://localhost:3000/auth/strava/callback'
    );
  } else {
    newEnvContent += `\nSTRAVA_REDIRECT_URI=http://localhost:3000/auth/strava/callback`;
  }

  // 添加或更新 OAUTH_PORT
  if (!newEnvContent.includes('OAUTH_PORT=')) {
    newEnvContent += `\nOAUTH_PORT=3000`;
  }

  writeFileSync(ENV_FILE, newEnvContent.trim() + '\n', 'utf-8');
  print('  ✅ .env 文件已更新\n');

  // Step 4: 测试连接
  print('🔧 步骤 4: 测试连接\n');
  
  try {
    const { execSync } = await import('child_process');
    const result = execSync(`node scripts/connection-cli.mjs status strava`, {
      cwd: ROOT,
      encoding: 'utf-8',
    });
    print(result);
  } catch (e) {
    // 忽略错误，继续
  }

  // Step 5: 启动授权
  print('\n🚀 步骤 5: 开始授权\n');
  print('  1. 启动 OAuth 服务器 (终端 1):');
  print('     node scripts/connection-server.mjs\n');
  print('  2. 获取授权 URL (终端 2):');
  print('     node scripts/connection-cli.mjs auth strava\n');
  print('  3. 在浏览器打开授权链接，完成授权\n');
  print('  4. 授权成功后，验证连接:');
  print('     node scripts/connection-cli.mjs status strava\n');

  // Step 6: Discord 命令
  print('\n💬 Discord 命令:\n');
  print('  !connection list       - 查看已连接服务');
  print('  !connection status strava  - 查看 Strava 状态');
  print('  !connection sync strava     - 同步数据');
  print('  !connection query strava recent 10  - 查询最近活动\n');

  print(`
╔═══════════════════════════════════════════════════════════════╗
║                    设置完成！                                ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
