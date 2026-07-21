// ~/pi-discord-agents/src/dreaming/index.mjs
// 「遐思」统一入口 — entry-bot 用这一个文件就能拿到所有模块。

export { createDreamingPi } from './dreaming-pi.mjs';
export { createDreamer } from './dreamer.mjs';
export { createArtifacts } from './artifacts.mjs';
export { createBudget } from './budget.mjs';
export { createDiary } from './diary.mjs';
export { createReporter } from './report.mjs';
export { createVotes } from './votes.mjs';
export { loadXiasiConfig, describeXiasiConfig } from './config.mjs';
export { PATHS, TYPES, ALL_TYPES } from './paths.mjs';
export { loadPrompt, renderPrompt } from './prompts.mjs';

// 增强模块
export { createNightmareMitigator, computePolarity } from './enhancement/nightmare-mitigation.mjs';
export { createDreamToMemory } from './enhancement/dream-to-memory.mjs';
export { createVoteFeedback } from './enhancement/vote-feedback.mjs';
export { createDreamSelfImprover } from './enhancement/self-improvement.mjs';
export { createImplicitKnowledgeMiner } from './mining/implicit-knowledge.mjs';

// 预言阶段
export { run as runYuYan } from './phases/yu-yan.mjs';