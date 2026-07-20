---
name: serp-analyze
agent: seo
description: |
  Synthetic agent skill for seo: serp-analyze.
  Auto-generated.
---

# SERP Analyze（SERP 分析）

## 1. 收集 SERP 数据
对目标关键词,抓取 Google 前 10 名的:
- 标题 / URL / 元描述
- 内容结构(H1/H2/H3)
- 字数 / 图片数 / 视频数
- 域名权威度(DR)

## 2. 内容缺口分析
对比 top 10,找出:
- 共性主题(都在讲什么)
- 差异化机会(谁都没覆盖的角度)
- 必答问题(PAA)

## 3. 报告输出
```
# SERP 分析: <关键词>

## Top 10 概览
[表格]

## 共性主题
- ...

## 差异化建议
- ...

## 必答问题
1. ...
2. ...
```

## 4. 落盘
data/business/seo/serp-<keyword>-<date>.md
