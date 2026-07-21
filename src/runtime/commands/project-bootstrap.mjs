// ~/pi-discord-agents/src/runtime/commands/project-bootstrap.mjs
// pm-agent 调用：!pr new <alias> <industry> <一句话需求>
// 1. 在 data/business/projects/index.yaml 增加元数据
// 2. 创建 data/business/accounts/<account-id>/projects/<PRJ-ID>/ 目录骨架
// 3. 返回 Kanban 卡片内容

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = process.cwd();
const INDUSTRIES = new Set([
  'ai-agent', 'saas', 'data-analytics', 'cross-border-ecommerce', 'internal-tools', 'generic',
]);

export async function projectBootstrap({ alias, industry, requirement, channel, dryRun = false }) {
  if (!alias || !industry || !requirement) {
    throw new Error('!pr new 缺少参数：alias / industry / requirement');
  }
  if (!INDUSTRIES.has(industry)) {
    throw new Error(`!pr new 不支持的行业：${industry}`);
  }
  const today = new Date().toISOString().slice(0, 10);
  const ymd = today.replaceAll('-', '');
  const prjId = `PRJ-${ymd}-${randomShort()}`;
  const accountId = inferAccount(alias);

  // 1. index.yaml
  const indexPath = resolve(ROOT, 'data/business/projects/index.yaml');
  if (!dryRun) {
    const index = existsSync(indexPath)
      ? parseSimpleYaml(readFileSync(indexPath, 'utf8'))
      : [];
    index.unshift({
      id: prjId,
      alias,
      industry,
      line: 'FDE',
      stage: 'setup',
      repo: prjId,
      channel: {
        pm: channel || 'CH_PROJECT_MGMT',
        demo: 'CH_FDE_DELIVERY',
      },
      created_at: new Date().toISOString(),
      owner: 'huifer',
    });
    // 确保 index.yaml 的父目录存在
    mkdirSync(resolve(indexPath, '..'), { recursive: true });
    writeFileSync(indexPath, toYaml(index), 'utf8');
  }

  // 2. project 目录骨架
  const root = resolve(ROOT, 'data/business/accounts', accountId, 'projects', prjId);
  if (!dryRun) {
    for (const dir of ['brief', 'knowledge-pack', 'prd', 'demo', 'research/alg-XX-name', 'build']) {
      mkdirSync(join(root, dir), { recursive: true });
    }
    writeFileSync(join(root, 'README.md'), `# ${prjId} · ${alias}\n\n行业: ${industry}\n一句话需求: ${requirement}\n创建时间: ${new Date().toISOString()}\n`, 'utf8');
    // 复制 kp-XX 模板
    for (const kp of ['kp-01-domain.md', 'kp-02-users.md', 'kp-03-integration.md', 'kp-04-constraints.md', 'kp-05-risks.md', 'kp-06-similar-products.md']) {
      const src = resolve(ROOT, 'agent-core/enterprise/templates/knowledge-pack.md');
      const dst = join(root, 'knowledge-pack', kp);
      if (existsSync(src)) {
        // 用一个共享模板 + 标题区分每个 kp
        const base = readFileSync(src, 'utf8');
        writeFileSync(dst, base.replace('# knowledge-pack 模板', `# ${kp.replace('.md', '')} · ${alias}`), 'utf8');
      }
    }
    // 复制行业 PRD
    const industryPrd = resolve(ROOT, `agent-core/enterprise/templates/prd/${industry}.md`);
    if (existsSync(industryPrd)) {
      copyFileSync(industryPrd, join(root, 'prd/prd-v0.1.md'));
    } else {
      const generic = resolve(ROOT, 'agent-core/enterprise/templates/prd/internal-tools.md');
      if (existsSync(generic)) copyFileSync(generic, join(root, 'prd/prd-v0.1.md'));
    }
  }

  return {
    prjId,
    alias,
    industry,
    accountId,
    projectRoot: root,
    kanban: {
      title: `[SETUP] ${prjId} · ${alias}`,
      description: `行业: ${industry}\n需求: ${requirement}`,
      color: 0x64748b,
      fields: [
        { name: 'PRJ', value: prjId, inline: true },
        { name: 'Alias', value: alias, inline: true },
        { name: 'Industry', value: industry, inline: true },
      ],
      footer: { text: 'created at ' + new Date().toISOString() },
    },
  };
}

function inferAccount(alias) {
  return `acc-${alias.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()}`;
}

function randomShort() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// 极简 YAML 读写（仅支持我们写的 list of map）
function toYaml(items) {
  const lines = [];
  for (const it of items) {
    lines.push(`- id: ${it.id}`);
    lines.push(`  alias: ${it.alias}`);
    lines.push(`  industry: ${it.industry}`);
    lines.push(`  line: ${it.line}`);
    lines.push(`  stage: ${it.stage}`);
    lines.push(`  repo: ${it.repo}`);
    if (it.channel && typeof it.channel === 'object') {
      lines.push(`  channel:`);
      lines.push(`    pm: ${it.channel.pm ?? ''}`);
      lines.push(`    demo: ${it.channel.demo ?? ''}`);
    } else if (it.channel) {
      // 兼容历史：当作 pm 字段
      lines.push(`  channel:`);
      lines.push(`    pm: ${it.channel}`);
    }
    lines.push(`  created_at: ${it.created_at}`);
    lines.push(`  owner: ${it.owner}`);
  }
  return lines.join('\n') + '\n';
}

function parseSimpleYaml(text) {
  const items = [];
  const lines = text.split('\n');
  let cur = null;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    if (raw.trim().startsWith('#')) continue;
    if (raw.startsWith('  - ') || raw.startsWith('- ')) {
      if (cur) items.push(cur);
      cur = { channel: {} };
      const m = raw.match(/^\s*-\s*([a-zA-Z0-9_]+):\s*(.*)$/);
      if (m) cur[m[1]] = stripQuotes(m[2]);
      continue;
    }
    const m = raw.match(/^\s{2,4}([a-zA-Z0-9_]+):\s*(.*)$/);
    if (m && cur) {
      const k = m[1];
      const v = stripQuotes(m[2]);
      if (k === 'pm' && cur.channel) cur.channel.pm = v;
      else if (k === 'demo' && cur.channel) cur.channel.demo = v;
      else cur[k] = v;
    }
  }
  if (cur) items.push(cur);
  return items;
}

function stripQuotes(s) {
  s = s.trim();
  if (s.startsWith("'") && s.endsWith("'")) s = s.slice(1, -1);
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  return s;
}
