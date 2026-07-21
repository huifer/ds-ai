# FDE Project 三阶段 SOP

> 适用对象：客户先与你本人沟通，再把 Project 转给 Pi Agent 工作流。  
> 与 `agent-core/enterprise/sop.md` 配合：FDE 主链把单子推进到 PRJ（项目启动）后，进入本 SOP 的三阶段。  
> 对应 Discord 频道：#fde-客户交付 / #项目管理 / #测试与验收 / #客户成功。

---

# 1. 阶段总览

```text
PRJ 已创建（合同 / 项目 / 范围 都已经过 #审批中心）
       ↓
Stage 1 · Project Setup
  ├─ A · 目录规划 + Project Index 元数据
  ├─ B · 资料整理（高密度合集设计）
  └─ C · PRD 草稿（按行业模板、Multi-Agent 运行时检索）
       ↓
Stage 2 · React Demo（coding-agent 自动生成，不手写 HTML）
  ├─ Vite + React + TypeScript + React Router
  ├─ Tailwind v4 + shadcn/ui + TanStack Query
  ├─ MSW / fixtures 提供 mock data
  ├─ 使用 @zenbuild/design 组件库与 token
  └─ Demo Review（客户 + 内部）
       ↓
Stage 3 · 算法预研（可与 Stage 2 并行）
  ├─ 选题与边界
  ├─ 离线数据集或 Mock
  ├─ 笔记 + 代码 + 指标
  └─ 评估 / 决策（继续 / 调整 / 放弃）
       ↓
Stage 4 · 正式研发（不在本 SOP 内，由 main-line R&D 推进）
  ├─ Architecture
  ├─ Coding
  ├─ Testing
  ├─ Release
  └─ Maintenance
```

每个 Stage 都有硬性产出（artifact），未达产出不能进下一阶段。

---

# 2. Stage 1 · Project Setup

## 2.0 Project Index（仅元数据，不含客户敏感内容）

在 `data/business/projects/index.yaml` 维护项目索引：

```yaml
- id: PRJ-2026-0001
  alias: client-alpha
  industry: ai-agent
  line: FDE
  stage: setup | demo | research | build | closed
  repo: PRJ-2026-0001
  channel:
    pm: CH_PROJECT_MGMT
    demo: CH_FDE_DELIVERY
  created_at: 2026-07-19
  owner: huifer
```

敏感内容（合同、报价、客户真名、联系人、账号、密钥）只写进对应 `data/business/accounts/<account-id>/` 目录，不出现在项目索引中。

## 2.1 输入

- 客户与你的对话记录（飞书 / 微信 / 邮件）；
- 早期报价、Discovery 记录、合同附件；
- 客户已有资料（PPT、Word、图片、链接）；
- 你的个人理解和初始提案；
- 行业类型（AI Agent / SaaS / 数据分析 / 跨境电商 / 企业内部工具 / 其他）；
- Multi-Agent 运行时检索（Research Agent + Knowledge Agent）。

## 2.2 步骤

### A. 目录规划

每个 Project 拥有独立目录：

```text
data/business/accounts/<account-id>/
└── projects/
    └── PRJ-2026-0001/
        ├── README.md
        ├── brief/
        │   ├── conversation-raw.md
        │   ├── discovery.md
        │   ├── quote.md
        │   └── contract.md
        ├── knowledge-pack/
        │   ├── kp-01-domain.md
        │   ├── kp-02-users.md
        │   ├── kp-03-integration.md
        │   ├── kp-04-constraints.md
        │   ├── kp-05-risks.md
        │   └── kp-06-similar-products.md
        ├── prd/
        │   ├── prd-v0.1.md
        │   ├── prd-v1.0.md
        │   └── review-log.md
        ├── demo/                    # 软链 / 软引用
        ├── research/
        │   ├── alg-XX-name/
        │   │   ├── proposal.md
        │   │   ├── notebook.md
        │   │   ├── data/
        │   │   ├── code/
        │   │   ├── metrics/
        │   │   └── decision.md
        └── build/                  # 阶段 4 之后
            ├── arch/
            ├── code/
            ├── tests/
            └── release/

data/business/projects/<alias>/
├── README.md
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── public/brand/{logo,og}.svg
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   ├── components/
│   ├── lib/{api,msw}
│   ├── data/fixtures/
│   ├── styles/tailwind.css
│   └── types.ts
├── tests/smoke.test.ts
├── .github/workflows/ci.yml
└── .gitignore
```

> `brief/`：客户原始对话、需求、合同。  
> `knowledge-pack/`：高密度合集。  
> `prd/`：PRD 文档。  
> `demo/`：与 `data/business/projects/<alias>/` 软链或 README 引用。  
> `research/`：算法预研。  
> `build/`：阶段 4 才使用。  
> `data/business/projects/<alias>/`：实际 React 工程。  
> 索引 `data/business/projects/index.yaml`：只存元数据。

### B. 资料整理（高密度合集设计）

按以下顺序产出 6 个 `kp-XX-*.md`：

| 文件 | 关注点 |
|---|---|
| `kp-01-domain.md` | 行业术语、业务模型、监管规则、竞品 |
| `kp-02-users.md` | 用户画像、使用场景、痛点、决策路径 |
| `kp-03-integration.md` | 现存系统、数据源、API、协议、合规 |
| `kp-04-constraints.md` | 性能、安全、隐私、预算、时效、语言 |
| `kp-05-risks.md` | 已知风险、潜在风险、依赖、风险等级 |
| `kp-06-similar-products.md` | 竞品、参考实现、灵感来源 |

`kp-XX-*.md` 要求：

- 高密度：每文件 800 - 3000 字；
- 一手资料 > 二手资料 > 经验；
- 标注证据来源（链接、截图、文档、对话编号）；
- 不允许仅凭印象写。

### C. PRD 草稿（按行业 + Multi-Agent 搜索）

PRD 模板按行业分发：

```text
agent-core/enterprise/templates/prd/
├── ai-agent.md
├── saas.md
├── data-analytics.md
├── cross-border-ecommerce.md
└── internal-tools.md
```

行业目录在 `agent-core/enterprise/industries/<industry>/`：

```text
agent-core/enterprise/industries/<industry>/
├── prd.md
├── demo-case.md
├── api-routes.md
└── design-hints.md
```

`!prd new` 命令行为：

```text
!prd new PRJ-2026-0001 ai-agent client-alpha
  ↓
solution-agent 加载 templates/prd/ai-agent.md + industries/ai-agent/prd.md
  ↓
research-agent 运行时检索（行业现状 / 玩家 / 趋势 / 风险）
  ↓
knowledge-agent 拉取 knowledge-pack
  ↓
solution-agent 拼装 prd-v0.1.md
  ↓
推到 #项目管理 与 #fde-客户交付
```

Multi-Agent 搜索产物在 PRD 中以 `## Runtime Research` 段标注，包含：

- 检索源（如官方报告、GitHub、Crunchbase）；
- 时间戳；
- 摘要与链接；
- 是否影响决策。

完成判定：

- 6 个 knowledge-pack 全部有内容；
- v0.1 PRD 章节完整；
- Runtime Research 段已生成；
- `#项目管理` 发布 `decision` 卡片；
- 客户代表在 Demo 之前对 v0.1 已形成书面或留言确认。

---

# 3. Stage 2 · React Demo

## 3.1 目标

让客户“看清楚我们具体在做些什么”，**不**接后端、**不**接真数据、**不**做部署，但**用真实项目结构**作为可演进底座。Demo 不由 Agent 手写 HTML。Demo 由专用 `coding-agent` 调用 `react-demo` Skill 根据客户基础资料与业务说明自动生成。

## 3.2 技术栈

- Vite
- React 18 + TypeScript
- React Router v6
- Tailwind v4
- shadcn/ui
- TanStack Query
- Zustand（轻状态）
- Zod（mock 校验）
- MSW（接口 mock）
- Vitest（单测骨架）

## 3.3 组件库

所有 Demo / MVP 复用 `agent-core/design/components/`。`coding-agent` 在生成项目时以 `@zenbuild/design` 引用组件与 token，不允许重复实现。组件与行业路由决策详见 `agent-core/enterprise/industries/<industry>/demo-case.md`。

## 3.4 工程模板

模板位于 `agent-core/enterprise/templates/demo-react/`。已包含 routes（dashboard / scenario / chart / settings）、MSW、tokens、shadcn/ui、CI、smoke 测试。

## 3.5 必须包含的页面区

- Hero：标题 + 副标题 + CTA；
- Stats：3-4 个核心指标卡；
- Scenario：2-3 个可点击场景 + mock 响应；
- Chart：mock 图表；
- Boundaries：Demo 范围说明；
- Settings：mock config；
- Contact：联系方式（指向你的 Discord / 飞书）。

## 3.6 流程

1. `coding-agent` 接收 `!demo new`：
   - `read-foundation` 加载 `CONTEXT.md` / 项目索引 / 基础文件；
   - `react-design` 选定路由与风格；
   - `component-library` + `zenbuild-design-tokens` 选用 `@zenbuild/design`；
   - `react-vite` / `react-router` / `tailwind-v4` / `shadcn-ui` / `tanstack-query` / `msw-mock` / `react-testing` 生成骨架；
   - 拷贝 `agent-core/enterprise/templates/demo-react/`，注入行业 `industries/<industry>/demo-case.md`；
   - 写到 `data/business/projects/<alias>/`；
2. `pnpm install` 验证依赖；
3. `pnpm run typecheck` + `pnpm test` 验证 TS 与单测；
4. `pnpm build` 产物；
5. `renderer-agent` 出 PDF + 截图；
6. 推到 `#fde-客户交付`，附 preview 链接；
7. 客户点 Approve / Request Changes；
8. Approve 后 `distill-agent` 把 Demo 截图 / 关键交互 / 客户回复作为内容候选送 `#主快讯`。

## 3.7 完成判定

- 客户在 Discord 中点 Approve；
- `pnpm run dev` 跑通，截图清晰；
- 内部 `prd/review-log.md` 记录 v1.0 与客户答复；
- 模板代码可作为正式研发的起点。

---

# 4. Stage 3 · 算法预研

## 4.1 触发条件

- 项目涉及机器学习、推荐、NLP、检索、调度或复杂启发式；
- 客户在 PRD 中提出“不确定是否可行”的功能；
- 实现成本高，需要先验证可行性。

## 4.2 每个算法的研究流程

```text
proposal.md
  ├─ 背景
  ├─ 目标
  ├─ 输入 / 输出
  ├─ 数据获取
  ├─ 候选方法
  └─ 评估指标
        ↓
notebook.md
  ├─ 方案演进
  ├─ 失败案例
  └─ 关键发现
        ↓
code/
  └─ 最小可复现脚本
        ↓
metrics/
  └─ 指标与可视化
        ↓
decision.md
  ├─ 结论：继续 / 调整 / 放弃
  ├─ 依据
  └─ 升级到 PRD 的建议
```

## 4.3 与公开知识的关系

- 预研笔记不发布，但**算法思路**可作为公开内容；
- `distill-agent` 在 `#主快讯` 推送“预研已得出 X 结论”候选卡；
- 客户数据相关的输入 / 输出 / 指标禁止出现在公开内容中。

---

# 5. Stage 4 · 正式研发主链

正式研发不在 FDE Project 三阶段 SOP 内，使用标准 R&D 主链：

```text
1. Architecture     solution-agent + delivery-agent
2. Coding           delivery-agent + engineer-agent
3. Unit Test        qa-agent
4. Integration Test qa-agent
5. Release          delivery-agent + qa-agent
6. Deployment       delivery-agent
7. Maintenance      delivery-agent + cs-agent
```

每个阶段产出写入 `build/`，交付物版本号与 PRD 版本号一一对应。模板与 Stage 2 共享，删去 MSW 接入真后端。

---

# 6. 与 Discord 的具体契约

```text
#项目管理      !pr new <alias> <industry> <一句话需求>     # 自动建 PRJ 与目录、生成 v0.1 草稿
#项目管理      !prd v0.1 | !prd v1.0 | !prd diff
#项目管理      !research new <alg-name> | !research update
#项目管理      !build stage set <stage>
#项目管理      !pr list

#fde-客户交付  !demo new <PRJ-ID> | !demo approve | !demo request-changes
#fde-客户交付  !demo run <PRJ-ID>     # 启动 vite dev 容器或本地预览

#客户成功      !cs document <PRJ-ID>     → 把脱敏后经验推 #主快讯
```

按钮组（`#fde-客户交付` 通用）：

```text
[Approve Demo] [Request Changes] [Open Live Preview] [Download Build]
[Send to Engineering] [Send to Knowledge Base]
```

按钮组（`#项目管理` 通用）：

```text
[Approve Stage] [Request Changes] [Move to Next Stage] [Block]
```

---

# 7. Agent 与角色

| Agent | 责任 |
|---|---|
| `pm-agent` | Project Index、SOP 门禁、版本号、变更控制 |
| `solution-agent` | brief 整理、knowledge-pack、PRD v0.1、行业模板填充 |
| `research-agent` | 运行时多源搜索（行业 / 玩家 / 趋势 / 风险） |
| `knowledge-agent` | knowledge-pack 增广与一致性检查 |
| `coding-agent` | Demo / MVP / 内部工具的代码生成（加载 react-design / component-library / zenbuild-design-tokens 等 Skill） |
| `renderer-agent` | Demo 套版 + 截图 + PDF |
| `distill-agent` | 把 Demo、预研、交付转公开内容候选 |
| `delivery-agent` | 阶段 4 之后才接手 |
| `qa-agent` | 阶段 4 之后才接手 |
| `cs-agent` | 把交付转脱敏后资产 |
| `chief-agent` | 阶段门禁审批 |

Agent 互不通讯，统一在 `#项目管理` / `#fde-客户交付` / `#主快讯` 接受按钮。

---

# 8. 完成判定的统一规则

- Stage 1 完成：`kp-XX-*.md` 全在；`prd-v0.1.md` 在；`#项目管理` 标记 `stage=setup_done`；
- Stage 2 完成：客户 Approve；`prd-v1.0.md` 在；`pnpm run dev` 跑通；
- Stage 3 完成：`research/alg-XX-name/decision.md` 在；PRD 已写明是否采纳；
- Stage 4 完成：`build/release/RELEASE.md` 在；客户签收。

---

# 9. 模板与文件

```text
agent-core/enterprise/templates/
├── prd/
│   ├── ai-agent.md
│   ├── saas.md
│   ├── data-analytics.md
│   ├── cross-border-ecommerce.md
│   └── internal-tools.md
├── demo-react/                     # Vite + React + TS + Tailwind v4 + shadcn/ui + MSW
├── knowledge-pack.md
├── research-notebook.md
├── rd-stage-checklist.md
└── demo-review-log.md

agent-core/enterprise/industries/
├── ai-agent/
├── saas/
├── data-analytics/
├── cross-border-ecommerce/
├── internal-tools/
└── generic/

agent-core/design/
├── README.md
├── tokens.css
└── components/                    # Zenbuild 组件库
    ├── button/  card/  table/  form/  modal/
    ├── chart/  hero/   nav/    breadcrumb/
    └── toast/  tooltip/ table-of-contents/

agent-core/agents/coding/            # coding-agent
├── agent.yaml
├── SKILL.md
├── react-demo.skill.md
└── skills/
    ├── read-foundation.skill.md
    ├── react-design.skill.md
    ├── component-library.skill.md
    ├── react-vite.skill.md
    ├── react-router.skill.md
    ├── tailwind-v4.skill.md
    ├── shadcn-ui.skill.md
    ├── tanstack-query.skill.md
    ├── msw-mock.skill.md
    ├── react-testing.skill.md
    ├── zenbuild-design-tokens.skill.md
    ├── pnpm-install.skill.md
    ├── codespace-build.skill.md
    └── zip-folder.skill.md
```

`html-demo-template.html` 已被 `demo-react/` 取代，不再生成新 HTML 模板。

> Project 索引 `data/business/projects/index.yaml` 只存元数据（PRJ-ID / 客户化名 / 行业 / 业务线 / 状态 / 阶段 / 仓库 / Discord 频道 / 创建时间等）。客户全名、合同、报价、联系人、账号、密钥仅写进对应 `accounts/<account-id>/` 下。

> Project 本地工程位于 `data/business/projects/<alias>/`；敏感文件（brief / prd / 合同 / 联系人）位于 `data/business/accounts/<account-id>/projects/<PRJ-ID>/`。两边通过 `prj_id` 关联。

---

# 10. 与现有系统的连接

| 已有 | 改造方式 |
|---|---|
| `src/entry-bot.mjs` | 注册 `!pr new` / `!demo` / `!coding` 等命令 |
| `extensions/discord-tools.mjs` | 新增 `discord_post_demo_card` / `discord_post_prd` / `discord_post_kanban` |
| `extensions/file-tools.mjs` | 新增 `write_kp` / `write_prd` / `write_demo` |
| `data/business/` | 新增 `projects/index.yaml` 与 `accounts/<id>/projects/<PRJ-ID>/` |
| `agent-core/enterprise/sop.md` | 在主链 “交付” 阶段指向本 SOP |

---

# 11. 下一项需要你确认的两件事

1. 行业 PRD 模板首批交付的优先级（当前已先产 AI Agent / SaaS / 数据分析 / 跨境电商 / 企业内部工具 五个；如优先顺序不同请说明）。
2. `coding-agent` 是否同时负责内部工具的代码生成（如审批系统 / 客户支持后台），还是只限于 Demo 与 MVP？
