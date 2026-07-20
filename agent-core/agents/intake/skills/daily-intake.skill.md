---
name: daily-intake
agent: intake
description: |
  Auto-generated skill for intake agent.
  每日 23:50 拉取 GitHub commits、Pi Session、Discord、飞书摘要。
---

# Daily Intake（每日内容采集）

触发: 每日 23:50 cron 自动 / `!intake now`

## 1. 数据源
- GitHub: 监听仓库的当天 commits(gh-watch.mjs)
- Pi Session: 今天的 session 文件(sessions/*.jsonl)
- Discord: 今天的活跃频道(过滤 #主入口 / 各业务频道)
- 飞书: 今天的文档更新(可选,需要飞书 token)

## 2. 落盘
写到 data/business/intake/INTAKE-YYYYMMDD.md:
- 各源的摘要(每源 ≤200 字)
- 关键词 / 标签提取
- 候选评分(0-10)
- 备注

## 3. 推送
写入后推送摘要卡片到 #每日素材 频道。

## 4. 后续
- distill agent 会在 00:30 自动处理昨晚的 intake 产物
