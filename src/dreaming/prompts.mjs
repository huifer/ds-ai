// ~/pi-discord-agents/src/dreaming/prompts.mjs
// 「遐思」prompt 模板加载器。
//
// 每个 phase 对应一个 .txt 文件,运行时用 {{占位符}} 注入数据。
// PR1:只装载文件 + 做最基本注入,具体模板留到 PR2/PR3。

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, 'prompts');

export async function loadPrompt(name) {
  // name 可带或不带 .txt
  const file = name.endsWith('.txt') ? name : `${name}.txt`;
  const path = join(PROMPTS_DIR, file);
  return await readFile(path, 'utf8');
}

export function renderPrompt(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) return String(vars[key]);
    return `{{${key}}}`; // 保留原样,便于排查缺字段
  });
}