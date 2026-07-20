---
name: pi-session-fetch
agent: intake
description: |
  Auto-generated skill for intake agent.
  每日 23:50 拉取 GitHub commits、Pi Session、Discord、飞书摘要。
---

# Pi Session Fetch（Pi Session 数据抓取）

## 1. 扫描 sessions 目录
读取 sessions/*.jsonl 中今天的 session 文件。

## 2. 提取关键信息
每个 session:
- 会话开始/结束时间
- 用户消息数
- Agent 响应数
- 用到的 skill 列表
- 关键词提取

## 3. 输出
data/business/intake/pi-session-YYYYMMDD.md:
```
# Pi Session Summary - 2024-01-15

总 session: 23
活跃用户: 5
主要 skill: lead-capture (8次), react-demo (3次)
```
