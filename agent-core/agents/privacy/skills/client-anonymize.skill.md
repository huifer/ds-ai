---
name: client-anonymize
agent: privacy
description: |
  Auto-generated skill for privacy agent.
  脱敏 / Secret 检测 / 客户名替换。
---

# Client Anonymize（客户匿名化）

## 1. 客户识别
- 从 memory-scope 'company' 读取已知客户列表
- 匹配: 全名 / 简称 / 拼音 / 缩写

## 2. 替换
- ABC 公司 → [CLIENT-A](大型企业, 金融行业)
- 张总 → [DECISION-MAKER](技术负责人)

## 3. 保留维度
- 行业(不变)
- 公司规模(用 tier 替换)
- 角色(用 role 替换)

## 4. 输出
data/business/contents/<id>-anon.md
