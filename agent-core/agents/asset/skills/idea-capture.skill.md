---
name: idea-capture
agent: asset
description: |
  Synthetic agent skill for asset: idea-capture.
  Auto-generated.
---

# Idea Capture（灵感捕捉）

## 1. 触发
- 用户明确说 "记录这个想法"
- 检测到高价值洞察(对话中)
- 遐思产物中的可执行项

## 2. 结构化
```
# 灵感: <标题>

## 灵感来源
- 触发: <对话/遐思/手动>
- 时间: <ISO>

## 描述
...

## 关联
- [相关记忆 1]
- [相关记忆 2]

## 下一步
- [ ] ...
```

## 3. 落盘
data/ideas/<date>-<slug>.md

## 4. 同步
写入 asset-manager / agent-internal scope。
