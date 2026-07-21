// ~/pi-discord-agents/scripts/run-all-jobs.mjs
// 手动执行所有未完成的定时任务

import { loadConfig } from '../src/config.mjs';
import { createMemoryStore } from '../src/memory-store.mjs';
import { createMemoryGovernance } from '../src/memory-governance.mjs';
import { createMemoryQuality } from '../src/memory-quality.mjs';
import { createEmbedder } from '../src/embedder.mjs';
import { createMemoryDistiller } from '../src/memory-distiller.mjs';
import { createMemoryJournal } from '../src/memory-journal.mjs';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

function log(...args) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[run-all-jobs ${ts}] ${args.join(' ')}`);
}

async function runGithubTodo() {
  log('📋 开始执行 GitHub 待办列表任务...');

  return new Promise((resolve) => {
    const script = join(ROOT, 'scripts', 'push-gh-list.mjs');
    const child = spawn('node', [script], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';

    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('close', code => {
      if (code === 0) {
        log('✅ GitHub 待办列表任务完成');
      } else {
        log('⚠️  GitHub 待办列表任务退出码:', code);
      }
      if (out) log('  输出:', out.trim().split('\n').slice(-3).join(' | '));
      if (err) log('  错误:', err.trim().split('\n').slice(-3).join(' | '));
      resolve();
    });

    child.on('error', e => {
      log('❌ GitHub 待办列表任务失败:', e.message);
      resolve();
    });
  });
}

async function runMemoryGovernance() {
  log('🧹 开始执行记忆治理任务...');

  try {
    const embedder = await createEmbedder({ log: () => {} });
    const memoryStore = await createMemoryStore({
      rootDir: ROOT,
      embedder,
      log: () => {},
    });
    const memoryGovernance = createMemoryGovernance({ memoryStore, log });

    const result = await memoryGovernance.runGovernance({ dryRun: false });
    log(`✅ 记忆治理完成: 过期=${result.expired}, 归档=${result.archived}, 删除=${result.deleted}, 矛盾=${result.conflicts}`);
  } catch (e) {
    log('❌ 记忆治理失败:', e.message);
  }
}

async function runMemoryQuality() {
  log('📊 开始执行记忆质量更新任务...');

  try {
    const embedder = await createEmbedder({ log: () => {} });
    const memoryStore = await createMemoryStore({
      rootDir: ROOT,
      embedder,
      log: () => {},
    });
    const memoryQuality = createMemoryQuality({ memoryStore, log });

    const result = await memoryQuality.batchUpdate({ dryRun: false });
    log(`✅ 记忆质量更新完成: 更新=${result.updated}, 跳过=${result.skipped}`);
  } catch (e) {
    log('❌ 记忆质量更新失败:', e.message);
  }
}

async function runMemoryDistillation() {
  log('🧠 开始执行记忆蒸馏任务...');

  try {
    const embedder = await createEmbedder({ log: () => {} });
    const memoryStore = await createMemoryStore({
      rootDir: ROOT,
      embedder,
      log: () => {},
    });
    const memoryJournal = createMemoryJournal({ memoryStore, log: () => {} });
    const memoryDistiller = createMemoryDistiller({
      memoryStore,
      journal: memoryJournal,  // 修正参数名
      embedder,
      log: () => {},
    });

    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
    const tzMs = utcMs + 8 * 3600_000;
    const d = new Date(tzMs);
    const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    const result = await memoryDistiller.distillNow({
      reason: 'manual',
      dateKeyStr: dateKey,
    });
    log(`✅ 记忆蒸馏完成: 提取=${result.count} 条记忆`);
  } catch (e) {
    log('❌ 记忆蒸馏失败:', e.message);
  }
}

async function main() {
  log('🚀 开始执行所有未完成的定时任务...\n');

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('📋 GitHub 待办列表 (10:00)');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await runGithubTodo();
  log('');

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('🧹 记忆治理 (周日 02:00)');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await runMemoryGovernance();
  log('');

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('📊 记忆质量更新 (周日 03:00)');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await runMemoryQuality();
  log('');

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('🧠 记忆蒸馏 (23:30) - 提前执行');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await runMemoryDistillation();
  log('');

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('🎉 所有任务执行完成！');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(e => {
  log('❌ 执行失败:', e.message);
  console.error(e);
  process.exit(1);
});