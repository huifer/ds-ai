---
name: architecture
agent: dev
description: |
  Synthetic agent skill for dev: architecture.
  Auto-generated.
---

# Architecture Design（架构设计）

## 1. 输入
- 业务需求(性能 / 可用性 / 扩展性)
- 约束(预算 / 时间 / 团队规模)
- 现有系统

## 2. 输出架构图
```
[Client] → [CDN] → [API Gateway] → [Service A/B/C] → [DB]
                                ↓
                          [Cache] [Queue] [Search]
```

## 3. 关键技术决策
- 前后端分离?
- 单体 vs 微服务?
- 数据库选型
- 部署方式
- 监控方案

## 4. ADR(架构决策记录)
```
# ADR-001: 选择 PostgreSQL

## 背景
...

## 决策
...

## 后果
+ ...
- ...

## 替代方案
- MySQL: ...
- MongoDB: ...
```

## 5. 落盘
data/architecture/ADR-<id>.md
