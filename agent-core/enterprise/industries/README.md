# Industries

每个行业一个目录：

```text
agent-core/enterprise/industries/
├── ai-agent/
│   ├── prd.md               # 行业 PRD 引用 (templates/prd/ai-agent.md)
│   ├── demo-case.md         # 典型场景与组件
│   ├── api-routes.md        # 接口契约
│   └── design-hints.md      # 视觉与组件偏好
├── saas/
├── data-analytics/
├── cross-border-ecommerce/
├── internal-tools/
└── generic/
```

新增行业只需新增一个子目录。

---

# 1. ai-agent

- 业务：把 LLM 接入企业流程（客服、Copilot、自动化）；
- 关键组件：Scenario / Chat / ToolCall / Approval；
- 路由：`/` `/scenario` `/settings`；
- 视觉：minimal / Inter；
- 详情：见子目录文件。

# 2. saas

- 业务：标准 SaaS 站点；
- 关键组件：Pricing / Signup / Dashboard；
- 路由：`/` `/pricing` `/settings`；
- 视觉：minimal / Inter。

# 3. data-analytics

- 业务：报表、看板、告警；
- 关键组件：BarChart / LineChart / KPI；
- 路由：`/` `/chart` `/settings`；
- 视觉：data-dense / Inter。

# 4. cross-border-ecommerce

- 业务：跨境订单、库存、物流；
- 关键组件：Orders / Shipments / Inventory；
- 路由：`/` `/orders` `/shipments` `/settings`；
- 视觉：data-dense / Inter。

# 5. internal-tools

- 业务：内部审批、运维、客户支持；
- 关键组件：Tasks / Approvals / Audit；
- 路由：`/` `/tasks` `/approvals` `/settings`；
- 视觉：story / Lora。

# 6. generic

兜底；不允许长期驻留，新行业必须有自己的子目录。
