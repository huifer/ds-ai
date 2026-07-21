# API Routes · ai-agent

> Demo 阶段使用 MSW + fixtures，不接真后端。
> 正式研发接入时按此契约。

## 1. GET /api/scenarios

- 用途：列出 Agent 演示场景；
- 入参：无；
- 出参：

```json
{
  "scenarios": [
    { "id": "order-status", "title": "Order status", "hint": "Customer asks where is my order." },
    { "id": "return-policy", "title": "Return policy", "hint": "Customer asks can I return this." },
    { "id": "transfer", "title": "Transfer to human", "hint": "Customer requests a real person." }
  ]
}
```

## 2. GET /api/chart

- 用途：KPI 数据；
- 出参：

```json
{
  "bars": [
    { "label": "Auto-reply rate", "value": 50, "note": "target" },
    { "label": "P95 latency", "value": 3, "note": "seconds" },
    { "label": "CSAT", "value": 4.5, "note": "out of 5" }
  ]
}
```

## 3. POST /api/save（Mock）

- 用途：保存设置；
- 出参：`{ ok: true }`。

## 4. 错误

- 4xx 走 `HttpResponse.json({ error: '...' }, { status: 400 })`；
- 5xx 走 `HttpResponse.json({ error: '...' }, { status: 500 })`。
