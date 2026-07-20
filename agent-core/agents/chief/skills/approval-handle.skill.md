---
name: approval-handle
agent: chief
description: |
  Auto-generated skill for chief agent.
  战略协调、审批仲裁、跨 Agent 冲突处理。
---

# Approval Handle（审批处理）

触发: `!approve <id>` / `!reject <id>` / `!defer <id>` / 按钮回调

## 1. 校验权限
检查 userId 是否在 ALLOWED_USER_IDS 白名单,或拥有对应 approval 的决策权。

## 2. 读取审批项
从 data/approval/<id>.json 读取待审批项,包含:
- producer (哪个 agent 提交)
- objectId (关联的对象,如 rnd=xxx, prj=yyy)
- summary (一句话描述)
- evidence (证据数组)

## 3. 执行决策
根据命令执行:
- approve: 写入 status=approved + decidedAt,调用 producer agent 继续执行
- reject: 写入 status=rejected + reason,通知 producer 取消
- defer: 写入 status=deferred,设置 remindAt(默认 24h 后)

## 4. 落盘
更新 data/approval/<id>.json,在 approval-center 频道发通知卡片。

## 5. 回复用户
`✅ 已批准 #<id> → <producer> 继续执行` 或 `❌ 已拒绝 #<id> → <reason>`
