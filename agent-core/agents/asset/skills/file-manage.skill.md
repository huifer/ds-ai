---
name: file-manage
agent: asset
description: |
  Synthetic agent skill for asset: file-manage.
  Auto-generated.
---

# File Manage（文件管理）

## 1. 分类
按用途:
- 业务文件 (data/business/)
- 内容产物 (data/content/)
- 记忆归档 (data/memory/)
- 系统日志 (data/logs/)

## 2. 命名规范
YYYY-MM-DD_<category>_<id>_<title>.ext

## 3. 清理
- 30 天前的临时文件 → 归档
- 90 天前的归档 → 压缩存储
- 1 年前的 → 移到冷存储

## 4. 索引
data/business/INDEX.md 维护所有重要文件路径。
