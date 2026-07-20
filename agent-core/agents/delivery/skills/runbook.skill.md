---
name: runbook
agent: delivery
description: 运维 Runbook（无独立命令，部署前生成）
---

# Runbook（运维手册）

> 内部 skill，无独立命令。由 `deploy` 前置调用（无 runbook 则先本 skill 生成）。

## 调用契约
入参：`{ prjId }`

## 流程
基于 PRD / 集成方案 / 部署架构生成运维手册：
1. **部署**：环境 / 步骤 / 配置 / 密钥管理
2. **监控**：指标 / 阈值 / 告警通道
3. **故障处理**：常见故障 → 诊断 → 处置（引用 incident 历史）
4. **备份与恢复**
5. **回滚预案**
6. **联系人 / 升级路径**

## 落盘
`data/business/accounts/<account-id>/projects/<PRJ-ID>/delivery/runbook.md`

## 返回
runbook 路径 + 关键告警项；交付 deployment 与 oncall 使用。
