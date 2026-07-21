# Discord 机器人命令参考

本文档列出了 pi-discord-agents Discord 机器人支持的所有命令。

---

## 命令速查表

| 命令 | 功能 | 使用场景 |
|------|------|----------|
| `!help` | 显示命令帮助 | 查看所有可用命令 |
| `!watch` | 管理仓库监控池 | 添加/查看/移除 GitHub 仓库 |
| `!archive` | 显式知识归档 | 手动归档到记忆库/灵感/工程 |
| `!usage` | 查看 Token 使用量 | 查看用量报告和趋势 |
| `!distill` | 手动触发记忆蒸馏 | 提取值得永久记住的信息 |
| `!memory` | 记忆管理 | 查询/统计/管理记忆 |
| `!opportunity` | 机会发现调研 | 触发机会调研生成 brief |

---

## 详细说明

### `!help` - 命令帮助

显示所有可用命令的简要说明。

**用法**
```
!help
```

---

### `!watch` - 仓库监控管理

管理 GitHub 仓库监控池，每日自动生成 Issue 待办并推送到 `#🎯 每日任务`。

**子命令**
- `!watch list` — 查看监控池中的仓库列表
- `!watch add <owner/repo>` — 添加仓库到监控池
- `!watch remove <owner/repo>` — 从监控池移除仓库
- `!watch help` — 显示帮助信息

**示例**
```
!watch list
!watch add rust-lang/rust
!watch remove vercel/next.js
```

**自动任务**
- 每天北京时间 10:00 自动生成 GitHub Issue 待办

---

### `!archive` - 显式知识归档

手动将内容归档到对应的沉淀频道。

**子命令**
- `!archive memory <内容>` — 归档长期事实/偏好 → `#🧠 记忆库`
- `!archive ideas <内容>` — 归档灵感/点子 → `#✨ 灵感`
- `!archive build <内容>` — 归档工程结论 → `#🔨 工程`
- `!archive help` — 显示帮助信息

**示例**
```
!archive memory 我偏好使用 Rust 构建高性能服务
!archive ideas 可以做一个 AI 驱动的代码审查工具
!archive build 使用 axum + tokio 的异步 Web 框架
```

**别名支持**
- `memory` 可用：`记忆`、`记忆库`
- `ideas` 可用：`idea`、`灵感`、`点子`
- `build` 可用：`工程`、`代码`

---

### `!usage` - Token 使用量

查看 MiniMax Token 使用量报告和趋势分析。

**子命令**
- `!usage` — 14 天详细报告（推送到 `#📊 用量`，含 ECharts 图）
- `!usage 7` — 显示最近 7 天报告
- `!usage 30` — 显示最近 30 天报告
- `!usage 90` — 显示最近 90 天报告
- `!usage today` — 今日 vs 昨日对比
- `!usage month` — 本月累计统计
- `!usage model` — 按 model 拆分统计（Top 25）
- `!usage agent` — 按 agent 拆分统计（claude / pi / opencode / codex / gemini）
- `!usage cost` — 只看成本统计
- `!usage help` — 显示帮助信息

**示例**
```
!usage
!usage 7
!usage today
!usage model
```

**自动任务**
- 每天北京时间 12:30 自动推送 14 天报告

---

### `!distill` - 手动触发记忆蒸馏

从今日对话中提取值得永久记住的信息并归档到 `#🧠 记忆库`。

**子命令**
- `!distill` — 立即触发蒸馏（使用今日 journal）
- `!distill help` — 显示帮助信息

**蒸馏规则**
- 从今日对话中提取 0-5 条记忆
- 严格查重：相似度阈值 0.9
- 质量优先：宁缺毋滥

**示例**
```
!distill
```

**自动任务**
- 每天北京时间 23:30 自动蒸馏
- 蒸馏结果自动推送到 `#🧠 记忆库`

---

### `!memory` - 记忆管理

查询、统计和管理长期记忆。

**子命令**

**统计**
- `!memory stats` — 查看记忆统计信息

**查询**
- `!memory search <关键词>` — 搜索记忆
- `!memory show <subject>` — 显示记忆详情

**维护**
- `!memory report` — 生成记忆质量报告
- `!memory cleanup` — 手动清理过期记忆
- `!memory help` — 显示帮助信息

**示例**
```
!memory stats
!memory search rust
!memory show 我的编码偏好
!memory report
```

**自动任务**
- 每日 23:30：自动蒸馏
- 每周日 02:00：自动治理（过期/归档/删除）
- 每周日 03:00：批量更新置信度

---

### `!opportunity` - 机会发现调研

触发 AI 机会发现调研，生成结构化 brief 并归档到 `#💡 机会`。

**子命令**
- `!opportunity <topic>` — 触发机会发现，brief 推送到 `#💡 机会`
- `!opportunity <topic> <channel>` — 推送到指定频道
  - 可选频道：`opportunity` / `build` / `ideas` / `memory`
- `!opportunity help` — 显示帮助信息

**调研流程**
1. 数据采集：HN Algolia / gh CLI / 中文 RSS / Reddit（零 API Key）
2. AI 推理：聚类 / 合成 / 写 brief
3. 输出：5 个 cluster + SaaS/App 创业灵感 + 链接清单
4. 自动推送到 `#主入口` + 目标频道
5. Brief 落盘到 `data/opportunity/`

**示例**
```
!opportunity AI Agent 开发工具
!opportunity Rust Web 框架 ideas
```

**预计耗时**
- 1-3 分钟（spawn 独立子进程，不影响主流程）

---

## 频道说明

| 频道 | Emoji | 用途 |
|------|-------|------|
| #主入口 | 📝 | 唯一对话入口，用户发送消息、Pi 回复 |
| #记忆库 | 🧠 | 长期事实/偏好，蒸馏自动归档 |
| #灵感 | ✨ | 创意/灵感点子 |
| #工程 | 🔨 | 技术结论/代码决策 |
| #系统 | 🛠 | 系统告警、诊断信息 |
| #资讯 | 📰 | RSS hub 每日推送（每天 12:00） |
| #每日总结 | 🌙 | 每日总结推送（每天 23:00） |
| #每日任务 | 🎯 | GitHub Issue 待办（每天 10:00） |
| #用量 | 📊 | Token 使用量报告（每天 12:30） |
| #机会 | 💡 | 机会发现调研 brief |

---

## 自动任务总览

| 任务 | 时间 | 频道 | 说明 |
|------|------|------|------|
| GitHub 待办生成 | 10:00 | #🎯 每日任务 | 从监控池生成 Issue 列表 |
| RSS 推送 | 12:00 | #📰 资讯 | RSS hub 资讯汇总 |
| 用量报告 | 12:30 | #📊 用量 | Token 使用量趋势 |
| 每日总结 | 23:00 | #🌙 每日总结 | 当日对话摘要 |
| 记忆蒸馏 | 23:30 | #🧠 记忆库 | 提取长期记忆 |
| 记忆治理 | 周日 02:00 | - | 过期/归档/删除 |
| 置信度更新 | 周日 03:00 | - | 批量更新记忆置信度 |

---

## 使用技巧

### 归档知识
- 重要的技术决策用 `!archive build` 归档
- 灵光一现的创意用 `!archive ideas` 归档
- 个人偏好和长期事实用 `!archive memory` 归档

### 查询记忆
- 先用 `!memory search <关键词>` 找到记忆的 subject
- 再用 `!memory show <subject>` 查看完整内容

### 监控趋势
- 每天自动推送用量报告，也可随时 `!usage today` 查看
- 按 model 或 agent 拆分可发现使用模式

### 机会发现
- 善用 `!opportunity` 发现新技术趋势和创业灵感
- 指定目标频道可自动分类归档

---

## 故障排查

### 命令无响应
- 检查频道是否为 `#主入口`
- 确认用户是否在白名单（`ALLOWED_USER_IDS`）
- 查看日志：`logs/orchestrator.log`

### 记忆系统异常
- 用 `!memory stats` 检查记忆状态
- 用 `!memory cleanup` 手动清理过期记忆

### 机会发现失败
- 检查网络代理配置
- 查看日志：`logs/trigger.log`