# API Routes · internal-tools

## 1. GET /api/tasks

```json
{ "tasks": [
  { "id": "T-1", "title": "Approve invoice", "status": "pending" }
]}
```

## 2. POST /api/approvals

```json
{ "ok": true, "taskId": "T-1", "decision": "approved" }
```
