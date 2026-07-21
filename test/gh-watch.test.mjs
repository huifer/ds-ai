import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addWatchedRepo,
  normalizeRepoName,
  readWatchFile,
  removeWatchedRepo,
  writeWatchFile,
} from '../src/gh-watch.mjs';

test('GitHub repo names are normalized and validated', () => {
  assert.equal(normalizeRepoName('https://github.com/safeindie/demo.git'), 'safeindie/demo');
  assert.equal(normalizeRepoName('github.com/safeindie/demo/'), 'safeindie/demo');
  assert.throws(() => normalizeRepoName('safeindie'), /owner\/repo/);
  assert.throws(() => normalizeRepoName('safeindie/demo issue'), /owner\/repo/);
});

test('watch pool add/remove is deduplicated and persisted atomically', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pi-discord-agents-'));
  const path = join(dir, 'gh-watch.json');
  try {
    writeWatchFile(['safeindie/one'], path);
    const added = addWatchedRepo('safeindie/two', path);
    assert.equal(added.added, true);
    assert.deepEqual(added.repos, ['safeindie/one', 'safeindie/two']);

    const duplicate = addWatchedRepo('SAFEINDIE/ONE', path);
    assert.equal(duplicate.added, false);
    assert.equal(readWatchFile(path).repos.length, 2);

    const removed = removeWatchedRepo('safeindie/one', path);
    assert.equal(removed.removed, true);
    assert.deepEqual(readWatchFile(path).repos, ['safeindie/two']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
