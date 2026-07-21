# Project 生命周期管理

> 本文档详细说明 Project 的创建、管理、归档全流程

---

## 一、Project 定义

### 1.1 什么是 Project

**Project** 是 AI 自动创建的工作容器，用于管理：
- 一个完整的任务/项目
- 相关的所有对话
- 产生的所有文档、代码、决策
- 关联的任务清单

### 1.2 Project vs 频道

| 维度 | 频道 | Project |
|------|------|---------|
| 生命周期 | 永久 | 有始有终 |
| 内容 | 消息流 | 结构化数据 |
| 创建方式 | Discord 内置 | AI 自动/用户显式 |
| 归档 | 不归档 | 自动归档 |
| 用途 | 沉淀容器 | 工作空间 |

---

## 二、Project 类型

### 2.1 类型定义

```javascript
const PROJECT_TYPES = {
  // 技术类
  tech: {
    label: '技术开发',
    description: '代码开发、系统搭建、技术调研',
    subTypes: [
      'web-app',      // Web 应用
      'api',          // API 开发
      'bot',          // 机器人
      'script',       // 脚本工具
      'research',      // 技术调研
      'architecture', // 架构设计
    ],
    defaultTasks: [
      '需求分析',
      '架构设计',
      '编码实现',
      '测试验证',
      '部署上线',
    ],
  },
  
  // 销售类
  sales: {
    label: '销售机会',
    description: '客户需求、商机跟进',
    subTypes: [
      'lead',         // 线索
      'opportunity',  // 商机
      'proposal',     // 提案
    ],
    defaultTasks: [
      '客户需求确认',
      '资格判断',
      '方案设计',
      '报价',
      '合同签署',
    ],
  },
  
  // 内容类
  content: {
    label: '内容创作',
    description: '文章、笔记、视频、推文',
    subTypes: [
      'article',      // 文章
      'video',        // 视频脚本
      'social',       // 社交媒体
      'newsletter',   // 通讯
    ],
    platforms: [
      'wechat',       // 公众号
      'xiaohongshu',  // 小红书
      'videostar',    // 视频号
      'x',            // X/Twitter
    ],
    defaultTasks: [
      '选题确认',
      '内容创作',
      '编辑校对',
      '预览确认',
      '发布',
    ],
  },
  
  // 交付类
  delivery: {
    label: '项目交付',
    description: 'FDE 客户交付、项目实施',
    subTypes: [
      'poc',          // POC
      'implementation', // 实施
      'training',     // 培训
      'support',      // 支持
    ],
    defaultTasks: [
      'POC 计划',
      '环境搭建',
      '功能开发',
      '测试验收',
      '交付培训',
    ],
  },
};
```

### 2.2 类型选择规则

AI 根据以下规则自动判断 Project 类型：

```javascript
const TYPE_SELECTION_RULES = [
  // 技术类关键词
  {
    type: 'tech',
    keywords: [
      '做个', '写个', '开发', '帮我做', '帮我写',
      '代码', '网站', '应用', '机器人', '脚本',
      'API', '接口', '部署', '架构',
    ],
  },
  
  // 销售类关键词
  {
    type: 'sales',
    keywords: [
      '客户', '公司', '预算', '报价', '合作',
      '商机', '需求', '解决方案',
    ],
  },
  
  // 内容类关键词
  {
    type: 'content',
    keywords: [
      '写一篇', '写个文章', '拍个视频', '做个视频',
      '发个推文', '小红书', '公众号',
      '内容', '文案', '脚本',
    ],
  },
  
  // 交付类关键词
  {
    type: 'delivery',
    keywords: [
      '交付', '实施', '部署', '上线', '培训',
      'POC', '客户现场', '驻场',
    ],
  },
];
```

---

## 三、Project 创建

### 3.1 创建条件

```javascript
const CREATE_CONDITIONS = {
  // 显式触发（用户明确要求）
  explicit: [
    '开个新项目',
    '创建项目',
    '这是 xxx 项目',
    '开始 xxx 项目',
    '项目名：xxx',
  ],
  
  // 隐式触发（满足任一条件）
  implicit: [
    {
      name: '客户+需求',
      check: (msg) => containsKeywords(msg, ['客户', '公司']) && 
                      containsKeywords(msg, ['需求', '做', '开发', '网站', '系统']),
      priority: 1,
    },
    {
      name: '多文档需求',
      check: (msg) => containsMultiple(msg, ['PRD', '报价', '方案', '合同']),
      priority: 1,
    },
    {
      name: '长对话',
      check: (_, context) => context.turnCount >= 10,
      priority: 2,
    },
    {
      name: '代码生成',
      check: (_, context) => context.codeLines >= 100,
      priority: 2,
    },
    {
      name: '内容创作',
      check: (msg) => containsKeywords(msg, ['写', '文章', '视频', '推文']),
      priority: 1,
    },
  ],
};
```

### 3.2 创建流程

```
用户消息
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  AI 判断：需要创建 Project？                            │
│  ├─ 满足显式条件 → 创建                               │
│  ├─ 满足隐式条件 → 创建                               │
│  └─ 不满足条件 → 留在当前会话                         │
└─────────────────────────────────────────────────────────┘
    │
    ▼ (创建)
┌─────────────────────────────────────────────────────────┐
│  创建 Project                                           │
│  ├─ 生成 ID: PRJ-YYYY-NNNN                           │
│  ├─ 生成标题: AI 根据上下文生成                        │
│  ├─ 确定类型: tech/sales/content/delivery              │
│  ├─ 关联 Thread: 创建或使用现有                        │
│  └─ 写入存储                                            │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  创建初始子项                                           │
│  ├─ conversation-001: 第一条对话摘要                    │
│  └─ task (根据类型创建默认任务)                        │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  用户通知                                               │
│  📦 已创建项目: [标题]                                  │
│  类型: [类型]                                          │
│  ├─ 在这里继续对话                                     │
│  ├─ AI 会自动记录对话摘要                             │
│  └─ 任务会自动追踪                                     │
└─────────────────────────────────────────────────────────┘
```

### 3.3 自动命名规则

```javascript
const TITLE_GENERATION_RULES = {
  // 优先级从上到下
  rules: [
    {
      // 用户直接指定
      condition: (msg) => msg.match(/项目[名为:：]\s*(.+)/),
      template: (match) => match[1],
    },
    {
      // 客户 + 需求
      condition: (msg) => msg.includes('客户') || msg.includes('公司'),
      template: (msg) => {
        const customer = extractCustomer(msg);
        const need = extractNeed(msg);
        return `${customer}-${need}`;
      },
    },
    {
      // 内容创作
      condition: (msg) => containsKeywords(msg, ['写', '文章', '视频']),
      template: (msg) => {
        const platform = detectPlatform(msg);
        const topic = extractTopic(msg);
        return `${platform}-${topic}`;
      },
    },
    {
      // 技术开发
      condition: (msg) => containsKeywords(msg, ['做个', '写个', '开发']),
      template: (msg) => `开发-${extractTechSubject(msg)}`,
    },
    {
      // 默认
      condition: () => true,
      template: (msg) => `项目-${Date.now().toString(36)}`,
    },
  ],
};
```

---

## 四、子项管理

### 4.1 子项类型详解

#### conversation（对话摘要）

```yaml
type: conversation
purpose: 记录对话内容，便于回顾

fields:
  - id: 自动生成
  - created_at: ISO 时间
  - content:
      summary: 摘要文本（必填）
      key_points: 关键点列表
      decisions: 决策列表
      pending: 待确认事项
      next_action: 下一步
  - turns: 涉及的对话轮次范围
  - context: 上下文标签
```

#### document（文档产出）

```yaml
type: document
purpose: 记录生成的文档

fields:
  - id: 自动生成
  - created_at: ISO 时间
  - content:
      title: 文档标题（必填）
      path: 文件路径（必填）
      type: markdown | pdf | html | docx
      summary: 文档摘要
      status: draft | review | approved | published
      platform: wechat | xhs | video | x | newsletter
  - linked_items: 关联的其他子项
  - versions: 版本历史
```

#### decision（关键决策）

```yaml
type: decision
purpose: 记录重要决策

fields:
  - id: 自动生成
  - created_at: ISO 时间
  - content:
      decision: 决策内容（必填）
      reason: 决策理由
      alternatives: 备选方案
      tradeoffs: 权衡考量
      decided_by: user | ai
      approved_by: user_id（如果是 AI 建议）
  - status: proposed | approved | rejected
  - related_items: 关联子项
```

#### task（任务清单）

```yaml
type: task
purpose: 追踪待办事项

fields:
  - id: 自动生成
  - created_at: ISO 时间
  - content:
      title: 任务标题（必填）
      description: 详细描述
      status: pending | in_progress | completed | blocked
      assignee: user | ai
      priority: high | medium | low
      due_at: 截止时间
      completed_at: 完成时间
  - subtasks: 子任务
  - dependencies: 依赖任务
  - related_items: 关联子项
```

#### code（代码产出）

```yaml
type: code
purpose: 记录生成的代码

fields:
  - id: 自动生成
  - created_at: ISO 时间
  - content:
      title: 文件名（必填）
      path: 文件路径（必填）
      language: typescript | python | rust | ...
      lines: 代码行数
      status: generated | tested | deployed
      summary: 代码说明
      tests: 测试情况
  - commits: 提交记录
  - deployments: 部署记录
```

#### comment（评审/反馈）

```yaml
type: comment
purpose: 记录评审意见和反馈

fields:
  - id: 自动生成
  - created_at: ISO 时间
  - content:
      author: user | ai
      author_name: 显示名称
      text: 评论内容（必填）
      action_required: 需要采取的行动
      status: pending | acknowledged | resolved
  - replies: 回复
  - related_items: 关联子项
```

#### asset（资产引用）

```yaml
type: asset
purpose: 引用图片、文件等资产

fields:
  - id: 自动生成
  - created_at: ISO 时间
  - content:
      title: 资产名称（必填）
      type: image | pdf | video | audio | file
      path: 文件路径或 URL
      description: 说明
      size: 文件大小
      thumbnail: 缩略图
  - related_items: 关联子项
```

#### note（备注）

```yaml
type: note
purpose: 其他需要记录的内容

fields:
  - id: 自动生成
  - created_at: ISO 时间
  - content:
      text: 备注内容（必填）
      tags: 标签
  - related_items: 关联子项
```

### 4.2 子项创建时机

```javascript
const SUB_ITEM_AUTO_CREATE = {
  conversation: {
    triggers: [
      { type: 'interval', every: 10, condition: 'turnCount >= 10' },
      { type: 'keyword', keywords: ['总结', '汇总'] },
      { type: 'milestone', keywords: ['完成了', '可以了'] },
      { type: 'command', command: '!summary' },
    ],
  },
  
  document: {
    triggers: [
      { type: 'ai_action', action: 'save_file', extensions: ['.md', '.pdf', '.html'] },
      { type: 'ai_action', action: 'generate_doc' },
      { type: 'user_request', keywords: ['生成文档', '输出方案'] },
    ],
  },
  
  decision: {
    triggers: [
      { type: 'user_decision', pattern: '决定用|选择|那就' },
      { type: 'ai_recommendation', pattern: '建议.*采纳' },
      { type: 'technical_choice', pattern: '技术方案|架构' },
    ],
  },
  
  task: {
    triggers: [
      { type: 'user_request', pattern: '做一下|帮我.*|需要.*|' },
      { type: 'ai_action', action: 'complete_task' },
      { type: 'ai_suggestion', suggestion: 'task' },
    ],
  },
  
  code: {
    triggers: [
      { type: 'ai_action', action: 'write_file', extensions: ['.ts', '.js', '.py', '.rs'] },
      { type: 'user_upload', type: 'code' },
    ],
  },
  
  comment: {
    triggers: [
      { type: 'user_feedback', pattern: '.*' }, // 所有用户反馈
    ],
  },
  
  asset: {
    triggers: [
      { type: 'ai_action', action: 'generate_image' },
      { type: 'ai_action', action: 'render_pdf' },
      { type: 'user_upload', type: 'file' },
    ],
  },
};
```

---

## 五、项目状态

### 5.1 状态定义

```javascript
const PROJECT_STATUS = {
  active: {
    label: '进行中',
    color: 'green',
    description: '项目正在推进中',
    allowed_transitions: ['completed', 'archived', 'blocked'],
  },
  
  completed: {
    label: '已完成',
    color: 'blue',
    description: '项目目标达成，等待归档',
    allowed_transitions: ['archived', 'active'],
  },
  
  blocked: {
    label: '已暂停',
    color: 'yellow',
    description: '项目暂停，等待条件满足',
    allowed_transitions: ['active', 'archived'],
  },
  
  archived: {
    label: '已归档',
    color: 'gray',
    description: '项目已归档到历史',
    allowed_transitions: [],
  },
};
```

### 5.2 状态转换规则

```javascript
const STATUS_TRANSITIONS = {
  // 自动转换
  auto: [
    {
      from: 'active',
      to: 'completed',
      condition: (project) => {
        const tasks = getSubItems(project.id, { type: 'task' });
        return tasks.every(t => t.content.status === 'completed');
      },
    },
    {
      from: 'active',
      to: 'archived',
      condition: (project) => {
        const daysSinceUpdate = daysBetween(project.meta.updated_at, new Date());
        return daysSinceUpdate >= 30;
      },
    },
  ],
  
  // 用户触发
  user: [
    {
      command: '!project done',
      from: '*',
      to: 'completed',
    },
    {
      command: '!project archive',
      from: '*',
      to: 'archived',
    },
    {
      command: '!project resume',
      from: ['completed', 'blocked'],
      to: 'active',
    },
    {
      command: '!project pause',
      from: 'active',
      to: 'blocked',
    },
  ],
};
```

---

## 六、对话摘要机制

### 6.1 摘要触发条件

```javascript
const SUMMARY_TRIGGERS = [
  {
    type: 'interval',
    condition: 'turnCount % 10 === 0',
    priority: 1,
    label: '每 10 轮',
  },
  {
    type: 'keyword',
    keywords: ['总结', '汇总', '小结', '整理一下'],
    priority: 1,
    label: '用户要求',
  },
  {
    type: 'milestone',
    keywords: ['完成了', '可以了', '好了', '搞定'],
    priority: 2,
    label: '里程碑',
  },
  {
    type: 'topic_change',
    priority: 2,
    label: '主题变化',
  },
  {
    type: 'command',
    commands: ['!summary', '/summary'],
    priority: 1,
    label: '命令触发',
  },
];
```

### 6.2 摘要生成模板

```javascript
const SUMMARY_TEMPLATE = `
## 对话摘要

**时间**: ${timestamp}
**轮次**: ${turnStart} - ${turnEnd}（共 ${turnCount} 轮）

### 📝 主要内容
${mainContent}

### 🎯 关键决策
${decisions.length > 0 ? decisions.map(d => `- ${d}`).join('\n') : '无'}

### 📋 待确认
${pending.length > 0 ? pending.map(p => `- ${p}`).join('\n') : '无'}

### ➡️ 下一步
${nextAction}
`;
```

### 6.3 摘要合并规则

当一个 Project 有多个对话摘要时：

```javascript
async function mergeSummaries(projectId) {
  const summaries = await getSubItems(projectId, { type: 'conversation' });
  
  // 按时间排序
  summaries.sort((a, b) => a.created_at - b.created_at);
  
  // 合并内容
  const merged = {
    first: summaries[0].content.summary,
    last: summaries[summaries.length - 1].content.summary,
    keyDecisions: deduplicate(summaries.flatMap(s => s.content.decisions || [])),
    pendingItems: deduplicate(summaries.flatMap(s => s.content.pending || [])),
    turnCount: summaries.reduce((sum, s) => sum + (s.content.turns?.length || 1), 0),
  };
  
  return merged;
}
```

---

## 七、归档机制

### 7.1 归档触发

```javascript
const ARCHIVE_TRIGGERS = [
  // 超时自动归档
  {
    type: 'timeout',
    days: 30,
    condition: (project) => daysSince(project.meta.updated_at) >= 30 && project.meta.status === 'active',
    action: 'archive',
    notify: true,
  },
  
  // 用户命令
  {
    type: 'command',
    commands: ['!archive', '!project archive'],
    action: 'archive',
    notify: false,
  },
  
  // 完成归档
  {
    type: 'status_change',
    from: 'completed',
    action: 'prompt_archive',
    notify: true,
  },
  
  // 用户放弃
  {
    type: 'user_abandon',
    keywords: ['不做了', '算了', '取消', '停止'],
    action: 'archive_with_reason',
    notify: false,
  },
];
```

### 7.2 归档流程

```
触发归档
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  1. 生成归档摘要                                       │
│  ├─ 汇总所有对话摘要                                  │
│  ├─ 整理产出清单                                      │
│  ├─ 记录关键决策                                      │
│  └─ 保存归档原因                                      │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  2. 移动文件                                          │
│  ├─ 文档 → data/archive/projects/                     │
│  ├─ 代码 → data/archive/projects/                     │
│  └─ 资产 → data/archive/projects/                     │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  3. 更新状态                                           │
│  ├─ status → archived                                 │
│  ├─ archived_at → now                                 │
│  └─ archive_reason → [原因]                          │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  4. 发送通知（可选）                                   │
│  📦 项目「xxx」已归档                                  │
│  归档时间: xxx                                         │
│  原因: xxx                                            │
└─────────────────────────────────────────────────────────┘
```

### 7.3 归档保留内容

```javascript
const ARCHIVE_PRESERVE = [
  'id',
  'title',
  'type',
  'meta.created_at',
  'meta.updated_at',
  'meta.archived_at',
  'meta.archive_reason',
  'meta.status',
  'stats',
  'links',
  // 子项
  'sub_items.conversation',
  'sub_items.decision',
  'sub_items.task',
  'sub_items.document',
  // 不保留
  // 'sub_items.comment', // 评论不保留
  // 'sub_items.note',    // 备注不保留
];

const ARCHIVE_REMOVE = [
  'sub_items.comment',
  'sub_items.note',
];
```

---

## 八、用户命令

### 8.1 Project 命令列表

```
# 项目操作
!project                    - 查看当前项目
!project list               - 列出所有项目
!project <id>              - 查看指定项目
!project done               - 标记完成
!project archive            - 归档项目
!project resume             - 重新激活
!project pause              - 暂停项目

# 子项操作
!task                      - 查看任务清单
!task add <title>          - 添加任务
!task done <id>            - 完成任务
!task <id> <status>        - 更新状态

# 摘要操作
!summary                   - 生成摘要
!summary list              - 查看所有摘要

# 文档操作
!docs                      - 查看文档清单
!doc <id>                  - 查看文档
```

### 8.2 命令格式示例

```
# 查看当前项目
!project

# 输出：
# 📦 当前项目: 飞书机器人开发
# 类型: tech
# 状态: 进行中
# 创建: 2026-07-20 10:00
# 更新: 2026-07-20 15:30
#
# 📋 任务 (3/5)
# [x] 需求分析
# [x] 架构设计
# [x] 核心代码
# [ ] 测试
# [ ] 部署

# 完成任务
!task done 3

# 输出：
# ✅ 任务「测试」已标记完成
```

---

## 九、Project 界面展示

### 9.1 项目卡片格式

```markdown
## 📦 PRJ-2026-0001: 飞书机器人开发

| 属性 | 值 |
|------|-----|
| 类型 | 🛠 技术开发 |
| 状态 | 🟢 进行中 |
| 创建 | 2026-07-20 10:00 |
| 更新 | 2026-07-20 15:30 |
| 对话 | 45 轮 |
| 文档 | 3 份 |
| 任务 | 3/5 完成 |

### 📋 任务清单
- [x] 需求分析
- [x] 架构设计
- [x] 核心代码
- [ ] 测试
- [ ] 部署

### 📝 最近摘要
> 15:30 用户确认：增加定时任务功能，代码已更新

### 📄 文档
- PRD.md (完成)
- 架构图.png (完成)
- 报价单.md (草稿)
```

### 9.2 时间线展示

```markdown
## 📅 项目时间线

### 2026-07-20
├─ 10:00 📦 创建项目
├─ 10:05 💬 对话摘要: 需求确认
├─ 10:30 📝 决策: 选择 discord.js
├─ 10:45 📄 文档: PRD.md
├─ 11:00 💻 代码: src/index.ts (245行)
└─ 15:30 💬 对话摘要: 添加定时任务

### 2026-07-19 (无活动)
```

---

*文档版本：v1.0*  
*最后更新：2026-07-20*
