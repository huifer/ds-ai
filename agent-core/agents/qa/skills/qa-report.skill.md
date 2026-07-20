---
name: qa-report
agent: qa
description: |
  Auto-generated skill for qa agent.
  数据回收、内容复盘、Agent 心跳、记忆治理。
---

# QA Report（QA 报告）

触发: `!qa last` 或每日 23:00 自动

## 1. 数据源
- data/business/published/*.json(发布记录)
- 各 publish 平台的实际数据(通过 API 拉)

## 2. 指标
- 阅读量 / 点赞 / 转发 / 评论
- 转化率(到官网 / demo)
- 评论情感分析

## 3. 输出
data/qa/REPORT-YYYYMMDD.md:
```
# QA Report - 2024-01-15

## 本周发布
- 公众号 5 篇 (阅读 1.2k, +12% WoW)
- X 8 条 (impression 5.6k, +25% WoW)
- LinkedIn 2 篇 (engagement 4.5%)

## Top 3 表现
1. xxx (阅读 3.2k)
2. yyy (engagement 8.9%)
3. zzz (转化 23)

## 改进建议
- 视频号时长偏短,建议 60s+
- 公众号标题过于平淡
```

## 4. 推送
发到 #agent-状态 频道。
