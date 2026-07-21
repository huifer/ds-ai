// ~/pi-discord-agents/src/runtime/commands/image-render.mjs
// 图片平台卡片渲染：HTML → Chrome headless → PNG（小红书/抖音/视频号）
// 用系统 Chrome headless 截图，无需额外 npm 包

import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return process.env.CHROME_PATH || null;
}

// ===== HTML 卡片生成 =====
export function generateCardHtml({ title, content, brand, score, platform, accent }) {
  const a = accent || (platform === 'xiaohongshu' ? '#ff2442' : '#0ea5e9');
  const year = new Date().getFullYear();
  const safeTitle = (title || '').slice(0, 80);
  const safeContent = (content || '').slice(0, 800).replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'PingFang SC', 'Noto Sans CJK SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; }
  .card {
    width: 600px;
    background: #ffffff;
    display: flex;
    flex-direction: column;
  }
  .header {
    background: linear-gradient(135deg, ${a} 0%, #1e293b 100%);
    padding: 36px 32px 28px;
    color: #ffffff;
  }
  .header h1 {
    font-size: 26px;
    font-weight: 700;
    line-height: 1.4;
    margin-bottom: 16px;
  }
  .tag {
    display: inline-block;
    background: rgba(255,255,255,0.25);
    color: #ffffff;
    font-size: 13px;
    padding: 5px 14px;
    border-radius: 14px;
  }
  .body {
    padding: 28px 32px;
    color: #333333;
    font-size: 17px;
    line-height: 1.8;
  }
  .stats {
    display: flex;
    gap: 12px;
    padding: 0 32px 20px;
  }
  .stat {
    flex: 1;
    background: #f8f9fa;
    border-radius: 12px;
    padding: 16px;
    text-align: center;
  }
  .stat .num {
    font-size: 22px;
    font-weight: 700;
    color: ${a};
  }
  .stat .label {
    font-size: 12px;
    color: #999999;
    margin-top: 4px;
  }
  .footer {
    background: #f8f9fa;
    padding: 16px 32px;
    text-align: center;
    font-size: 13px;
    color: #999999;
  }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>${safeTitle}</h1>
    <span class="tag">${brand}</span>
  </div>
  <div class="body">${safeContent}</div>
  <div class="stats">
    <div class="stat">
      <div class="num">${score ?? '—'}</div>
      <div class="label">内容评分</div>
    </div>
    <div class="stat">
      <div class="num">${platform}</div>
      <div class="label">平台</div>
    </div>
    <div class="stat">
      <div class="num">✅</div>
      <div class="label">已脱敏</div>
    </div>
  </div>
  <div class="footer">© ${year} ${brand} · All rights reserved</div>
</div>
</body>
</html>`;
}

// ===== HTML → PNG via Chrome headless =====
export function htmlToPng(html, width = 600, height = null) {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('Chrome 未找到。请设置 CHROME_PATH 环境变量或安装 Chrome');
  }

  // 写 HTML 到临时文件
  const tmpDir = join(tmpdir(), 'pi-cards');
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const htmlPath = join(tmpDir, `card-${stamp}.html`);
  const pngPath = join(tmpDir, `card-${stamp}.png`);
  writeFileSync(htmlPath, html, 'utf8');

  // Chrome headless 截图
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--force-device-scale-factor=2',
    `--screenshot=${pngPath}`,
    `--window-size=${width},${height || 800}`,
    `file://${htmlPath}`,
  ];

  try {
    spawnSync(chromePath, args, { timeout: 15_000, stdio: 'ignore' });
    if (!existsSync(pngPath)) throw new Error('Chrome 截图失败，PNG 未生成');
    const png = readFileSync(pngPath);
    return png;
  } finally {
    try { unlinkSync(htmlPath); } catch {}
    try { unlinkSync(pngPath); } catch {}
  }
}


export function renderImageCard(candidate, platform) {
  const brand = '杭州 OPC 张三';
  const title = candidate.title ?? `${platform} 内容`;
  const content = candidate.content ?? '';
  const score = candidate.score?.total ?? '—';
  const accent = platform === 'xiaohongshu' ? '#ff2442'
    : platform === 'douyin' ? '#000000'
    : '#07c160';

  const html = generateCardHtml({ title, content, brand, score, platform, accent });
  const png = htmlToPng(html, 600, 800);

  return { html, png, format: 'png' };
}
