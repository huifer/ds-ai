# API Routes · data-analytics

## 1. GET /api/kpis

```json
{ "kpis": [
  { "label": "DAU", "value": 12345 },
  { "label": "ARPU", "value": 12.3 }
]}
```

## 2. GET /api/series?metric=DAU

```json
{ "series": [
  { "date": "2026-07-19", "value": 12300 },
  { "date": "2026-07-18", "value": 11800 }
]}
```
