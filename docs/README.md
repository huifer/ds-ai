# 艺人公司 IP 管理平台 - 文档索引

> 基于 Discord + AI Agent 的企业级内容管理系统

---

## 📚 核心文档

| 文档 | 说明 |
|------|------|
| [CHANNEL_ARCHITECTURE.md](CHANNEL_ARCHITECTURE.md) | 频道架构设计（18 频道精简方案） |
| [PROJECT_LIFECYCLE.md](PROJECT_LIFECYCLE.md) | Project 生命周期管理 |
| [FDE_DELIVERY_STANDARD.md](FDE_DELIVERY_STANDARD.md) | FDE 项目交付标准 |
| [USER_SETTINGS.md](USER_SETTINGS.md) | 用户设置与控制 |
| [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) | 实施路线图 |
| [QUICK_START.md](QUICK_START.md) | 快速开始指南 |
| [OPC_MEMORY_AND_LOOP_AGENT_DESIGN.md](OPC_MEMORY_AND_LOOP_AGENT_DESIGN.md) | **高级设计：记忆2.0·Loop Agent·做梦增强·OPC优化** |
| [XIASI_ENHANCEMENT_PLAN.md](XIASI_ENHANCEMENT_PLAN.md) | **遐思增强：好梦机制·预言·记忆通道·自我改进** |

---

## 🎯 核心功能

### 1. 项目管理
- AI 自动识别并创建 Project
- 7 种子项类型：对话、文档、决策、任务、代码、评论、资产
- 自动归档（30 天无活动）

### 2. 定时任务（北京时间）
| 时间 | 任务 |
|------|------|
| 03:00 | 项目归档检查 |
| 09:00 | 提醒检查 |
| 10:00 | 每日任务推送 |
| 12:00 | RSS 资讯 |
| 12:30 | Token 用量 |
| 23:00 | 每日总结 |

### 3. 内容分发
支持多平台内容渲染与分发：
- 📝 公众号
- 📕 小红书
- 🎬 视频号
- 🐦 X/Twitter
- 📧 Newsletter

### 4. 文件搜索
在 Discord 中直接搜索本地文件：
```
!files <关键词>     - 搜索文件
!recent             - 最近文件
!types              - 支持的文件类型
```

### 5. 通知系统
- 📋 审批推送
- ⏰ 提醒调度
- 🚨 告警管理

### 6. 多 Agent 系统
- 25 个真实 Agent + 115 个 Skill
- Session 隔离与自动压缩
- Team 引擎（多 Agent 协作）
- Memory 四层架构

### 7. 梦境系统（遐思）
- Light → REM → Deep 三阶段流水线
- 四种梦：连珠、归藏、明台、预言
- 5 信号评分 + 影子试用
- Discord 投票 + 周报/月报

---

## 📁 文档结构

```
docs/
├── README.md                     # 本文档
├── CHANNEL_ARCHITECTURE.md       # 频道架构
├── PROJECT_LIFECYCLE.md         # Project 生命周期
├── FDE_DELIVERY_STANDARD.md     # FDE 交付标准
├── USER_SETTINGS.md             # 用户设置
├── QUICK_START.md              # 快速开始
├── IMPLEMENTATION_ROADMAP.md   # 实施路线图
└── CHANNEL_MIGRATION.md        # 频道迁移说明
```

---

## 🔧 源代码结构

```
src/
├── project/
│   ├── project-store.mjs        # 数据存储
│   └── project-manager.mjs     # 管理器
│
├── workflow/
│   ├── intent-classifier.mjs   # 意图分类
│   ├── summary-engine.mjs      # 摘要生成
│   ├── project-integrator.mjs  # Project 集成
│   └── entry-integrator.mjs    # 入口协调
│
├── user/
│   └── settings-manager.mjs    # 用户设置
│
├── notification/
│   ├── approval-pusher.mjs     # 审批推送
│   ├── reminder-scheduler.mjs  # 提醒调度
│   └── alert-manager.mjs       # 告警管理
│
├── content/
│   ├── content-renderer.mjs    # 内容渲染
│   └── content-publisher.mjs   # 内容发布
│
└── file/
    ├── file-searcher.mjs       # 文件搜索
    └── file-commands.mjs       # 文件命令
```

---

## 📝 命令速查

### 项目命令
| 命令 | 功能 |
|------|------|
| `!project` | 查看当前项目 |
| `!project list` | 列出所有项目 |
| `!project done` | 标记完成 |
| `!project archive` | 归档项目 |

### 设置命令
| 命令 | 功能 |
|------|------|
| `!settings` | 查看设置 |
| `!settings <项> on/off` | 修改设置 |
| `!quick` | 极简模式 |
| `!normal` | 正常模式 |
| `!verbose` | 详细模式 |

### 文件命令
| 命令 | 功能 |
|------|------|
| `!files <关键词>` | 搜索文件 |
| `!file <文件名>` | 查看详情 |
| `!recent` | 最近文件 |
| `!types` | 支持的类型 |

### 其他命令
| 命令 | 功能 |
|------|------|
| `!summary` | 生成摘要 |
| `!usage` | Token 用量 |

---

## 🏢 企业化管理功能

### FDE 项目交付
完整的项目交付标准，支持 L1/L2/L3 三个级别：
- L1: 标准交付
- L2: 完整交付 + 文档
- L3: 专家交付 + 培训 + 维护

### 审批流程
- 报价审批
- 合同审批
- 内容发布审批
- 折扣审批

### 定时任务
所有任务统一使用北京时间 (UTC+8)

---

## 🚀 快速开始

1. 确保 `.env` 配置正确
2. 安装依赖: `npm install`
3. 启动: `node src/entry-bot.mjs`

详细步骤见 [QUICK_START.md](QUICK_START.md)

---

## 📊 频道结构（18 频道）

```
Entry (1):    #主入口
Push (4):     #资讯, #每日总结, #每日任务, #用量
Project (1):   #项目
Knowledge (4): #记忆库, #灵感, #产出, #归档
Content (5):   #内容-公众号, #内容-小红书, #内容-视频号, #内容-X, #内容-Newsletter
Notification (3): #审批, #提醒, #告警
```

---

*文档版本：v2.0*  
*最后更新：2026-07-20*
