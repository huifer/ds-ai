# 每日工作与 AI 对话转次日内容系统

> 核心信息锚点：创始人每天都有真实工作任务，并与 AI 进行大量对话。这些工作、决策、修复、失败和产物应在当日被结构化蒸馏，转化为第二天可审核、可发布的自媒体内容。

---

# 1. 为什么这是内容系统的核心

传统内容系统通常从“今天发什么”开始，容易产生：

- 凭空选题；
- 追热点；
- 内容与真实业务脱节；
- 平台之间重复；
- 缺少证据；
- 长期无法积累专业资产。

本系统从“今天真实做了什么”开始：

```text
真实任务
→ 与 AI 的对话
→ 文件、代码和决策
→ 当日蒸馏
→ 次日内容候选
→ 人工批准
→ 平台适配
→ 发布和复盘
```

因此，内容本身是业务和产品的副产品，而不是脱离工作单独制造的负担。

---

# 2. 每日输入

## 工作输入

- 新功能开发；
- Bug 修复；
- 部署；
- SEO 调整；
- 外链分析；
- 客户问题；
- FDE 问诊；
- POC；
- 报价、方案和标书；
- 产品调研；
- 用户反馈；
- 失败实验；
- 数据变化；
- 开源维护；
- 图书和源码知识复用。

## AI 对话输入

- Discord 与 Agent 对话；
- Pi Agent Session；
- Claude Code 对话；
- 其他编码 Agent 记录；
- 飞书中的项目讨论；
- 项目 Issue、Commit 和 PR；
- 当日生成的 Markdown、图片、表格和视频。

---

# 3. 原始对话不能直接发布

AI 对话只是一种原材料，存在：

- 重复；
- 上下文缺失；
- 未验证推测；
- 客户隐私；
- 密钥和内部路径；
- 错误答案；
- 未完成方案；
- 对公众没有价值的操作细节。

发布前必须经过：

```text
隐私过滤
→ Secret 过滤
→ 客户脱敏
→ 事实核验
→ 证据绑定
→ 观点提炼
→ 受众价值判断
→ 平台重写
```

禁止直接把完整聊天记录自动发布。

---

# 4. 当日蒸馏流程

建议每天固定执行一次。

## Step 1：收集

按日期收集：

- 用户消息；
- Agent 回复；
- Tool 调用；
- 修改的文件；
- Git Commits；
- 完成和失败的任务；
- 新建 Artifact；
- 重要决策。

## Step 2：提取工作事件

每个事件形成：

```yaml
id: WORK-2026-0001
title: 修复多 Agent 回复串线
project: pi-discord-agents
problem: 全局 pendingReply 会导致并发消息错配
attempts:
  - 检查当前 RPC 事件流
  - 设计 Agent + Thread Session Actor
result: 形成新的路由设计
proof:
  - source file
  - commit
  - test
confidentiality: internal
```

## Step 3：生成内容候选

一个工作事件可以生成多个候选角度：

- 我今天做了什么；
- 为什么会失败；
- 技术原理；
- 企业为什么需要；
- 一人公司如何利用；
- 一个可以复用的清单；
- 一个产品机会；
- 一个反常识观点；
- 一段视频演示。

## Step 4：候选评分

每个候选按 0 至 5 分评分：

| 维度 | 问题 |
|---|---|
| 真实性 | 是否来自真实工作？ |
| 证据 | 是否有代码、截图、数据、文件或来源？ |
| 受众价值 | 读者能否学到或使用？ |
| 新颖性 | 是否不是泛泛常识？ |
| 品牌一致性 | 是否符合杭州 OPC、FDE、AI、SaaS 主线？ |
| 可传播性 | 是否有明确冲突、结果、方法或故事？ |
| 可复用性 | 是否能转成长文、短帖、视频或 Skill？ |
| 保密安全 | 是否可以公开？分数越高表示风险越低。 |

推荐规则：

- 总分高于 32：优先进入次日内容；
- 24 至 31：进入选题池；
- 低于 24：保留为知识资产，不急于发布；
- 保密安全低于 4：必须人工审核或禁止公开。

---

# 5. 次日内容包

每天生成一个：

```text
CNT-DAY-YYYY-MM-DD
```

内容包包含：

```text
content-library/daily/YYYY-MM-DD/
├── source-events.md
├── evidence.md
├── private-redactions.md
├── candidates.yaml
├── selected-brief.md
├── drafts/
│   ├── wechat.md
│   ├── xiaohongshu.md
│   ├── video-account.md
│   ├── douyin.md
│   └── overseas-english.md
├── approval.json
└── publish-record.json
```

---

# 6. 国内平台转换

## 微信公众号

适合：

- 一项完整实践；
- 一次复杂故障；
- 一个企业案例；
- 一个方法论；
- 一周工作总结。

## 小红书

适合：

- 清单；
- 对比；
- 一人公司工作流；
- 一天完成了什么；
- 工具截图；
- 避坑经验。

## 视频号

适合：

- 真实讲解；
- 企业 AI 落地；
- FDE 经验；
- 上线后的培训和复盘；
- 产品演示。

## 抖音

适合：

- 单一强观点；
- 三秒冲突；
- 快速演示；
- 失败与反转；
- 前后效果对比。

---

# 7. 海外内容转换

海外内容必须重新用英文构思，不逐句翻译中文稿。

适合：

- What I shipped today
- A bug I fixed and what caused it
- A product screenshot
- A technical trade-off
- A failed launch or experiment
- A reusable open-source tool
- A SaaS validation lesson
- A public metric with evidence

海外不使用 Reddit。具体平台见 [海外平台地图](../platforms/overseas-channel-map.md)。

---

# 8. FDE 知识回流

FDE 每次项目都应产生两套资料：

## 私有交付资料

- 客户需求；
- 架构；
- 数据；
- 部署；
- 验收；
- 客户问题。

## 可公开知识资产

经过脱敏后形成：

- 通用问题；
- 决策框架；
- 检查清单；
- 失败原因；
- 技术教程；
- 视频课程；
- SaaS 产品机会；
- Agent Skill。

任何客户内容在脱敏和审批前不得进入公开草稿。

---

# 9. 质量要求

次日内容必须回答：

1. 昨天真实发生了什么？
2. 这件事为什么值得别人知道？
3. 哪部分是事实，哪部分是观点？
4. 有什么证据？
5. 是否泄露客户、Secret 或内部路径？
6. 是否符合国内或海外品牌定位？
7. 是否为对应平台重新创作？
8. 是否有一个明确结论或行动建议？

---

# 10. 与当前系统的连接

当前项目已经具备：

- Discord 消息接收；
- Session JSONL；
- Memory Journal；
- 每日总结；
- 记忆蒸馏；
- Scheduler；
- Discord 推送。

后续需要新增一个独立的 `daily-content-distillation` Workflow：

```text
23:00 每日工作总结
23:30 长期记忆蒸馏
00:00 内容候选蒸馏
次日早上 Discord #自媒体-总编室 审批
审批后生成各平台版本
```

长期记忆蒸馏与内容蒸馏不能合并：

- Memory 关心未来 Agent 是否需要记住；
- Content 关心公众是否值得阅读。
