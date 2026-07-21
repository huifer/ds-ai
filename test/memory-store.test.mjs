// ~/pi-discord-agents/test/memory-store.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMemoryStore } from '../src/memory-store.mjs';
import { createEmbedder } from '../src/embedder.mjs';

let store, embedder, rootDir;

test.before(async () => {
  rootDir = mkdtempSync(join(tmpdir(), 'pi-memory-'));
  embedder = await createEmbedder({ log: () => {} });
  const det = await embedder.detect();
  if (!det.available) console.warn('embedder 不可用,跳过 embedding 相关断言');
  store = await createMemoryStore({ rootDir, embedder, log: () => {} });
});

test.after(async () => {
  await store.compact();
  await new Promise((r) => setTimeout(r, 100));
  rmSync(rootDir, { recursive: true, force: true });
});

test('upsert 创建 + 重复 upsert 自动 superseded', async () => {
  const subject = `t1-${Date.now()}`;
  const a = await store.upsert({
    kind: 'preference', scope: 'user', subject, content: 'A version.',
  });
  assert.equal(a.action, 'created');
  assert.equal(a.revision, 1);

  const b = await store.upsert({
    kind: 'preference', scope: 'user', subject, content: 'B version.',
  });
  assert.equal(b.action, 'updated');
  assert.equal(b.revision, 2);
  assert.ok(b.supersedes.includes(a.id));
  // 验证文件确实生成
  assert.ok(store.readContent(a.id) || store.readContent(b.id));
});

test('content.md 有 YAML frontmatter 和变更记录', async () => {
  const subject = `t-md-${Date.now()}`;
  await store.upsert({ kind: 'fact', scope: 'user', subject, content: 'fact A' });
  const b = await store.upsert({ kind: 'fact', scope: 'user', subject, content: 'fact B revised' });
  const md = store.readContent(b.id);
  assert.ok(md.includes('---'));
  assert.ok(md.includes('kind: fact'));
  assert.ok(md.includes('subject: ' + subject));
  assert.ok(md.includes('revision: 2'));
  assert.ok(md.includes('## 变更记录'));
  assert.ok(md.includes('revision 1'));
});

test('query 过滤 status=active', async () => {
  const subject = `t-active-${Date.now()}`;
  await store.upsert({ kind: 'fact', scope: 'user', subject, content: 'test fact' });
  const a = await store.query({ subject });
  assert.equal(a.items.length, 1);
  assert.equal(a.items[0].status, 'active');

  await store.revoke({ subject });
  const b = await store.query({ subject });
  assert.equal(b.items.length, 0);
});

test('query kind / tags 过滤', async () => {
  const subjectA = `t-ka-${Date.now()}`;
  const subjectB = `t-kb-${Date.now()}`;
  await store.upsert({ kind: 'decision', scope: 'user', subject: subjectA, content: 'd1' });
  await store.upsert({ kind: 'fact', scope: 'user', subject: subjectB, content: 'f1', tags: ['x'] });
  const r = await store.query({ kind: 'decision' });
  assert.ok(r.items.some((i) => i.subject === subjectA));
  const r2 = await store.query({ tags: ['x'] });
  assert.ok(r2.items.some((i) => i.subject === subjectB));
});

test('revoke by id / by subject', async () => {
  const subject1 = `t-r1-${Date.now()}`;
  const a = await store.upsert({ kind: 'fact', scope: 'user', subject: subject1, content: 'x' });
  const r1 = await store.revoke({ id: a.id });
  assert.equal(r1.count, 1);
  const subject2 = `t-r2-${Date.now()}`;
  const e2 = await store.upsert({ kind: 'fact', scope: 'user', subject: subject2, content: 'x' });
  const r2 = await store.revoke({ subject: subject2 });
  assert.equal(r2.count, 1);
  assert.deepEqual(r2.ids, [e2.id]);
});

test('buildContext 按 userText 选 N 条', async () => {
  const subject1 = `t-ctx-1-${Date.now()}`;
  const subject2 = `t-ctx-2-${Date.now()}`;
  await store.upsert({ kind: 'preference', scope: 'user', subject: subject1, content: 'Prefer TypeScript for new projects.' });
  await store.upsert({ kind: 'fact', scope: 'user', subject: subject2, content: 'Project uses Pi agent.' });
  const ctx = await store.buildContext({ userText: 'TypeScript', limit: 5 });
  assert.ok(ctx.includes('<memory-digest>'));
  assert.ok(ctx.includes('</memory-digest>'));
  assert.ok(ctx.includes('TypeScript'));
});

test('hybrid 查询 FTS + 向量', async () => {
  const subject = `t-hyb-${Date.now()}`;
  await store.upsert({ kind: 'preference', scope: 'user', subject, content: 'Always use strict TypeScript configuration.' });
  const r = await store.query({ contains: 'TypeScript', mode: 'hybrid', limit: 5 });
  assert.ok(r.items.length >= 1);
});

test('partial unique 索引:同 (scope,subject,kind) 只能一个 active', async () => {
  const subject = `t-uniq-${Date.now()}`;
  const a = await store.upsert({ kind: 'fact', scope: 'user', subject, content: 'v1' });
  const b = await store.upsert({ kind: 'fact', scope: 'user', subject, content: 'v2' });
  assert.equal(b.action, 'updated');
  const r = await store.query({ subject });
  assert.equal(r.items.length, 1);
});

test('stats 准确', async () => {
  const before = (await store.stats()).total;
  await store.upsert({ kind: 'preference', scope: 'user', subject: `t-stat-1-${Date.now()}`, content: 'a' });
  await store.upsert({ kind: 'fact', scope: 'user', subject: `t-stat-2-${Date.now()}`, content: 'b' });
  const s = await store.stats();
  assert.ok(s.total >= before + 2);
  assert.ok(s.vectorCount >= 2);
});

test('compact 删除 90 天前的 superseded', async () => {
  const { writeFileSync, mkdirSync, existsSync, utimesSync } = await import('node:fs');
  const id = `t-old-${Date.now()}`;
  // 直接构造一个老的 superseded
  const dir = join(rootDir, 'data', 'memory', 'store', id);
  mkdirSync(dir, { recursive: true });
  const oldDate = new Date(Date.now() - 200 * 86400_000).toISOString();
  writeFileSync(join(dir, 'meta.json'), JSON.stringify({
    id, kind: 'fact', scope: 'user', subject: 'old', content: 'old', tags: [],
    status: 'superseded', revision: 1, supersedes: [], createdAt: oldDate, updatedAt: oldDate,
  }));
  const r = await store.compact();
  assert.ok(r.removed >= 1, `removed >= 1, got ${r.removed}`);
  assert.ok(!existsSync(join(dir, 'meta.json')));
});

test('index.json 同步状态', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  const subject = `t-idx-${Date.now()}`;
  const r = await store.upsert({ kind: 'fact', scope: 'user', subject, content: 'indexed' });
  const idxPath = store.getIndexFile();
  assert.ok(existsSync(idxPath));
  const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
  assert.ok(idx.some((i) => i.id === r.id));
});
