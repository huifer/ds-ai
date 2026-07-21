# PRD 模板 · 数据分析

> 行业类型：`data-analytics`  
> 路径：`agent-core/enterprise/templates/prd/data-analytics.md`  
> 由 `solution-agent` 加载；`research-agent` + `knowledge-agent` 运行时填充 `## Runtime Research`。

---

# 1. 文档头

```yaml
project: PRJ-2026-0001
industry: data-analytics
title:
owner: huifer
client:
version: 0.1
status: DRAFT
```

# 2. 一句话定义

```text
[客户] 希望通过 [数据源] 得出 [业务指标]，按 [节奏] 输出 [报表/告警/预测]。
```

# 3. 数据源

| 来源 | 类型 | 频率 | 接入方式 |
|---|---|---|---|
| 业务库 | MySQL | 1h | ETL |
| 行为日志 | ClickHouse | 实时 | Kafka |
| 外部 API | REST | 1d | 拉取 |

# 4. 指标体系

| 指标 | 定义 | 维度 | 刷新 |
|---|---|---|---|
| DAU | 日活用户 | 国家 / 渠道 | 1h |
| ARPU | 人均收入 | 套餐 / 国家 | 1d |
| 转化率 | 转化 / 访问 | 渠道 | 实时 |

# 5. 报表

| ID | 报表 | 受众 | 形式 |
|---|---|---|---|
| R-01 | 每日经营 | 管理层 | 邮件 / 看板 |
| R-02 | 实时大屏 | 运营 | Web |
| R-03 | 异常告警 | 值班 | IM / 短信 |

# 6. 数据治理

- 数据血缘：Lineage
- 元数据：Glossary
- 访问控制：RBAC
- 数据脱敏：PII 自动 mask
- 备份与恢复

# 7. 技术栈

- OLAP：ClickHouse / DuckDB
- ETL：Airbyte / dbt
- 看板：Metabase / 自研
- 告警：Grafana / Alertmanager

# 8. 风险

| ID | 风险 | 缓解 |
|---|---|---|
| R-01 | 数据质量 | Schema check + 异常告警 |
| R-02 | 合规 | 脱敏 + 访问审计 |
| R-03 | 性能 | 物化视图 + 采样 |

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

- 全部指标对账；
- 报表可导出；
- 异常告警在 1 分钟内送达。

# 11. 上线计划

| 阶段 | 范围 | 周 |
|---|---|---|
| 接入 | 数据源 + 指标 | 2-3 |
| 看板 | R-01 / R-02 | 3-4 |
| 告警 | R-03 | 4-5 |
