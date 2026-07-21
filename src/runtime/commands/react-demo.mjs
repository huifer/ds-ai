// ~/pi-discord-agents/src/runtime/commands/react-demo.mjs
// coding-agent 调用：!demo new <PRJ-ID>
// 1. 从 data/business/projects/index.yaml 找 alias / industry
// 2. 拷贝 agent-core/enterprise/templates/demo-react/ 到 data/business/projects/<alias>/
// 3. 注入项目 id / alias / industry
// 4. 返回 Discord demo card payload

import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = process.cwd();
const TEMPLATE_DIR = resolve(ROOT, 'agent-core/enterprise/templates/demo-react');
const ALIASES_INDEX = resolve(ROOT, 'data/business/projects/index.yaml');

function parseIndex(text) {
  const items = [];
  const lines = text.split('\n');
  let cur = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (line.startsWith('- ')) {
      if (cur) items.push(cur);
      cur = { channel: {} };
      const m = line.match(/^\s*-\s*([a-zA-Z0-9_]+):\s*(.*)$/);
      if (m) cur[m[1]] = stripQuotes(m[2]);
      continue;
    }
    const m = line.match(/^\s{2,4}([a-zA-Z0-9_]+):\s*(.*)$/);
    if (m && cur) {
      const k = m[1];
      const v = stripQuotes(m[2]);
      if (k === 'pm') ensureChannel(cur).pm = v;
      else if (k === 'demo') ensureChannel(cur).demo = v;
      else cur[k] = v;
    }
  }
  if (cur) items.push(cur);
  return items;
}

function ensureChannel(cur) {
  if (typeof cur.channel !== 'object' || cur.channel === null) cur.channel = {};
  return cur.channel;
}

function stripQuotes(s) {
  s = s.trim();
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) s = s.slice(1, -1);
  return s;
}

export async function reactDemoNew({ prjId, alias, industry, dryRun = false }) {
  if (!prjId) throw new Error('reactDemoNew 缺少 prjId');
  if (existsSync(ALIASES_INDEX)) {
    const items = parseIndex(readFileSync(ALIASES_INDEX, 'utf8'));
    const found = items.find((it) => it.id === prjId);
    if (!found) throw new Error(`prjId ${prjId} 不在 index.yaml 中`);
    alias = alias ?? found.alias;
    industry = industry ?? found.industry;
  }
  if (!alias) throw new Error('reactDemoNew 缺少 alias（请先 !pr new 创建）');
  if (!industry) industry = 'generic';

  const target = resolve(ROOT, 'data/business/projects', alias);
  if (!existsSync(TEMPLATE_DIR)) {
    throw new Error(`demo-react 模板不存在：${TEMPLATE_DIR}`);
  }
  if (!dryRun) {
    mkdirSync(target, { recursive: true });
    cpSync(TEMPLATE_DIR, target, { recursive: true, dereference: true });
    const pkgPath = join(target, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      pkg.name = `@zenbuild/${alias}-demo`;
      pkg.__zenbuild = { prjId, alias, industry, generatedAt: new Date().toISOString() };
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    }
  }

  return {
    prjId,
    alias,
    industry,
    projectRoot: target,
    demoCard: {
      title: `Demo ready · ${alias}`,
      description: `Project \`${prjId}\` · industry=${industry}\nRun \`pnpm install && pnpm dev\` in \`${target}\``,
      color: 0x22d3ee,
      fields: [
        { name: 'PRJ', value: prjId, inline: true },
        { name: 'Alias', value: alias, inline: true },
        { name: 'Industry', value: industry, inline: true },
        { name: 'Path', value: target.replace(ROOT, '.'), inline: false },
      ],
    },
  };
}
