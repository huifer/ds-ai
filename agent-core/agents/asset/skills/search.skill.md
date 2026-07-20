---
name: search
agent: asset
description: |
  Synthetic agent skill for asset: search.
  Auto-generated.
---

# Search（语义检索）

## 1. 输入
用户查询 + scope 范围

## 2. 检索
- 关键词匹配
- 向量相似度(tavily / embedder)
- 跨 scope 联合

## 3. 排序
按相关性 + 时间新鲜度 + 来源权威度

## 4. 输出
```
## 找到 N 条相关记忆

### 1. <标题>(<scope>, <date>)
摘要: ...
链接: memory://xxx

### 2. ...
```
