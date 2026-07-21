// ~/pi-discord-agents/src/utils.mjs
// 通用工具函数

import { marked } from 'marked';

// 配置 marked 选项
marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * 构建精美的 HTML 文档（供 PDF 生成使用）
 * @param {string} md - Markdown 内容
 * @param {string} title - 文档标题
 * @param {object} options - 额外选项
 * @returns {string} HTML 字符串
 */
export function buildBeautifulHtml(md, title, options = {}) {
  const {
    author = '',
    date = new Date().toLocaleDateString('zh-CN'),
    accentColor = '#1a365d',  // 深蓝色主色 - 商务风格
    watermark = ''
  } = options;

  // 使用 marked 解析 Markdown
  let body = marked.parse(md);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
  /* ============================================
     基础设置
     ============================================ */
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: "Source Han Serif SC", "Source Han Serif CN", "Noto Serif SC", 
                 "SimSun", "宋体", "STSong", Georgia, serif;
    font-size: 10.5pt;
    line-height: 1.9;
    color: #1a1a1a;
    background: #ffffff;
    -webkit-font-smoothing: antialiased;
  }

  /* ============================================
     封面页样式
     ============================================ */
  .cover {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 80px;
    background: #ffffff;
    position: relative;
    page-break-after: always;
  }

  /* 封面左侧装饰条 */
  .cover::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 6px;
    background: linear-gradient(180deg, ${accentColor} 0%, ${accentColor}cc 100%);
  }

  /* 封面底部装饰线 */
  .cover::after {
    content: '';
    position: absolute;
    bottom: 60px;
    left: 80px;
    right: 80px;
    height: 1px;
    background: linear-gradient(90deg, ${accentColor}, transparent);
  }

  /* 文档类型标识 */
  .cover-label {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 9pt;
    font-weight: 500;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: ${accentColor};
    margin-bottom: 40px;
    opacity: 0.7;
  }

  /* 标题 */
  .cover-title {
    font-size: 28pt;
    font-weight: 700;
    color: #0d0d0d;
    line-height: 1.3;
    margin-bottom: 32px;
    max-width: 500px;
  }

  /* 分隔线 */
  .cover-divider {
    width: 48px;
    height: 2px;
    background: ${accentColor};
    margin-bottom: 32px;
  }

  /* 元信息 */
  .cover-meta {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 9.5pt;
    color: #666666;
    line-height: 2;
  }

  .cover-meta-item {
    display: inline;
  }

  .cover-meta-item + .cover-meta-item::before {
    content: "  |  ";
    color: #cccccc;
  }

  /* ============================================
     内容区域
     ============================================ */
  .content {
    max-width: 620px;
    margin: 0 auto;
    padding: 56px 60px;
  }

  /* ============================================
     标题层级 - 商务正式风格
     ============================================ */
  h1 {
    font-size: 18pt;
    font-weight: 700;
    color: ${accentColor};
    margin: 40px 0 18px;
    padding-bottom: 10px;
    border-bottom: 1.5px solid ${accentColor};
    line-height: 1.35;
  }

  h1:first-child {
    margin-top: 0;
  }

  h2 {
    font-size: 14pt;
    font-weight: 700;
    color: #1a1a1a;
    margin: 32px 0 14px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e0e0e0;
    line-height: 1.4;
  }

  h3 {
    font-size: 12pt;
    font-weight: 600;
    color: #2d2d2d;
    margin: 24px 0 10px;
    line-height: 1.5;
  }

  h4 {
    font-size: 10.5pt;
    font-weight: 600;
    color: #404040;
    margin: 18px 0 8px;
    line-height: 1.5;
  }

  /* ============================================
     段落与文本
     ============================================ */
  p {
    margin: 10px 0;
    text-align: justify;
    text-indent: 2em;
  }

  p:first-of-type {
    text-indent: 0;
  }

  strong, b {
    font-weight: 700;
    color: #0d0d0d;
  }

  em, i {
    font-style: italic;
    color: #404040;
  }

  /* ============================================
     链接
     ============================================ */
  a {
    color: ${accentColor};
    text-decoration: none;
    border-bottom: 1px solid ${accentColor}60;
  }

  a:hover {
    border-bottom-color: ${accentColor};
  }

  /* ============================================
     列表
     ============================================ */
  ul, ol {
    margin: 12px 0;
    padding-left: 24px;
  }

  li {
    margin: 6px 0;
    line-height: 1.8;
    color: #333333;
  }

  /* 无序列表标记 */
  ul li::marker {
    color: ${accentColor};
  }

  /* 有序列表 */
  ol {
    list-style-type: none;
    counter-reset: item;
  }

  ol li {
    position: relative;
    padding-left: 8px;
  }

  ol li::before {
    content: counter(item) ".";
    counter-increment: item;
    position: absolute;
    left: -20px;
    color: ${accentColor};
    font-weight: 600;
  }

  /* ============================================
     引用块 - 商务风格
     ============================================ */
  blockquote {
    margin: 20px 0;
    padding: 14px 20px;
    border-left: 3px solid ${accentColor};
    background: #f8f9fa;
    color: #4a4a4a;
  }

  blockquote p {
    text-indent: 0;
    margin: 4px 0;
    color: #4a4a4a;
  }

  blockquote strong, blockquote b {
    color: ${accentColor};
  }

  /* ============================================
     代码 - 简洁商务风格
     ============================================ */
  /* 行内代码 */
  code:not(pre code) {
    font-family: "SF Mono", "Menlo", "Monaco", "Consolas", monospace;
    font-size: 9pt;
    background: #f5f5f5;
    color: #c7254e;
    padding: 1px 5px;
    border-radius: 2px;
    border: 1px solid #e8e8e8;
  }

  /* 代码块 */
  pre {
    margin: 18px 0;
    padding: 16px 20px;
    background: #2d3748;
    border-radius: 4px;
    overflow-x: auto;
  }

  pre code {
    font-family: "SF Mono", "Menlo", "Monaco", "Consolas", monospace;
    font-size: 8.5pt;
    line-height: 1.7;
    color: #e2e8f0;
    background: none;
    padding: 0;
    border: none;
  }

  /* ============================================
     表格 - 商务风格
     ============================================ */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
    font-size: 9.5pt;
  }

  thead {
    background: ${accentColor};
  }

  th {
    color: #ffffff;
    font-weight: 600;
    padding: 12px 14px;
    text-align: left;
    border: none;
    white-space: nowrap;
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 9pt;
  }

  td {
    padding: 10px 14px;
    border-bottom: 1px solid #e8e8e8;
    border: none;
    color: #333333;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tbody tr:nth-child(even) {
    background: #fafbfc;
  }

  tbody tr:hover {
    background: ${accentColor}08;
  }

  /* ============================================
     分隔线
     ============================================ */
  hr {
    margin: 36px 0;
    border: none;
    height: 1px;
    background: linear-gradient(90deg, ${accentColor}40, ${accentColor}10, transparent);
  }

  /* ============================================
     图片
     ============================================ */
  img {
    max-width: 100%;
    height: auto;
    border-radius: 2px;
    margin: 16px 0;
    border: 1px solid #e8e8e8;
  }

  /* ============================================
     任务列表
     ============================================ */
  .task-list-item {
    list-style: none;
    margin-left: -24px;
    padding-left: 24px;
    position: relative;
  }

  .task-list-item::before {
    content: "[ ]";
    position: absolute;
    left: 0;
    color: ${accentColor};
    font-family: monospace;
    font-size: 9pt;
  }

  .task-list-item.checked::before {
    content: "[x]";
  }

  /* ============================================
     水印
     ============================================ */
  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 72pt;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.025);
    pointer-events: none;
    white-space: nowrap;
    z-index: 0;
    letter-spacing: 12px;
  }

  /* ============================================
     打印优化
     ============================================ */
  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .watermark {
      opacity: 0.02;
    }

    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .cover {
      page-break-after: always;
    }

    table {
      page-break-inside: avoid;
    }
  }
</style>
</head>
<body>
${watermark ? `<div class="watermark">${escapeHtml(watermark)}</div>` : ''}

<!-- 封面 -->
<div class="cover">
  <div class="cover-label">Technical Document</div>
  <h1 class="cover-title">${escapeHtml(title)}</h1>
  <div class="cover-divider"></div>
  <div class="cover-meta">
    ${author ? `<span class="cover-meta-item">${escapeHtml(author)}</span>` : ''}
    <span class="cover-meta-item">${date}</span>
  </div>
</div>

<!-- 内容 -->
<div class="content">
${body}
</div>
</body>
</html>`;
}

/**
 * Markdown 转 PDF（使用 Chrome headless + 精美样式）
 * @param {string} mdContent - Markdown 内容
 * @param {string} title - PDF 标题
 * @param {string} outputPath - 输出路径
 * @param {object} options - 额外选项
 * @returns {Promise<boolean>} 是否成功
 */
export async function mdToPdf(mdContent, title = 'Document', outputPath = '/tmp/output.pdf', options = {}) {
  try {
    const { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } = await import('node:fs');
    const { dirname } = await import('node:path');
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    // 确保输出目录存在
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // 生成精美的 HTML
    const htmlPath = outputPath.replace('.pdf', '.html');
    const htmlContent = buildBeautifulHtml(mdContent, title, options);
    writeFileSync(htmlPath, htmlContent, 'utf8');

    // 转换 PDF
    const chromeBin = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    
    // 预热 Chrome
    try {
      await execAsync(`"${chromeBin}" --headless=new --disable-gpu --dump-dom "data:text/html,<h1>warmup</h1>"`, { timeout: 5000 });
    } catch {}

    const cmd = `"${chromeBin}" --headless=new --no-pdf-header-footer --disable-gpu --print-to-pdf="${outputPath}" --print-to-pdf-no-header "${htmlPath}"`;

    await execAsync(cmd, { timeout: 60000 });

    // 验证 PDF 生成
    try {
      const stats = readFileSync(outputPath);
      if (stats.length < 1000) {
        console.error(`[mdToPdf] PDF too small: ${stats.length} bytes`);
        return false;
      }
    } catch {
      console.error(`[mdToPdf] PDF not generated`);
      return false;
    }

    // 清理 HTML
    try { unlinkSync(htmlPath); } catch {}

    return true;
  } catch (e) {
    console.error(`[mdToPdf] error: ${e.message}`);
    return false;
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
