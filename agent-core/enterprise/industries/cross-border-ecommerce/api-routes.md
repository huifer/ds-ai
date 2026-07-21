# API Routes · cross-border-ecommerce

## 1. GET /api/orders

```json
{ "orders": [
  { "id": "O-1001", "status": "shipped", "country": "US", "amount": 99.0 }
]}
```

## 2. GET /api/shipments?orderId=O-1001

```json
{ "shipments": [
  { "id": "S-1", "carrier": "DHL", "eta": "2026-07-22" }
]}
```
