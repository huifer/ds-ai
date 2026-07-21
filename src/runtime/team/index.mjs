// ~/pi-discord-agents/src/runtime/team/index.mjs
// Team 模块统一导出

// 核心类型和类
export {
  TASK_STATES,
  AGENT_TYPES,
  COLLABORATION_MODES,
  Agent,
  TeamTask,
  Team,
  TEAM_TEMPLATES,
  createTeam,
} from './team-core.mjs';

// 引擎
export { TeamEngine } from './team-engine.mjs';

// Subagent
export {
  SUBAGENT_STATES,
  Subagent,
  SubagentManager,
} from './subagent-manager.mjs';
