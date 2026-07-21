// ~/pi-discord-agents/src/runtime/commands/content.mjs
// 内容流水线 7 阶段命令处理器
// intake → distill → privacy → fact-check → renderer → publisher → qa
//
// 数据目录：data/content/{inbox,candidates,renders,published,qa}/
// ID 前缀：MAT- CNT- RND- PUB- QA-

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { renderImageCard } from './image-render.mjs';

const ROOT = process.cwd();
const CONTENT_DIR = resolve(ROOT, 'data/content');
const SUBDIRS = ['inbox', 'candidates', 'renders', 'published', 'qa'];

function ensureDirs() {
  for (const d of SUBDIRS) mkdirSync(resolve(CONTENT_DIR, d), { recursive: true });
}

function genId(prefix) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${date}-${rand}`;
}

function saveArtifact(subdir, artifact) {
  ensureDirs();
  const p = resolve(CONTENT_DIR, subdir, `${artifact.id}.json`);
  writeFileSync(p, JSON.stringify(artifact, null, 2) + '\n', 'utf8');
  return p;
}

export function loadArtifact(subdir, id) {
  const p = resolve(CONTENT_DIR, subdir, `${id}.json`);
  if (!existsSync(p)) throw new Error(`artifact not found: ${subdir}/${id}`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function latestArtifact(subdir) {
  ensureDirs();
  const dir = resolve(CONTENT_DIR, subdir);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) return null;
  return JSON.parse(readFileSync(join(dir, files[files.length - 1]), 'utf8'));
}

// ===== 隐私脱敏正则 =====
const PRIVACY_PATTERNS = [
  { name: 'phone', re: /\b1[3-9]\d{9}\b/g, replacement: '<phone>' },
  { name: 'email', re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replacement: '<email>' },
  { name: 'api-key', re: /(?:api[_-]?key|token|secret|password|apikey)\s*[=:]\s*["']?[\w-]{16,}["']?/gi, replacement: '<redacted:api-key>' },
  { name: 'internal-path', re: /\/Users\/[\w.-]+\//g, replacement: '<internal-path>/' },
];

function runPrivacyRedact(text) {
  const findings = [];
  let redacted = text;
  for (const p of PRIVACY_PATTERNS) {
    const matches = [...text.matchAll(p.re)];
    if (matches.length) {
      findings.push({ type: p.name, count: matches.length });
      redacted = redacted.replace(p.re, p.replacement);
    }
  }
  return { redacted, findings };
}

// ===== 事实核查 =====
const EVIDENCE_PATTERNS = {
  url: /https?:\/\/[\w.-]+[^\s]*/gi,
  commit: /\b[0-9a-f]{7,40}\b/gi,
  number: /\b\d{2,}\b/g,
};

function runFactCheck(text) {
  const claims = (text.match(/[^。.!！\n]+[。.!！]/g) ?? []).slice(0, 20);
  const checked = claims.map((claim) => {
    const evidence = [];
    if (EVIDENCE_PATTERNS.url.test(claim)) evidence.push('url');
    EVIDENCE_PATTERNS.url.lastIndex = 0;
    if (EVIDENCE_PATTERNS.commit.test(claim)) evidence.push('commit-hash');
    EVIDENCE_PATTERNS.commit.lastIndex = 0;
    if (EVIDENCE_PATTERNS.number.test(claim)) evidence.push('number');
    EVIDENCE_PATTERNS.number.lastIndex = 0;
    return {
      claim: claim.trim().slice(0, 120),
      hasEvidence: evidence.length > 0,
      evidenceTypes: evidence,
    };
  });
  const unsupported = checked.filter((c) => !c.hasEvidence);
  return {
    totalClaims: checked.length,
    supported: checked.length - unsupported.length,
    unsupported: unsupported.length,
    details: checked,
    passed: unsupported.length <= Math.ceil(checked.length * 0.3),
  };
}

// ===== 8 维评分 =====
const DIMENSIONS = ['authenticity', 'evidence', 'audience-value', 'novelty', 'brand-fit', 'virality', 'reusability', 'privacy-safety'];

function scoreCandidate({ hasEvidence, factPassed, privacyFindings, text }) {
  const scores = {};
  scores['authenticity'] = 4; // 假设来自真实工作
  scores['evidence'] = hasEvidence ? 5 : 2;
  scores['audience-value'] = text.length > 100 ? 4 : 3;
  scores['novelty'] = 3;
  scores['brand-fit'] = 4;
  scores['virality'] = hasEvidence ? 4 : 2;
  scores['reusability'] = 4;
  scores['privacy-safety'] = privacyFindings.length === 0 ? 5 : 3;
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  return { scores, total, max: 40 };
}

// ===== 渲染 HTML 骨架 =====
const OVERSEAS_PLATFORMS = ['x', 'newsletter', 'ph', 'youtube', 'linkedin', 'dev-to', 'hashnode'];

const IMAGE_PLATFORMS = ['xiaohongshu', 'douyin', 'video-account'];

function renderHtmlCard(candidate, platform) {
  const brand = '杭州 OPC 张三';
  const year = new Date().getFullYear();
  const title = candidate.title ?? `${platform} 内容`;
  const content = candidate.content ?? '';
  const score = candidate.score?.total ?? '—';
  const body = content.slice(0, 800);
  const accent = platform === 'xiaohongshu' ? '#ff2442' : '#0ea5e9';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'PingFang SC', 'Noto Sans CJK SC', system-ui, sans-serif; background: linear-gradient(135deg, ${accent} 0%, #1e293b 100%); min-height: 100vh; display: flex; justify-content: center; padding: 40px 20px; }
  .card { background: #fff; border-radius: 24px; max-width: 600px; width: 100%; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
  .card-header { background: linear-gradient(135deg, ${accent}, #1e293b); padding: 40px 32px; color: #fff; }
  .card-header h1 { font-size: 1.6rem; font-weight: 800; line-height: 1.4; margin-bottom: 12px; }
  .card-header .tag { display: inline-block; background: rgba(255,255,255,0.25); padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; }
  .card-body { padding: 32px; }
  .card-body p { font-size: 1.05rem; line-height: 1.8; color: #333; margin-bottom: 16px; white-space: pre-wrap; }
  .stats { display: flex; gap: 12px; margin: 20px 0; }
  .stat { flex: 1; background: #f8f9fa; border-radius: 12px; padding: 16px; text-align: center; }
  .stat .num { font-size: 1.4rem; font-weight: 800; color: ${accent}; }
  .stat .label { font-size: 0.75rem; color: #999; margin-top: 4px; }
  .card-footer { padding: 20px 32px; border-top: 1px solid #f0f0f0; text-align: center; color: #999; font-size: 0.85rem; }
</style>
</head>
<body>
<div class="card">
  <div class="card-header">
    <h1>${escapeHtml(title)}</h1>
    <span class="tag">${brand}</span>
  </div>
  <div class="card-body">
    <p>${escapeHtml(body)}</p>
    <div class="stats">
      <div class="stat"><div class="num">${score}</div><div class="label">内容评分</div></div>
      <div class="stat"><div class="num">${platform}</div><div class="label">平台</div></div>
      <div class="stat"><div class="num">✅</div><div class="label">已脱敏</div></div>
    </div>
  </div>
  <div class="card-footer">© ${year} ${brand} · All rights reserved</div>
</div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMarkdown(candidate, platform) {
  const isOverseas = OVERSEAS_PLATFORMS.includes(platform);
  const brand = isOverseas ? 'Zenbuild' : '杭州 OPC 张三';
  const year = new Date().getFullYear();
  const title = candidate.title ?? `${platform} 内容`;
  const content = candidate.content ?? candidate.rawContent ?? '';
  const score = candidate.score?.total ?? '—';
  const tagline = isOverseas ? 'Zenbuild · Build with intention' : '杭州 OPC 张三 · 一人公司';

  // X / Twitter：英文推文（如果内容是中文，标注需要翻译）
  if (platform === 'x') {
    // 检测是否包含中文
    const hasChinese = /[\u4e00-\u9fff]/.test(content);
    if (hasChinese) {
      // 中文素材：英文框架 + 原文引用 + 翻译提示
      const short = content.length > 200 ? content.slice(0, 200) + '...' : content;
      return `🚀 New project shipped!\n\n[Translate to English before posting]\n${short}\n\n— ${brand} (@huifer)`;
    }
    // 英文素材：直接格式化
    const enContent = content.length > 250 ? content.slice(0, 250) + '...' : content;
    return `Just shipped: ${title}\n\n${enContent}\n\n— ${brand} (@huifer)`;
  }

  // 标准长文 Markdown
  return `# ${title}\n\n> ${tagline} · 评分 ${score}/40\n\n---\n\n${content}\n\n---\n\n© ${year} ${brand} · All rights reserved`;
}

// ===== LLM 系统提示词 =====

const DISTILL_SYSTEM_PROMPT = `你是杭州 OPC 张三 / Zenbuild 的内容蒸馏 Agent。对以下素材进行评分和分析。

评分维度（每项 0-5 分）：
1. authenticity（真实性）— 是否来自真实工作
2. evidence（证据）— 是否有 commit/URL/数据/截图引用
3. audience-value（受众价值）— 读者能否学到或用到
4. novelty（新颖性）— 是否是常识
5. brand-fit（品牌一致）— 是否符合 OPC/Zenbuild 品牌
6. virality（可传播）— 冲突/数字/方法/故事
7. reusability（可复用）— 能否转为长文/短帖/视频
8. privacy-safety（保密安全）— 风险越低分越高

回复 JSON：
{"title":"吸引人的标题 15-30 字","scores":{"authenticity":4,"evidence":3,"audience-value":4,"novelty":3,"brand-fit":4,"virality":3,"reusability":4,"privacy-safety":5},"brief":"一句话摘要","platforms":["wechat","xiaohongshu","x","newsletter"]}`;

const FACTCHECK_SYSTEM_PROMPT = `你是杭州 OPC 张三的事实核查 Agent。检查以下内容中每个声明是否有证据支持。

按句号分割每个声明，判断：
- hasEvidence: 是否有可验证证据（URL、commit hash、具体数据、引用来源）
- evidenceTypes: 证据类型
- suggestion: 如无证据，建议补充什么

回复 JSON：
{"claims":[{"claim":"声明","hasEvidence":true,"evidenceTypes":["url"],"suggestion":""}],"summary":"总体评估","passed":true}`;

const RENDER_SYSTEM_PROMPT = (platform, candidate) => {
  const isOverseas = OVERSEAS_PLATFORMS.includes(platform);
  const brand = isOverseas ? 'Zenbuild' : '杭州 OPC 张三';
  const lang = isOverseas ? 'English' : '中文';
  const year = new Date().getFullYear();
  const platformHints = {
    x: 'X/Twitter tweet in ENGLISH. If the source content is Chinese, TRANSLATE it to English first. Max 280 characters. Concise, engaging, use tech terms. Include relevant hashtags.',
    xiaohongshu: '小红书风格，emoji 友好，文末标注需要配图数量和内容建议（3-9张）',
    wechat: '微信公众号长文，结构清晰，有小标题',
    newsletter: '英文 Newsletter，专业、简洁、有洞察',
    linkedin: 'LinkedIn 专业帖，英文，有行业洞察',
    ph: 'Product Hunt 描述，简短突出产品价值',
  };
  return `你是${brand}的渲染 Agent。将以下内容渲染为 ${platform} 平台的 Markdown 文章。

要求：
- 语言：${lang}
- 使用标准 Markdown 格式（# 标题、## 小标题、**加粗**、- 列表、> 引用、\`代码\`）
- 必须包含：标题、正文、结尾版权
- 版权格式：© ${year} ${brand} · All rights reserved
- ${platformHints[platform] || platform + '平台格式'}
- 直接输出 Markdown 正文，不要有多余解释、不要输出 HTML

标题：${candidate.title ?? ''}
内容：${candidate.content ?? ''}`;
};

function mergeScore(local, llmScores) {
  if (!llmScores || typeof llmScores !== 'object') return local;
  const merged = { scores: {} };
  for (const dim of DIMENSIONS) {
    const kebab = dim;
    const camel = dim.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const v = llmScores[kebab] ?? llmScores[camel];
    merged.scores[dim] = (typeof v === 'number' && v >= 0 && v <= 5) ? v : local.scores[dim];
  }
  merged.total = Object.values(merged.scores).reduce((a, b) => a + b, 0);
  merged.max = 40;
  return merged;
}

// ===== 命令导出 =====

export async function intakeNow({ source, note, channelId, userId }) {
  const text = note ?? source ?? '(no content)';
  const id = genId('MAT');
  const artifact = {
    id,
    type: 'material',
    createdAt: new Date().toISOString(),
    source: source ?? 'discord',
    channelId,
    userId,
    rawText: text,
    status: 'intaked',
  };
  const path = saveArtifact('inbox', artifact);
  return {
    materialId: id,
    path,
    summary: text.slice(0, 120),
    card: {
      title: `[INTAKE] ${id}`,
      description: `素材摄入完成\n${text.slice(0, 200)}`,
      color: 0x22c55e,
      fields: [
        { name: 'MAT', value: id, inline: true },
        { name: 'Source', value: source ?? 'discord', inline: true },
        { name: 'Chars', value: String(text.length), inline: true },
      ],
    },
  };
}

export async function distillRun({ matId, piBridge }) {
  let material;
  if (matId) {
    material = loadArtifact('inbox', matId);
  } else {
    material = latestArtifact('inbox');
    if (!material) throw new Error('inbox 为空，请先 !intake now');
  }
  // --- 本地基线 ---
  const { redacted, findings } = runPrivacyRedact(material.rawText);
  const factResult = runFactCheck(material.rawText);
  const localScore = scoreCandidate({
    hasEvidence: factResult.supported > 0,
    factPassed: factResult.passed,
    privacyFindings: findings,
    text: material.rawText,
  });

  // --- LLM 增强 ---
  let title = material.rawText.split('\n')[0]?.slice(0, 60) ?? '';
  let score = localScore;
  let brief = '';
  let platforms = ['wechat', 'xiaohongshu', 'x', 'newsletter'];
  let llmEnhanced = false;

  if (piBridge?.available) {
    const llm = await piBridge.promptJSON(DISTILL_SYSTEM_PROMPT, material.rawText, { timeoutMs: 60_000 });
    if (llm) {
      title = llm.title ?? title;
      score = mergeScore(localScore, llm.scores);
      brief = llm.brief ?? '';
      platforms = Array.isArray(llm.platforms) ? llm.platforms : platforms;
      llmEnhanced = true;
    }
  }

  const id = genId('CNT');
  const artifact = {
    id, type: 'candidate',
    createdAt: new Date().toISOString(),
    materialId: material.id,
    title, brief,
    content: redacted, rawContent: material.rawText,
    privacyFindings: findings, factCheck: factResult,
    score, llmEnhanced,
    status: findings.length === 0 && factResult.passed ? 'ready' : 'needs-review',
    platforms,
  };
  const path = saveArtifact('candidates', artifact);
  const verdict = score.total >= 32 ? '推荐' : score.total >= 24 ? '入池' : '知识';
  return {
    candidateId: id, path,
    score: score.total, verdict,
    privacyIssues: findings.length,
    factUnsupported: factResult.unsupported,
    status: artifact.status, llmEnhanced,
    platforms,
    card: {
      title: `[DISTILL] ${id} · ${verdict} · ${score.total}/40${llmEnhanced ? ' 🤖' : ''}`,
      description: `${title}${brief ? '\n' + brief : ''}\n隐私: ${findings.length} 项 · 事实: ${factResult.supported}/${factResult.totalClaims} 支持\n平台: ${platforms.join(', ')}`,
      color: score.total >= 32 ? 0x22c55e : score.total >= 24 ? 0xeab308 : 0x64748b,
      fields: [
        { name: 'CNT', value: id, inline: true },
        { name: 'Score', value: `${score.total}/40`, inline: true },
        { name: 'Status', value: artifact.status, inline: true },
        { name: '平台', value: platforms.join(', '), inline: false },
      ],
      platforms,
    },
  };
}

export async function privacyCheck({ cntId }) {
  let candidate;
  if (cntId) {
    candidate = loadArtifact('candidates', cntId);
  } else {
    candidate = latestArtifact('candidates');
    if (!candidate) throw new Error('candidates 为空，请先 !distill now');
  }
  const { redacted, findings } = runPrivacyRedact(candidate.rawContent ?? candidate.content ?? '');
  candidate.content = redacted;
  candidate.privacyFindings = findings;
  candidate.privacyChecked = true;
  candidate.status = findings.length === 0 ? candidate.status : 'privacy-fixed';
  saveArtifact('candidates', candidate);
  return {
    candidateId: candidate.id,
    findings,
    passed: findings.length === 0,
    redactedPreview: redacted.slice(0, 200),
  };
}

export async function factCheck({ cntId, piBridge }) {
  let candidate;
  if (cntId) {
    candidate = loadArtifact('candidates', cntId);
  } else {
    candidate = latestArtifact('candidates');
    if (!candidate) throw new Error('candidates 为空，请先 !distill now');
  }
  const localResult = runFactCheck(candidate.content ?? candidate.rawContent ?? '');
  let result = localResult;
  let llmEnhanced = false;

  if (piBridge?.available) {
    const llm = await piBridge.promptJSON(
      FACTCHECK_SYSTEM_PROMPT,
      candidate.content ?? candidate.rawContent ?? '',
      { timeoutMs: 60_000 },
    );
    if (llm?.claims) {
      const claims = llm.claims;
      const supported = claims.filter((c) => c.hasEvidence).length;
      result = {
        totalClaims: claims.length,
        supported,
        unsupported: claims.length - supported,
        details: claims.map((c) => ({ claim: c.claim, hasEvidence: c.hasEvidence, evidenceTypes: c.evidenceTypes ?? [], suggestion: c.suggestion ?? '' })),
        summary: llm.summary ?? '',
        passed: llm.passed ?? (claims.length - supported <= Math.ceil(claims.length * 0.3)),
      };
      llmEnhanced = true;
    }
  }

  candidate.factCheck = result;
  candidate.factChecked = true;
  candidate.factCheckLlmEnhanced = llmEnhanced;
  saveArtifact('candidates', candidate);
  return {
    candidateId: candidate.id,
    totalClaims: result.totalClaims,
    supported: result.supported,
    unsupported: result.unsupported,
    passed: result.passed,
    llmEnhanced,
  };
}

export async function renderPlatform({ cntId, platform, piBridge }) {
  if (!platform) throw new Error('!render 缺少 platform 参数');
  let candidate;
  if (cntId) {
    candidate = loadArtifact('candidates', cntId);
  } else {
    candidate = latestArtifact('candidates');
    if (!candidate) throw new Error('candidates 为空，请先 !distill now');
  }

  // 图片平台（小红书等）生成 PNG 卡片，文本平台生成 Markdown
  const isImagePlatform = IMAGE_PLATFORMS.includes(platform);
  let body = null;
  let renderFormat = 'markdown';
  let llmEnhanced = false;
  let pngBuffer = null;

  if (isImagePlatform) {
    // 图片平台：SVG → PNG
    renderFormat = 'png';
    const card = renderImageCard(candidate, platform);
    pngBuffer = card.png;
    body = card.svg; // SVG 源码存档
  } else if (piBridge?.available) {
    // 文本平台：LLM 生成 Markdown
    body = await piBridge.prompt(
      RENDER_SYSTEM_PROMPT(platform, candidate),
      '',
      { timeoutMs: 90_000 },
    );
    if (body && body.trim().length > 50 && !body.trim().startsWith('<!DOCTYPE')) {
      llmEnhanced = true;
    } else {
      body = null;
    }
  }
  if (!body && !isImagePlatform) {
    body = renderMarkdown(candidate, platform);
  }

  const id = genId('RND');
  const ext = renderFormat === 'png' ? 'png' : renderFormat === 'html' ? 'html' : 'md';
  const artifact = {
    id, type: 'render',
    createdAt: new Date().toISOString(),
    candidateId: candidate.id,
    platform,
    format: renderFormat,
    body,
    bytes: pngBuffer ? pngBuffer.length : Buffer.byteLength(body, 'utf8'),
    llmEnhanced,
    status: 'rendered',
  };
  const path = saveArtifact('renders', artifact);
  // 写文件
  const filePath = resolve(CONTENT_DIR, 'renders', `${id}.${ext}`);
  if (pngBuffer) {
    writeFileSync(filePath, pngBuffer);
  } else {
    writeFileSync(filePath, body, 'utf8');
  }
  return {
    renderId: id, path, filePath, platform, format: renderFormat,
    bytes: artifact.bytes, llmEnhanced,
    pngBuffer,
    card: {
      title: `[RENDER] ${id} · ${platform}${llmEnhanced ? ' 🤖' : ''}`,
      description: `渲染完成 · ${artifact.bytes} bytes${llmEnhanced ? ' · LLM' : ' · template'}\n候选: ${candidate.id}`,
      color: 0x6366f1,
      fields: [
        { name: 'RND', value: id, inline: true },
        { name: 'Platform', value: platform, inline: true },
        { name: 'Size', value: `${artifact.bytes}B`, inline: true },
      ],
    },
  };
}

export async function publishPlatform({ rndId, platform, publisher }) {
  let render;
  if (rndId) {
    render = loadArtifact('renders', rndId);
  } else {
    render = latestArtifact('renders');
    if (!render) throw new Error('renders 为空，请先 !render');
  }

  // 使用 publisher 发布（如果有）
  let externalUrl = null;
  let publishStatus = 'published';
  if (publisher) {
    try {
      const result = await publisher.publish({
        html: render.html,
        platform: platform ?? render.platform,
        metadata: { renderId: render.id, candidateId: render.candidateId },
      });
      externalUrl = result.externalUrl ?? null;
      publishStatus = result.status ?? 'published';
    } catch (e) {
      publishStatus = 'publish-failed';
      externalUrl = null;
    }
  }

  const id = genId('PUB');
  const artifact = {
    id,
    type: 'publish',
    createdAt: new Date().toISOString(),
    renderId: render.id,
    candidateId: render.candidateId,
    platform: platform ?? render.platform,
    status: publishStatus,
    externalUrl,
  };
  const path = saveArtifact('published', artifact);
  return {
    publishId: id,
    path,
    platform: artifact.platform,
    externalUrl,
    card: {
      title: `[PUBLISH] ${id} · ${artifact.platform}`,
      description: `发布完成\n渲染: ${render.id}${externalUrl ? `\nURL: ${externalUrl}` : ''}`,
      color: 0xec4899,
      fields: [
        { name: 'PUB', value: id, inline: true },
        { name: 'Platform', value: artifact.platform, inline: true },
      ],
    },
  };
}

export async function qaReport({ pubId, range }) {
  let pub;
  if (pubId) {
    pub = loadArtifact('published', pubId);
  } else {
    pub = latestArtifact('published');
    if (!pub) throw new Error('published 为空，请先 !publish');
  }
  const render = loadArtifact('renders', pub.renderId);
  const candidate = loadArtifact('candidates', pub.candidateId);
  const checks = {
    hasTitle: Boolean(candidate.title),
    hasContent: (candidate.content ?? '').length > 50,
    privacyClean: (candidate.privacyFindings ?? []).length === 0,
    factChecked: candidate.factChecked === true,
    scorePassed: (candidate.score?.total ?? 0) >= 24,
    hasBody: render.bytes > 200,
    hasHeadings: /^#{1,3} /.test(render.body ?? ''),
    hasFooter: /©/.test(render.body ?? ''),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  const id = genId('QA');
  const artifact = {
    id,
    type: 'qa',
    createdAt: new Date().toISOString(),
    publishId: pub.id,
    checks,
    passed,
    total,
    verdict: passed === total ? 'pass' : passed >= total - 1 ? 'pass-with-warnings' : 'fail',
  };
  const path = saveArtifact('qa', artifact);
  return {
    qaId: id,
    path,
    passed,
    total,
    verdict: artifact.verdict,
    checks,
    card: {
      title: `[QA] ${id} · ${artifact.verdict.toUpperCase()} · ${passed}/${total}`,
      description: `质量检查完成\n发布: ${pub.id} · 平台: ${pub.platform}`,
      color: artifact.verdict === 'pass' ? 0x22c55e : artifact.verdict === 'pass-with-warnings' ? 0xeab308 : 0xef4444,
      fields: Object.entries(checks).map(([k, v]) => ({ name: k, value: v ? '✅' : '❌', inline: true })),
    },
  };
}

export async function autoRender({ cntId, platforms, piBridge }) {
  if (!cntId) {
    const c = latestArtifact('candidates');
    if (!c) throw new Error('candidates 为空，请先 !distill now');
    cntId = c.id;
  }
  const targets = platforms ?? ['wechat', 'xiaohongshu', 'x', 'newsletter'];
  const results = [];
  for (const platform of targets) {
    try {
      const r = await renderPlatform({ cntId, platform, piBridge });
      results.push({ platform, renderId: r.renderId, bytes: r.bytes, llmEnhanced: r.llmEnhanced, ok: true });
    } catch (e) {
      results.push({ platform, error: e.message, ok: false });
    }
  }
  const ok = results.filter((r) => r.ok);
  return {
    cntId,
    platforms: targets,
    rendered: ok.length,
    total: targets.length,
    renderIds: ok.map((r) => r.renderId),
    results,
    card: {
      title: `[AUTO-RENDER] ${cntId} · ${ok.length}/${targets.length} 平台`,
      description: results.map((r) => `${r.ok ? '✅' : '❌'} ${r.platform}: ${r.renderId ?? r.error}`).join('\n'),
      color: ok.length === targets.length ? 0x22c55e : 0xeab308,
      fields: ok.map((r) => ({ name: r.platform, value: r.renderId, inline: true })),
    },
  };
}

export const CONTENT_DIR_PATH = CONTENT_DIR;

export function listContent(subdir) {
  ensureDirs();
  const dir = resolve(CONTENT_DIR, subdir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const a = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      return { id: a.id, type: a.type, status: a.status, createdAt: a.createdAt };
    });
}
