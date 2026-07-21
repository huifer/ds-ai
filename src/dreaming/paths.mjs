// ~/pi-discord-agents/src/dreaming/paths.mjs
// 「遐思」系统所有路径常量 — 集中管理,确保 dreaming/ 代码
// 只读写 data/dreams/ 和 sessions/dreams/,绝不碰 data/memory/。

import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

export const PATHS = {
  // 数据根目录(与 data/memory 平级)
  dreamsRoot:     join(ROOT, 'data', 'dreams'),
  machineDir:     join(ROOT, 'data', 'dreams', '.dreams'),
  runsDir:        join(ROOT, 'data', 'dreams', '.dreams', 'runs'),
  locksDir:       join(ROOT, 'data', 'dreams', '.dreams', 'locks'),
  themesDir:      join(ROOT, 'data', 'dreams', '.dreams', 'themes'),
  phaseSignals:   join(ROOT, 'data', 'dreams', '.dreams', 'phase-signals.json'),
  budgetFile:     join(ROOT, 'data', 'dreams', '.dreams', 'budget.json'),
  votesFile:      join(ROOT, 'data', 'dreams', '.dreams', 'votes.json'),

  // 人读态
  diary:          join(ROOT, 'data', 'dreams', 'DREAMS.md'),
  diaryAlias:     join(ROOT, 'data', 'dreams', '遐思录.md'),
  artifactsRoot:  join(ROOT, 'data', 'dreams', 'artifacts'),

  // Pi 自动写的 session 日志
  dreamsSessionDir: join(ROOT, 'sessions', 'dreams'),

  // 项目根
  root: ROOT,
};

// 4 种遐思类型(对齐设计文档)
export const TYPES = {
  'lian-zhu':  { cn: '连珠', emoji: '🚀', en: 'free-association' },
  'gui-cang':  { cn: '归藏', emoji: '🌊', en: 'abstract' },
  'ming-tai':  { cn: '明台', emoji: '☁️', en: 'lucid' },
  'yu-yan':    { cn: '预言', emoji: '🔮', en: 'counterfactual' }, // v2
};

export const ALL_TYPES = Object.keys(TYPES);