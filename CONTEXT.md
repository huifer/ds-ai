# Agent Workforce Business Context

本语境定义“杭州 OPC 张三”一人公司的业务、品牌与 Agent Workforce 所使用的统一语言。

## Business Model

**FDE Service（FDE 企业服务）**:
以 Forward Deployed Engineer 模式深入客户业务现场，从需求发现、AI 方案设计和 POC 延伸到软件开发、系统集成、部署、交付与持续支持。
_Avoid_: 普通外包、单纯驻场

**AI Development Service（AI 开发服务）**:
面向企业客户交付 AI 应用、AI Agent、自动化工作流和相关软件系统的专业服务。
_Avoid_: 纯咨询、通用软件外包

**SaaS Product（自有 SaaS 产品）**:
由公司自主设计和开发，并通过订阅、授权、一次性转让或其他待确定商业模式经营的软件工具。
_Avoid_: 客户定制项目

**Startup Stage（业务启动期）**:
公司尚未形成稳定主营业务和持续客户管道，但已积累 SEO、SaaS 外链和 Marketing 案例及外链库存；当前重点是把已有证明材料资产化，并验证可复制的服务、产品和渠道。
_Avoid_: 零经验阶段、成熟业务期

**FDE Knowledge Asset（FDE 知识资产）**:
在客户需求发现、POC、实施、培训和上线支持中形成，经脱敏、验证和结构化后可复用于交付、培训、产品和公开内容的知识。
_Avoid_: 未经处理的客户原始资料

**Enterprise Service Workflow（企业服务主链）**:
从销售线索到知识回流的完整业务链：销售线索 → 需求发现 → 解决方案 → 估算报价 → 提案谈判 → 招投标 → 合同 → 项目启动 → 交付 → 验收 → 开票回款 → 客户成功 → 续费增购 → 知识回流。业务 Agent 集合为 sales / solution / cost / quote / bid / contract / pm / delivery / qa / cs / finance。
_Avoid_: 脱开 `#审批中心` 直接外发报价、合同与发布

**FDE Project Pipeline（FDE 项目三阶段）**:
Project 启动后固定三阶段：① Project Setup（目录 + Project Index + 资料整理 → 高密度 knowledge-pack → PRD v0.1，PRD 按行业模板、Multi-Agent 运行时检索）；② React Demo（Vite + React + TS + Router + Tailwind v4 + shadcn/ui + TanStack Query + MSW）；③ 算法预研（独立小任务、可被研发复用）。Stage 4 进入标准 R&D 主链。
_Avoid_: 在 Demo 阶段接入真实后端、跳过 knowledge-pack 直接写 PRD、跨行业复用空白 PRD

**Industry-specific PRD（行业专用 PRD）**:
PRD 模板不再只做一份，按行业细分：AI Agent、SaaS、数据分析、跨境电商、企业内部工具等。Multi-Agent 在运行时以 Research Agent + Knowledge Agent 对行业现状、玩家、趋势进行检索后填充到 PRD。
_Avoid_: 跨行业复用同一份空白 PRD 模板

**React-based FDE Demo（React 业务原型）**:
FDE Demo 统一使用 React 项目模板（Vite + TS + React Router + Tailwind v4 + shadcn/ui + TanStack Query + MSW），与正式交付同源。Demo 不由 Agent 手写 HTML。Demo 由专用 `coding-agent` 调用 `react-demo` Skill 根据客户基础资料与业务说明自动生成。
_Avoid_: 交付前临时从 HTML 转换到 React、Agent 手写 HTML Demo

**Coding Agent（代码生成 Agent）**:
`coding-agent` 是负责产生 React Demo / MVP / 内部工具的专属 Agent，加载 `react-design`、`component-library`、`react-vite`、`react-router`、`tailwind-v4`、`shadcn-ui`、`react-testing` 等 Skill。`!demo new` / `!demo refactor` / `!mvp new` 命令直接路由到该 Agent。
_Avoid_: 让 distill / renderer / content 三个 Agent 兼扮代码生成角色

**Component Library（组件库）**:
所有 React Demo / MVP 复用 `agent-core/design/components/`。每个组件包含 variant、状态、主题、props 类型、Storybook 故事。设计 token 集中在 `agent-core/design/tokens.css`。
_Avoid_: 各 Demo 重复实现同一组件、不同 Demo 使用不同色值与风格

**Industry Catalogue（行业目录）**:
可扩展行业目录位于 `agent-core/enterprise/industries/`。每个行业包含 `prd-template.md` 与 `demo-case.md`。新增行业只需新增一个子目录，不需修改其它部分。
_Avoid_: 把行业逻辑写在 `solution-agent` 内

**Project Index（项目索引）**:
Project 索引位于 `data/business/projects/index.yaml`，只记录 PRJ-ID / 客户化名 / 行业 / 业务线 / 状态 / 阶段 / 仓库 / Discord 频道 / 创建时间等元数据，不写客户名、合同、报价、联系人、账号、密钥等敏感内容。客户全名、合同、报价、联系人等仅写进对应 `accounts/<account-id>/` 下。
_Avoid_: 在索引目录中写入客户全名 / 合同 / 联系方式 / 凭据

**Backlink Inventory（外链库存）**:
内部维护、供应关系和交易条件可核验，并可用于销售或 SEO 交付的链接资源记录集合。明细表尚未导入前，不对数量、价格和质量作推断。
_Avoid_: 未核验网址列表

**Daily Work Content Anchor（每日工作内容锚点）**:
把当天真实工作任务、与 AI 的对话、代码、决策、失败和产物经过隐私过滤与事实核验后，蒸馏为第二天可审核的自媒体内容候选。
_Avoid_: 直接发布原始聊天记录、凭空生成选题

**Founder Evidence Library（创始人证据库）**:
保存出版物、公开代码、官方项目页、媒体报道、产品案例和本人证明材料，并为每项对外陈述标记证据等级的本地事实库。
_Avoid_: 未注明来源的个人简介

**Content Visual Standard（内容视觉标准）**:
任何公开内容都以 HTML 设计为成品，附带头图、品牌色、版式、组件与版权，输出 PDF + 渲染长图。Discord 嵌入层不允许只贴纯文本、Markdown 或裸截图。
_Avoid_: 无头图、无品牌色、无版式、无组件、无版权信息的“干巴巴”输出

**Editor-in-Chief Role（总编角色）**:
总编是公司级主编岗位，在 Discord 架构上必须以独立 Category 出现，名称为 `总编室`。总编与 `总控` 平级，不隶属于任何业务 Category。海外与国内各有一个总编 Category：`国内总编` 与 `海外总编（Zenbuild）`。总编下子频道按平台分（公众号 / 小红书 / 视频号 / 抖音 / X / Newsletter / YouTube / LinkedIn / Product Hunt），不再设“总编室”子频道，子 Agent 候选卡均推到总编 Category 的“主快讯”频道。总编按钮通过后，稿件才进入对应 `preview-*`。
_Avoid_: 把 `总编室` 当作总控下的一个频道；把总编与子平台频道混在同一 Category

## Brand

**Domestic Personal Brand（国内个人 IP）**:
“杭州 OPC 张三”，是微信公众号、小红书、视频号、抖音及其他国内公开内容的统一主体身份。本人已确认该写法是唯一对外用法。
_Avoid_: “杭州 OPC 33”及其译写法、杭州 OPC 之外的其他国内品牌名称

**Overseas Indie Developer Brand（海外独立开发者 IP）**:
与“杭州 OPC 张三”完全分开的纯英文独立开发者身份，面向海外 Indie Developer、Solo Founder 和 SaaS 市场，不发布中文内容，也不使用 Reddit。早期不建设独立个人网站；若必须建站，仅接受以可运行 SaaS 产品站点形式呈现，单独信息站不可接受。永远不参与付费投放。名称已定：个人名 `Zen Huifer`，创作者品牌 `Zenbuild`（同样接受 `ZENBUILD` 写法）。所有海外公开资产、渠道、Newsletter、Repository、Handle 都使用 `Zenbuild`。
_Avoid_: 纯意造词（Ship Wizard、Quantum Forge 等）、国内 IP 的英文翻译、Reddit 运营、纯信息站、付费广告
