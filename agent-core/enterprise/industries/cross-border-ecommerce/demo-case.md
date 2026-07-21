# Demo Case · cross-border-ecommerce

## 1. 典型场景

- 订单列表；
- 物流追踪；
- 库存概览；
- 退款 / 退仓。

## 2. 关键组件

- `Table`（订单 / 物流）；
- `Filter`（FormField）；
- `Badge`（状态色）；
- `Modal`（详情）。

## 3. 路由

```text
/             Dashboard
/orders       Orders
/shipments    Shipments
/settings     Settings
```

## 4. 数据契约

- 订单来自 `src/data/fixtures/orders.ts`；
- 物流来自 `src/data/fixtures/shipments.ts`。

## 5. 视觉

- 风格：data-dense；
- 主色：brand-primary；
- 副色：brand-accent；
- 字体：Inter。
