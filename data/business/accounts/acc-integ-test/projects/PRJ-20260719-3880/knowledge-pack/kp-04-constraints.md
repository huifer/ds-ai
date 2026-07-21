# kp-04-constraints · integ-test

> 每个项目产出 6 个高密度合集文件，编号 `kp-01` 到 `kp-06`。  
> 路径：`data/business/accounts/<account-id>/projects/<PRJ-ID>/knowledge-pack/kp-XX-name.md`。

## 文件头

```yaml
project: PRJ-2026-0001
file: kp-01-domain.md
title: 行业 / 业务域
author: solution-agent
reviewer: chief-agent
last_updated: 2026-07-19
status: DRAFT | IN_REVIEW | APPROVED
```

## 标准结构

```text
# 1. 行业与市场
# 2. 业务模型
# 3. 监管与合规
# 4. 关键术语表
# 5. 主要竞品
# 6. 数据来源与置信度
# 7. 仍未解决
```

每节需要：

- 至少 1 个一手来源（官方文档、客户对话、合同附件）；
- 标注文档链接或对话时间戳；
- 区分“事实 / 推断 / 假设”。

## 完整度规则

- 全文 800 - 3000 字；
- 不少于 1 张表、1 张列表；
- 关键术语给出中文与英文；
- 未通过完整性检查的合集不能进入 PRD 草稿。
