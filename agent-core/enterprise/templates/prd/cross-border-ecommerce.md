# PRD 模板 · 跨境电商

> 行业类型：`cross-border-ecommerce`  
> 路径：`agent-core/enterprise/templates/prd/cross-border-ecommerce.md`  
> 由 `solution-agent` 加载；`research-agent` + `knowledge-agent` 运行时填充 `## Runtime Research`。

---

# 1. 文档头

```yaml
project: PRJ-2026-0001
industry: cross-border-ecommerce
title:
owner: huifer
client:
version: 0.1
status: DRAFT
```

# 2. 一句话定义

```text
[客户] 想在 [目标市场] 销售 [品类]，通过 [渠道] 触达 [人群]，使用 [支付 / 物流] 完成闭环。
```

# 3. 市场

- 目标市场：北美 / 欧洲 / 东南亚 / 中东
- 主营品类：
- 目标人群：
- 主要竞品：

# 4. 渠道

| 渠道 | 类型 | 上线优先级 |
|---|---|---|
| 自建站 | Shopify / 自研 | 高 |
| Amazon | 第三方平台 | 高 |
| TikTok Shop | 短视频电商 | 中 |
| 独立 KOL | 合作 | 中 |
| 邮件 | 复购 | 低 |

# 5. 履约

| 段 | 责任 | 系统 |
|---|---|---|
| 仓 | 海外仓 / 三方 | ShipBob / 谷仓 |
| 物流 | 头程 / 尾程 | DHL / FedEx |
| 退货 | 退仓 / 退款 | 渠道后台 |

# 6. 支付

- 收单：Stripe / Airwallex / 连连
- 币种：USD / EUR / GBP / JPY
- 退款：原路退回

# 7. 合规

- VAT / 销售税
- 产品合规（FDA / CE / FCC）
- 进口合规
- 平台政策

# 8. 风险

| ID | 风险 | 缓解 |
|---|---|---|
| R-01 | 库存积压 | 预售 / 限单 |
| R-02 | 物流延误 | 多渠道 + 备货 |
| R-03 | 平台封号 | 多账号 + 合规 |
| R-04 | 汇率波动 | 实时结算 |

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

- 订单从下单到妥投可追踪；
- 退款 SLA；
- 月度经营复盘。

# 11. 上线计划

| 阶段 | 范围 | 周 |
|---|---|---|
| 选品 | 类目 + 渠道 | 2-3 |
| 上线 | 独立站 + Amazon | 3-6 |
| 扩量 | 多渠道 | 6-10 |
