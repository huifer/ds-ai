---
name: knowledge-redact
agent: cs
description: 客户案例脱敏 → 可回用知识
---

# Knowledge Redact（案例脱敏与知识化）

触发：`!cs document <account 或 PRJ-ID>`

## 流程（CONTEXT.md「知识回流」）
1. 读该客户的项目交付产物（PRD / delivery / incident / 成果数据）。
2. **脱敏**：去除客户全名 / 联系人 / 账号 / 密钥 / 真实业务数据；替换为化名与占位。
3. **结构化**为可复用知识：
   - 行业场景与方法论
   - 技术方案与踩坑
   - 量化成果（脱敏后）
   - 可复用组件 / 模板引用
4. 标注**证据等级**与是否可公开。

## 落盘
- 客户侧：`data/business/accounts/<account-id>/cs/case-redacted.md`
- 可回用知识：`agent-core/enterprise/knowledge/<slug>.md`（脱敏后，供交付/培训/产品/内容复用）

## 约束（CONTEXT.md）
- 必须**脱敏 + 验证 + 结构化**后才可回用。
- 未脱敏的客户内容**禁止**直接用于公开内容。
- 客户全名 / 敏感数据只存 account 下。
