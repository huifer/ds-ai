---
name: react-design
description: |
  Choose the visual style, route structure, and components for a FDE Demo.
  Always pairs with `zenbuild-design-tokens` and `component-library`.
---

# 1. 决策点

- 行业：ai-agent / saas / data-analytics / cross-border-ecommerce / internal-tools / generic
- 客户使用设备：PC / Mobile / Both
- 视觉风格：minimal / data-dense / story / marketing
- 路由层级：1 层 / 2 层 / 3 层

# 2. 风格速查

| 风格 | 主色 | 副色 | 字体 | 适合 |
|---|---|---|---|---|
| minimal | primary | accent | Inter | AI Agent / SaaS 演示 |
| data-dense | primary | highlight | Inter | 数据分析 / 跨境电商 |
| story | primary | highlight | Lora | 内部工具 / 复杂流程 |
| marketing | accent | highlight | Inter | 新产品上线 / 增长 |

# 3. 路由

| 行业 | 推荐路由 |
|---|---|
| AI Agent | Dashboard / Scenario / Settings |
| SaaS | Dashboard / Pricing / Settings |
| Data Analytics | Dashboard / Chart / Settings |
| Cross-border E-commerce | Dashboard / Orders / Shipments / Settings |
| Internal Tools | Dashboard / Tasks / Approvals / Settings |

# 4. 关键页

- Hero：标题 + 副标题 + CTA
- StatCard：3-4 个核心指标
- 图表：BarChart / LineChart
- 边界：Boundaries 列表
- 联系方式：Contact

# 5. 错误处理

- 缺 `demo-case.md` → 退回 `industries/generic`；
- 风格不匹配 → 强制 minimal，避免喧宾夺主。
