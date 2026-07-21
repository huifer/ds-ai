# 一人公司 Agent Workforce 与企业运营系统总体蓝图

> 文档状态：总体设计稿 v1.1  
> 适用项目：`pi-discord-agents`  
> 核心目标：把当前 Discord ↔ Pi 系统升级为一套可长期积累、可独立运行、可执行 Skills、支持企业服务与自媒体运营的多 Agent 工作系统。

---

## 已确认的业务基线

| 事项 | 已确认决定 |
|---|---|
| FDE 定义 | 采用 Forward Deployed Engineer 模式，服务可以覆盖需求发现、AI 开发、SaaS 工具开发、集成、实施与交付。 |
| 当前阶段 | 尚未形成稳定主营业务和持续客户管道，但已积累 SEO、SaaS 外链和 Marketing 案例及可交易外链库存；系统需要先把已有证明材料和库存资产化。 |
| 可经营方向 | 可以提供企业 AI 开发服务，可以为客户开发 SaaS 工具，也可以经营自主开发的 SaaS 产品。 |
| 国内个人 IP | 统一使用“杭州 OPC 张三”，其他写法不再使用。 |
| 海外 IP | 与国内 IP 完全分开，采用新的纯英文独立开发者身份，不发布中文内容、不使用 Reddit；创作者品牌已定为 `Zenbuild`（也接受 `ZENBUILD` 写法），个人名仍为 GitHub 展示名 `Zen Huifer`。海外平台采全市场扩展原则。早期不建设独立个人网站；若建站仅接受可运行 SaaS 产品站点形式，不接受纯信息站；任何付费投放都被拒绝。所有公开内容以 HTML 设计成品，附头图、品牌色、版式、组件、版权。 |
| 企业 POC 入口 | 优先建设以 Agent 为核心、飞书为主要操作方式的企业 POC，企业微信作为备选接入。具体产品名称仍需确认。 |
| FDE 知识沉淀 | FDE 不只发现和交付开发项目，还要把需求、实施、培训和上线经验转化为可复用知识及经脱敏的内容资产。 |
| SEO 与外链基础 | 已有 SEO、SaaS 外链和 Marketing 案例；内部已维护可用于交易的外链表，后续需要导入、核验、分级和运营。 |
| 品牌总称 | 海外统一品牌 `Zenbuild`（也接受 `ZENBUILD` 写法），个人名仍为 `Zen Huifer`。所有海外公开资产、渠道、Newsletter、Repository、Handle 使用 `Zenbuild`。 |
| 视觉与内容质量 | 任何公开内容都以 HTML 设计成品，含头图、品牌色、版式、组件、版权；不允许“干巴巴”输出。 |
| Discord Group 设计 | `总编` 升级为顶级 Category，与 `总控` 平级。`国内总编` 与 `海外总编（Zenbuild）` 为两个独立 Category，下设 “主快讯 / main-feed” 与各平台 `preview-*` / `publish-*`。 |
| 创始人事实库 | 已在项目内建立 `profile/`，归档五本清华大学出版社图书、GitHub `huifer`、OPENIOTGO、Rust IoT、杭州 OPC 媒体、WellAlly 和 TanStack Ship 资料。 |
| 每日内容锚点 | 当天真实工作及与 AI 的对话必须经过隐私过滤、事实核验和内容蒸馏，成为第二天自媒体内容的主要来源；禁止直接发布原始聊天记录。 |

## 公开背书的初步核验

截至本版文档，已经找到以下公开来源：

| 公开来源 | 可支持的陈述 | 当前证据等级 |
|---|---|---|
| [杭州网：职高毕业的小伙在杭州上城开“一人公司”火到了海外，5个月用AI做了120多个App](https://hznews.hangzhou.com.cn/jingji/content/2026-02/13/content_9177823_0.htm) | 报道使用“张三”称谓，描述其 1997 年出生、杭州经历、AI 应用流水线、5 个月上线 120 多个 App、90% 有付费用户且主要面向海外，并提到“康心伴”。 | B：官方城市媒体报道，具体经营数据仍应补充第一方证明 |
| [杭州政协网转载：职高毕业的小伙在杭州上城开“一人公司”火到了海外](https://www.hzzx.gov.cn/cshz/content/2026-02/13/content_9178071.htm) | 对上述经历形成政府机构网站转载背书。 | B：机构转载 |
| [新华网：杭州“一人公司”风乍起](https://www.news.cn/local/20260628/00f56b42570b421dbe6eb8ab285f6515/c.html) | 支持杭州 AI+OPC 生态、政策和创业环境背景，不直接证明个人项目、出版或捐赠经历。 | B：权威环境背景 |

公开宣传中可以引用媒体已经报道的事实，但需要区分“媒体报道数据”和“经第一方材料核验的数据”。App 清单、商店链接、后台数据、图书信息、开源仓库和项目捐赠文件进入案例库后，才能升级为 A 级证据。

> 后续已在 `profile/` 中逐项补充了五本清华大学出版社图书、GitHub `huifer`、OPENIOTGO、Rust IoT、WellAlly Health、TanStack Ship 与杭州 OPC 媒体资料，详见 `profile/README.md` 与 `profile/evidence-register.md`。

---

## 18. 内容生产 + Discord Group + Multi-Agent 一体化 SOP

详细设计与定稿见 `agent-core/content/sop.md`。关键点：

- 8 个 Agent 协作：`intake / distill / privacy / fact-check / renderer / publisher / qa / chief`；
- `chief` 主编，8 个子 Agent 各自独立 Session、互不通讯；
- Discord 架构：`总控` 与 `总编` 平级；`总编` 升级为顶级 Category；
- 国内总编 Category：`#主快讯`、`#今日素材`、各平台 `preview-*` 与 `publish-*`；
- 海外总编 Category：`#main-feed`、`#raw-materials`、各平台 `preview-*` 与 `publish-*`；
- 所有内容 HTML 化 + PDF + 渲染长图，8 维评分 ≥ 32 推荐，≥ 24 入池；
- 海外统一品牌 `Zenbuild`，纯英文，不发布中文，不使用 Reddit，不做付费投放。

## 18.1 企业咨询与 FDE 业务 SOP

详细设计见 `agent-core/enterprise/sop.md`。该 SOP 与内容 SOP 并行运行，共用 `#主快讯` / `#main-feed` 的数据回流。

业务主链：

```text
销售线索 → 需求发现 → 解决方案 → 估算报价 → 提案谈判
  → 招投标 → 合同 → 项目启动 → 交付 → 验收 → 开票回款
  → 客户成功 → 续费增购 → 知识回流
```

业务 Agent 集合：

```text
sales / solution / cost / quote / bid / contract / pm
delivery / qa / cs / finance
```

业务频道与 Agent 绑定：

```text
#销售线索     sales-agent
#商机与方案   solution-agent
#报价         cost-agent + quote-agent
#标书         bid-agent
#合同运营     contract-agent
#项目管理     pm-agent
#fde-客户交付 delivery-agent
#测试与验收   qa-agent
#客户成功     cs-agent
#开票与回款   finance-agent
```

`#审批中心` 在以下节点必须人工批准：

- QUOTE_APPROVED
- CONTRACT_SIGNED（重大合同需外部法律复审）
- BID_SUBMIT
- ACCEPTANCE_PASSED
- PAYMENT_OVERDUE_30D

## 18.2 FDE Project 三阶段 SOP

Project 启动后进入三阶段，详见 `agent-core/enterprise/fde-project-sop.md`：

```text
Stage 1 · Project Setup
  ├─ A · 目录规划 + Project Index 元数据
  ├─ B · 资料整理（高密度合集设计）
  └─ C · PRD 草稿（按行业模板、Multi-Agent 运行时检索）
Stage 2 · React Demo（coding-agent 自动生成，不手写 HTML）
  ├─ Vite + React + TypeScript + React Router
  ├─ Tailwind v4 + shadcn/ui + TanStack Query
  ├─ MSW / fixtures 提供 mock data
  ├─ 使用 @zenbuild/design 组件库与 token
  └─ Demo Review（客户 + 内部）
Stage 3 · 算法预研
  └─ 每条算法 proposal → notebook → metrics → decision
Stage 4 · 正式研发
  └─ Architecture → Coding → Unit → Integration → Release → Deployment → Maintenance
```

新增 `coding-agent` 负责 Demo / MVP / 内部工具代码生成。Skill 清单见 `agent-core/agents/coding/skills/`。

行业目录位于 `agent-core/enterprise/industries/`，新增行业只需新增子目录。

项目本地工程位于 `data/business/projects/<alias>/`；敏感文件位于 `data/business/accounts/<account-id>/projects/<PRJ-ID>/`。

模板文件：

```text
agent-core/enterprise/templates/
├── prd/
│   ├── ai-agent.md
│   ├── saas.md
│   ├── data-analytics.md
│   ├── cross-border-ecommerce.md
│   └── internal-tools.md
├── demo-react/                    # Vite + React + TS + Tailwind v4 + shadcn/ui + MSW
├── knowledge-pack.md
├── research-notebook.md
├── rd-stage-checklist.md
└── demo-review-log.md
```

Project 索引：

```text
data/business/projects/index.yaml
  ├─ PRJ-ID
  ├─ 客户化名（alias）
  ├─ 行业
  ├─ 业务线
  ├─ 状态 / 阶段
  ├─ 仓库
  ├─ Discord 频道
  └─ 创建时间
```

不写客户全名、合同、报价、联系人、账号、密钥。客户敏感信息只写进 `data/business/accounts/<account-id>/`。

---

## 0. 如何阅读这份文档

这是一份完整蓝图，不要求一次读完。

### 只想先理解整体方向

依次阅读：

1. 第 1 章：最终要建设什么
2. 第 4 章：总体架构
3. 第 7 章：Agent 组织结构
4. 第 9 章：企业服务完整业务流程
5. 第 18 章：实施路线

### 想确认 Discord 最终怎么使用

依次阅读：

1. 第 5 章：核心交互模型
2. 第 12 章：Discord 频道设计
3. 第 13 章：`@Agent` 路由设计
4. 第 14 章：文件收发设计
5. 第 15 章：审批中心

### 想确认报价、标书、合同和交付怎么覆盖

依次阅读：

1. 第 8 章：企业服务 Agent
2. 第 9 章：企业服务生命周期
3. 第 10 章：报价体系
4. 第 11 章：标书体系
5. 第 16 章：业务对象与文档资产

### 想确认自媒体怎么做

依次阅读：

1. 第 7.1 节：公开对话 Agent
2. 第 17 章：自媒体内容供应链
3. 第 12.5 和 12.6 节：国内与海外自媒体频道

---

# 1. 最终要建设什么

最终系统不是“一个会聊天的机器人”，也不是“很多不同 Prompt 的集合”。

最终系统是一套面向一人公司的 **Agent Workforce 企业运营系统**，它需要同时具备以下能力：

1. 你可以在 Discord 中直接和不同专业 Agent 对话。
2. 你可以通过 `@FDE`、`@SEO-GEO`、`@Bid`、`@X` 指定 Agent。
3. 每个 Agent 拥有独立身份、职责、Skills、权限、记忆和会话。
4. Agent 可以读取你发到 Discord 的文件。
5. Agent 可以把 Markdown、PDF、Word、Excel、CSV、图片、代码包发送回 Discord。
6. Agent 可以生成企业服务所需的方案、报价、标书、合同审查意见、项目计划、验收材料和复盘报告。
7. Agent 可以支持软件开发、FDE 客户交付、SEO、GEO、外链业务、市场营销和销售运营。
8. Agent 可以支持微信公众号、小红书、视频号、抖音、X 和 Product Hunt。
9. 所有外部发布、正式报价、合同确认、生产部署和文件外发都可以进入审批中心。
10. 所有关键知识、客户事实、商业决策、内容资产和交付材料都可以长期沉淀。
11. Agent 核心内容放在独立目录中，并能被版本管理、测试、迁移和复用。
12. Discord 只是交互入口，核心 Agent 资产不依赖 Discord。

最终形态可以概括为：

```text
你
│
├── Discord：对话、文件、审批、状态、结果
│
├── Agent Workforce：路由、会话、执行、协作、权限
│
├── Enterprise Operations：销售、报价、标书、合同、交付、回款
│
├── Growth Operations：SEO、GEO、外链、营销、增长
│
├── Media Operations：国内自媒体、X、Product Hunt
│
└── Core Assets：Agent、Skills、知识、模板、工作流、评测
```

---

# 2. 建设目标与非目标

## 2.1 建设目标

### 目标 A：形成可积累的核心资产

Agent 的能力不能只存在于聊天记录中。以下内容必须文件化、结构化并进入版本管理：

- Agent 身份定义
- Agent 职责边界
- Skills
- 工作流
- 企业资料
- 服务目录
- 报价规则
- 标书模板
- 内容模板
- 审批规则
- 权限策略
- 质量评测
- 业务术语
- 记忆分类规则

### 目标 B：支持一人公司完整运营

系统不仅支持“产出内容”，还要支持企业服务从销售机会到回款续费的完整流程。

### 目标 C：支持专业 Agent 独立执行

每个 Agent 都应能：

- 独立接收任务
- 主动澄清问题
- 调用适合自己的 Skills
- 使用被授权的工具
- 生成可交付文件
- 请求审批
- 记录过程和结果
- 在后续对话中恢复上下文

### 目标 D：保持安全和可控

Agent 可以提高效率，但不能绕过你完成高风险外部动作。

## 2.2 当前阶段的非目标

以下内容不作为第一阶段目标：

- 一次性实现全部 Agent
- 一开始就全自动发布所有自媒体平台
- 一开始就自动签合同或提交标书
- 让 Agent 自动决定最终价格
- 让 Agent 无审批部署生产环境
- 让所有 Agent 共享全部客户文件
- 为每个 Agent 创建一个独立 Discord Bot Application

---

# 3. 核心概念与分层

系统中必须区分以下概念。

## 3.1 Agent

Agent 是一个长期存在的专业角色，包含身份、目标、职责、权限、记忆范围和质量标准。

示例：

- Chief of Staff
- FDE
- Bid Manager
- SEO/GEO Strategist
- WeChat Editor

## 3.2 Skill

Skill 是 Agent 按需加载的专业工作方法。

示例：

- 企业需求访谈
- 方案估算
- 报价生成
- 标书合规矩阵
- SEO Audit
- Product Hunt Launch

Skill 可以包含：

- `SKILL.md`
- 辅助脚本
- 参考资料
- 模板
- 示例
- 验证清单

## 3.3 Tool

Tool 是 Agent 真正执行动作的能力。

示例：

- 读文件
- 写文件
- 执行命令
- 搜索 Web
- 生成图片
- 查询业务数据
- 发送 Discord 文件
- 创建审批请求

## 3.4 Workflow

Workflow 是多步骤或多 Agent 协作流程。

示例：

```text
销售线索
→ 需求澄清
→ 技术方案
→ 成本估算
→ 报价审批
→ 发送报价
→ 合同
→ 项目交付
→ 验收
→ 开票回款
```

## 3.5 Memory

Memory 是需要长期保留并在后续任务中检索的事实、偏好、决定和约束。

## 3.6 Artifact

Artifact 是系统产生或接收的文件资产。

示例：

- 客户需求文档
- 报价单
- 标书
- 项目计划
- 验收报告
- SEO 报告
- 公众号文章
- X Thread
- 图片
- CSV 数据
- 代码包

## 3.7 Approval

Approval 是对高风险动作的人工批准记录。

示例：

- 正式报价批准
- 折扣批准
- 标书提交批准
- 合同风险接受批准
- 自媒体发布批准
- 生产部署批准

---

# 4. 总体架构

```text
┌───────────────────────────────────────────────┐
│ Discord                                      │
│ 频道、Thread、@Role、附件、Webhook、审批按钮    │
└──────────────────────┬────────────────────────┘
                       │
┌──────────────────────▼────────────────────────┐
│ Discord Adapter                              │
│ 消息接收、路由解析、附件下载、回复、文件发送    │
└──────────────────────┬────────────────────────┘
                       │
┌──────────────────────▼────────────────────────┐
│ Agent Workforce Runtime                      │
│ Agent Catalog                                │
│ Agent Manager                                │
│ Conversation Manager                         │
│ Pi RPC Process Pool                          │
│ Approval Center                              │
│ Artifact Gateway                             │
│ Memory Gateway                               │
│ Audit Log                                    │
└──────────────────────┬────────────────────────┘
                       │
┌──────────────────────▼────────────────────────┐
│ agent-core                                   │
│ Agent Definitions                            │
│ Skills                                       │
│ Workflows                                    │
│ Knowledge                                    │
│ Templates                                    │
│ Policies                                     │
│ Evals                                        │
└───────────────────────────────────────────────┘
```

## 4.1 Discord Adapter

Discord Adapter 只负责 Discord 相关行为：

- 接收消息
- 解析 Channel 和 Thread
- 解析 Agent Role Mention
- 下载附件
- 转换成统一请求
- 接收 Agent 事件
- 发送文字和文件
- 展示审批卡片
- 处理按钮

它不负责判断业务流程，也不负责拼装 Agent Prompt。

## 4.2 Agent Workforce Runtime

这是整个系统最重要的运行模块。

它对 Discord Adapter 提供一个较小的 interface：

```ts
workforce.dispatch(request)
workforce.cancel(conversationId)
workforce.getStatus()
workforce.shutdown()
```

`dispatch` 内部隐藏：

- Agent 查找
- Skills 加载
- System Prompt 组合
- Pi RPC 启动
- Session 恢复
- 并发队列
- 权限注入
- 记忆检索
- 输出事件
- Artifact 记录
- 成本记录
- 崩溃恢复

## 4.3 Agent Core

Agent Core 是独立、可版本化、可迁移的核心资产包。

## 4.4 Runtime Data

运行时数据与核心资产严格分离。

```text
data/agent-runtime/
├── sessions/
├── inbox/
├── artifacts/
├── workspaces/
├── approvals/
├── audit/
├── queue/
└── state/
```

---

# 5. 核心交互模型

系统需要支持五种主要交互。

## 5.1 直接对话

```text
@Chief 我想重新规划企业服务业务
```

Chief 可以持续追问、讨论和记录决定。

## 5.2 专业任务

```text
@Bid 分析我上传的招标文件，先生成投标合规矩阵
```

Bid Agent 读取附件并生成文件。

## 5.3 频道默认 Agent

在 `#seo-geo` 发送消息，不需要每次 `@SEO-GEO`。

## 5.4 多 Agent 会诊

```text
@Chief 让 Research、SEO-GEO 和 Growth 一起判断这个市场机会
```

内部执行方式：

```text
Chief
├── Research：事实和市场证据
├── SEO-GEO：搜索需求和内容机会
└── Growth：获客和转化建议

Chief：统一综合回复
```

## 5.5 文件交互

```text
用户上传 tender.pdf
→ 系统保存到 inbox
→ Bid Agent 读取
→ 生成 compliance-matrix.xlsx
→ 发送回 Discord
```

---

# 6. 核心资产目录

建议创建：

```text
agent-core/
├── package.json
├── README.md
├── registry.yaml
│
├── shared/
│   ├── constitution/
│   │   ├── company-principles.md
│   │   ├── communication-style.md
│   │   └── decision-policy.md
│   │
│   ├── company-context/
│   │   ├── founder-profile.md
│   │   ├── company-profile.md
│   │   ├── products-services.md
│   │   ├── positioning.md
│   │   ├── customer-segments.md
│   │   ├── pricing-principles.md
│   │   └── brand-voice.md
│   │
│   ├── policies/
│   │   ├── security.md
│   │   ├── approval.md
│   │   ├── external-actions.md
│   │   ├── publishing.md
│   │   ├── client-data-isolation.md
│   │   ├── pricing-discount.md
│   │   └── document-retention.md
│   │
│   ├── skills/
│   ├── workflows/
│   ├── templates/
│   └── knowledge/
│
├── agents/
│   ├── chief-of-staff/
│   ├── strategy/
│   ├── research-intelligence/
│   ├── sales-crm/
│   ├── solution-consultant/
│   ├── fde/
│   ├── quote-manager/
│   ├── bid-manager/
│   ├── contract-operations/
│   ├── project-manager/
│   ├── delivery-qa/
│   ├── customer-success/
│   ├── finance-operations/
│   ├── product-manager/
│   ├── product-engineer/
│   ├── release-engineer/
│   ├── seo-geo/
│   ├── link-commerce/
│   ├── growth-marketing/
│   ├── media-editor/
│   ├── media-wechat/
│   ├── media-xiaohongshu/
│   ├── media-video-account/
│   ├── media-douyin/
│   ├── media-x/
│   └── producthunt-launch/
│
├── schemas/
│   ├── agent.schema.json
│   ├── workflow.schema.json
│   ├── approval.schema.json
│   ├── artifact.schema.json
│   └── content.schema.json
│
├── runtime/
│   ├── agent-bootstrap.mjs
│   ├── safety-extension.mjs
│   ├── artifact-extension.mjs
│   └── approval-extension.mjs
│
├── bin/
│   └── run-agent.mjs
│
└── evals/
    ├── routing/
    ├── permissions/
    ├── business-documents/
    ├── media-quality/
    └── safety/
```

## 6.1 单个 Agent 目录

```text
agents/bid-manager/
├── agent.yaml
├── SYSTEM.md
├── PLAYBOOK.md
├── knowledge/
│   ├── tender-terminology.md
│   ├── bid-compliance-rules.md
│   └── submission-checklist.md
├── skills/
│   ├── tender-ingestion/
│   │   └── SKILL.md
│   ├── compliance-matrix/
│   │   └── SKILL.md
│   └── bid-review/
│       └── SKILL.md
├── templates/
│   ├── bid-no-bid.md
│   ├── compliance-matrix.xlsx
│   ├── technical-response.md
│   └── final-checklist.md
└── evals/
    ├── missing-mandatory-clause.md
    └── inconsistent-pricing.md
```

## 6.2 Agent Manifest

```yaml
id: bid-manager
display_name: Bid Manager
description: 负责招投标分析、合规矩阵、投标文档编制和提交前检查

aliases:
  - bid
  - tender
  - 标书
  - 投标

model:
  primary: minimax-cn/MiniMax-M3
  thinking: high

runtime:
  session_scope: project
  idle_ttl_minutes: 30
  max_concurrency: 2

skills:
  - shared/skills/document-analysis
  - shared/skills/fact-checking
  - agents/bid-manager/skills

tools:
  profile: business-documents

permissions:
  external_actions: approval-required
  allowed_write_roots:
    - data/agent-runtime/artifacts/bid-manager

memory:
  read_scopes:
    - company
    - credentials
    - current-client
    - current-bid
  write_scope: bid
```

---

# 7. Agent 组织结构

Agent 分为三类：公开对话 Agent、内部执行 Agent、实例化 Agent。

## 7.1 公开对话 Agent

公开 Agent 可以在 Discord 中被直接 `@`。

建议最终公开 Agent：

| Agent | 主要职责 |
|---|---|
| Chief | 总控、讨论、优先级、分派、决策 |
| Sales | 线索、商机、跟进、CRM |
| Solution | 需求分析、方案设计、范围定义 |
| FDE | 客户实施、集成、交付、故障处理 |
| Quote | 估算、报价、版本和折扣流程 |
| Bid | 招标文件、合规矩阵、标书编制 |
| Contract Ops | 合同条款整理、风险清单、履约义务 |
| Project Manager | 计划、里程碑、风险、周报 |
| Finance Ops | 开票材料、应收、回款、经营数据 |
| Engineer | 自有软件开发和技术执行 |
| SEO-GEO | SEO、AEO、GEO 和内容架构 |
| Link Sales | 外链库存、报价、订单和履约 |
| Growth | 定位、渠道、转化和增长实验 |
| Editor | 自媒体总编和内容规划 |
| WeChat | 微信公众号 |
| Xiaohongshu | 小红书 |
| VideoAccount | 视频号 |
| Douyin | 抖音 |
| X | X.com |
| ProductHunt | Product Hunt 发布战役 |

## 7.2 内部执行 Agent

内部 Agent 默认不在 Discord 公开出现，由其他 Agent 调用。

| Agent | 主要职责 |
|---|---|
| Research | 搜索、来源、竞品、事实 |
| Fact Checker | 检查事实、数字和引用 |
| Cost Estimator | 工时、成本、毛利估算 |
| Document Controller | 编号、版本、归档、文件一致性 |
| Proposal Writer | 方案和商业文案 |
| Compliance Reviewer | 强制条款、缺失项和合规检查 |
| Technical Reviewer | 架构和代码评审 |
| QA Reviewer | 测试和验收检查 |
| Content Repurposer | 一份内容转换成多平台版本 |
| Analytics Reviewer | 内容、销售和经营数据复盘 |

## 7.3 实例化 Agent

实例化 Agent 是基于模板为某个客户、项目或产品创建的隔离实例。

示例：

```text
FDE Agent Definition
├── FDE / client-acme
├── FDE / client-beta
└── FDE / client-gamma
```

每个实例拥有独立：

- Workspace
- Session
- 客户记忆
- 文件目录
- 权限
- 项目状态

## 7.4 管理与战略 Agent

### Chief of Staff

职责：

- 与你进行长期经营讨论
- 维护公司目标和优先级
- 收集你的新想法
- 把想法转成项目、实验或待办
- 分派专业 Agent
- 汇总跨 Agent 结果
- 记录正式决策
- 发现冲突、风险和长期拖延事项
- 生成每日和每周经营回顾

输出：

- 决策记录
- 优先级清单
- 周计划
- 经营复盘
- Agent 分工方案

### Strategy Agent

职责：

- 业务组合分析
- 服务产品化
- 市场选择
- 定价框架
- 竞争策略
- 年度、季度和月度规划

### Research Intelligence Agent

职责：

- 市场研究
- 客户声音
- 竞品研究
- 行业信息
- 事实核查
- 来源归档
- 机会扫描

---

# 8. 企业服务 Agent

## 8.1 Sales / CRM Agent

负责：

- 线索录入
- 线索去重
- 客户画像
- 商机资格判断
- 跟进计划
- 会议准备
- 沟通纪要
- 下一步动作
- 输单原因
- 续费和复购机会

核心产物：

- Lead Record
- Account Brief
- Opportunity Record
- Meeting Brief
- Follow-up Draft
- Pipeline Report

限制：

- 不自动承诺价格
- 不自动发送外部邮件和私信
- 不虚构客户背景

## 8.2 Solution Consultant Agent

负责：

- 需求访谈提纲
- 现状分析
- 问题定义
- 用户和系统范围
- 功能范围
- 非功能需求
- 集成边界
- 依赖和约束
- 假设条件
- 排除项
- 技术方案
- 实施路线

核心产物：

- Discovery Questionnaire
- Requirement Summary
- Scope Statement
- Solution Design
- Assumption Log
- Exclusion List
- Risk Register

## 8.3 FDE Agent

负责：

- 客户现场技术沟通
- POC
- 系统集成
- 数据迁移
- 环境配置
- 部署
- 生产问题处理
- Runbook
- 培训
- 交付文档
- 客户验收支持

核心产物：

- POC Plan
- Integration Design
- Environment Checklist
- Deployment Plan
- Migration Plan
- Runbook
- Training Material
- Incident Report
- Handover Package

## 8.4 Quote Manager Agent

负责：

- 报价请求收集
- 服务项匹配
- 工时估算
- 成本估算
- 毛利计算
- 折扣检查
- 报价版本
- 有效期
- 付款条款
- 报价审批
- 报价归档

核心产物：

- Estimate Worksheet
- Quote Draft
- Quote Approval Request
- Final Quote
- Quote Comparison

## 8.5 Bid Manager Agent

负责：

- 招标文件读取
- 截止时间识别
- 强制资格识别
- 废标条件识别
- 评分标准识别
- Bid / No-Bid 分析
- 合规矩阵
- 标书目录
- 技术响应
- 商务响应
- 资质材料清单
- 版本控制
- 提交前检查

核心产物：

- Bid / No-Bid Report
- Tender Summary
- Compliance Matrix
- Bid Schedule
- Technical Proposal
- Commercial Response
- Credential Checklist
- Submission Checklist

## 8.6 Contract Operations Agent

负责：

- 合同结构整理
- 服务范围对照
- 付款条款提取
- 验收条件提取
- 交付义务提取
- 数据和保密义务提取
- 知识产权条款提取
- 违约和赔偿风险清单
- 合同与报价、标书一致性检查
- 合同履约日历

限制：

- 它是合同运营和风险辅助，不替代执业律师
- 高风险法律意见需要专业人士确认
- 不自动接受合同风险

核心产物：

- Contract Summary
- Risk Register
- Obligation Matrix
- Deviation List
- Negotiation Points
- Contract Calendar

## 8.7 Project Manager Agent

负责：

- 项目启动
- WBS
- 里程碑
- 人日和排期
- 依赖
- 风险
- 变更请求
- 周报
- 决策记录
- 问题升级
- 验收准备

核心产物：

- Project Charter
- Project Plan
- Milestone Plan
- RAID Log
- Weekly Report
- Change Request
- Decision Log

## 8.8 Delivery QA Agent

负责：

- 交付清单
- 测试计划
- 验收标准
- 验收证据
- 缺陷清单
- 发布检查
- 交接检查

核心产物：

- Test Plan
- Acceptance Criteria
- Acceptance Evidence
- Defect Report
- Release Checklist
- Handover Checklist

## 8.9 Customer Success Agent

负责：

- 上线后跟踪
- 使用情况
- 客户问题
- 价值回顾
- 健康度
- 续费机会
- 增购机会
- 客户案例

核心产物：

- Success Plan
- Health Report
- QBR
- Renewal Brief
- Expansion Opportunity
- Case Study Draft

## 8.10 Finance Operations Agent

负责：

- 报价和合同金额对照
- 开票申请材料
- 应收账款记录
- 到期提醒
- 回款状态
- 项目毛利
- 月度收入和现金流摘要
- 供应商付款计划

限制：

- 不替代会计师和税务专业人士
- 不自动生成具有法律效力的税务结论
- 不自动执行付款

核心产物：

- Invoice Request
- Accounts Receivable Report
- Payment Reminder Draft
- Project Margin Report
- Cash Flow Summary

---

# 9. 企业服务完整生命周期

## 9.1 业务阶段

```text
线索 Lead
→ 客户 Account
→ 商机 Opportunity
→ 需求发现 Discovery
→ 方案 Solution
→ 估算 Estimate
→ 报价 Quote
→ 提案 Proposal
→ 招投标 Bid（适用时）
→ 商务谈判 Negotiation
→ 合同 Contract
→ 项目启动 Kickoff
→ 项目交付 Delivery
→ 测试验收 Acceptance
→ 开票 Invoice
→ 回款 Payment
→ 客户成功 Customer Success
→ 续费或增购 Renewal / Expansion
```

## 9.2 阶段责任和产物

| 阶段 | 主 Agent | 关键产物 | 审批要求 |
|---|---|---|---|
| 线索 | Sales | Lead Record | 无 |
| 商机资格 | Sales + Chief | Qualification Report | 重要机会需确认 |
| 需求发现 | Solution | Requirement Summary | 客户确认范围前需审核 |
| 技术方案 | Solution + FDE | Solution Design | 对外发送前审批 |
| 估算 | Cost Estimator + Quote | Estimate Worksheet | 内部审核 |
| 报价 | Quote | Final Quote | 必须审批 |
| 提案 | Proposal Writer | Proposal | 对外发送前审批 |
| 投标 | Bid | Bid Package | 必须审批 |
| 合同 | Contract Ops | Contract Risk Register | 必须人工确认 |
| 项目启动 | PM | Project Charter | 项目负责人确认 |
| 交付 | FDE + Engineer | Deliverables | 高风险变更审批 |
| 验收 | Delivery QA | Acceptance Package | 人工确认 |
| 开票 | Finance Ops | Invoice Request | 人工确认 |
| 回款 | Finance Ops | AR Status | 不自动收付款 |
| 客户成功 | Customer Success | QBR / Renewal Brief | 对外材料审批 |

## 9.3 Bid / No-Bid 决策

收到招标机会后，不应直接开始写标书。

首先执行 Bid / No-Bid：

- 是否符合强制资格
- 是否有足够交付能力
- 是否有合理利润
- 是否有竞争优势
- 是否能在截止时间前完成
- 是否存在不可接受的合同风险
- 是否需要保证金
- 是否需要特定资质
- 是否有客户关系基础
- 是否值得消耗时间

输出建议：

```text
Decision: BID / CONDITIONAL BID / NO BID
Confidence: 0-100
Mandatory Gaps:
Commercial Risks:
Delivery Risks:
Required Approvals:
Next Action:
```

---

# 10. 报价体系

## 10.1 报价不是一个文档，而是一套受控流程

```text
报价请求
→ 服务项识别
→ 范围确认
→ 工作量估算
→ 成本计算
→ 毛利检查
→ 折扣检查
→ 商务条款
→ 内部审批
→ 生成正式报价
→ 对外发送
→ 版本跟踪
→ 接受、失效或替换
```

## 10.2 报价输入

- 客户名称
- 商机编号
- 项目名称
- 服务范围
- 交付物
- 数量
- 人日
- 单价
- 第三方成本
- 差旅成本
- 税费口径
- 付款条件
- 有效期
- 客户特殊要求
- 排除项
- 假设条件

## 10.3 报价结构

正式报价应至少包含：

1. 报价编号
2. 报价版本
3. 客户信息
4. 项目名称
5. 服务说明
6. 报价明细
7. 小计
8. 税费说明
9. 总价
10. 币种
11. 付款计划
12. 报价有效期
13. 交付周期
14. 假设条件
15. 排除项
16. 变更处理方式
17. 联系方式
18. 审批记录引用

## 10.4 报价状态

```text
DRAFT
→ INTERNAL_REVIEW
→ APPROVAL_PENDING
→ APPROVED
→ SENT
→ REVISED
→ ACCEPTED
→ REJECTED
→ EXPIRED
→ SUPERSEDED
```

## 10.5 报价编号

建议：

```text
QTE-2026-0001
QTE-2026-0001-V2
```

## 10.6 折扣规则

Agent 只能提出折扣建议，不得自行批准。

折扣审批应记录：

- 原价
- 折后价
- 折扣率
- 毛利变化
- 折扣原因
- 竞争情况
- 有效期
- 审批人
- 审批时间

---

# 11. 标书体系

## 11.1 标书工作流

```text
上传招标文件
→ 文件登记
→ 截止时间识别
→ Bid / No-Bid
→ 招标摘要
→ 合规矩阵
→ 任务分解
→ 技术响应
→ 商务响应
→ 资质材料
→ 一致性检查
→ 完整性检查
→ 审批
→ 提交
→ 提交证据归档
```

## 11.2 招标文件解析内容

Bid Agent 必须提取：

- 招标人
- 项目名称
- 项目编号
- 截止日期和时间
- 提交方式
- 文件格式要求
- 资格要求
- 强制条款
- 废标条件
- 评分标准
- 技术需求
- 商务需求
- 报价格式
- 保证金要求
- 签字盖章要求
- 密封要求
- 演示或答辩要求
- 合同主要条款
- 联系方式
- 澄清问题截止时间

## 11.3 合规矩阵

合规矩阵字段：

| 字段 | 说明 |
|---|---|
| Requirement ID | 要求编号 |
| Source Page | 原文页码 |
| Requirement | 要求原文 |
| Mandatory | 是否强制 |
| Owner | 负责人或 Agent |
| Response | 响应内容 |
| Evidence | 证明材料 |
| Status | 未开始、进行中、完成、风险 |
| Risk | 缺失风险 |
| Final Location | 最终标书位置 |

## 11.4 标书目录

标准标书包可包含：

1. 投标函
2. 法定代表人或授权文件
3. 企业资质
4. 商务响应
5. 技术响应
6. 项目实施方案
7. 项目团队
8. 项目计划
9. 质量保障
10. 风险管理
11. 售后服务
12. 培训方案
13. 偏离表
14. 报价文件
15. 案例和证明材料
16. 招标要求的附表
17. 最终提交检查表

## 11.5 标书最终检查

提交前必须检查：

- 所有强制条款已响应
- 公司名称一致
- 项目名称一致
- 项目编号一致
- 金额大小写一致
- 技术方案与报价范围一致
- 报价与合同条件一致
- 页码和目录一致
- 附件齐全
- 资质未过期
- 签字盖章位置完整
- 文件命名符合要求
- 文件格式符合要求
- 提交时间留有安全余量
- 最终文件哈希和版本已记录

最终提交必须由你人工确认。

---

# 12. Discord 频道设计

## 12.1 总控区

```text
00-总部
├── #总控台
├── #深度讨论
├── #审批中心
├── #agent-状态
├── #每日经营简报
└── #系统告警
```

## 12.2 企业服务区

```text
10-企业服务
├── #销售线索
├── #商机与方案
├── #报价
├── #标书
├── #合同运营
├── #项目管理
├── #fde-客户交付
├── #测试与验收
├── #客户成功
└── #开票与回款
```

## 12.3 技术与产品区

```text
20-技术产品
├── #软件开发
├── #产品规划
├── #架构评审
├── #测试发布
├── #生产运维
└── #工程沉淀
```

## 12.4 增长与商业区

```text
30-增长商业
├── #seo-geo
├── #外链业务
├── #marketing-growth
├── #市场研究
├── #机会发现
└── #增长复盘
```

## 12.5 国内总编（杭州 OPC 张三）

```text
40-国内总编
├── #主快讯
├── #今日素材
├── #preview-公众号
├── #preview-小红书
├── #preview-视频号
├── #preview-抖音
├── #publish-公众号
├── #publish-小红书
├── #publish-视频号
└── #publish-抖音
```

## 12.6 海外总编（Zenbuild）

```text
50-海外总编
├── #main-feed
├── #raw-materials
├── #preview-x
├── #preview-producthunt
├── #preview-newsletter
├── #preview-youtube
├── #preview-linkedin
├── #publish-x
├── #publish-producthunt
└── #publish-newsletter
```

## 12.7 资产区

```text
60-资产中心
├── #文件收件箱
├── #文件交付
├── #内容资产
├── #客户资料
├── #记忆库
├── #灵感
├── #资讯
└── #用量
```

## 12.8 频道不是 Agent

频道负责组织工作和上下文，Agent 负责专业能力。

一个 Agent 可以服务多个频道，一个频道也可以临时调用其他 Agent。

---

# 13. `@Agent` 路由设计

## 13.1 推荐方案

使用：

- 一个 Discord Gateway Bot
- 多个 Discord Agent Roles
- 多个 Agent Webhooks

输入示例：

```text
@Quote 根据这个方案生成报价草案
@Bid 分析附件中的废标条件
@FDE 给客户制定实施计划
@X 把这篇文章转换成英文 Thread
```

输出通过 Webhook 呈现独立身份和头像。

## 13.2 路由优先级

```text
1. Thread 已绑定 Agent
2. 显式 @Agent Role
3. Slash Command 指定 Agent
4. 当前频道默认 Agent
5. 未命中时交给 Chief
```

## 13.3 多 Agent Mention

一条消息 Mention 多个 Agent 时：

- 不让多个 Agent 独立刷屏
- 自动创建 Council 任务
- Chief 或指定 Lead Agent 汇总输出

## 13.4 Thread 规则

推荐：

- 一个客户问题一个 Thread
- 一个标书一个 Thread
- 一个报价版本一个 Thread
- 一个内容主题一个 Thread
- 一个开发任务一个 Thread

Thread 是默认 Conversation Scope。

## 13.5 Session Key

```text
guildId:channelId:threadId:userId:agentId:projectId
```

同一个 Session 内串行执行，不同 Session 可以并行。

---

# 14. 文件收发设计

## 14.1 Discord 入站文件

流程：

```text
Discord Attachment
→ 下载
→ 文件名规范化
→ 大小检查
→ MIME 检查
→ 哈希计算
→ 保存 inbox
→ 创建 Artifact Record
→ 交给 Agent
```

目录：

```text
data/agent-runtime/inbox/
└── 2026-07-19/
    └── <message-id>/
        ├── manifest.json
        ├── tender.pdf
        └── customer-requirements.docx
```

## 14.2 入站安全

默认规则：

- 文件名去除路径字符
- 限制单文件大小
- 限制单消息总大小
- 保存 SHA-256
- 不自动运行可执行文件
- 不自动执行 Office 宏
- ZIP 默认只登记，不自动解压
- 未知类型只保存，不自动解析
- 客户文件绑定客户作用域
- 文件保留时间遵守文档保留策略

## 14.3 图片输入

图片可以转成 Pi RPC `images` 输入。

## 14.4 文档输入

- Markdown、Text、JSON、CSV：直接读取
- PDF：PDF 解析 Skill
- DOCX：Word 文档 Skill
- XLSX：表格 Skill
- PPTX：演示文档 Skill
- ZIP：审批后解压

## 14.5 Agent 输出文件

Agent 只能写入授权的 Artifact 目录：

```text
data/agent-runtime/artifacts/<agent-id>/<project-id>/<artifact-id>/
```

不能直接把任意系统路径发送到 Discord。

## 14.6 通用文件发送

Artifact Gateway 需要支持：

- 本地路径
- Buffer
- 文件名
- Caption
- MIME
- Reply Reference
- Channel
- Thread
- 多文件
- 大文本自动转换成 `.md`

## 14.7 超长回复

文字输出策略：

- 短文本：Discord 消息
- 中等文本：自动分片
- 长文档：生成 Markdown 文件
- 正式商业文档：生成 DOCX 或 PDF
- 数据表：CSV 或 XLSX

---

# 15. 审批中心

## 15.1 必须审批的动作

- 正式报价
- 折扣
- 标书提交
- 合同风险接受
- 合同对外回复
- 客户正式方案发送
- 生产部署
- 删除客户数据
- 外发敏感文件
- 公众号发布
- 小红书发布
- 视频号发布
- 抖音发布
- X 发布
- Product Hunt 正式发布
- 冷邮件和私信群发
- 外链订单最终确认
- 付款和退款

## 15.2 审批卡片

Discord 审批卡片包含：

- Approval ID
- 请求 Agent
- 动作类型
- 业务对象
- 摘要
- 风险
- 影响范围
- 文件链接
- 到期时间
- 批准按钮
- 拒绝按钮
- 请求修改按钮
- 延后按钮

## 15.3 审批状态

```text
PENDING
→ APPROVED
→ REJECTED
→ CHANGES_REQUESTED
→ EXPIRED
→ CANCELLED
→ EXECUTED
→ EXECUTION_FAILED
```

## 15.4 幂等

同一个 Approval 只能执行一次。

按钮重复点击不能造成：

- 重复报价发送
- 重复发布
- 重复部署
- 重复文件外发

---

# 16. 业务对象与文档资产

## 16.1 统一编号

建议使用以下编号：

| 类型 | 编号示例 |
|---|---|
| Lead | `LEAD-2026-0001` |
| Account | `ACC-2026-0001` |
| Opportunity | `OPP-2026-0001` |
| Quote | `QTE-2026-0001` |
| Bid | `BID-2026-0001` |
| Contract | `CTR-2026-0001` |
| Project | `PRJ-2026-0001` |
| Invoice Request | `INVREQ-2026-0001` |
| Content | `CNT-2026-0001` |
| Artifact | `ART-2026-0001` |
| Approval | `APR-2026-0001` |
| Decision | `DEC-2026-0001` |

## 16.2 客户目录

```text
data/business/accounts/<account-id>/
├── account.yaml
├── contacts/
├── opportunities/
├── quotes/
├── bids/
├── contracts/
├── projects/
├── invoices/
├── customer-success/
└── correspondence/
```

## 16.3 项目目录

```text
projects/<project-id>/
├── project.yaml
├── discovery/
├── solution/
├── plan/
├── delivery/
├── testing/
├── acceptance/
├── handover/
├── reports/
├── risks/
├── decisions/
└── artifacts/
```

## 16.4 文档元数据

每个重要文档记录：

- Artifact ID
- 文档类型
- 业务对象
- 客户
- 项目
- 创建 Agent
- 创建时间
- 版本
- 状态
- 文件路径
- 文件哈希
- 保密级别
- 审批状态
- 外发记录
- 替代版本

## 16.5 文档状态

```text
DRAFT
→ INTERNAL_REVIEW
→ APPROVAL_PENDING
→ APPROVED
→ RELEASED
→ SUPERSEDED
→ ARCHIVED
```

---

# 17. 自媒体内容供应链

## 17.1 组织原则

自媒体采用：

```text
一个总编 Agent
+ 多个平台 Agent
+ 一个统一内容资产库
+ 一个审批流程
+ 一个数据复盘流程
```

各平台 Agent 不应分别创造互相冲突的事实。

## 17.2 Media Editor

负责：

- 个人 IP 定位
- 内容主线
- 栏目
- 选题池
- 编辑日历
- 中文和英文内容关系
- 内容去重
- 内容复用
- 发布优先级
- 平台分配

## 17.3 WeChat Agent

输出：

- 公众号长文
- 标题组合
- 摘要
- 目录
- 配图建议
- 封面文案
- 朋友圈分发文案

## 17.4 Xiaohongshu Agent

输出：

- 标题变体
- 封面大字
- 图文卡片结构
- 正文
- 标签
- 首评
- 评论互动建议

## 17.5 Video Account Agent

输出：

- 60 至 180 秒口播稿
- 分镜
- 字幕
- 镜头提示
- 封面文案
- 发布说明

## 17.6 Douyin Agent

输出：

- 三秒 Hook
- 15 至 60 秒脚本
- 快节奏分镜
- 字幕
- 评论引导
- 系列化选题

## 17.7 X Agent

输出：

- 英文短帖
- Thread
- Build in Public
- 回复素材
- Quote Tweet 素材
- 产品观点
- Launch 内容

## 17.8 Product Hunt Agent

输出：

- Tagline
- Description
- Maker Comment
- FAQ
- Gallery 素材清单
- Demo 说明
- Launch Day 时间线
- 回复模板
- X 联动计划
- 发布后复盘

## 17.9 Content ID

每个内容主题拥有唯一 ID：

```text
CNT-2026-0001
```

目录：

```text
content-library/CNT-2026-0001/
├── brief.yaml
├── source-pack.md
├── claims.json
├── canonical-article.md
├── assets/
├── drafts/
│   ├── wechat.md
│   ├── xiaohongshu.md
│   ├── video-account.md
│   ├── douyin.md
│   ├── x.md
│   └── producthunt.md
├── approval.json
├── publish-record.json
└── metrics.json
```

## 17.10 内容状态

```text
IDEA
→ RESEARCHED
→ BRIEFED
→ DRAFTED
→ REVIEWED
→ APPROVAL_PENDING
→ APPROVED
→ SCHEDULED
→ PUBLISHED
→ MEASURED
→ REPURPOSED
→ ARCHIVED
```

## 17.11 内容来源

一份企业服务实践可以复用为：

- 客户案例
- SEO 文章
- GEO 内容
- 公众号文章
- 小红书卡片
- 视频号口播
- 抖音短视频
- X Thread
- Product Hunt Maker Story

涉及客户的内容必须先脱敏，并经过审批。

## 17.12 每日工作与 AI 对话内容锚点

每天的真实工作任务、AI 对话、代码修改、决策、失败、修复和产物，是次日自媒体内容的首要来源。

```text
真实工作
→ AI 对话与执行记录
→ 隐私和 Secret 过滤
→ 事实与证据绑定
→ 当日内容候选蒸馏
→ 次日人工审批
→ 微信公众号 / 小红书 / 视频号 / 抖音 / 英文海外内容适配
```

长期记忆蒸馏与内容蒸馏必须分开：

- Memory 判断未来 Agent 是否需要记住；
- Content 判断公众是否值得阅读；
- 原始聊天记录不得直接自动发布；
- 客户内容必须脱敏并审批；
- 内容候选按真实性、证据、受众价值、新颖性、品牌一致性、可传播性、可复用性和保密安全八维评分；
- 当地市场使用“杭州 OPC 张三”IP，海外使用全新纯英文身份，不使用 Reddit，不发布中文。

具体内容管道、平台清单和海外品牌工作方案见 `profile/content-system/daily-work-to-content.md` 和 `profile/platforms/overseas-channel-map.md`。


---

# 18. 实施路线

## Phase 0：设计冻结和代码保护

目标：避免在当前大量未提交修改上直接重构。

任务：

- 建立 Git 分支或 checkpoint
- 确认 `agent-core/` 是子目录还是独立仓库
- 确认 FDE 定义
- 确认 Discord `@Role + Webhook` 方案
- 确认 Thread Session 方案
- 确认第一批 Agent

完成标准：

- 关键架构决策已记录
- 当前代码可以随时回退

## Phase 1：Agent Core 与 Agent Manager

第一批 Agent：

- Chief
- FDE
- SEO-GEO

任务：

- 创建 `agent-core/`
- 创建 Agent Schema
- 创建 Agent Registry
- 实现 AgentManager
- 实现按 Agent + Thread 懒启动 RPC
- 每个 Agent 独立 Session 目录
- 显式加载 Agent Skills
- 每个 Agent 独立工具权限
- 实现 Session 队列
- 修复全局 `pendingReply` 串线问题

完成标准：

- 三个 Agent 可以独立对话
- 不同 Thread 不串线
- 不同 Agent 不共享不该共享的上下文
- 子进程崩溃可以恢复

## Phase 2：Discord 路由和身份

任务：

- 创建 Discord Agent Roles
- 创建频道默认 Agent 映射
- 解析 Role Mention
- Agent Webhook 名称和头像
- Thread 自动绑定
- 多 Agent Council 路由
- Agent 状态频道

完成标准：

- `@FDE` 可以稳定路由
- `#seo-geo` 不 Mention 也能路由
- 回复显示对应 Agent 身份

## Phase 3：文件和 Artifact

任务：

- 接收 Discord 附件
- Attachment Manifest
- 文件大小和类型校验
- SHA-256
- 图片进入 RPC
- 文档路径进入 Agent
- Artifact Gateway
- 通用 `sendFile`
- 长文本自动生成 Markdown

完成标准：

- 可以上传 PDF、DOCX、XLSX、图片和 Markdown
- Agent 可以返回 Markdown、CSV、图片和办公文档
- Agent 不能外发任意系统文件

## Phase 4：审批中心

任务：

- Approval 数据模型
- Discord 审批卡片
- Approve、Reject、Request Changes、Defer
- 幂等执行
- 审批审计
- 外部动作统一经过 Approval Gateway

完成标准：

- 未审批动作无法执行
- 已审批动作不能重复执行
- 每次外部动作可追溯

## Phase 5：企业服务运营

新增 Agent：

- Sales
- Solution
- Quote
- Bid
- Contract Ops
- Project Manager
- Finance Ops

任务：

- 业务对象编号
- 客户和商机目录
- 报价工作流
- 标书工作流
- 合同义务矩阵
- 项目计划和周报
- 开票和应收记录

完成标准：

- 一个商机可以走完需求、方案、报价、合同和项目启动
- 一个招标文件可以生成合规矩阵和标书工作区

## Phase 6：技术、SEO、GEO 和外链业务

新增 Agent：

- Product Engineer
- Release Engineer
- Link Commerce
- Growth
- Research

任务：

- 项目 Workspace 权限
- 代码和部署审批
- SEO/GEO 资产
- 外链库存和订单状态
- 市场研究 Source Pack
- Growth Experiment

## Phase 7：自媒体矩阵

新增 Agent：

- Media Editor
- WeChat
- Xiaohongshu
- VideoAccount
- Douyin
- X
- ProductHunt

任务：

- Content ID
- 统一内容 Brief
- 平台 Draft
- 发布审批
- 发布记录
- 指标复盘

## Phase 8：自动化和经营系统

任务：

- 每日经营简报
- 每周 Pipeline Review
- 每周项目健康报告
- 每周内容日历
- 月度收入和回款摘要
- Agent 成本报告
- Agent 质量评测
- 失败任务重试和告警

---

# 19. 权限与安全

## 19.1 权限档位

### Read Only

可用于 Research、Fact Checker、Reviewer。

- 读文件
- 搜索
- 不写文件
- 不执行外部动作

### Artifact Writer

可用于 SEO、Media、Quote、Bid。

- 读授权资料
- 写自己的 Artifact 目录
- 不修改项目源码
- 外发需审批

### Project Contributor

可用于 FDE 和 Engineer。

- 读写指定项目 Workspace
- 执行测试
- 不能直接部署生产

### External Operator

可用于发布和客户沟通工具。

- 只能通过审批后的动作执行
- 所有动作进入审计日志

### Production Operator

- 生产部署
- 数据删除
- 密钥操作
- 必须单独审批

## 19.2 Secret 管理

Secret 不进入：

- Agent Prompt
- Agent Core
- Session 文本
- Discord 消息
- Artifact 文件

Agent 使用 Secret 时只引用环境变量名或受控凭据 ID。

## 19.3 客户隔离

每个客户拥有独立：

- Memory Scope
- Workspace
- Artifact Root
- Session Root
- Audit Scope

默认拒绝跨客户读取。

---

# 20. Session 与长期记忆

## 20.1 Session 层级

```text
Agent Definition
→ Agent Instance
→ Project / Client
→ Discord Thread
→ Session
```

## 20.2 Memory 层级

```text
company
├── founder
├── business
├── positioning
├── services
└── global-decisions

domain
├── enterprise-service
├── fde
├── engineering
├── seo-geo
├── link-commerce
├── growth
└── media

channel
├── wechat
├── xiaohongshu
├── video-account
├── douyin
├── x
└── producthunt

client-project
├── client-a
├── client-b
└── product-a

conversation
└── thread-session
```

## 20.3 Memory 读取原则

- Chief：读取公司级摘要和必要领域记忆
- FDE：读取公司、FDE、当前客户和当前项目
- Bid：读取公司资质、当前客户和当前投标
- Finance：读取合同金额、开票和回款数据
- X：读取品牌、内容和 X 平台记忆
- 小红书：不读取客户私有交付资料

## 20.4 Memory 写入原则

Agent 不应把所有对话都写入长期记忆。

适合长期记忆：

- 稳定偏好
- 正式决定
- 客户确认事实
- 合同义务
- 长期约束
- 内容风格
- 重要失败教训
- 经验证的业务规则

不适合长期记忆：

- 临时草稿
- 未确认猜测
- 一次性错误输出
- 敏感凭据
- 可从原文件重新获取的大段内容

---

# 21. Agent 协作模式

## 21.1 Lead Agent

每个工作流必须有一个 Lead Agent。

示例：

- 报价：Quote Lead
- 标书：Bid Lead
- 项目交付：Project Manager 或 FDE Lead
- 自媒体：Media Editor Lead
- 多领域战略：Chief Lead

Lead Agent 负责：

- 拆任务
- 选择内部 Agent
- 合并结果
- 解决冲突
- 请求审批
- 对用户统一回复

## 21.2 并行模式

适合：

- 市场研究
- 竞品研究
- 多平台内容草稿
- 标书不同章节
- 多角度评审

## 21.3 串行模式

适合：

```text
Research
→ Solution
→ Cost Estimate
→ Quote
→ Approval
```

## 21.4 Reviewer 模式

生产 Agent 与 Reviewer Agent 分开。

示例：

```text
Bid Agent 写技术响应
→ Compliance Reviewer 查强制条款
→ Fact Checker 查数字和资质
→ Bid Agent 修订
→ 人工审批
```

---

# 22. Pi Runtime 与 Skills 执行方式

每个 Conversation Actor 使用独立 Pi RPC 子进程：

```bash
pi --mode rpc \
  --no-skills \
  --skill agent-core/shared/skills \
  --skill agent-core/agents/<agent-id>/skills \
  --no-extensions \
  --extension agent-core/runtime/agent-bootstrap.mjs \
  --extension agent-core/runtime/safety-extension.mjs \
  --extension agent-core/runtime/artifact-extension.mjs \
  --session-dir data/agent-runtime/sessions/<agent-id>
```

运行原则：

- 不使用 TUI 和 tmux
- 使用 `RpcClient`
- Skill 显式加载
- Extension 显式加载
- 工具按 Agent Allowlist
- System Prompt 来自 Agent Core
- Session 按 Conversation 隔离
- Agent 空闲后关闭子进程
- Session 文件保留

Agent 数量和进程数量不同：

- 可以有二十个 Agent 定义
- 只启动当前正在使用的 Conversation Actor
- 一个 Agent 可以有多个隔离 Actor

---

# 23. 状态、审计和成本

## 23.1 Agent 状态

`#agent-状态` 展示：

- Agent
- Conversation
- 当前任务
- 状态
- 启动时间
- 已运行时间
- 当前模型
- Token
- 成本
- 当前 Tool
- 等待审批
- 错误

## 23.2 审计事件

记录：

- 收到消息
- 路由结果
- 下载文件
- 启动 Agent
- 调用 Skill
- 调用 Tool
- 写入文件
- 创建审批
- 批准或拒绝
- 外发文件
- 发布内容
- 部署
- 发生错误

## 23.3 成本控制

按以下维度统计：

- Agent
- 客户
- 项目
- Workflow
- Channel
- Model
- 日期
- 任务类型

可以设置：

- 每日 Agent 预算
- 单任务 Token 上限
- 高成本任务审批
- 并发上限
- 超时
- 自动降级模型

---

# 24. 当前项目迁移重点

当前项目已经具备：

- Pi RPC
- Discord Gateway
- 定时任务
- 长期记忆
- Discord 工具
- 图片发送
- 机会发现
- GitHub 监控
- 用量统计
- 按钮交互

需要重构的重点：

1. 当前只有一个长期运行的 `RpcClient`。
2. 当前 `pendingReply` 是全局变量，并发对话会有串线风险。
3. 当前只监听 `#主入口`。
4. 当前没有入站附件处理。
5. 当前没有按 Agent 和 Thread 隔离 Session。
6. 当前 Agent 子进程直接获得 Discord Token。
7. 当前技能发现不是按 Agent 显式隔离。
8. 当前普通长回复会被截断。
9. 当前文件工具实际允许写入整个项目根范围，而不只是描述中的 `data/`。
10. 当前写文件能力可能污染源码目录。
11. 当前不同业务模块逐步堆入 `entry-bot.mjs`，需要抽出深模块。

迁移时不建议一次重写全部现有任务。

推荐：

- 保留现有 scheduler 和 memory 能力
- 新建 AgentManager
- 新路由优先服务新增 Agent Channel
- 旧 `#主入口` 暂时保持兼容
- 稳定后再迁移现有命令

---

# 25. 最终 Agent 清单与建设优先级

## P0：基础核心

- Chief
- FDE
- SEO-GEO
- AgentManager
- Discord Router
- Artifact Gateway
- Approval Center

## P1：企业服务

- Sales
- Solution
- Quote
- Bid
- Contract Ops
- Project Manager
- Delivery QA
- Finance Ops
- Customer Success

## P2：技术和商业增长

- Product Manager
- Product Engineer
- Release Engineer
- Link Commerce
- Growth
- Research

## P3：自媒体

- Media Editor
- WeChat
- Xiaohongshu
- VideoAccount
- Douyin
- X
- ProductHunt

## P4：内部质量 Agent

- Fact Checker
- Cost Estimator
- Document Controller
- Compliance Reviewer
- Technical Reviewer
- QA Reviewer
- Content Repurposer
- Analytics Reviewer

---

# 26. 第一阶段推荐范围

第一阶段不做完整企业运营，而是先验证底层架构。

建议第一阶段只做：

```text
@Chief
@FDE
@SEO-GEO
```

并实现：

- 独立 `agent-core/`
- Agent Manifest
- 显式 Skill 加载
- Agent + Thread 独立 Session
- Role Mention
- Channel 默认路由
- Agent Webhook 身份
- 文件入站
- 文件出站
- 基础审批

第一阶段完成后，再增加：

```text
@Quote
@Bid
@Editor
@X
```

这样可以同时验证：

- 企业服务文档
- 正式审批
- 长文文件
- 自媒体内容
- 多 Agent 协作

---

# 27. 需要最终确认的业务问题

## 架构

1. FDE 的首批目标客户、首批服务范围和交付深度是什么？
2. `@Agent Role + Webhook 身份` 是否满足需求？
3. 是否采用 Thread 作为默认 Session？
4. 是否允许一个 Agent 同时服务多个客户实例？
5. `agent-core/` 是当前项目子目录还是独立私有仓库？

## 企业服务

6. 主要客户类型是什么？
7. 企业服务是标准化产品、定制项目还是两者都有？
8. 当前是否已有报价模板？
9. 当前是否已有合同模板？
10. 是否参与正式招投标？
11. 标书主要是政府、国企、大企业还是商业采购？
12. 报价使用什么币种和税费口径？
13. 是否需要多人审批，还是只有你审批？
14. 是否需要把 CRM 数据接入现有系统？
15. 是否需要开票、回款和应收提醒？

## FDE 与开发

16. 客户项目是否需要按客户严格隔离？
17. Agent 是否允许直接修改代码？
18. Agent 是否允许执行测试？
19. 生产部署是否永远需要审批？
20. 主要技术栈是什么？

## 外链与 SEO/GEO

21. 外链业务属于自有站点、Guest Post、Link Insertion、代理库存还是撮合？
22. 是否已有站点库存和价格表？
23. SEO/GEO 服务主要面向自己的产品还是客户？
24. 主要语言是中文、英文还是双语？
25. 是否需要生成客户 SEO/GEO 月报？

## 自媒体

26. 海外 IP 的名称、目标受众、语言和核心定位是什么？
26a. `Zen Huifer` 是否可作为海外工作名称和 GitHub 展示名的统一身份？
26b. Apple App Store 限制的具体含义是什么？
26c. 海外平台分阶段选型是否确认采用全市场扩展原则？
26d. 海外个人网站是否仅在作为可运行 SaaS 站点时才建设？
26e. 付费投放被永久拒绝，如何规划替代增长路径？
26f. 海外创作者品牌使用哪个名字？接受候选还是需重起？**已定为 `Zenbuild`。**
27. 国内平台的主要主题是什么？
28. X 使用英文、中文还是双语？
29. 第一阶段只生成发布包，还是接入自动发布？
30. Product Hunt 是否已有待发布产品？
31. 每个平台的目标更新频率是多少？
32. 是否允许同一主题跨平台复用？
33. 客户案例是否允许脱敏后用于自媒体？

---

# 28. 最终推荐

推荐把这个项目定位为：

> **一人公司的 Agent Workforce 与企业运营中枢。**

Discord 是你的工作台，Pi RPC 是执行引擎，`agent-core/` 是核心资产，企业运营工作流是业务骨架，长期记忆和 Artifact 是知识与交付沉淀。

不要先追求 Agent 数量。第一优先级是把以下能力做正确：

1. Agent 身份隔离
2. Session 隔离
3. Skills 显式加载
4. 权限隔离
5. 文件收发
6. 审批
7. 业务对象编号
8. 文档版本管理
9. 客户数据隔离
10. 审计和成本

底层稳定后，新增一个 Agent 应当主要是新增：

- 一个 Manifest
- 一组 System 与 Playbook
- 一组 Skills
- 一组模板
- 一组权限
- 一组评测
- 一个 Discord Role 和默认 Channel

而不应该每增加一个 Agent 就重写 Discord Bot 或复制一套 daemon。

这套结构最终可以同时支撑：

- 企业服务销售
- 方案与报价
- 招投标
- 合同运营
- FDE 客户交付
- 软件开发
- 项目管理
- 验收与回款
- SEO 与 GEO
- 外链业务
- 增长营销
- 国内自媒体
- X 内容
- Product Hunt 发布
- 长期知识和经营复盘

---

# 29. 下一步决策顺序

建议下一轮只完成以下五个决定：

1. 确认 FDE 的实际业务定义。
2. 确认 `@Role + Webhook` 还是多个 Discord Bot。
3. 确认 Agent Session 采用 Thread 还是 Channel。
4. 确认 `agent-core/` 的存放方式。
5. 确认第一批 Agent 是 `Chief + FDE + SEO-GEO`，还是需要把 `Quote + Bid` 一起纳入第一批。

完成这五个决定后，再进入目录创建和代码实施阶段。

---

# 30. v1.2 状态

### 名称与品牌

- 国内 IP 锁定为 `杭州 OPC 张三`；
- 海外创作者品牌锁定为 `Zenbuild`（变体 `ZENBUILD`），个人名 `Zen Huifer`。

### 渠道与增长

- 海外平台采全市场扩展原则；
- Reddit 与付费投放永久排除；
- 早期不建设独立个人网站，建站仅接受可运行 SaaS 站点。

### 内容生产

- 公开内容以 HTML 视觉成品为主，含头图、品牌色、版式、组件与版权；
- 8 个内容 Agent：chief / intake / distill / privacy / fact-check / renderer / publisher / qa；
- Discord 按 Category 分层：`总控` 与 `总编` 平级；国内与海外各一个 `总编` Category；每个平台一个 `preview-*` 与一个 `publish-*`；
- 完整 SOP 写在 `agent-core/content/sop.md`。

### Founder Profile

- 五本清华大学出版社图书、GitHub `huifer`、OPENIOTGO、Rust IoT、WellAlly、TanStack Ship 资料已归档至 `profile/`。

### 下一项需确认

- 内部产品名 `Pipe Agent` 与 `Pi Agent` 的关系；
- Apple App Store 限制的具体含义；
- 外链表数据到达时间与字段顺序。
