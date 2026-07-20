---
name: keyword-research
agent: seo
description: |
  Synthetic agent skill for seo: keyword-research.
  Auto-generated.
---

# Keyword Research（关键词研究）

触发: 用户提到 "关键词"、"搜索量"、"难度"

## 1. 收集候选关键词
从用户上下文提取,或基于主题生成 10-20 个候选。

## 2. 多维度评估
对每个关键词:
- 搜索量(预估月搜索)
- 竞争度(0-100,越低越好)
- 商业价值(广告主愿意出价)
- 趋势(过去 12 个月变化)
- GEO 适配性(生成式引擎引用的概率)

## 3. 工具调用
用 web_search / tavily 检索:
- "X keyword difficulty"
- "X keyword volume"
- "X industry benchmark"

## 4. 输出建议
按"先易后难"原则给 5 个推荐关键词:
```
| 关键词 | 月搜索量 | 难度 | 价值 | 趋势 |
| ... |
```

## 5. 落盘
写到 data/business/seo/keywords-<date>.md
