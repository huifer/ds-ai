---
name: memory-manage
agent: asset
description: |
  Synthetic agent skill for asset: memory-manage.
  Auto-generated.
---

# Memory Manage（记忆治理）

## 1. 质量检查
- 长度 < 50 字符 → 标记低质量
- 重复内容 → 合并
- 引用失效 → 标记
- 过期(>180 天未访问) → 评估删除

## 2. 整理
- 按 scope 分组
- 按 topic 聚类
- 按时间排序

## 3. 输出
data/memory/INDEX.md: 总览
data/memory/<scope>/SUMMARY.md: 各 scope 摘要
