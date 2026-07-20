---
name: deploy
agent: delivery
description: 生产部署（需 prod-deploy 审批门）
---

# Deploy（生产部署）

触发：`!poc deploy <PRJ-ID>`（或项目部署）

## ⚠️ 审批门
本命令配置 `approval: prod-deploy`，必须先在 #审批中心 授权 `!approve` 通过后才会执行。未授权返回 `NEED_APPROVAL`。

## 流程（授权后执行）
1. 读 runbook（`accounts/<account>/projects/<PRJ>/delivery/runbook.md`，无则先生成）。
2. **部署前检查**：环境就绪 / 依赖 / 数据库迁移 / 回滚预案。
3. **部署步骤**（按 runbook）。
4. **部署后验证**：健康检查 / 冒烟测试 / 监控基线。
5. 记录部署版本、时间、执行人、结果。

## 落盘
`data/business/accounts/<account-id>/projects/<PRJ-ID>/delivery/deploy-<YYYYMMDD>.md`

## 回复
部署结果（版本 / 验证状态）；异常则触发 `!incident`。
## 约束
生产部署强审批；失败必须可回滚。
