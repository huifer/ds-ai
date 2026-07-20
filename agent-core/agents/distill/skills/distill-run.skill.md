---
name: distill-run
agent: distill
description: |
  Auto-generated skill for distill agent.
  候选评分、生成 brief、推送 #主快讯 / #main-feed。
---

# Distill Run（蒸馏执行）

触发: `!distill now` 或每日 00:30 cron 自动

## 1. 读取 intake 产物
从 data/business/intake/INTAKE-YYYYMMDD.md 加载昨晚的采集结果。

## 2. 候选评分
对每个候选按以下维度评分(0-10):
- 时效性: 是否是热点话题
- 品牌相关性: 是否与公司业务相关
- 价值密度: 是否包含可执行的信息
- 可分享性: 读者会觉得有用吗

过滤: score >= 6 的进入 brief 流程。

## 3. 生成 brief
对每个高分候选生成 brief:
- 标题(中文/英文各一)
- 摘要(3 句话以内)
- 标签(3-5 个)
- 目标平台(wechat / x / linkedin 等)
- 推荐发布时间

## 4. 推送
- 国内候选 → #主快讯
- 海外候选 → #main-feed
- 草稿卡片由 distill/distill-brief 生成
