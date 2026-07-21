// extensions/file-tools.mjs
// Pi Extension — 提供 2 个本地文件工具,被 entry-bot 用 `--extension` 加载。
//
// 设计动机:RSS hub 和每日总结要落本地 md 留底,Pi 需要有写文件的能力。
// 路径白名单:只允许写到项目内的 data/ 目录,防越权。
import { Type } from '@sinclair/typebox';
import { writeFileSync, readFileSync, mkdirSync, existsSync, cpSync, readdirSync } from 'node:fs';
import { resolve, dirname, isAbsolute, relative } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');
// 允许的写入根:data/ 目录下任意子目录(rss / daily-summary)
function resolveSafe(relativePath) {
  // 强制相对路径,不允许 ..
  if (isAbsolute(relativePath)) throw new Error('不允许绝对路径');
  const norm = relativePath.replace(/^\.\//, '');
  if (norm.startsWith('..')) throw new Error('不允许跳出');
  const abs = resolve(ROOT, norm);
  const rel = relative(ROOT, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('解析后跳出项目根');
  return abs;
}

export default function (pi) {
  // ----- write_file -----
  pi.registerTool({
    name: 'write_file',
    label: 'write_file',
    description:
      '把内容写到项目内 data/ 目录下的任意路径(相对项目根,如 data/rss/2026-07-18.md)。' +
      '会自动创建父目录。路径不允许跳出项目根。' +
      '主要用途:RSS hub / 每日总结 把生成的 md 落到本地留底。',
    parameters: Type.Object({
      path: Type.String({ description: '相对项目根的路径,例如 data/rss/2026-07-18.md' }),
      content: Type.String({ description: '要写入的完整内容' }),
      append: Type.Optional(Type.Boolean({ description: '是否追加(默认 false 覆盖)' })),
    }),
    execute: async (_id, args, _signal, _onUpdate) => {
      try {
        const abs = resolveSafe(args.path);
        mkdirSync(dirname(abs), { recursive: true });
        if (args.append) {
          // append 模式:存在则拼接
          const prev = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
          writeFileSync(abs, prev + args.content, 'utf8');
        } else {
          writeFileSync(abs, args.content, 'utf8');
        }
        const size = Buffer.byteLength(args.content, 'utf8');
        return {
          content: [{ type: 'text', text: JSON.stringify({ ok: true, path: args.path, bytes: size, appended: !!args.append }, null, 2) }],
        };
      } catch (e) {
        return { content: [{ type: 'text', text: `写入失败: ${e.message}` }], isError: true };
      }
    },
  });

  // ----- read_file -----
  pi.registerTool({
    name: 'read_file',
    label: 'read_file',
    description:
      '读取项目内 data/ 目录下的文件内容(相对项目根)。用于读取用户画像 ~/summary/profile 等。',
    parameters: Type.Object({
      path: Type.String({ description: '相对项目根的路径,例如 data/rss/2026-07-18.md' }),
      max_bytes: Type.Optional(Type.Number({ description: '最多返回字节数,默认 50000' })),
    }),
    execute: async (_id, args, _signal, _onUpdate) => {
      try {
        const abs = resolveSafe(args.path);
        if (!existsSync(abs)) {
          return { content: [{ type: 'text', text: `文件不存在: ${args.path}` }], isError: true };
        }
        const maxBytes = args.max_bytes || 50000;
        const buf = readFileSync(abs);
        const text = buf.slice(0, maxBytes).toString('utf8');
        return {
          content: [{ type: 'text', text: JSON.stringify({ ok: true, path: args.path, bytes: buf.byteLength, truncated: buf.byteLength > maxBytes, content: text }, null, 2) }],
        };
      } catch (e) {
        return { content: [{ type: 'text', text: `读取失败: ${e.message}` }], isError: true };
      }
    },
  });
}
// ===== 5 个新 writer（阶段 1 Day 3）=====

function registerFileWriters(pi) {
  pi.registerTool({
    name: 'write_html',
    label: 'write_html',
    description: '把 HTML 写到项目内 data/ 目录。',
    parameters: Type.Object({
      path: Type.String({ description: '相对路径，如 data/agent-runtime/drafts/xxx.html' }),
      content: Type.String(),
    }),
    execute: async (_id, args) => {
      try {
        const abs = resolveSafe(args.path);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, args.content, 'utf8');
        return { content: [{ type: 'text', text: `wrote HTML ${args.path} (${args.content.length} bytes)` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `write_html 失败: ${e.message}` }], isError: true };
      }
    },
  });

  pi.registerTool({
    name: 'write_pdf',
    label: 'write_pdf',
    description: '把 PDF（base64 编码或本地 playwright 产物）保存到 data/ 目录。',
    parameters: Type.Object({
      path: Type.String(),
      base64: Type.Optional(Type.String()),
      srcHtmlPath: Type.Optional(Type.String()),
    }),
    execute: async (_id, args) => {
      try {
        const abs = resolveSafe(args.path);
        mkdirSync(dirname(abs), { recursive: true });
        if (args.base64) {
          writeFileSync(abs, Buffer.from(args.base64, 'base64'));
        } else if (args.srcHtmlPath) {
          // srcHtmlPath 分支：复制源 HTML 到目标（HTML→图片渲染由 renderer-agent 用 playwright 完成，非本工具职责）
          const src = resolveSafe(args.srcHtmlPath);
          if (!existsSync(src)) throw new Error(`src not found: ${args.srcHtmlPath}`);
          writeFileSync(abs, readFileSync(src));
        } else {
          throw new Error('必须提供 base64 或 srcHtmlPath');
        }
        return { content: [{ type: 'text', text: `wrote PDF ${args.path}` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `write_pdf 失败: ${e.message}` }], isError: true };
      }
    },
  });

  pi.registerTool({
    name: 'write_kp',
    label: 'write_kp',
    description: '把 knowledge-pack 文件（kp-XX-name.md）写到 data/business/accounts/<id>/projects/<PRJ-ID>/knowledge-pack/。',
    parameters: Type.Object({
      prjId: Type.String(),
      file: Type.String({ description: 'kp-01-domain.md / kp-02-users.md / ...' }),
      content: Type.String(),
    }),
    execute: async (_id, args) => {
      try {
        const safe = safePrjPath(args.prjId, `knowledge-pack/${args.file}`);
        writeFileSync(safe.abs, args.content, 'utf8');
        return { content: [{ type: 'text', text: `wrote KP ${args.file} for ${args.prjId}` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `write_kp 失败: ${e.message}` }], isError: true };
      }
    },
  });

  pi.registerTool({
    name: 'write_prd',
    label: 'write_prd',
    description: '把 PRD 文档写到 data/business/accounts/<id>/projects/<PRJ-ID>/prd/。',
    parameters: Type.Object({
      prjId: Type.String(),
      version: Type.String({ description: 'v0.1 / v1.0 / v1.1' }),
      content: Type.String(),
    }),
    execute: async (_id, args) => {
      try {
        const safe = safePrjPath(args.prjId, `prd/prd-${args.version}.md`);
        writeFileSync(safe.abs, args.content, 'utf8');
        return { content: [{ type: 'text', text: `wrote PRD ${args.version} for ${args.prjId}` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `write_prd 失败: ${e.message}` }], isError: true };
      }
    },
  });

  pi.registerTool({
    name: 'write_demo',
    label: 'write_demo',
    description: '把 React 项目目录拷贝到 data/business/projects/<alias>/。',
    parameters: Type.Object({
      alias: Type.String(),
      srcPath: Type.String({ description: '源目录绝对路径' }),
    }),
    execute: async (_id, args) => {
      try {
        const target = resolve(ROOT, 'data/business/projects', args.alias);
        if (!existsSync(args.srcPath)) throw new Error(`src 目录不存在: ${args.srcPath}`);
        mkdirSync(target, { recursive: true });
        cpSync(args.srcPath, target, { recursive: true });
        return { content: [{ type: 'text', text: `copied ${args.srcPath} → ${target}` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `write_demo 失败: ${e.message}` }], isError: true };
      }
    },
  });
}

function safePrjPath(prjId, rel) {
  // 路径必须形如 data/business/accounts/<account-id>/projects/<prjId>/<rel>
  if (rel.startsWith('/') || rel.includes('..')) throw new Error('bad rel path');
  // 反查真实 account-id：扫描 data/business/accounts/*/projects/<prjId>/（由 !pr new 创建）
  const accountsDir = resolve(ROOT, 'data/business/accounts');
  let accountId = null;
  try {
    for (const acc of readdirSync(accountsDir)) {
      if (existsSync(resolve(accountsDir, acc, 'projects', prjId))) { accountId = acc; break; }
    }
  } catch {}
  if (!accountId) throw new Error(`未找到项目 ${prjId} 的 account 目录（先用 !pr new 创建项目）`);
  const real = resolve(accountsDir, accountId, 'projects', prjId, rel);
  mkdirSync(dirname(real), { recursive: true });
  return { abs: real };
}

export { registerFileWriters };
