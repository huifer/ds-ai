---
name: integration
agent: delivery
description: 系统集成设计（无独立命令，交付内部）
---

# Integration（集成设计）

> 内部 skill，无独立命令。由交付流程在集成阶段调用。

## 调用契约
入参：`{ prjId, systems: [...] }`（systems 为待对接的外部系统）

## 流程
1. 读 PRD 的集成需求。
2. 设计集成方案：
   - 接口契约（协议 / 端点 / 字段 / 频率）
   - 数据流与映射
   - 认证与授权
   - 异常 / 重试 / 幂等
   - 监控点
3. 评估对接风险与前置条件。

## 落盘
`data/business/accounts/<account-id>/projects/<PRJ-ID>/delivery/integration.md`

## 返回
集成方案摘要 + 前置依赖清单。
