---
name: github-fetch
agent: intake
description: |
  Auto-generated skill for intake agent.
  每日 23:50 拉取 GitHub commits、Pi Session、Discord、飞书摘要。
---

# GitHub Fetch（GitHub 数据抓取）

## 1. 仓库列表
读取 data/gh-watch.json 获取监控仓库列表。

## 2. 抓取当天 commits
对每个仓库:
- git log --since="today 00:00" --until="now"
- 提取: hash, author, message, files changed
- 过滤 merge commits

## 3. 输出
data/business/intake/gh-YYYYMMDD.json:
```json
{
  "date": "2024-01-15",
  "commits": [
    {"repo": "xxx", "hash": "abc123", "author": "zhangsan", "message": "fix bug", "files": 3}
  ]
}
```
