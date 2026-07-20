---
name: contract-summarize
agent: contract
description: 合同条款解析与摘要
---

# Contract Summarize（合同摘要）

触发：`!contract new <合同文件路径或粘贴文本>`

## 流程
解析合同，抽取结构化条款：
- **当事方** / 标的 / 合同金额 / 币种
- **期限**（生效 / 终止 / 里程碑）
- **付款条件**（比例 / 节点 / 账期）
- **交付与验收**（标准 / 周期 / 违约金）
- **知识产权**（归属 / 许可 / 背景 IP）
- **保密 / 竞业 / 数据**
- **终止条款**（单方 / 违约 / 赔偿上限）
- **争议解决**（管辖 / 仲裁）

标注**异常/对我不利**条款。

## 落盘（敏感，只写 account 下）
`data/business/accounts/<account-id>/contract/summary.md`

## 回复
合同摘要 + ⚠️ 风险条款；提示 `!contract risk` 登记风险、`!contract sign` 走审批签署。
## 约束
合同全文、金额、客户信息只存 account 下，严禁进 index.yaml。
