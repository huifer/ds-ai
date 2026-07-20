---
name: margin-report
agent: finance
description: 毛利报告（无独立命令，内部财务分析）
---

# Margin Report（毛利报告）

> 内部 skill，无独立命令。供管理层 / QBR 查看项目毛利。

## 调用契约
入参：`{ prjId 或 accountId, range }`

## 流程
1. 读 quote（报价）+ cost（成本估算）+ invoice（已开票）+ 实际交付工时。
2. 计算：
   - 合同金额 / 已开票 / 已回款
   - 实际成本（人天 × 单价 + 外采 + overhead）
   - **毛利率**（实际 vs 估算对比）
   - 偏差分析（超支原因）
3. 多项目聚合趋势。

## 返回
毛利摘要 + 偏差预警；供 finance 决策与 cs 续费定价参考。
## 约束
金额数据敏感，仅内部；只存 account / 内部财务目录。
