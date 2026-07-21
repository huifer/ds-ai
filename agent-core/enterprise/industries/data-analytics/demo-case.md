# Demo Case · data-analytics

## 1. 典型场景

- 经营日报；
- 实时大屏；
- 异常告警（mock）；
- 维度筛选与钻取。

## 2. 关键组件

- `StatCard`（多指标）
- `BarChart`（指标对比）
- `Filter`（FormField）
- `Table`（明细）
- `Toast`（导出成功）

## 3. 路由

```text
/             Dashboard
/chart        Chart
/settings     Settings
```

## 4. 数据契约

- KPIs 来自 `src/data/fixtures/kpis.ts`
- 时间序列数据来自 `src/data/fixtures/series.ts`

## 5. 视觉

- 风格：data-dense
- 主色：brand-primary
- 副色：brand-accent
- 字体：Inter
