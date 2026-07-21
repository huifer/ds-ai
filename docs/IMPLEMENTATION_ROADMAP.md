# 实施路线图

> Phase 0-5 详细实施计划

---

## Phase 0: 基础建设（P0） ✅ 已完成

### 0.1 目标

建立 Project 和子项的基础结构 ✅

### 0.2 任务清单

| 任务 | 文件 | 状态 |
|------|------|------|
| 创建 Project 数据结构 | `src/project/project-store.mjs` | ✅ |
| 创建子项数据结构 | `src/project/project-manager.mjs` | ✅ |
| 创建 Project 管理器 | `src/project/project-manager.mjs` | ✅ |

### 0.3 代码结构

```javascript
// src/project/project-store.mjs ✅
export class ProjectStore {
  async create(data) { }
  async get(id) { }
  async update(id, data) { }
  async list(filters) { }
  async delete(id) { }
}

// src/project/project-manager.mjs ✅
export class ProjectManager {
  async createProject(params) { }
  async getProject(id) { }
  async updateProject(id, params) { }
  async archiveProject(id) { }
  async listProjects(filters) { }
}
```

### 0.4 验收标准

- [x] 能创建 Project
- [x] 能创建 7 种类型的子项
- [x] 能查询和更新
- [x] 数据持久化到 `data/projects/`

---

## Phase 1: AI 集成（P0） ✅ 已完成

### 1.1 目标

让 AI 自动判断创建 Project，自动生成摘要 ✅

### 1.2 任务清单

| 任务 | 文件 | 状态 |
|------|------|------|
| 意图分类器 | `src/workflow/intent-classifier.mjs` | ✅ |
| 摘要引擎 | `src/workflow/summary-engine.mjs` | ✅ |
| AI 集成到入口 | `src/workflow/entry-integrator.mjs` | ✅ |

### 1.3 代码结构

```javascript
// src/workflow/intent-classifier.mjs ✅
export class IntentClassifier {
  async classify(message, context) {
    // 返回：
    // { type: 'instant' | 'project', reason: '...' }
  }
}

// src/workflow/summary-engine.mjs ✅
export class SummaryEngine {
  async shouldSummarize(context) { }
  async generateSummary(turns) { }
}

// src/workflow/project-integrator.mjs ✅
export class ProjectIntegrator {
  async handleMessage(msg, options) { }
}
```

### 1.4 验收标准

- [x] AI 能判断是否创建 Project
- [x] 能自动创建 Project
- [x] 每 10 轮自动生成摘要
- [x] 摘要写入 Project

---

## Phase 2: 用户控制（P1） ✅ 已完成

### 2.1 目标

实现用户设置和开关功能 ✅

### 2.2 任务清单

| 任务 | 文件 | 状态 |
|------|------|------|
| 设置管理器 | `src/user/settings-manager.mjs` | ✅ |
| 设置命令集成 | `src/workflow/entry-integrator.mjs` | ✅ |
| 进度显示 | 在 entry-integrator 中处理 | ✅ |
| 通知控制 | 在 entry-integrator 中处理 | ✅ |

### 2.3 代码结构

```javascript
// src/user/settings-manager.mjs ✅
export class SettingsManager {
  async get(userId) { }
  async set(userId, key, value) { }
  async reset(userId) { }
  async handleSettingsCommand(userId, text) { }
}
```

### 2.4 验收标准

- [x] `!settings` 命令可用
- [x] `!quick`/`!normal`/`!verbose` 可用
- [x] 设置持久化到文件
- [x] 集成到 entry-bot.mjs

---

## Phase 3: 归档与通知（P1） ✅ 已完成

### 3.1 目标

实现自动归档和通知机制 ✅

### 3.2 任务清单

| 任务 | 文件 | 状态 |
|------|------|------|
| 归档逻辑 | `ProjectManager.autoArchive()` | ✅ |
| 归档调度任务 | `entry-bot.mjs` 调度器 | ✅ |
| 审批推送 | `src/notification/approval-pusher.mjs` | ✅ |
| 提醒调度 | `src/notification/reminder-scheduler.mjs` | ✅ |
| 告警管理 | `src/notification/alert-manager.mjs` | ✅ |

### 3.3 验收标准

- [x] 30 天无活动自动归档
- [x] 审批推送到 #审批
- [x] 每日摘要推送到 #提醒
- [x] 系统异常推送到 #告警

---

## Phase 4: 内容分发（P2） ✅ 已完成

### 4.1 目标

完善内容分发频道 ✅

### 4.2 任务清单

| 任务 | 文件 | 状态 |
|------|------|------|
| 内容模板 | `src/content/content-renderer.mjs` | ✅ |
| 渲染器 | `src/content/content-renderer.mjs` | ✅ |
| 发布器 | `src/content/content-publisher.mjs` | ✅ |

### 4.3 验收标准

- [x] #内容-公众号 频道可用
- [x] #内容-小红书 频道可用
- [x] #内容-X 频道可用
- [x] 内容自动渲染预览

---

## Phase 5: 频道迁移（P2） ✅ 脚本完成

### 5.1 目标

清理旧频道，创建新频道 ✅

### 5.2 任务清单

| 任务 | 文件 | 状态 |
|------|------|------|
| 迁移脚本 | `scripts/migrate-channels.mjs` | ✅ |
| 迁移说明 | `docs/CHANNEL_MIGRATION.md` | ✅ |
| 手动执行 | Discord 中创建频道 | 🔄 待执行 |

### 5.3 需要在 Discord 中手动创建

```bash
# 新频道:
- #项目
- #产出
- #归档
- #提醒
- #内容-公众号
- #内容-小红书
- #内容-视频号
- #内容-X
- #内容-Newsletter
```

---

## 实施顺序

```
Week 1: Phase 0 (基础建设) ✅
Week 2: Phase 1 (AI 集成) ✅
Week 3: Phase 2 (用户控制) ✅
Week 4: Phase 3 (归档与通知) ✅
Week 5: Phase 4-5 (内容分发 + 频道迁移) ✅
```

---

## 风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| 数据迁移丢失 | 高 | 先备份，再迁移 |
| 旧功能丢失 | 中 | 逐步迁移，保持兼容 |
| 用户习惯改变 | 低 | 提供迁移指南 |

---

## 验收检查清单

### Phase 0
- [x] Project 数据结构定义完成
- [x] 子项数据结构定义完成
- [x] CRUD 操作实现
- [x] 单元测试通过

### Phase 1
- [x] 意图分类器实现
- [x] 自动创建 Project
- [x] 摘要引擎实现
- [x] 端到端测试通过

### Phase 2
- [x] 设置管理器实现
- [x] 所有设置命令可用
- [x] 进度条正确显示/隐藏
- [x] 用户测试通过

### Phase 3
- [x] 归档规则正确
- [x] 审批推送正确
- [x] 提醒正确
- [x] 告警正确

### Phase 4
- [x] 内容模板完整
- [x] 渲染正确
- [x] 各平台适配

### Phase 5
- [ ] 新频道创建（需手动在 Discord 中执行）
- [ ] 更新 .env 文件
- [ ] 旧频道清理
- [ ] 文档更新

---

## 待手动执行

1. 在 Discord 中创建新频道
2. 更新 .env 中的 Channel ID
3. 重启 entry-bot
4. 确认功能正常

---

## 完整文件清单

```
src/
├── project/
│   ├── project-store.mjs        # ✅ 数据存储
│   └── project-manager.mjs       # ✅ 管理器
│
├── workflow/
│   ├── intent-classifier.mjs    # ✅ 意图分类
│   ├── summary-engine.mjs       # ✅ 摘要生成
│   ├── project-integrator.mjs    # ✅ Project 集成
│   └── entry-integrator.mjs      # ✅ 入口协调
│
├── user/
│   └── settings-manager.mjs       # ✅ 用户设置
│
├── notification/
│   ├── approval-pusher.mjs      # ✅ 审批推送
│   ├── reminder-scheduler.mjs    # ✅ 提醒调度
│   └── alert-manager.mjs         # ✅ 告警管理
│
└── content/
    ├── content-renderer.mjs       # ✅ 内容渲染
    └── content-publisher.mjs      # ✅ 内容发布
```

---

*文档版本：v2.0*  
*最后更新：2026-07-20*
