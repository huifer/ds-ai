---
name: discord-summary
agent: intake
description: |
  Auto-generated skill for intake agent.
  每日 23:50 拉取 GitHub commits、Pi Session、Discord、飞书摘要。
---

# Discord Summary（Discord 频道摘要）

## 1. 扫描今天的消息
读取 Discord API(通过 bot token)今天所有业务频道的消息:
- #主入口, #销售线索, #项目管理, #软件开发 等
- 排除 #遐思, #用量, #系统 等被动频道

## 2. 提取关键信息
- 每个频道的活跃度(消息数)
- 高频关键词
- 待办事项(检测 "TODO" / "待办")
- 决策事项(检测 "决定" / "approved")

## 3. 输出
data/business/intake/discord-YYYYMMDD.md: 各频道摘要 + 关键事项列表。

## 4. 隐私
- 默认脱敏客户名(用 [CLIENT-X] 替换)
- 不记录具体消息内容,只记录元数据
