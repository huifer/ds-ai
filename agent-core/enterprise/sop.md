# 企业咨询与 FDE 业务 SOP

> 与内容 SOP 并行运行。文件 `agent-core/content/sop.md` 写内容主链；本文件写企业服务主链。两者在 Discord 共享 `#主快讯` / `#main-feed` 的数据回流。

---

# 1. 业务范围

```
销售线索（Sales）
  → 需求发现（Discovery）
  → 解决方案（Solution）
  → 估算与报价（Quote）
  → 提案与商务谈判（Proposal & Negotiation）
  → 招投标（Bid）          [可选]
  → 合同（Contract Ops）
  → 项目启动（Kickoff）
  → 交付（Delivery：FDE / Engineer / QA）
  → 验收与交接（Acceptance & Handover）
  → 开票与回款（Finance Ops）
  → 客户成功（Customer Success）
  → 续费与增购（Renewal & Expansion）
  → 知识回流（Knowledge Loop）
```

对应 Category `10 企业服务`：

```
#销售线索
#商机与方案
#报价
#标书
#合同运营
#项目管理
#fde-客户交付
#测试与验收
#客户成功
#开票与回款
```

---

# 2. 业务对象与编号

| 类型 | 编号示例 |
|---|---|
| Lead | `LEAD-2026-0001` |
| Account | `ACC-2026-0001` |
| Opportunity | `OPP-2026-0001` |
| Discovery | `DISC-2026-0001` |
| Solution | `SOL-2026-0001` |
| Quote | `QTE-2026-0001` |
| Bid | `BID-2026-0001` |
| Contract | `CTR-2026-0001` |
| Project | `PRJ-2026-0001` |
| Acceptance | `ACC-2026-0001-A` |
| Invoice | `INV-2026-0001` |
| Renewal | `RNW-2026-0001` |

所有编号写入 `data/business/registry.json` 并同步到 Discord `#客户资料` 与 `Channel` 主题。

---

# 3. Agent 与频道映射

| Agent | 主要频道 | 关键产物 |
|---|---|---|
| `sales-agent` | `#销售线索` `#商机与方案` | Lead Record、Qualification、Meeting Brief、Follow-up |
| `solution-agent` | `#商机与方案` | Discovery、Scope、Solution、Assumption、Risk |
| `cost-agent` | `#报价` | Estimate Sheet、Quote Draft、Discount |
| `quote-agent` | `#报价` | Final Quote、Version、Approval Card |
| `bid-agent` | `#标书` | Tender Summary、Compliance Matrix、Bid Package |
| `contract-agent` | `#合同运营` | Contract Summary、Risk Register、Obligation Matrix |
| `pm-agent` | `#项目管理` | Charter、Plan、RAID、Weekly Report、Decision Log |
| `delivery-agent` | `#fde-客户交付` | POC、Integration Plan、Migration Plan、Runbook、Incident Report |
| `qa-agent` | `#测试与验收` | Test Plan、Acceptance Evidence、Defect List、Release Checklist |
| `cs-agent` | `#客户成功` | Health Report、QBR、Renewal Brief、Case Study |
| `finance-agent` | `#开票与回款` | Invoice Request、AR Report、Payment Reminder |
| `chief-agent` | `#总控台` `#审批中心` | Strategy、Cross-project Coordination、Approvals |

子 Agent 互不通讯，统一以 `editor_card` 推 `#审批中心` 或对应业务频道。

---

# 4. 跨业务状态机

```text
LEAD
  → QUALIFIED              sales-agent
  → DISCOVERY_RUNNING      solution-agent
  → SOLUTION_READY         solution-agent
  → QUOTE_DRAFTING          quote-agent
  → QUOTE_REVIEWING         chief-agent
  → QUOTE_APPROVED          chief-agent  (审批中心)
  → QUOTE_SENT              sales-agent
  → NEGOTIATING             sales-agent
  → BID_RUNNING             bid-agent (可选)
  → CONTRACT_DRAFTING       contract-agent
  → CONTRACT_REVIEWING      chief-agent  (审批中心)
  → CONTRACT_SIGNED         contract-agent
  → PROJECT_INITIATING      pm-agent
  → DELIVERING              delivery-agent + pm-agent
  → ACCEPTING               qa-agent
  → ACCEPTED                qa-agent
  → INVOICING               finance-agent
  → PAYMENT_RECEIVED        finance-agent
  → ACTIVE                  cs-agent
  → RENEWAL                 cs-agent
  → CLOSED                  cs-agent
  → KNOWLEDGE_LOOP          chief-agent + distill-agent
```

`#审批中心` 在以下节点硬性要求人工批准：

- QUOTE_APPROVED
- CONTRACT_SIGNED（重大合同需法务外部复审）
- BID_SUBMIT
- ACCEPTANCE_PASSED
- PAYMENT_OVERDUE_30D

---

# 5. 输入 / 输出最小集合

## 5.1 Lead Record

```yaml
id: LEAD-2026-0001
source: 微信 / 飞书 / 推荐人 / 公开渠道
contact:
  name: 张三
  role: CTO
  company: ACME
  email: zhangsan@acme.com
  phone: 已脱敏
  wechat: 已脱敏
problem_brief: |
  客户想在飞书做内部 AI 知识库 Agent。
qualification:
  budget: 30-80 万
  decision_window: 3 个月
  authority: 高
  need: 高
next_action: solution-agent 启动 Discovery
created_at: 2026-07-19T10:00:00Z
created_by: sales-agent
```

## 5.2 Discovery

```yaml
id: DISC-2026-0001
opportunity: OPP-2026-0001
participants:
  client: [张总, 李经理]
  ours: [solution-agent, fde-agent]
goals: 3 项
non_goals: 2 项
constraints: [预算, 集成, 数据合规]
success_metrics:
  - 人工答疑减少 60%
  - 飞书活跃度提升 30%
scope_in: 飞书 AI 知识库 + 飞书 API + RAG
scope_out: 钉钉、企微
risks: [内部知识泄露, 飞书 API 限额]
decisions: [使用 GLM 4.5, 单租户部署]
```

## 5.3 Quote Draft

```yaml
id: QTE-2026-0001
items:
  - name: 飞书 AI 知识库 POC
    unit: 人日
    qty: 8
    unit_price: 4500
    cost: 36000
  - name: RAG 集成与优化
    qty: 5
    unit_price: 5000
    cost: 25000
subtotal: 61000
tax: 含 6% 增值税
discount: 0
total: 61000
currency: CNY
payment_terms: 50% 启动 / 40% 验收 / 10% 上线 30 日
validity: 14 日
approval: PENDING
discount_rationale: ""
```

## 5.4 Contract Risk Register

```yaml
id: CTR-2026-0001
risks:
  - id: R-01
    type: 知识产权
    severity: 中
    mitigation: 客户授权使用 Open Source
  - id: R-02
    type: 数据安全
    severity: 高
    mitigation: 单租户部署 + 飞书安全策略
  - id: R-03
    type: SLA
    severity: 中
    mitigation: 7x24 一线 + 24h 响应
approval: PENDING
```

---

# 6. 与 Discord 的具体契约

```text
#销售线索      !lead new ...  | !lead list | !lead qualify
#商机与方案    !disc start ...| !disc set goals ... | !disc set scope ...
#报价          !quote draft ...| !quote set discount ...| !quote approve
#标书          !bid start <tender_url> | !bid compliance | !bid submit
#合同运营      !contract new <quote_id> | !contract risk | !contract sign
#项目管理      !pm plan <project_id> | !pm weekly | !pm risk
#fde-客户交付  !poc start ... | !poc deploy ... | !incident ...
#测试与验收    !qa plan ... | !qa accept ... | !qa defect ...
#客户成功      !cs health <account_id> | !cs qbr ...
#开票与回款    !invoice request <contract_id> | !invoice remind

#总控台        !state | !restart <agent> | !cost
#审批中心      !approve <object_id> | !reject | !defer
#agent-状态    !status <agent>
```

按钮组（业务频道通用）：

```text
[Approve]  [Edit]  [Defer]  [Reject]
[Open Card] [Push to Next Stage] [Send to Customer]
```

---

# 7. 客户数据隔离与权限

- 每个 `Account` 拥有独立目录：`data/business/accounts/<account-id>/`；
- 客户私有资料只能由 `client-data` 内存作用域的 Agent 读取；
- 客户名称在跨客户会话中替换为 `Client A/B/...`；
- 客户文件原文件不入公开内容；
- 任何出客户项目都需要在 `#审批中心` 审批。

---

# 8. 与现有系统的连接

| 已有 | 改造方式 |
|---|---|
| `src/entry-bot.mjs` | 抽出 AgentManager 负责按 Agent 路由；FDE Agent 与内容 Agent 共用 Session 池 |
| `src/scheduler.mjs` | 新增 `intake-business-agent` 9:00 / 16:00 拉取当日销售与项目状态 |
| `src/memory-*.mjs` | 新增 `memory-business` 域，与 `memory-content` 严格隔离 |
| `src/jobs/*.mjs` | 业务相关任务改名 `biz-*` 并迁移到 `src/jobs/biz/` |
| `extensions/discord-tools.mjs` | 新增 `discord_send_business_card` 工具 |

---

# 9. 知识回流

每次项目交付后：

- `delivery-agent` 提交交付物清单到 `#测试与验收`；
- `cs-agent` 在 `#客户成功` 发起知识脱敏请求；
- `distill-agent` 把脱敏后的经验推到 `#主快讯`，判断是否能转公开内容；
- `distill-agent` 决定入选“企业实践”知识库或公开内容池。

知识回流 = 客户内容 → 脱敏 → 内部资产 → 公开内容（可选）。
```

---

# 10. 第一阶段 Agent 集合

```text
sales-agent
solution-agent
cost-agent
quote-agent
bid-agent
contract-agent
pm-agent
delivery-agent
qa-agent
cs-agent
finance-agent
```

不引入新 Agent 框架，全部基于已有 `agent-core/agents/<name>/` 模板。Skill 列表在 `agent-core/skills/` 中维护。

---

# 11. 下一项需要你确认的两件事

1. 业务 Agent 是否需要进一步合并，例如 `solution-agent + cost-agent + quote-agent` 合并为 `pre-sales-agent`？
2. 客户对外合同是否需要分类型（标准 SaaS、定制开发、年度顾问、培训）以分别设置不同的审批阈值？
