---
name: project-bootstrap
agent: pm
description: 创建项目（PRJ-ID + 目录骨架 + 项目索引）
---

# Project Bootstrap（项目立项）

> ⚙️ 本 skill 由**本地实现**提供：`src/runtime/commands/project-bootstrap.mjs`（`projectBootstrap()`）。
> 运行时直接命中本地代码，**不读本文件**；本文件仅作人类参考文档。

触发：`!pr new <alias> <industry> <一句话需求>`

## 行业白名单
`ai-agent` / `saas` / `data-analytics` / `cross-border-ecommerce` / `internal-tools` / `generic`
（不在列表则报错 `不支持的行业`）

## 真实行为（已 dryRun 验证）
1. 生成 `PRJ-YYYYMMDD-XXXX`（4 位随机）。
2. 写入 `data/business/projects/index.yaml`（unshift 到顶部）：字段 `id / alias / industry / line:FDE / stage:setup / repo / channel{pm,demo} / created_at / owner:huifer`。
3. 创建 `data/business/accounts/acc-<alias>/projects/<PRJ-ID>/` 目录骨架：`brief` `knowledge-pack` `prd` `demo` `research/alg-XX-name` `build`。
4. 复制 knowledge-pack 模板（`agent-core/enterprise/templates/knowledge-pack.md` → 6 个 `kp-0X`）。
5. 复制行业 PRD（`agent-core/enterprise/templates/prd/<industry>.md` → `prd/prd-v0.1.md`；缺失回退 `internal-tools.md`）。
6. 返回 Discord Kanban 卡片 payload。

## 约束（CONTEXT.md）
- index.yaml **只存元数据**，不存客户全名 / 合同 / 报价 / 联系人 / 凭据。
- 客户全名等敏感信息只写 `accounts/<account-id>/` 下。
