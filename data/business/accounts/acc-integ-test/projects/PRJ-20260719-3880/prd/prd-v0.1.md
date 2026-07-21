# PRD 模板 · SaaS

> 行业类型：`saas`  
> 路径：`agent-core/enterprise/templates/prd/saas.md`  
> 由 `solution-agent` 加载；`research-agent` + `knowledge-agent` 运行时填充 `## Runtime Research`。

---

# 1. 文档头

```yaml
project: PRJ-2026-0001
industry: saas
title:
owner: huifer
client:
version: 0.1
status: DRAFT
```

# 2. 一句话定义

```text
[客户] 想通过 SaaS 平台 [解决什么问题]，提供 [核心能力]，按 [计费模式] 收费。
```

# 3. 目标用户

| 角色 | 关注点 | 使用频率 |
|---|---|---|
| Admin | 报表 / 团队 | 周 |
| Operator | 日常工作 | 日 |
| End user | 完成单一任务 | 日 |

# 4. 核心模块

| ID | 模块 | MVP | V1 | V2 |
|---|---|---|---|---|
| M-01 | 账号 / 权限 | ✓ | ✓ | ✓ |
| M-02 | 核心功能 A | ✓ | ✓ | ✓ |
| M-03 | 计费与订阅 | — | ✓ | ✓ |
| M-04 | 团队协作 | — | ✓ | ✓ |
| M-05 | API | — | — | ✓ |

# 5. 计费

| 套餐 | 包含 | 单价 |
|---|---|---|
| Free | 基础能力 | 0 |
| Pro | 完整能力 | ¥ X / 月 |
| Team | 团队 + 协作 | ¥ Y / 人 / 月 |
| Enterprise | SSO + 审计 | 联系销售 |

# 6. 技术栈

- 前端：React + Tailwind v4 + shadcn/ui
- 后端：Vite SSR / Node / Go
- 数据库：Postgres + Redis
- 部署：Cloudflare Workers / Vercel
- 支付：Stripe / Creem
- 监控：Sentry / PostHog

# 7. 非功能需求

- P95 ≤ 1s
- 可用性 ≥ 99.9%
- 多租户隔离
- 数据导出
- GDPR / 个保法

# 8. 风险

| ID | 风险 | 缓解 |
|---|---|---|
| R-01 | 滥用 / 刷量 | 限速 + 验证码 |
| R-02 | 支付失败 | 多通道 + 重试 |
| R-03 | 多租户泄露 | 行级安全 |
| R-04 | 成本失控 | 限速 + 计费上限 |

# 9. Runtime Research

```yaml
sources:
  - name:
    url:
    fetched_at:
summary:
decision_impact:
```

# 10. 验收标准

- MVP 5 个核心场景通过；
- 支付与计费跑通；
- 多租户隔离通过安全测试；
- 客户代表验收签字。

# 11. 上线计划

| 阶段 | 范围 | 周 |
|---|---|---|
| MVP | M-01 / M-02 | 4-6 |
| V1 | + M-03 / M-04 | 6-8 |
| V2 | + M-05 | 8-10 |
