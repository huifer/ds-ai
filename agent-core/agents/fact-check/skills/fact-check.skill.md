---
name: fact-check
agent: fact-check
description: |
  Auto-generated skill for fact-check agent.
  事实校验、证据绑定、引用规范。
---

# Fact Check（事实核查）

触发: `!fact check <cnt-id>` 或 distill 自动

## 1. 提取主张
从内容中提取所有 factual claim:
- 数字 / 百分比
- 日期 / 时间
- 引述
- 引用

## 2. 验证
对每个 claim:
- 内部数据: 检查 memory-store
- 外部数据: 用 tavily / google search 检索
- 引述: 检查原文出处

## 3. 评级
- verified: 有可靠来源
- unverified: 找不到来源
- disputed: 来源相互矛盾

## 4. 输出
data/business/fact-check/<cnt-id>.json:
```json
{
  "claims": [
    {"text": "X 公司增长 50%", "status": "verified", "source": "xxx"},
    {"text": "Y 功能上线", "status": "unverified", "note": "找不到公开来源"}
  ]
}
```
