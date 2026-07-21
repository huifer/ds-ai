# 内容生产 + 展示一体化 SOP

> 适用于：Discord 平台 + Pi Agent 多智能体协作 + Markdown 视觉成品
> 国内 IP：`杭州 OPC 张三`
> 海外 IP：`Zenbuild`（变体 `ZENBUILD`）
> 永久排除：Reddit、纯信息个人站、付费投放
> 架构关键点：`总编` 与 `总控` 平级，都是顶级 Category。`总编室` 不再是总控下的子频道。
>
> **输出格式**：统一 Markdown（.md），除非平台本身需要图片（如小红书）。

---

# 1. 总体目标

```text
Pi Agent 多智能体
   ↓
每日真实工作 + AI 对话 → 蒸馏内容候选 → 多平台渲染 Markdown
   ↓
Discord Category 分层（总编 与 总控 平级）展示 → 主编按钮审批
   ↓
通过/打回 → 推送外平台 → 数据回收
```

不依赖独立个人站，不做付费投放，所有内容 Markdown 化，Discord 是唯一日常操作面板。

---

# 2. Discord Category 拓扑

>  Category 0n 为管理类 Category，0n - 9n 为业务/输出类 Category。`总编` 与 `总控` 各自为顶级 Category。

```text
Category 00 · 总控
├── #总控台
├── #深度讨论
├── #审批中心
└── #agent-状态

Category 10 · 企业服务
└── 已有频道保留

Category 20 · 技术产品
└── 已有频道保留

Category 30 · 增长商业
└── 已有频道保留

Category 40 · 国内总编（杭州 OPC 张三）
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

Category 50 · 海外总编（Zenbuild）
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

Category 60 · 资产中心
└── 已有频道保留
```

说明：

- `#主快讯` / `#main-feed` 接收子 Agent 候选卡与按钮交互；
- `preview-*` 接收 HTML 渲染成品 + PDF + 截图；
- `publish-*` 接收外平台发布回执与状态；
- `#今日素材` / `#raw-materials` 保留为原始流，不发长文。

---

# 3. Multi-Agent 聚合架构

## 3.1 主编视角

`#主快讯` 与 `#main-feed` 是主编视角，不做长文输出，只聚合子 Agent 的“候选卡 + 渲染附件 + 数据”。所有子 Agent 各自独立 Session，互不依赖。

## 3.2 Agent 角色

| Agent | 责任 | Session Scope | 通知频道 |
|---|---|---|---|
| `chief-agent` | 战略、决策、协调多 Agent | persistent | `#总控` |
| `intake-agent` | 每日 23:50 拉取工作、对话、产物 | daily | `#今日素材` / `#raw-materials` |
| `distill-agent` | 蒸馏为内容候选、打分、生成 brief | daily | `#主快讯` / `#main-feed` |
| `renderer-agent` | 渲染各平台 HTML + PDF + 截图 | per artifact | `#preview-*` |
| `publisher-agent` | 推送外平台与本地草稿 | per publish | `#publish-*` |
| `qa-agent` | 数据回收与复盘 | daily | `#主快讯` / `#main-feed` |
| `privacy-agent` | 隐私脱敏与 Secret 检测 | per artifact | 内部 |
| `fact-check-agent` | 事实校验与证据绑定 | per artifact | 内部 |

## 3.3 Agent 协作契约

子 Agent 通过统一 RPC 给主编发“候选卡”：

```yaml
type: editor_card
id: CNT-2026-0001
producer: distill-agent
score: 33
title: ...
evidence: [source-evidence-id]
drafts:
  - wechat_html
  - xiaohongshu_png_3x3
  - x_thread
  - producthunt_assets
  - newsletter_html
buttons: [approve, edit, defer, reject]
```

子 Agent 互不通讯。`chief-agent` 负责在出现冲突或优先级时介入。

## 3.4 主编决策流

```text
intake 拉取
 → distill 蒸馏
 → privacy 脱敏
 → fact-check 校验
 → renderer 多平台渲染
 → distill 汇总
 → 推 #主快讯 / #main-feed
 → 主编按钮
 → 批准 → publisher-agent
 → 打回 → 修订（回到 distill）
 → 拒绝 → 仅入知识库
 → 延期 → 候选池
```

## 3.5 Session 隔离规则

- 同一 Agent 跨日使用独立 Session 目录；
- 同一 Agent 不同任务使用独立 Session 目录；
- 子 Agent 之间不共享 Memory；
- 主编可读取所有子 Agent 的公开产物。

## 3.6 失败重试

子 Agent 在 Discord 推送失败时，5 分钟后重试 1 次；仍失败则转告 `chief-agent`，由主编裁决。不得静默丢失。

---

# 4. Discord 频道使用规则

- `preview-*` 频道只放同一平台的稿件，避免混杂；
- `publish-*` 频道只放同一平台的发布后数据；
- 总编的 `#主快讯` / `#main-feed` 只放“候选卡 + 摘要”，不直接放长文；
- 主编在总编频道按钮通过后，稿件才进入对应 `preview-*` 频道；
- 海外频道由 `#main-feed` 主编聚合，不与国内稿件混用。

## 4.1 Discord 嵌入展示限制

Discord 不直接渲染网页，因此每个 `preview-*` 频道推送：

- PDF 附件（最稳定）；
- PNG 长图（适用于手机预览）；
- `embed` 标题 + 关键摘要（不超过 4096 字符）；
- 按钮组（Approve / Edit / Defer / Reject / Send）。

## 4.2 频道命名规则

- 总编类 Category 优先使用中文（`国内总编` / `海外总编`），避免与业务 Category 混名；
- 子频道全部使用 kebab-case；
- 暂不创建 voice 频道。

---

# 4. 内容视觉标准

## 4.1 必须的 HTML 元素

每个内容产物必须包含：

- 头图（1200×630 像素用于文章/Newsletter，9 宫格用于小红书）；
- 品牌主色 + 副色 + 背景色 + 文本色；
- 标题 / 副标题 / 导语 / 主体 / 结论五段结构；
- 数据卡（如果有数据）；
- 关键证据卡（指向 commit / URL / 截图）；
- 行动按钮区（公众号阅读原文 / Newsletter 订阅 / X 关注）；
- 页脚版权：`杭州 OPC 张三 · 2026` 或 `Zenbuild · 2026`。

## 4.2 禁止

- 无头图直接发正文；
- 仅 Markdown 直接发 Discord；
- 仅截图；
- 无版权、无来源、无品牌色。

## 4.3 头图设计

| 用途 | 尺寸 | 主元素 |
|---|---|---|
| 公众号封面 | 900×383 | 大标题 + 1 张主图 + 1 句副文 |
| 小红书封面 | 1080×1440 | 大字 6-12 字 + 主图 + 小字小标签 |
| 视频号封面 | 1080×1260 | 大字 + 1 句钩子 |
| 抖音封面 | 1080×1920 | 大字 4-6 字 + 反差色 |
| X Header | 1500×500 | 1 句宣言 + 4-5 个产品截图 |
| YouTube 缩略图 | 1280×720 | 大字 + 主图 + 1 句反问 |
| Newsletter 头图 | 1200×400 | 标题 + 期号 + 1 句副文 |
| Product Hunt 缩略图 | 240×240 | Logo 主导 |

## 4.4 视觉技术栈

- 设计：HTML 内联样式 + React + Tailwind v4 + `prose`；
- PDF：服务端 `puppeteer` 或 `playwright` 渲染；
- 截图：`playwright` 滚动全页截图；
- 字体：中文 Noto Sans CJK SC + Noto Serif CJK SC；英文 Inter + Lora；
- 颜色：参考 `CONTEXT.md` Brand Visual。

## 4.5 颜色、字体与组件

- 颜色集中于 `agent-core/design/tokens.css`；
- 字体集中于 `agent-core/design/fonts.css`；
- 通用组件集中于 `agent-core/design/components/`：
  - 头图 `Hero.astro` / `Hero.tsx`；
  - 数据卡 `StatCard`；
  - 证据卡 `EvidenceCard`；
  - 行动按钮 `ActionBar`；
  - 版权 `Footer`。

---

# 5. 每日 SOP

## 5.1 23:50 intake

`intake-agent` 拉取：

- GitHub commits（huifer、SourceHot、doocs、iot-ecology、tanstackship、tanstackship-pro、safeindie）；
- Pi Agent Session JSONL；
- `daily-summary` 任务结果；
- `memory-journal` 增量；
- Discord `#主入口` 摘要；
- 飞书相关讨论（待接入后启用）。

输出到 `data/agent-runtime/intake/YYYY-MM-DD/`，并推送 `今日素材`。

## 5.2 00:00 / 09:00 / 18:00 distill

`distill-agent` 在每个时间槽执行三道工序：

### A. 隐私脱敏

`privacy-agent` 同步执行：

- 删除手机号、邮箱、Token、API Key；
- 客户名替换 `Client A/B/...`；
- 内部路径替换 `<internal-path>`；
- 删除未授权截图。

### B. 候选评分

8 维评分 0-5：

| 维度 | 含义 |
|---|---|
| 真实性 | 来自真实工作 |
| 证据 | 有 commit/截图/数据/URL |
| 受众价值 | 读者能学/能用 |
| 新颖性 | 不是常识 |
| 品牌一致 | 符合 OPC/Zenbuild |
| 可传播 | 冲突/数字/方法/故事 |
| 可复用 | 可转长文/短帖/视频 |
| 保密安全 | 风险越低分越高 |

`>= 32` 进入次日内审；`24-31` 入池；`< 24` 留作知识。

### C. 内容包生成

```text
content-library/daily/YYYY-MM-DD/
├── source-events.md
├── evidence.md
├── redacted.md
├── candidates.yaml
├── selected-brief.md
├── drafts/
│   ├── wechat.html
│   ├── wechat.pdf
│   ├── wechat.png
│   ├── xiaohongshu-cover.png
│   ├── xiaohongshu-grid.png
│   ├── video-account-script.md
│   ├── video-account-cover.png
│   ├── douyin-script.md
│   ├── douyin-cover.png
│   ├── x-thread.md
│   ├── producthunt.md
│   ├── newsletter.html
│   ├── newsletter.pdf
│   └── youtube-script.md
├── approval.json
└── publish-record.json
```

## 5.3 00:10 / 09:10 / 18:10 总编聚合

`distill-agent` 推 `总编室`：

```text
embed title: 2026-07-19 内容候选 · 3 条
embed fields:
  - name: 1. 修复多 Agent 串线
    value: 推荐 · 33 分 · 真实工作 · 证据强
  - name: 2. 给客户做的飞书 POC
    value: 推荐 · 28 分 · 需脱敏 · 视频号适配
  - name: 3. 改造 OpenRouter 鉴权
    value: 保留 · 22 分 · 入池
buttons:
  [Approve All]  [Open Cards]  [Skip Today]
```

## 5.4 审批通过

`renderer-agent` 立即渲染：

- 微信公众号：HTML + PDF + 渲染长图 → `#预览-公众号`；
- 小红书：9 宫格 + 标题变体 → `#预览-小红书`；
- 视频号：脚本 + 封面 + 字幕 → `#预览-视频号`；
- 抖音：脚本 + 封面 + hook 变体 → `#预览-抖音`；
- X：英文短帖 + Thread + 卡片图 → `#preview-x`；
- Product Hunt：Tagline + Description + Maker Comment → `#preview-producthunt`；
- Newsletter：HTML 邮件 → `#preview-newsletter`；
- YouTube：长文脚本 + 缩略图 → `#preview-youtube`；
- LinkedIn：专业版本 → `#preview-linkedin`。

`overseas-editor` 也同步推一份英文聚合候选卡，海外稿件统一经 `overseas-editor` 进入 `preview-*`。

## 5.5 主编在 preview 频道点击 Send

- 按钮：`Send to Publish`
- 触发 `publisher-agent` 推送外平台与本地草稿；
- 同步写入 `publish-record.json`；
- 稿件流到 `publish-*` 频道，附上外平台回执 URL。

## 5.6 22:00 数据回收

`qa-agent` 抓取每个 `publish-*` 频道的昨日数据，写 `metrics.json`，输出到 `#主快讯` 与 `#main-feed`。

---

# 6. 内容审批门槛

## 6.1 最低门槛

每个候选必须满足：

- 真实工作来源；
- 至少 1 项公开证据；
- 隐私脱敏通过；
- 8 维评分 ≥ 24；
- 至少 1 个适配平台明确；
- 至少 1 张头图就绪。

## 6.2 必做脱敏

- 客户名 / 公司名 / URL / 路径 / 邮箱 / 电话；
- API Key、Token、Webhook；
- 未公开截图；
- 未经客户授权的对话；
- 未经本人授权的收入数字。

## 6.3 不允许的表述

- 没有数据来源的“快进”叙事；
- 模仿或洗稿；
- 攻击其他开发者与产品；
- “某大佬都在用”这类证据不足的拉踩式背书。

---

# 7. 最低质量标准

每个发布物必须回答：

1. 真实发生了什么？
2. 为什么值得别人看？
3. 事实 vs 观点边界？
4. 证据在哪？
5. 隐私和 Secret 是否泄露？
6. 是否符合平台风格？
7. 是否为该平台独立创作？
8. 是否有明确结论或行动建议？

并通过硬质量：

- 错别字 0；
- 链接全部可访问；
- 图片有 alt；
- 关键数据有来源；
- HTML 在主流手机渲染无溢出；
- X 短帖符合平台长度；
- 视频脚本符合平台时长；
- Newsletter 在 Gmail / Outlook / Apple Mail 渲染无错位。

---

# 8. 视觉与渲染流水线

```text
drafts/wechat.md
   ↓
agent-core/design/components/Hero
   ↓
react + tailwind (vite / next)
   ↓
SSR / build / 静态导出
   ↓
puppeteer render → PDF
   ↓
playwright screenshot → PNG
   ↓
Discord upload (PDF + PNG)
```

对应 `renderer-agent` 内的命令：

```text
render platform=wechat id=CNT-2026-0001
render platform=newsletter id=CNT-2026-0001
render platform=x id=CNT-2026-0001
```

---

# 9. 定时任务

| 时间 | Agent | 动作 |
|---|---|---|
| 23:50 | intake-agent | 拉取每日素材 |
| 00:00 / 09:00 / 18:00 | distill-agent | 蒸馏评分生成候选 |
| 00:10 / 09:10 / 18:10 | distill-agent | 推送总编室 |
| 按需 | renderer-agent | 渲染预览 |
| 按需 | publisher-agent | 推送外平台 |
| 22:00 | qa-agent | 数据回收 |
| 23:30 | memory-distill | 长期记忆蒸馏 |
| 23:00 | daily-summary | 每日总结 |

---

# 10. 与现有系统的连接

| 已存在 | 改造方式 |
|---|---|
| `src/entry-bot.mjs` | 抽出 AgentManager 负责按 Agent 路由；内容 Agent 走同一套 Session |
| `src/scheduler.mjs` | 接入 `intake / distill / renderer / publisher / qa` |
| `src/memory-*.mjs` | 蒸馏阶段共享 Memory Journal，但不污染内容 |
| `src/jobs/*.mjs` | 内容相关任务改名 `content-*` 并迁移到 `src/jobs/content/` |
| `extensions/discord-tools.mjs` | 增加 `discord_post_html` 与 `discord_post_render` 工具 |
| `extensions/file-tools.mjs` | 增加 `write_html` / `write_pdf` |
| `extensions/discover-tools.mjs` | 不变，仅在 `intake-agent` 触发时使用 |

---

# 11. 第一阶段栏目

## 11.1 杭州 OPC 张三 国内栏目

| 栏目 | 来源 | 主要平台 |
|---|---|---|
| 一日工作 | 每日 | 小红书、抖音 |
| 一周复盘 | 周末 | 微信公众号、视频号 |
| 一次企业 POC | 客户脱敏 | 微信公众号、视频号 |
| 一段源码 | 图书 | 微信公众号 |
| 一个开源 | Rust IoT / WellAlly | 知乎、视频号 |
| 一场对话 | 与 AI 工作对话 | 视频号、小红书 |

## 11.2 Zenbuild 海外栏目

| 栏目 | 来源 | 主要平台 |
|---|---|---|
| Daily Build | 每日 | X |
| Weekly Note | 周末 | Newsletter、Dev.to、Hashnode |
| One Fix | Bug 修复 | X、YouTube Shorts |
| One Lesson | 失败与决策 | Indie Hackers、LinkedIn |
| Open Source Drop | 开源更新 | X、GitHub、YouTube |
| Product Story | 产品 | Product Hunt、YouTube |

---

# 12. Discord 命令契约

```text
channel: #主快讯
!intake now
!distill now
!render platform=wechat id=CNT-2026-0001
!publish platform=wechat id=CNT-2026-0001
!qa last 7d
!brief id=CNT-2026-0001
!approve id=CNT-2026-0001
!reject id=CNT-2026-0001
!defer id=CNT-2021-0001

channel: #main-feed
!intake now
!distill now
!render platform=x id=CNT-2026-0001
!publish platform=x id=CNT-2026-0001
```

按钮组（所有 preview / publish 频道通用）：

```text
[Approve] [Edit] [Defer] [Reject]
[Open in Discord Preview] [Download] [Send to Publish]
```

---

# 13. 文件与目录落地

```text
agent-core/
├── content/
│   ├── sop.md
│   ├── intake/                      YYYY-MM-DD 拉取数据
│   ├── drafts/                      YYYY-MM-DD 草稿与渲染
│   ├── library/                     CNT-2026-0001 内容库
│   ├── daily/                       YYYY-MM-DD 候选
│   └── templates/                   模板与组件
├── design/
│   ├── tokens.css
│   ├── fonts.css
│   └── components/                  Hero, StatCard, EvidenceCard, ActionBar, Footer
├── agents/
│   ├── chief/
│   ├── intake/
│   ├── distill/
│   ├── renderer/
│   ├── publisher/
│   ├── qa/
│   ├── privacy/
│   └── fact-check/
├── skills/
│   ├── daily-intake
│   ├── privacy-redact
│   ├── fact-check
│   ├── brand-voice-zh
│   ├── brand-voice-en
│   ├── platform-wechat
│   ├── platform-xiaohongshu
│   ├── platform-video-account
│   ├── platform-douyin
│   ├── platform-x
│   ├── platform-producthunt
│   ├── platform-newsletter
│   ├── platform-youtube
│   ├── platform-linkedin
│   ├── channel-renderer-html
│   ├── channel-renderer-react
│   └── channel-renderer-video
```

---

# 14. 下一项需要你确认的三件事

1. 国内总编 Category 与海外总编 Category 的中英文名是否需要统一为 `国内总编` / `海外总编（Zenbuild）`？
2. 8 个 Agent（intake / distill / renderer / publisher / qa / privacy / fact-check / chief）你是否确认？或者希望合并到 5-6 个？
3. 内容审批准入门槛 8 维评分 ≥ 32 推荐、≥ 24 入池。是否需要按平台差异化（如视频号 ≥ 30 即可、X ≥ 26 即可）？
