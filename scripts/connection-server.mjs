#!/usr/bin/env node
// scripts/connection-server.mjs
// OAuth 回调服务器 - 处理第三方服务的 OAuth 授权回调
// 
// 用法:
//   node scripts/connection-server.mjs
// 
// 启动后监听 http://localhost:3000/auth/<service>/callback

import http from 'http';
import { URL } from 'url';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = process.env.OAUTH_PORT || 3000;

// 加载环境变量
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

import manager from '../src/connections/manager.mjs';

// 等待的授权请求
const pendingAuth = new Map();

async function main() {
  await manager.init();
  
  const server = http.createServer(handleRequest);
  
  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              Connection OAuth Server                          ║
╠═══════════════════════════════════════════════════════════════╣
║  监听地址: http://localhost:${PORT}                             ║
║  等待 Strava 授权回调中...                                     ║
║                                                               ║
║  要启用 Strava 连接:                                          ║
║  1. 在浏览器打开:                                             ║
║     node scripts/connection-cli.mjs auth strava                ║
║  2. 浏览器会打开授权页面                                       ║
║  3. 授权后自动完成连接                                         ║
║                                                               ║
║  按 Ctrl+C 退出                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
  });
}

async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const path = parsedUrl.pathname;
  
  console.log(`\n📨 收到请求: ${path}`);
  
  // 解析路径: /auth/<service>/callback
  const match = path.match(/^\/auth\/([^/]+)\/callback$/);
  
  if (!match) {
    sendHtml(res, `
      <h1>404 Not Found</h1>
      <p>Unknown path: ${path}</p>
    `);
    return;
  }
  
  const serviceId = match[1];
  const code = parsedUrl.searchParams.get('code');
  const error = parsedUrl.searchParams.get('error');
  const state = parsedUrl.searchParams.get('state');
  
  if (error) {
    sendHtml(res, `
      <h1>❌ 授权失败</h1>
      <p>错误: ${error}</p>
      <p>${parsedUrl.searchParams.get('error_description') || ''}</p>
      <p><a href="/auth/${serviceId}">重试</a></p>
    `);
    return;
  }
  
  if (!code) {
    sendHtml(res, `
      <h1>❌ 授权失败</h1>
      <p>未收到授权码</p>
      <p><a href="/auth/${serviceId}">重试</a></p>
    `);
    return;
  }
  
  try {
    // 处理回调
    const result = await manager.handleCallback(serviceId, code);
    
    sendHtml(res, `
      <div style="font-family: system-ui; max-width: 600px; margin: 50px auto; text-align: center;">
        <h1 style="color: #22c55e;">✅ 授权成功！</h1>
        <p>${result.service} 连接已完成</p>
        ${result.athlete_name ? `<p>欢迎, ${result.athlete_name}</p>` : ''}
        <p style="margin-top: 30px; color: #666;">
          此窗口可以关闭了。
        </p>
        <p style="margin-top: 20px;">
          <a href="/" style="color: #3b82f6;">返回主页</a>
        </p>
      </div>
    `);
    
    console.log(`\n✅ ${serviceId} 授权成功:`, result);
    
    // 延迟退出，给浏览器一点时间显示结果
    setTimeout(() => {
      console.log('\n📝 授权完成，服务器继续运行中...');
      console.log('按 Ctrl+C 退出\n');
    }, 3000);
    
  } catch (e) {
    sendHtml(res, `
      <h1>❌ 授权失败</h1>
      <p>错误: ${e.message}</p>
      <p><a href="/auth/${serviceId}">重试</a></p>
    `);
    console.error(`\n❌ ${serviceId} 授权失败:`, e.message);
  }
}

function sendHtml(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connection OAuth</title>
</head>
<body style="margin: 0; padding: 20px; font-family: system-ui;">
  ${html}
</body>
</html>`);
}

main().catch(e => {
  console.error('Server error:', e);
  process.exit(1);
});
