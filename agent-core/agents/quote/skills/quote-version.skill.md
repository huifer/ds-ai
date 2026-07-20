---
name: quote-version
agent: quote
description: 报价版本管理（无独立命令，内部查询）
---

# Quote Version（报价版本）

> 内部 skill，无独立命令。供 quote 流程 / 人类查询报价版本历史。

## 调用契约
入参：`{ prjId }` 或 `{ accountId }`

## 流程
1. 扫描 `data/business/accounts/<account>/quote/QUOTE-<PRJ>-v*.md`。
2. 解析每版：报价、毛利率、折扣、变更理由、时间。
3. 输出版本时间线。

## 返回
```
QUOTE-<PRJ> 版本历史
v1 基准 300000 毛利40%
v2 -10% 270000 毛利33% (早鸟)
```
## 约束
版本文件只存 account 下，敏感金额不进 index.yaml。
