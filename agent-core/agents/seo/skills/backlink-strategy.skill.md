---
name: backlink-strategy
agent: seo
description: |
  Synthetic agent skill for seo: backlink-strategy.
  Auto-generated.
---

# Backlink Strategy（外链策略）

## 1. 分析现状
读取 data/business/seo/backlinks-<date>.csv 当前外链。

## 2. 分类
按 DR (Domain Rating):
- 高质量 (DR > 70): 5%
- 中等 (DR 30-70): 30%
- 低质量 (DR < 30): 65%

## 3. 策略
- 高质量: 主动联系,内容合作
- 中等: 投稿, 客座博客
- 低质量: 定期清理(disavow)

## 4. 新增机会
基于竞争对手外链,找出 10 个潜在目标站点。

## 5. 输出
data/business/seo/backlink-plan-<month>.md
