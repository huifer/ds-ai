// extensions/file-tools.mjs
// Pi Extension — 提供 2 个本地文件工具,被 entry-bot 用 `--extension` 加载。
//
// 设计动机:RSS hub 和每日总结要落本地 md 留底,Pi 需要有写文件的能力。
// 路径白名单:只允许写到项目内的 data/ 目录,防越权。
import { Type } from '@sinclair/typebox';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
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