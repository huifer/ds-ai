# Agent Workforce 频道与内容架构方案

> 版本：v1.0  
> 日期：2026-07-20  
> 状态：**最终版设计文档**

---

## 一、设计理念

### 1.1 核心原则

| 原则 | 说明 |
|------|------|
| **AI-First** | AI 是协调者，理解意图、决定方案、执行落地 |
| **用户控制** | 用户控制信息流（进度/日志/通知），而非被动接收 |
| **自动沉淀** | 有价值的内容自动归档，无价值的即时对话不沉淀 |
| **极简入口** | 用户只需要知道 `#主入口`，其他由 AI 引导 |
| **内容分层** | 对话 → 项目 → 知识 → 内容分发，层层递进 |

### 1.2 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: 对话层（#主入口）                                      │
│  用户直接交互，即时回复，不自动归档                                │
│  AI 判断是否成项                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓ 成项时
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: 项目层（#项目）                                        │
│  AI 自动创建 Project，自动管理子项                                │
│  对话摘要、文档产出、任务清单                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓ 自动归档
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: 知识层（#记忆库 / #灵感 / #产出 / #归档）              │
│  长期知识、点子、文档、历史项目                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ 持续经营
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: 内容层（#内容-*）                                     │
│  公众号、小红书、视频号、X、Newsletter                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓ 被动通知
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: 通知层（#审批 / #提醒 / #告警）                        │
│  用户开关控制是否接收                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、频道结构（最终版）

### 2.1 频道总览

| 层级 | 频道 | ID 配置键 | 数量 | 说明 |
|------|------|-----------|------|------|
| **入口层** | #主入口 | CH_ENTRY | 1 | 唯一对话入口 |
| **推送层** | #资讯 | CH_RSS | 1 | 世界发生了什么（定时推送） |
| | #每日总结 | CH_DAILY | 1 | 今天干了什么（定时推送） |
| | #每日任务 | CH_GH | 1 | GitHub 待办（定时推送） |
| | #用量 | CH_USAGE | 1 | AI Token 使用（定时推送） |
| **项目层** | #项目 | CH_PROJECT | 1 | 工作沉淀容器 |
| **知识层** | #记忆库 | CH_MEMORY | 1 | 知识沉淀 |
| | #灵感 | CH_IDEAS | 1 | 点子沉淀 |
| | #产出 | CH_OUTPUT | 1 | 文档沉淀 |
| | #归档 | CH_ARCHIVE | 1 | 历史沉淀 |
| **内容层** | #内容-公众号 | CH_CONTENT_WECHAT | 1 | 公众号文章 |
| | #内容-小红书 | CH_CONTENT_XHS | 1 | 小红书笔记 |
| | #内容-视频号 | CH_CONTENT_VIDEO | 1 | 视频脚本 |
| | #内容-X | CH_CONTENT_X | 1 | X 推文 |
| | #内容-Newsletter | CH_CONTENT_NEWSLETTER | 1 | 邮件通讯 |
| **通知层** | #审批 | CH_APPROVAL | 1 | 审批卡片 |
| | #提醒 | CH_REMINDER | 1 | 任务提醒 |
| | #告警 | CH_ALERT | 1 | 系统异常 |
| **合计** | | | **18** | |

### 2.2 频道角色定义

#### 入口层

```
#主入口 (CH_ENTRY)
├── 角色：唯一对话入口
├── 用户行为：直接发消息
├── AI 行为：
│   ├── 理解意图
│   ├── 即时回复（简单任务）
│   ├── 自动创建 Project（复杂任务）
│   └── 推送通知（需要审批时）
└── 推送信息：不打扰主入口，推送到对应频道
```

#### 推送层

```
#资讯 (CH_RSS)
├── 角色：世界发生了什么
├── 来源：AI 定时采集 RSS
├── 触发：每天 12:00
└── 内容：行业资讯、技术动态

#每日总结 (CH_DAILY)
├── 角色：今天干了什么
├── 来源：AI 定时汇总
├── 触发：每天 23:00
└── 内容：工作总结、关键决策、待办

#每日任务 (CH_GH)
├── 角色：GitHub 待办
├── 来源：监控仓库的 open issues
├── 触发：每天 10:00
└── 内容：待处理 Issue、高亮标注

#用量 (CH_USAGE)
├── 角色：AI Token 使用情况
├── 来源：系统统计
├── 触发：每天 12:30
└── 内容：Token 消耗、图表
```

#### 项目层

```
#项目 (CH_PROJECT)
├── 角色：所有工作的沉淀容器
├── 写入：AI 自动创建
├── 结构：每个 Project 包含多个子项
└── 归档：30 天无活动自动归档到 #归档
```

#### 知识层

```
#记忆库 (CH_MEMORY)
├── 角色：长期知识、偏好、决策
├── 来源：AI 自动从对话中提取
└── 内容：原则、偏好、技术决策

#灵感 (CH_IDEAS)
├── 角色：点子、想法、实验方向
├── 来源：用户提到 / AI 主动记录
└── 内容：产品想法、创业灵感、技术实验

#产出 (CH_OUTPUT)
├── 角色：文档、代码、方案
├── 来源：AI 生成后自动归档
└── 内容：PRD、报价单、合同、代码

#归档 (CH_ARCHIVE)
├── 角色：历史项目
├── 来源：Project 超时自动归档
└── 内容：已完成/停止的项目
```

#### 内容层

```
#内容-公众号 (CH_CONTENT_WECHAT)
├── 角色：公众号文章
├── 内容：标题、正文、配图
└── 状态：草稿 / 待发布 / 已发布

#内容-小红书 (CH_CONTENT_XHS)
├── 角色：小红书笔记
├── 内容：标题、正文、话题标签、封面
└── 状态：草稿 / 待发布 / 已发布

#内容-视频号 (CH_CONTENT_VIDEO)
├── 角色：视频脚本
├── 内容：标题、分镜、口播文案
└── 状态：草稿 / 待拍摄 / 已发布

#内容-X (CH_CONTENT_X)
├── 角色：X/Twitter 推文
├── 内容：单推 / 线程
└── 状态：草稿 / 待发布 / 已发布

#内容-Newsletter (CH_CONTENT_NEWSLETTER)
├── 角色：邮件通讯
├── 内容：标题、正文、CTA
└── 状态：草稿 / 待发送 / 已发送
```

#### 通知层

```
#审批 (CH_APPROVAL)
├── 角色：需要用户处理的审批
├── 触发：报价审批 / 合同审批 / 发布审批
└── 用户开关：控制是否推送

#提醒 (CH_REMINDER)
├── 角色：定时任务、待办事项
├── 来源：每日摘要 / 任务到期 / 周期待办
└── 用户开关：控制是否推送

#告警 (CH_ALERT)
├── 角色：系统异常
├── 来源：Pi RPC 错误 / 任务失败 / 系统异常
└── 用户开关：默认开启
```

---

## 三、Project 完整结构

### 3.1 Project 元信息

```yaml
Project:
  id: PRJ-2026-0001          # 自动编号
  title: "飞书机器人开发"     # AI 生成或用户指定
  type: tech                  # tech | sales | content | delivery
  
  # 元信息
  meta:
    created_at: "2026-07-20T10:00:00+08:00"
    updated_at: "2026-07-20T15:30:00+08:00"
    created_by: "user"       # user | ai
    status: active            # active | completed | archived
    
    # 类型特定信息
    tech:
      category: "discord-bot"  # discord-bot | web-app | api | ...
      tech_stack: ["Node.js", "discord.js"]
    sales:
      customer: "XXX公司"
      budget: "30-50万"
      stage: "qualification"   # lead | qualification | proposal | negotiation | closed
    content:
      platform: "wechat"       # wechat | xhs | video | x | newsletter
      topic: "AI Agent"
    delivery:
      client: "XXX公司"
      milestone: "POC"
  
  # 关联
  links:
    thread_id: "1234567890"   # Discord Thread ID
    session_id: "sess-xxx"    # Pi Session ID
    parent_project: null       # 父项目（如果有）
  
  # 统计
  stats:
    turn_count: 45            # 对话轮数
    summary_count: 5           # 摘要次数
    document_count: 3          # 文档数量
    task_total: 10             # 总任务数
    task_done: 6               # 已完成任务
```

### 3.2 子项类型定义

Project 下的子项分为以下几种类型：

| 类型 | 说明 | 典型内容 |
|------|------|---------|
| **conversation** | 对话摘要 | 摘要内容、时间、关键点 |
| **document** | 文档产出 | PRD、报价单、合同、报告 |
| **decision** | 关键决策 | 决策内容、时间、理由 |
| **task** | 任务清单 | 任务描述、状态、负责人 |
| **code** | 代码产出 | 文件路径、说明、状态 |
| **comment** | 评审/反馈 | 评审意见、时间、状态 |
| **asset** | 资产引用 | 图片、文件、链接 |
| **note** | 备注 | 其他需要记录的内容 |

### 3.3 子项结构示例

```yaml
# Project: 飞书机器人开发

sub_items:
  # === 对话摘要 ===
  - id: conv-001
    type: conversation
    created_at: "2026-07-20T10:00:00+08:00"
    content:
      summary: "用户需求：做一个飞书机器人，支持消息推送和指令处理"
      key_points:
        - "需要支持飞书应用机器人"
        - "主要功能：消息推送、slash commands"
        - "预算：未明确"
      next_action: "等待用户提供更多信息"
    ai_generated: true
  
  - id: conv-002
    type: conversation
    created_at: "2026-07-20T10:30:00+08:00"
    content:
      summary: "确认技术方案：使用 Node.js + discord.js"
      key_points:
        - "确认用 discord.js 库"
        - "支持 slash commands"
        - "部署到自有服务器"
      next_action: "开始编写代码"
    ai_generated: true
  
  # === 文档产出 ===
  - id: doc-001
    type: document
    created_at: "2026-07-20T10:45:00+08:00"
    content:
      title: "PRD.md"
      path: "data/projects/prj-001/PRD.md"
      type: markdown
      summary: "产品需求文档，包含功能范围、技术方案、里程碑"
      status: completed
    ai_generated: true
  
  - id: doc-002
    type: document
    created_at: "2026-07-20T14:00:00+08:00"
    content:
      title: "报价单.md"
      path: "data/projects/prj-001/报价单.md"
      type: markdown
      summary: "三档报价：基础版 5 万 / 标准版 12 万 / 旗舰版 25 万"
      status: draft
    ai_generated: true
  
  # === 关键决策 ===
  - id: dec-001
    type: decision
    created_at: "2026-07-20T10:30:00+08:00"
    content:
      decision: "选择 discord.js 作为开发框架"
      reason:
        - "社区活跃，文档完善"
        - "支持 slash commands"
        - "TypeScript 支持好"
      alternatives_considered:
        - "discord.py (Python): 不选，Python 异步生态不如 Node"
        - "go-cqhttp: 不选，需要额外协议层"
    ai_generated: true
  
  # === 任务清单 ===
  - id: task-001
    type: task
    created_at: "2026-07-20T10:45:00+08:00"
    content:
      title: "架构设计"
      description: "设计机器人架构，确定目录结构和模块划分"
      status: completed           # pending | in_progress | completed | blocked
      assignee: "ai"
      due_at: null
    ai_generated: true
  
  - id: task-002
    type: task
    created_at: "2026-07-20T11:00:00+08:00"
    content:
      title: "核心代码开发"
      description: "编写消息处理、指令解析、数据库交互"
      status: completed
      assignee: "ai"
      due_at: null
    ai_generated: true
  
  - id: task-003
    type: task
    created_at: "2026-07-20T14:00:00+08:00"
    content:
      title: "部署上线"
      description: "部署到服务器，配置 CI/CD"
      status: pending
      assignee: "ai"
      due_at: "2026-07-22"
    ai_generated: true
  
  # === 代码产出 ===
  - id: code-001
    type: code
    created_at: "2026-07-20T11:00:00+08:00"
    content:
      title: "src/index.ts"
      path: "data/projects/prj-001/src/index.ts"
      language: typescript
      lines: 245
      status: completed
      summary: "入口文件，初始化 bot，注册命令"
    ai_generated: true
  
  - id: code-002
    type: code
    created_at: "2026-07-20T12:00:00+08:00"
    content:
      title: "src/commands/*.ts"
      path: "data/projects/prj-001/src/commands/"
      language: typescript
      files: 5
      status: completed
      summary: "Slash commands 实现"
    ai_generated: true
  
  # === 评审/反馈 ===
  - id: comment-001
    type: comment
    created_at: "2026-07-20T15:00:00+08:00"
    content:
      author: "user"
      text: "代码看起来不错，但希望增加一个定时任务功能"
      action_required: "添加定时任务模块"
      status: acknowledged
    ai_generated: false
  
  # === 资产引用 ===
  - id: asset-001
    type: asset
    created_at: "2026-07-20T11:30:00+08:00"
    content:
      title: "架构图"
      type: image
      path: "data/projects/prj-001/assets/architecture.png"
      description: "机器人架构设计图"
    ai_generated: true
  
  # === 备注 ===
  - id: note-001
    type: note
    created_at: "2026-07-20T15:30:00+08:00"
    content:
      text: "用户希望下周一之前完成部署"
      tags: ["deadline", "urgent"]
    ai_generated: true
```

### 3.4 子项触发规则

AI 在以下情况自动创建子项：

```javascript
const SUB_ITEM_TRIGGERS = {
  conversation: [
    { condition: "每 10 轮对话", action: "自动摘要" },
    { condition: "用户说'总结'", action: "立即摘要" },
    { condition: "对话主题变化", action: "新对话段摘要" },
  ],
  
  document: [
    { condition: "用户要求生成文档", action: "创建 document" },
    { condition: "AI 判断需要沉淀", action: "AI 主动创建" },
    { condition: "文件保存成功", action: "关联到 document" },
  ],
  
  decision: [
    { condition: "用户做出决定", action: "记录决策" },
    { condition: "技术方案确定", action: "记录方案对比" },
    { condition: "AI 建议被采纳", action: "记录决策理由" },
  ],
  
  task: [
    { condition: "用户提到要做的事", action: "创建 task" },
    { condition: "AI 完成子任务", action: "更新 task 状态" },
    { condition: "用户确认完成", action: "标记 completed" },
  ],
  
  code: [
    { condition: "AI 生成代码文件", action: "创建 code" },
    { condition: "用户上传代码", action: "创建 code" },
    { condition: "代码通过测试", action: "更新状态" },
  ],
  
  comment: [
    { condition: "用户发送反馈", action: "创建 comment" },
    { condition: "评审完成", action: "记录评审意见" },
  ],
  
  asset: [
    { condition: "AI 生成图片", action: "创建 asset" },
    { condition: "用户上传文件", action: "创建 asset" },
    { condition: "渲染完成", action: "关联渲染产物" },
  ],
};
```

---

## 四、AI 工作流程

### 4.1 主入口消息处理流程

```
用户消息
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Step 1: 理解意图                                      │
│  AI 分析：                                             │
│  ├─ 用户的真实意图是什么？                              │
│  ├─ 需要多复杂？                                       │
│  ├─ 需要什么产出？                                     │
│  └─ 需要审批/归档吗？                                  │
└─────────────────────────────────────────────────────────┘
    │
    ├─────────────────────────────────────────────────┐
    │                                                 │
    ▼                                                 ▼
┌─────────────────────┐                     ┌─────────────────────┐
│  即时任务            │                     │  需要创建 Project    │
│  (简单咨询/问题)     │                     │  (复杂任务)          │
├─────────────────────┤                     ├─────────────────────┤
│  直接回复            │                     │  创建 Project        │
│  不创建 Project      │                     │  创建子项            │
│  不归档              │                     │  持续对话            │
└─────────────────────┘                     └─────────────────────┘
                                                     │
                                                     ▼
                                           ┌─────────────────────┐
                                           │  产出生成            │
                                           ├─────────────────────┤
                                           │  ├─ 文档            │
                                           │  ├─ 代码            │
                                           │  ├─ 报价单          │
                                           │  └─ 方案            │
                                           │  每个产出创建子项    │
                                           └─────────────────────┘
                                                     │
                                                     ▼
                                           ┌─────────────────────┐
                                           │  状态更新            │
                                           ├─────────────────────┤
                                           │  ├─ 摘要对话        │
                                           │  ├─ 更新任务状态    │
                                           │  ├─ 判断是否完成    │
                                           │  └─ 触发归档条件    │
                                           └─────────────────────┘
```

### 4.2 AI 决策点详解

```javascript
// AI 决策伪代码
async function handleMessage(message) {
  // Step 1: 理解意图
  const intent = await ai.understand(message);
  
  // Step 2: 判断任务类型
  const taskType = await ai.classify(intent);
  
  if (taskType === 'instant') {
    // 即时任务：直接回复
    const response = await ai.respond(intent);
    return { type: 'instant', response };
  }
  
  if (taskType === 'project') {
    // 需要创建 Project
    let project = await findActiveProject(message.channelId);
    
    if (!project) {
      // 创建新 Project
      project = await createProject({
        title: ai.generateTitle(intent),
        type: ai.determineType(intent),
        threadId: message.threadId,
      });
      
      // 创建初始子项：对话摘要
      await createSubItem(project.id, {
        type: 'conversation',
        content: { summary: message.content },
      });
    }
    
    // 处理任务
    const response = await ai.executeTask(intent, project);
    
    // 更新 Project
    await updateProject(project.id, {
      updatedAt: new Date(),
      stats: { turnCount: project.stats.turnCount + 1 },
    });
    
    return { type: 'project', project, response };
  }
  
  if (taskType === 'approval') {
    // 需要审批
    await pushToApprovalChannel({
      type: ai.determineApprovalType(intent),
      content: ai.prepareApprovalCard(intent),
    });
    
    return { type: 'approval', message: '已推送到审批频道' };
  }
}

// AI 意图分类
async function classifyIntent(intent) {
  const rules = [
    { type: 'instant', condition: '简单问题/问候/闲聊' },
    { type: 'instant', condition: '用户说"不用"或"就这样"' },
    { type: 'project', condition: '需要生成代码/文档' },
    { type: 'project', condition: '多轮对话' },
    { type: 'project', condition: '用户说"帮我做"' },
    { type: 'approval', condition: '需要用户确认的报价/合同/发布' },
  ];
  
  return ai.classifyByRules(intent, rules);
}
```

### 4.3 Project 创建条件

```javascript
const PROJECT_CREATE_CONDITIONS = {
  // 显式触发
  explicit: [
    '开个新项目',
    '这是 xxx 项目',
    '创建项目',
    '开始 xxx 项目',
  ],
  
  // 隐式触发（满足任一）
  implicit: [
    {
      condition: '客户 + 需求',
      example: '有个客户想做飞书机器人',
      priority: 'high',
    },
    {
      condition: '用户 + 预算',
      example: '我想做个网站，预算 10 万',
      priority: 'high',
    },
    {
      condition: '多文档需求',
      example: '帮我做个 PRD 和报价单',
      priority: 'high',
    },
    {
      condition: '多轮对话 (>10 轮)',
      example: null,
      priority: 'medium',
    },
    {
      condition: '代码生成 (>100 行)',
      example: null,
      priority: 'medium',
    },
    {
      condition: '用户明确说"做 xxx"',
      example: '帮我做个飞书机器人',
      priority: 'high',
    },
    {
      condition: '内容创作（文章/视频/推文）',
      example: '帮我写一篇公众号文章',
      priority: 'medium',
    },
  ],
  
  // 技术任务
  tech: [
    '做个 xxx',
    '写个 xxx',
    '开发 xxx',
    '帮我做 xxx',
    '帮我写 xxx',
  ],
  
  // 内容任务
  content: [
    '写一篇',
    '写个 xxx 文章',
    '做个 xxx 视频',
    '发个 xxx 推文',
  ],
};
```

### 4.4 对话摘要规则

```javascript
const SUMMARY_RULES = {
  // 触发条件
  triggers: [
    { type: 'interval', every: 10 },      // 每 10 轮
    { type: 'keyword', keywords: ['总结', '汇总', '小结'] },
    { type: 'topic_change', threshold: 0.7 },  // 主题变化
    { type: 'milestone', keywords: ['完成了', '可以了', '好了'] },
    { type: 'manual', command: '!summary' },
  ],
  
  // 摘要内容
  content: {
    required: [
      '时间范围',
      '主要讨论内容',
      '关键决定',
    ],
    optional: [
      '用户提供的新信息',
      '待确认事项',
      '下一步行动',
      '任务完成情况',
    ],
  },
  
  // 摘要格式
  format: {
    maxLength: 500,       // 最大字符数
    bulletPoints: true,     // 使用列表
    includeContext: true,   // 包含上下文
  },
};
```

### 4.5 归档规则

```javascript
const ARCHIVE_RULES = {
  // 触发条件
  triggers: [
    {
      type: 'timeout',
      condition: '30 天无活动',
      action: 'auto_archive',
      notify: true,
    },
    {
      type: 'user_command',
      command: '!archive',
      action: 'immediate_archive',
      notify: false,
    },
    {
      type: 'completion',
      condition: '所有任务完成',
      action: 'mark_completed',
      notify: true,
    },
    {
      type: 'abandon',
      condition: '用户说"不做了"或"算了"',
      action: 'archive_with_reason',
      notify: false,
    },
  ],
  
  // 归档位置
  archiveLocations: {
    project: '#归档',
    document: '#产出',
    code: '#产出',
    decision: '#记忆库',
  },
  
  // 归档时保留的信息
  preserve: [
    'id',
    'title',
    'type',
    'meta.created_at',
    'meta.updated_at',
    'stats',
    'links',
  ],
};
```

---

## 五、用户控制机制

### 5.1 设置项定义

```javascript
const USER_SETTINGS = {
  // 进度与日志
  progress: {
    default: true,
    type: 'boolean',
    description: '显示任务进度条',
    example: '⏳ [3/5] 正在处理...',
  },
  
  logs: {
    default: false,
    type: 'boolean',
    description: '显示详细执行日志',
    example: '📝 执行: npm install\n📝 执行: npm run build',
  },
  
  // 内容控制
  summary: {
    default: true,
    type: 'boolean',
    description: '自动生成对话摘要',
  },
  
  archive_auto: {
    default: true,
    type: 'boolean',
    description: '自动归档过期项目',
  },
  
  // 通知控制
  approval_push: {
    default: true,
    type: 'boolean',
    description: '审批推送',
    channel: '#审批',
  },
  
  daily_summary: {
    default: true,
    type: 'boolean',
    description: '每日工作摘要',
    channel: '#提醒',
  },
  
  reminder: {
    default: true,
    type: 'boolean',
    description: '任务提醒',
    channel: '#提醒',
  },
  
  alert: {
    default: true,
    type: 'boolean',
    description: '系统告警',
    channel: '#告警',
  },
  
  // 内容发布
  content_auto_render: {
    default: true,
    type: 'boolean',
    description: '内容自动渲染预览',
  },
  
  content_auto_queue: {
    default: false,
    type: 'boolean',
    description: '内容自动加入发布队列',
  },
};
```

### 5.2 设置命令

```
!settings              - 查看当前设置
!settings <项> on/off  - 开关某项设置
!quick                 - 极简模式（关闭所有通知）
!verbose               - 详细模式（开启所有详情）
!reset                 - 恢复默认设置
```

### 5.3 进度显示格式

```
✅ 开启进度时：

用户: 帮我做个飞书机器人

AI: 好的，我来帮你开发飞书机器人。

⏳ [1/5] 分析需求...
⏳ [2/5] 设计架构...
⏳ [3/5] 生成代码...
⏳ [4/5] 编写测试...
✅ [完成] 飞书机器人开发完成！

📎 代码已保存到: data/projects/prj-xxx/

---

❌ 关闭进度时：

用户: 帮我做个飞书机器人

AI: 好的，已完成！飞书机器人代码已生成，共 245 行，保存在 `data/projects/prj-xxx/`。
```

---

## 六、内容分发策略

### 6.1 各平台内容模板

#### 公众号

```yaml
platform: wechat
fields:
  - title: 单行文本，必填
  - cover: 图片链接，选填
  - content: Markdown 内容，必填
  - summary: 摘要，选填
  - author: 作者，默认"杭州 OPC 张三"
  
workflow:
  1. AI 生成初稿
  2. 用户确认/修改
  3. AI 渲染预览
  4. 推送到 #内容-公众号
  5. 用户审批发布
  6. 发布成功记录
```

#### 小红书

```yaml
platform: xiaohongshu
fields:
  - title: 标题，限 20 字
  - content: 正文，支持 Markdown
  - cover: 封面图 URL
  - tags: 话题标签，1-10 个
  - location: 位置，选填
  
workflow:
  1. AI 生成标题和正文
  2. AI 推荐话题标签
  3. 用户确认/修改
  4. AI 渲染预览
  5. 推送到 #内容-小红书
  6. 用户审批发布
```

#### 视频号

```yaml
platform: videostar
fields:
  - title: 视频标题
  - script: 分镜脚本
  - voiceover: 口播文案
  - duration: 预计时长
  - cover: 封面建议
  
workflow:
  1. AI 生成脚本
  2. 用户确认主题
  3. AI 生成完整脚本
  4. 推送到 #内容-视频号
  5. 用户录制/AI 生成视频
  6. 发布
```

#### X/Twitter

```yaml
platform: x
fields:
  - type: single | thread
  - content: 推文内容
  - thread_count: 线程数量（thread 时）
  - hashtags: 标签
  
workflow:
  1. AI 生成推文/线程
  2. 用户确认
  3. 推送到 #内容-X
  4. 发布
```

### 6.2 内容发布流程

```
创作请求
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  AI 生成初稿                                            │
│  ├─ 按平台模板生成                                    │
│  └─ 应用品牌风格                                      │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  用户确认/修改                                          │
│  ├─ 查看预览                                          │
│  ├─ 提出修改意见                                      │
│  └─ 确认发布                                          │
└─────────────────────────────────────────────────────────┘
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
┌─────────┐    ┌─────────────┐    ┌─────────────┐
│ 直接发布 │    │ 需要审批    │    │ 加入草稿    │
│ (用户授权)│    │ (推审批)   │    │ (稍后处理)  │
└─────────┘    └─────────────┘    └─────────────┘
```

---

## 七、通知与审批机制

### 7.1 审批触发条件

```javascript
const APPROVAL_TRIGGERS = {
  quote: {
    condition: '生成报价单后',
    urgency: 'medium',
    template: '报价审批卡片',
  },
  
  contract: {
    condition: '生成合同后',
    urgency: 'high',
    template: '合同审批卡片',
  },
  
  publish: {
    condition: '内容发布前',
    urgency: 'high',
    template: '发布审批卡片',
  },
  
  demo: {
    condition: 'Demo 交付前',
    urgency: 'low',
    template: 'Demo 交付审批卡片',
  },
  
  discount: {
    condition: '折扣超过阈值',
    urgency: 'high',
    template: '折扣审批卡片',
  },
};
```

### 7.2 审批卡片格式

```markdown
## ⏸️ 需要审批：报价单

**项目**: 飞书机器人开发  
**客户**: XXX 公司  
**金额**: ¥120,000（标准版）

**报价明细**:
- 基础版: ¥50,000
- 标准版: ¥120,000 ← 当前
- 旗舰版: ¥250,000

**审批操作**:
[批准] [修改] [拒绝]

**详情**: 点击查看完整报价单
```

---

## 八、技术实现要点

### 8.1 目录结构

```
data/
├── projects/                    # 所有项目
│   ├── prj-001/               # 按 ID 存储
│   │   ├── project.yaml       # 项目元信息
│   │   ├── sub-items/        # 子项
│   │   │   ├── conv-001.yaml
│   │   │   ├── doc-001.yaml
│   │   │   └── task-001.yaml
│   │   ├── documents/        # 文档产出
│   │   ├── code/             # 代码产出
│   │   └── assets/           # 资产文件
│   ├── prj-002/
│   └── ...
│
├── knowledge/                  # 知识沉淀
│   ├── memory.yaml           # 记忆库
│   ├── ideas.yaml            # 灵感
│   └── decisions.yaml        # 关键决策
│
├── output/                    # 产出归档
│   ├── documents/            # 文档
│   ├── code/                 # 代码
│   └── reports/              # 报告
│
└── archive/                   # 历史归档
    └── projects/             # 已归档项目
```

### 8.2 核心模块

```
src/
├── project/
│   ├── project-manager.mjs    # 项目管理器
│   ├── sub-item-manager.mjs # 子项管理器
│   └── project-store.mjs     # 项目持久化
│
├── workflow/
│   ├── intent-classifier.mjs # 意图分类
│   ├── summary-engine.mjs    # 摘要引擎
│   └── archive-engine.mjs    # 归档引擎
│
├── user/
│   └── settings-manager.mjs  # 用户设置
│
└── notification/
    ├── approval-pusher.mjs   # 审批推送
    ├── reminder-scheduler.mjs # 提醒调度
    └── alert-manager.mjs     # 告警管理
```

### 8.3 关键接口

```javascript
// 项目管理器
class ProjectManager {
  async createProject(params)      // 创建项目
  async getProject(id)             // 获取项目
  async updateProject(id, params)  // 更新项目
  async archiveProject(id)        // 归档项目
  async listProjects(filters)      // 列表查询
}

// 子项管理器
class SubItemManager {
  async createSubItem(projectId, item)  // 创建子项
  async updateSubItem(id, item)         // 更新子项
  async listSubItems(projectId, filters) // 列表查询
  async searchSubItems(query)            // 搜索子项
}

// 摘要引擎
class SummaryEngine {
  async shouldSummarize(context)     // 判断是否摘要
  async generateSummary(turns)      // 生成摘要
  async mergeSummary(existing, new) // 合并摘要
}

// 意图分类器
class IntentClassifier {
  async classify(message)            // 分类意图
  async getProjectType(intent)      // 判断项目类型
  async shouldCreateProject(intent)  // 判断是否创建项目
}
```

---

## 九、迁移计划

### 9.1 频道变更

| 操作 | 频道 | 说明 |
|------|------|------|
| **新建** | #项目 | 工作沉淀 |
| **新建** | #产出 | 文档/代码沉淀 |
| **新建** | #归档 | 历史项目 |
| **新建** | #内容-* | 内容分发（5个） |
| **保留** | #主入口 | 不变 |
| **保留** | #资讯 | 自动化推送（每天 12:00） |
| **保留** | #每日总结 | 自动化推送（每天 23:00） |
| **保留** | #每日任务 | 自动化推送（每天 10:00） |
| **保留** | #用量 | 自动化推送（每天 12:30） |
| **保留** | #记忆库 | 不变 |
| **保留** | #灵感 | 不变 |
| **保留** | #审批 | 不变 |
| **保留** | #提醒 | 任务提醒 |
| **保留** | #告警 | 不变 |
| **删除** | #销售线索 | 用 #项目 代替 |
| **删除** | #商机与方案 | 用 #项目 代替 |
| **删除** | #报价 | 用 #项目 代替 |
| **删除** | #标书 | 用 #项目 代替 |
| **删除** | #合同运营 | 用 #项目 代替 |
| **删除** | #项目管理 | 用 #项目 代替 |
| **删除** | #fde-客户交付 | 用 #项目 代替 |
| **删除** | #测试与验收 | 用 #项目 代替 |
| **删除** | #客户成功 | 用 #项目 代替 |
| **删除** | #开票与回款 | 用 #项目 代替 |
| **删除** | #今日素材 | 内容自动采集 |
| **删除** | #主快讯 | 内容自动生成 |

### 9.2 数据迁移

```javascript
// 迁移脚本
const MIGRATION_TASKS = [
  {
    name: '创建新频道',
    execute: async () => {
      // 创建 #项目、#产出、#归档、#提醒
      // 创建 #内容-公众号/小红书/视频号/X/Newsletter
    },
  },
  {
    name: '迁移现有项目',
    execute: async () => {
      // 将现有 12 个业务频道的内容迁移到 #项目
      // 按类型分组：销售类、技术类、内容类、交付类
    },
  },
  {
    name: '清理旧频道',
    execute: async () => {
      // 删除旧业务频道
      // 或归档到 #归档
    },
  },
];
```

---

## 十、总结

### 10.1 频道数量变化

| 设计 | 数量 |
|------|------|
| 旧设计 | 67 个 |
| 新设计 | **18 个** |
| 减少 | 49 个 |

### 10.2 核心变化

| 维度 | 旧设计 | 新设计 |
|------|--------|--------|
| 入口 | 1 + 12 个业务频道 | **1 个入口** |
| 推送 | 混在主入口 | **独立推送频道** |
| 项目 | 无 | **AI 自动创建** |
| 对话归档 | 全部归档 | **成项才归档** |
| 路由方式 | 规则匹配 | **AI 决策** |
| 用户控制 | 无 | **开关控制** |
| 内容分发 | 混合 | **平台分栏** |

### 10.3 自动化推送保留

| 频道 | 内容 | 时间 | 价值 |
|------|------|------|------|
| #资讯 | 世界发生了什么 | 12:00 | 了解行业动态 |
| #每日总结 | 今天干了什么 | 23:00 | 工作回顾 |
| #每日任务 | GitHub 待办 | 10:00 | 任务管理 |
| #用量 | AI Token 使用 | 12:30 | 成本控制 |

### 10.2 实施优先级

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| P0 | #项目 + 子项结构 | 必须 |
| P0 | AI 自动创建 Project | 必须 |
| P0 | 对话摘要 | 必须 |
| P1 | 用户设置/开关 | 重要 |
| P1 | 归档机制 | 重要 |
| P1 | #内容-* 频道 | 重要 |
| P2 | 审批机制 | 优化 |
| P2 | 通知机制 | 优化 |

---

*文档版本：v1.0*  
*最后更新：2026-07-20*
