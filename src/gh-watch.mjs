// src/gh-watch.mjs
// GitHub 仓库监控池的读写工具。
//
// 设计目标:
//   - !watch 命令和每日推送脚本共享同一份数据文件
//   - 规范化 owner/repo,避免重复和脏数据
//   - 使用临时文件 + rename,避免定时任务读到半写入 JSON
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

export const GH_WATCH_PATH = resolve(homedir(), 'pi-discord-agents', 'data', 'gh-watch.json');

const REPO_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/**
 * 把 GitHub URL / owner/repo 统一成 owner/repo。
 * 只接受仓库名,不接受 issue URL、分支 URL 或任意 shell 字符串。
 */
export function normalizeRepoName(input) {
  let value = String(input || '').trim();
  value = value
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\.git\/?$/i, '')
    .replace(/\/$/, '');

  if (!REPO_RE.test(value)) {
    throw new Error('仓库格式必须是 `owner/repo`，例如 `safeindie/deepseek-v4.io`');
  }
  return value;
}

function emptyWatch() {
  return { repos: [], updatedAt: null };
}

export function readWatchFile(filePath = GH_WATCH_PATH) {
  if (!existsSync(filePath)) return emptyWatch();
  const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!parsed || !Array.isArray(parsed.repos)) {
    throw new Error(`仓库监控池格式错误: ${filePath}`);
  }

  const repos = [];
  const seen = new Set();
  for (const raw of parsed.repos) {
    try {
      const repo = normalizeRepoName(raw);
      const key = repo.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        repos.push(repo);
      }
    } catch {
      // 旧文件里的坏条目不让整个 daemon 崩溃,读取时忽略;写回时会被清理。
    }
  }
  return { repos, updatedAt: parsed.updatedAt || null };
}

export function writeWatchFile(repos, filePath = GH_WATCH_PATH) {
  const normalized = [];
  const seen = new Set();
  for (const raw of repos) {
    const repo = normalizeRepoName(raw);
    const key = repo.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(repo);
    }
  }

  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  const payload = JSON.stringify({
    repos: normalized,
    updatedAt: new Date().toISOString(),
  }, null, 2) + '\n';
  try {
    writeFileSync(tmpPath, payload, { encoding: 'utf8', mode: 0o600 });
    renameSync(tmpPath, filePath);
  } catch (error) {
    try { if (existsSync(tmpPath)) unlinkSync(tmpPath); } catch {}
    throw error;
  }
  return normalized;
}

export function addWatchedRepo(repoInput, filePath = GH_WATCH_PATH) {
  const repo = normalizeRepoName(repoInput);
  const current = readWatchFile(filePath).repos;
  const exists = current.some((x) => x.toLowerCase() === repo.toLowerCase());
  if (!exists) writeWatchFile([...current, repo], filePath);
  return { repo, added: !exists, repos: exists ? current : [...current, repo] };
}

export function removeWatchedRepo(repoInput, filePath = GH_WATCH_PATH) {
  const repo = normalizeRepoName(repoInput);
  const current = readWatchFile(filePath).repos;
  const repos = current.filter((x) => x.toLowerCase() !== repo.toLowerCase());
  if (repos.length === current.length) {
    return { repo, removed: false, repos: current };
  }
  writeWatchFile(repos, filePath);
  return { repo, removed: true, repos };
}
