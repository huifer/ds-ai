---
name: secret-detect
agent: privacy
description: |
  Auto-generated skill for privacy agent.
  脱敏 / Secret 检测 / 客户名替换。
---

# Secret Detect（密钥检测）

## 1. 检测模式
- AWS: AKIA[0-9A-Z]{16}
- GitHub: ghp_[a-zA-Z0-9]{36}
- OpenAI: sk-[a-zA-Z0-9]{48}
- Stripe: sk_live_[a-zA-Z0-9]{24}
- 通用: 高熵字符串

## 2. 输出
- 严重度: critical / warning / info
- 位置(行号 + 上下文 50 字)
- 建议处理

## 3. 紧急处理
critical 级别:
- 立刻删除内容
- 通知用户
- 写入 audit log
