# Demo Case · ai-agent

> 与 `agent-core/enterprise/industries/ai-agent/` 配合使用。
> `coding-agent` 接到 `!demo new` 时会读取本文。

## 1. 典型场景

- **order-status**：客户询问订单状态，Agent 调 `order-api` 查物流。
- **return-policy**：客户询问退换政策，Agent 调 `faq`。
- **transfer**：客户要求人工，Agent 转人工并通知值班。

## 2. 关键组件

- `Hero`（展示产品价值）
- `StatCard`（机器人解决率 / 延迟 / 客户满意度）
- `FormField`（输入客户 ID 或问题）
- `Button`（提交 / 触发）
- `BarChart`（机器人 vs 人工占比）

## 3. 路由

```text
/             Dashboard
/scenario     Scenarios
/settings     Settings
```

## 4. 数据契约

- 行业 PRD：`agent-core/enterprise/templates/prd/ai-agent.md`
- API 路由：`agent-core/enterprise/industries/ai-agent/api-routes.md`

## 5. 视觉

- 风格：minimal
- 主色：brand-primary
- 副色：brand-accent
- 字体：Inter

## 6. 失败回退

- 客户没有基础文件 → 提示运行 `solution-agent` Stage 1；
- 风格冲突 → 以 `zenbuild-design-tokens` 为准。
