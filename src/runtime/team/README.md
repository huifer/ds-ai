# Agent Team 系统

基于 Agent Team 理念的多 Agent 协作框架，支持任务委派、并行执行、结果聚合。

## 核心概念

### Team (团队)
多个 Agent 协作完成复杂任务的组织单位。

### Subagent (子代理)
可被 Team 调用的小型 Agent，有独立的生命周期和资源管理。

### 协作模式
- **Sequential**: 串行执行，上一步输出作为下一步输入
- **Parallel**: 并行执行，多个 Agent 同时工作
- **Hierarchical**: 层级协作，Manager → Workers
- **Fan-out-in**: 扇出收集

## 快速开始

```javascript
import { 
  createTeam, 
  TEAM_TEMPLATES, 
  TeamEngine,
  TeamTask,
} from './src/runtime/team/index.mjs';

// 1. 从模板创建团队
const devTeam = createTeam(TEAM_TEMPLATES.DEVELOPMENT);

// 2. 创建引擎
const engine = new TeamEngine({
  rootDir: './data',
  piBridge,
  sessionManager,
  memoryStore,
});

// 3. 注册团队
engine.registerTeam(devTeam);

// 4. 创建任务
const task = new TeamTask({
  id: 'task-1',
  type: 'development',
  description: '开发新功能',
  requiredSkills: ['backend', 'frontend'],
});

// 5. 执行
const result = await engine.execute({
  teamId: 'team-dev',
  task,
  mode: 'sequential',
});
```

## 预定义模板

### 开发团队 (DEVELOPMENT)
```
技术负责人 → [后端开发 ‖ 前端开发] → 测试工程师
```

### 销售团队 (SALES)
```
调研员 → 销售主管 → 成交专家 → 质量审核
```

### 内容团队 (CONTENT)
```
内容主编 → 内容撰写 → 内容编辑 → 发布专员
```

## 自定义 Team

```javascript
import { Team, Agent, AGENT_TYPES } from './team-core.mjs';

const team = new Team({
  id: 'my-team',
  name: '我的团队',
  agents: [
    new Agent({
      id: 'leader',
      name: '领导',
      type: AGENT_TYPES.LEADER,
      skills: ['planning', 'coordination'],
    }),
    new Agent({
      id: 'worker1',
      name: '工人1',
      type: AGENT_TYPES.WORKER,
      skills: ['coding'],
    }),
  ],
  workflow: [
    { step: 1, agent: 'leader', mode: 'sequential' },
    { step: 2, agent: 'worker1', mode: 'sequential' },
  ],
});
```

## Subagent 管理

```javascript
import { SubagentManager } from './subagent-manager.mjs';

const manager = new SubagentManager({
  rootDir: './data',
  maxSubagents: 10,
  defaultLifetime: 3600,
});

// 创建 Subagent
const sub = manager.create({
  name: '临时任务Agent',
  parentId: 'team-1',
  agentType: 'worker',
  skills: ['data-analysis'],
});

// 获取统计
const stats = manager.getStats();
console.log(stats);
// { total: 1, byState: {...}, byType: {...}, ... }
```

## API 参考

### Agent
- `id`: Agent ID
- `name`: 名称
- `type`: 类型 (leader/worker/reviewer)
- `skills`: 技能列表
- `canHandle(task)`: 检查是否能处理任务

### Team
- `agents`: Agent 映射
- `leaderId`: 领导 ID
- `workflow`: 工作流定义
- `assignTask(task, agentId)`: 分配任务
- `completeTask(taskId, result)`: 完成任务

### TeamTask
- `id`: 任务 ID
- `type`: 任务类型
- `description`: 描述
- `requiredSkills`: 所需技能
- `state`: 状态 (pending/running/completed/failed)

### TeamEngine
- `registerTeam(team)`: 注册团队
- `execute({ teamId, task, mode })`: 执行任务
- `getExecutionHistory({ teamId, limit })`: 执行历史
- `getTeamStats(teamId)`: 团队统计
