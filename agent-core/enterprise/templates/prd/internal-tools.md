# PRD 模板 · 企业内部工具

> 行业类型：`internal-tools`  
> 路径：`agent-core/enterprise/templates/prd/internal-tools.md`  
> 由 `solution-agent` 加载；`research-agent` + `knowledge-agent` 运行时填充 `## Runtime Research`。

---

# 1. 文档头

```yaml
project: PRJ-2026-0001
industry: internal-tools
title:
owner: huifer
client:
version: 0.1
status: DRAFT
```

# 2. 一句话定义

```text
[客户] 内部 [团队/部门] 需要 [做什么]，通过 [集成现有系统] 减少 [手工步骤 / 错误 / 时间]。
```

# 3. 使用方

| 角色 | 团队 | 频次 | 设备 |
|---|---|---|---|
| 运营 | 业务 | 日 | PC + 手机 |
| 主管 | 业务 | 周 | PC |
| 运维 | IT | 月 | PC |

# 4. 功能清单

| ID | 功能 | 优先级 | 验收 |
|---|---|---|---|
| F-01 | 表单提交与审批 | P0 | 流程跑通 |
| F-02 | 数据导入导出 | P0 | 1 万行 < 30s |
| F-03 | 报表 / 看板 | P0 | 实时更新 |
| F-04 | 权限模型 | P0 | 角色 + 字段级 |
| F-05 | 审计日志 | P1 | 可查询 |

# 5. 集成

| 系统 | 方式 | 频率 |
|---|---|---|
| SSO | OAuth / SAML | 实时 |
| HR | API | 1d |
| Finance | API | 1h |
| CRM | API | 实时 |

# 6. 安全与合规

- 角色 + 字段级权限
- 操作审计
- 客户标识脱敏
- 数据保留策略
- 灾备与恢复

# 7. 技术栈

- 前端：React + shadcn/ui
- 后端：Node / Go
- 数据库：Postgres
- 部署：私有云 / 内网
- 监控：Sentry / Prometheus

# 8. 风险

| ID | 风险 | 缓解 |
|---|---|---|
| R-01 | 内部使用率低 | 培训 + 看板 |
| R-02 | 数据孤岛 | 标准化接口 |
| R-03 | 安全审计 | 灰度 + 审计日志 |

# 9. Runtime Research

```yaml
sources:
  - name:
    url:
    fetched_at:
summary:
decision_impact:
```

# 10. 验收

- 主管签字；
- 内部团队培训通过；
- 30 天稳定运行。

# 11. 上线计划

| 阶段 | 范围 | 周 |
|---|---|---|
| MVP | F-01 / F-02 | 3-4 |
| Beta | + F-03 / F-04 | 4-6 |
| 上线 | + F-05 | 6-8 |
