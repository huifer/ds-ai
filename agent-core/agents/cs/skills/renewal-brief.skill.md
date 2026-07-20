---
name: renewal-brief
agent: cs
description: 续费简报（无独立命令，QBR/health 内部调用）
---

# Renewal Brief（续费简报）

> 内部 skill，无独立命令。由 QBR / health 评估续费时调用。

## 调用契约
入参：`{ accountId }`

## 流程
1. 读合同（`accounts/<account>/contract/`）取到期日、金额、条款。
2. 读用量 / 价值实现 / 健康度。
3. 输出：
   - 到期日与剩余周期
   - 续费基线（原金额 / 折扣历史）
   - **续费策略**（平稳续 / 涨价 / 降配）
   - **增购机会**（新模块 / 扩容 / 新业务线）
   - **流失风险**与挽留动作

## 返回
续费简报，供 QBR 与销售 follow-up 使用。
