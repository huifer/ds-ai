// ~/pi-discord-agents/scripts/generate-missing-skills.mjs
// 批量生成缺失的 skill 文件
// 基于 agent 的 description 和 skill 名称,生成合理的工作指令

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const missing = JSON.parse(readFileSync('/tmp/missing-skills.json', 'utf8'));

const SKILL_TEMPLATES = {
  // Chief
  'approval-handle': `# Approval Handle（审批处理）

触发: \`!approve <id>\` / \`!reject <id>\` / \`!defer <id>\` / 按钮回调

## 1. 校验权限
检查 userId 是否在 ALLOWED_USER_IDS 白名单,或拥有对应 approval 的决策权。

## 2. 读取审批项
从 data/approval/<id>.json 读取待审批项,包含:
- producer (哪个 agent 提交)
- objectId (关联的对象,如 rnd=xxx, prj=yyy)
- summary (一句话描述)
- evidence (证据数组)

## 3. 执行决策
根据命令执行:
- approve: 写入 status=approved + decidedAt,调用 producer agent 继续执行
- reject: 写入 status=rejected + reason,通知 producer 取消
- defer: 写入 status=deferred,设置 remindAt(默认 24h 后)

## 4. 落盘
更新 data/approval/<id>.json,在 approval-center 频道发通知卡片。

## 5. 回复用户
\`✅ 已批准 #<id> → <producer> 继续执行\` 或 \`❌ 已拒绝 #<id> → <reason>\``,

  'status-read': `# Status Read（状态读取）

触发: \`!state\` 或 \`!state <agent-id>\`

## 1. 数据源
- AgentManager.getStatus() 返回所有 agent 的运行状态
- data/sessions/ 目录的活跃 session 数
- data/agent-runtime/memory/ 目录的写入量

## 2. 输出格式
\`\`\`
Agent         State    Last Run           Sessions  Errors
sales         idle     2024-01-15 14:23   12        0
pm            running  now                5         0
chief         idle     2024-01-15 13:50   3         1 (timeout)
\`\`\`

## 3. 单 Agent 详情
\`!state sales\` 输出:
- 当前活跃 session 数
- 最近 5 次运行的状态
- Token 累计消耗
- Memory scope 写入量
- 最近一次错误详情`,

  'cost-read': `# Cost Read（成本读取）

触发: \`!cost\`

## 1. 数据源
- data/token-usage/*.md - 每日用量报告
- AgentManager 的 tokenUsage 统计

## 2. 汇总维度
- 按 Agent 汇总(input/output/cache)
- 按时间(今日/本周/本月)
- 按 Skill 汇总

## 3. 输出
\`\`\`
📊 Token 用量报告 (近 14 天)

Agent         Input     Output    Cache R   Total
sales         234,567   45,678    12,345    292,590
pm            123,456   23,456    8,901     155,813
chief         89,012    12,345    5,678     107,035

💰 估算成本 (USD): $12.45
\`\`\``,

  // Intake
  'daily-intake': `# Daily Intake（每日内容采集）

触发: 每日 23:50 cron 自动 / \`!intake now\`

## 1. 数据源
- GitHub: 监听仓库的当天 commits(gh-watch.mjs)
- Pi Session: 今天的 session 文件(sessions/*.jsonl)
- Discord: 今天的活跃频道(过滤 #主入口 / 各业务频道)
- 飞书: 今天的文档更新(可选,需要飞书 token)

## 2. 落盘
写到 data/business/intake/INTAKE-YYYYMMDD.md:
- 各源的摘要(每源 ≤200 字)
- 关键词 / 标签提取
- 候选评分(0-10)
- 备注

## 3. 推送
写入后推送摘要卡片到 #每日素材 频道。

## 4. 后续
- distill agent 会在 00:30 自动处理昨晚的 intake 产物`,

  'github-fetch': `# GitHub Fetch（GitHub 数据抓取）

## 1. 仓库列表
读取 data/gh-watch.json 获取监控仓库列表。

## 2. 抓取当天 commits
对每个仓库:
- git log --since="today 00:00" --until="now"
- 提取: hash, author, message, files changed
- 过滤 merge commits

## 3. 输出
data/business/intake/gh-YYYYMMDD.json:
\`\`\`json
{
  "date": "2024-01-15",
  "commits": [
    {"repo": "xxx", "hash": "abc123", "author": "zhangsan", "message": "fix bug", "files": 3}
  ]
}
\`\`\``,

  'pi-session-fetch': `# Pi Session Fetch（Pi Session 数据抓取）

## 1. 扫描 sessions 目录
读取 sessions/*.jsonl 中今天的 session 文件。

## 2. 提取关键信息
每个 session:
- 会话开始/结束时间
- 用户消息数
- Agent 响应数
- 用到的 skill 列表
- 关键词提取

## 3. 输出
data/business/intake/pi-session-YYYYMMDD.md:
\`\`\`
# Pi Session Summary - 2024-01-15

总 session: 23
活跃用户: 5
主要 skill: lead-capture (8次), react-demo (3次)
\`\`\``,

  'discord-summary': `# Discord Summary（Discord 频道摘要）

## 1. 扫描今天的消息
读取 Discord API(通过 bot token)今天所有业务频道的消息:
- #主入口, #销售线索, #项目管理, #软件开发 等
- 排除 #遐思, #用量, #系统 等被动频道

## 2. 提取关键信息
- 每个频道的活跃度(消息数)
- 高频关键词
- 待办事项(检测 "TODO" / "待办")
- 决策事项(检测 "决定" / "approved")

## 3. 输出
data/business/intake/discord-YYYYMMDD.md: 各频道摘要 + 关键事项列表。

## 4. 隐私
- 默认脱敏客户名(用 [CLIENT-X] 替换)
- 不记录具体消息内容,只记录元数据`,

  // Distill
  'distill-run': `# Distill Run（蒸馏执行）

触发: \`!distill now\` 或每日 00:30 cron 自动

## 1. 读取 intake 产物
从 data/business/intake/INTAKE-YYYYMMDD.md 加载昨晚的采集结果。

## 2. 候选评分
对每个候选按以下维度评分(0-10):
- 时效性: 是否是热点话题
- 品牌相关性: 是否与公司业务相关
- 价值密度: 是否包含可执行的信息
- 可分享性: 读者会觉得有用吗

过滤: score >= 6 的进入 brief 流程。

## 3. 生成 brief
对每个高分候选生成 brief:
- 标题(中文/英文各一)
- 摘要(3 句话以内)
- 标签(3-5 个)
- 目标平台(wechat / x / linkedin 等)
- 推荐发布时间

## 4. 推送
- 国内候选 → #主快讯
- 海外候选 → #main-feed
- 草稿卡片由 distill/distill-brief 生成`,

  'distill-brief': `# Distill Brief（Brief 生成）

触发: \`!brief <mat-id>\`

## 1. 加载候选
从 data/business/materials/<mat-id>.json 读取素材。

## 2. 生成内容 brief
格式:
\`\`\`markdown
# Brief: <标题>

## 摘要
<3 句话摘要>

## 关键点
- <要点 1>
- <要点 2>
- <要点 3>

## 建议平台
- 国内: 公众号, 小红书
- 海外: X, LinkedIn

## 风格建议
- 语气: 专业 / 轻松
- 时长: 中等
- 视觉: 文字为主

## 数据点
- <关键数字 / 引述>
\`\`\`

## 3. 落盘
写到 data/business/briefs/BRIEF-<mat-id>.md

## 4. 推送
推送到 #今日素材 频道等待编辑处理。`,

  'brand-voice-zh': `# Brand Voice 中文（中文品牌声音）

## 1. 风格定义
- 语气: 专业但亲和,避免说教
- 用词: 简洁准确,避免晦涩术语
- 句式: 短句为主,偶尔用长句增加层次
- 情感: 自信但不自大,真诚分享

## 2. 平台差异
- 公众号: 深度长文,结构化,标题党适度
- 小红书: 口语化,emoji 适量,生活方式视角
- 视频号: 简短有力,情感共鸣
- 抖音: 节奏快,前 3 秒抓人

## 3. 禁用词
- "赋能" / "抓手" / "闭环"(除非真的在说技术)
- 过度使用 "!" 和 emoji
- 翻译腔(直译英文表达)

## 4. 必用元素
- 数据点(具体数字比形容词更有说服力)
- 第一人称案例
- 真实客户场景(脱敏后)`,

  'brand-voice-en': `# Brand Voice English (English Brand Voice)

## 1. Style Definition
- Tone: Confident but not arrogant, friendly
- Words: Clear, concise, avoid jargon
- Sentences: Mix of short and medium length
- Voice: Active voice, first-person when appropriate

## 2. Platform Differences
- X/Twitter: Punchy, hook in first 7 words, 1-2 hashtags
- LinkedIn: Professional storytelling, longer form OK
- Product Hunt: Benefit-focused, maker story
- Newsletter: Personal, exclusive insights, curated

## 3. Avoid
- Corporate buzzwords ("synergy", "leverage", "circle back")
- Passive voice overuse
- AI-sounding phrases ("In today's fast-paced world...")

## 4. Include
- Specific numbers / data points
- Real customer examples (anonymized)
- Counter-intuitive takes when applicable`,

  // Renderer
  'platform-render': `# Platform Render（平台渲染）

触发: \`!render <rnd-id> --platform=wechat\` 或 \`!auto-render\`

## 1. 读取 brief + 候选
- data/business/briefs/BRIEF-<id>.md
- data/business/materials/<mat-id>.json

## 2. 选择模板
按平台选择模板:
- wechat: 长文 + 头图
- xhs: 卡片式 + emoji
- x: 短推文 + thread
- linkedin: 长文 + bullets
- youtube: 视频脚本 + 时间轴
- newsletter: email 格式

## 3. 渲染产物
写到 data/business/renders/<rnd-id>/
- html (网页预览)
- png (主图截图)
- meta.json (元数据)

## 4. 推送
按 channel-map.mjs 的逻辑,推到对应 preview 频道:
- 国内 → preview-xxx
- 海外 → preview-yyy

## 5. 等待审批
publisher agent 需要审批(approval-publish-domestic)才能发布。`,

  'html-render': `# HTML Render（HTML 渲染）

## 1. 加载 token
从 agent-core/design/tokens.css 加载设计 token。

## 2. 套用模板
按 brand-voice-* 的风格选择:
- editorial (默认,白底大字)
- card (卡片式,适合社媒)
- minimal (极简,适合 newsletter)

## 3. 渲染
用 Playwright 渲染 HTML → PNG。

## 4. 输出
data/business/renders/<rnd-id>/
- card.html
- card.png
- card-mobile.png(可选)`,

  'react-render': `# React Render（React 渲染）

## 1. 加载模板
使用 agent-core/enterprise/templates/demo-react/。

## 2. 应用 design tokens
import '@zenbuild/design/tokens.css'

## 3. 生成组件
基于 brief 的内容生成 React 组件:
- 标题组件
- 内容卡片
- 数据可视化(用 echarts)
- CTA 按钮

## 4. 输出
data/business/renders/<rnd-id>/
- index.tsx
- components/
- dist/ (构建后)
- preview.html`,

  'video-render': `# Video Render（视频渲染）

## 1. 脚本生成
基于 brief 生成视频脚本:
- 0-3s: hook(抓人)
- 3-10s: 痛点
- 10-25s: 方案
- 25-30s: CTA

## 2. 分镜
每个时间点:
- 画面描述
- 字幕文案
- BGM 建议

## 3. 输出
data/business/renders/<rnd-id>/
- script.md
- storyboard.md
- voiceover.mp3 (TTS 生成)
- subtitles.srt`,

  // Publisher
  'platform-publish': `# Platform Publish（平台发布）

触发: \`!publish <rnd-id> --platform=wechat\` (需审批)

## 1. 读取 render 产物
从 data/business/renders/<rnd-id>/ 加载最终内容。

## 2. 检查审批
调用 approval.check('publish-domestic', {producer, objectId, summary})。
- 已批准 → 继续
- 需要审批 → 返回 NEED_APPROVAL,推到审批中心
- 已拒绝/过期 → 返回对应状态

## 3. 调用平台 API
按平台:
- wechat: 微信公众号 API (草稿箱)
- x: Twitter API v2
- linkedin: LinkedIn API
- 小红书/抖音: 通过内部草稿箱(不直接发布)

## 4. 记录
data/business/published/<pub-id>.json:
- 平台 + URL
- 发布时间
- 数据追踪 ID

## 5. 推送通知
发卡片到 publish-xxx 频道,附链接。`,

  'platform-domestic': `# Platform Domestic（国内平台发布）

## 1. 支持的平台
- 微信公众号
- 小红书
- 视频号
- 抖音

## 2. 实现方式
- 微信/视频号: 公众号 API 草稿箱,人工最终确认
- 小红书: 通过 wechat-helper 工具(自动草稿)
- 抖音: 通过字节开放平台(自动草稿)

## 3. 限制
- 不直接发外网,只入草稿箱
- 需要 approval-publish-domestic 审批
- 客户案例 / 数字 / 合同相关需二次审核`,

  'platform-overseas': `# Platform Overseas（海外平台发布）

## 1. 支持的平台
- X (Twitter)
- Product Hunt
- LinkedIn
- YouTube
- Newsletter (Substack / Beehiiv)

## 2. 实现方式
- X: 直接调用 API 发布(需 OAuth2)
- PH: 提交 maker 资料 + 排期
- LinkedIn: API 发布,工作流审批
- YouTube: 视频上传 + 元数据
- Newsletter: 通过 SMTP / 平台 API

## 3. 限制
- 重要客户案例需 anonymize
- 法务敏感内容需 legal review
- approval-publish-domestic / overseas 都需要`,

  'x-thread': `# X Thread（Twitter 线程）

## 1. 长度限制
- 单条 ≤280 字符
- 线程 ≤25 条
- 第一条必须有 hook(7 字以内抓人)

## 2. 结构
- 1/ 第一条: hook
- 2/ 痛点
- 3-5/ 方案展开
- 6-7/ 数据/案例
- 8/ CTA

## 3. Hashtag
1-2 个,放在最后一条。

## 4. 输出
- thread.md (markdown)
- thread.txt (每条一行)
- meta.json (调度时间)`,

  'newsletter': `# Newsletter（邮件订阅）

## 1. 平台
- Substack
- Beehiiv
- 自建 SMTP

## 2. 格式
- Subject: 30 字以内,有好奇心
- Preview: 50 字以内
- Body: 长文 + 配图 + 1 个 CTA

## 3. 风格
- Personal voice
- 第一人称
- 包含独家洞察

## 4. 发送时间
- 周二 / 周四 早上 9:00(目标用户活跃时间)`,

  // QA
  'qa-report': `# QA Report（QA 报告）

触发: \`!qa last\` 或每日 23:00 自动

## 1. 数据源
- data/business/published/*.json(发布记录)
- 各 publish 平台的实际数据(通过 API 拉)

## 2. 指标
- 阅读量 / 点赞 / 转发 / 评论
- 转化率(到官网 / demo)
- 评论情感分析

## 3. 输出
data/qa/REPORT-YYYYMMDD.md:
\`\`\`
# QA Report - 2024-01-15

## 本周发布
- 公众号 5 篇 (阅读 1.2k, +12% WoW)
- X 8 条 (impression 5.6k, +25% WoW)
- LinkedIn 2 篇 (engagement 4.5%)

## Top 3 表现
1. xxx (阅读 3.2k)
2. yyy (engagement 8.9%)
3. zzz (转化 23)

## 改进建议
- 视频号时长偏短,建议 60s+
- 公众号标题过于平淡
\`\`\`

## 4. 推送
发到 #agent-状态 频道。`,

  'health-report': `# Health Report（系统健康报告）

## 1. 数据源
- AgentManager.getStatus()
- session-pool.list()
- log 错误率
- token 消耗速率

## 2. 指标
- Agent uptime
- 错误率
- 平均响应时间
- Memory scope 增长率

## 3. 输出
每 6 小时生成,发到 #agent-状态。`,

  'metrics-fetch': `# Metrics Fetch（指标抓取）

## 1. 来源
- Discord: 消息数 / 活跃用户 / 频道活跃度
- Pi Agent: token 消耗 / session 数 / 错误数
- 业务系统: 客户数 / 项目数 / 收入

## 2. 抓取频率
每 6 小时一次,写入 data/metrics/。

## 3. 输出格式
JSON: {timestamp, metrics: {agent_id: {calls, errors, tokens, ...}}}`,

  'memory-governance': `# Memory Governance（记忆治理）

## 1. 任务
- 清理低质量记忆(短文本 / 重复)
- 合并相似记忆
- 标记过期记忆(status=expired)

## 2. 触发
- 每周日 02:00 自动
- 手动: \`!memory clean\`

## 3. 输出
- 删除 N 条
- 合并 M 条
- 总释放空间: X KB`,

  // Privacy
  'privacy-redact': `# Privacy Redact（隐私脱敏）

触发: \`!privacy check <cnt-id>\` 或 distill 流水线自动

## 1. 检测项
- 客户名 / 项目名 / 人名
- 邮箱 / 电话 / 身份证号
- 银行账号 / 订单号
- 内部代号 / 项目代号
- API key / token

## 2. 替换规则
- 公司名 → [CLIENT-N]
- 人名 → [PERSON-N]
- 邮箱 → [EMAIL]
- 电话 → [PHONE]
- 数字串(≥6 位) → [NUM-N]

## 3. 落盘
- 原文: data/business/contents/<cnt-id>-raw.md
- 脱敏: data/business/contents/<cnt-id>-redacted.md

## 4. 标记
在 content meta.json 标记:
- privacy: 'redacted'
- redactionCount: N
- reviewRequired: bool`,

  'secret-detect': `# Secret Detect（密钥检测）

## 1. 检测模式
- AWS: AKIA[0-9A-Z]{16}
- GitHub: ghp_[a-zA-Z0-9]{36}
- OpenAI: sk-[a-zA-Z0-9]{48}
- Stripe: sk_live_[a-zA-Z0-9]{24}
- 通用: 高熵字符串

## 2. 输出
- 严重度: critical / warning / info
- 位置(行号 + 上下文 50 字)
- 建议处理

## 3. 紧急处理
critical 级别:
- 立刻删除内容
- 通知用户
- 写入 audit log`,

  'client-anonymize': `# Client Anonymize（客户匿名化）

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
data/business/contents/<id>-anon.md`,

  // Fact Check
  'fact-check': `# Fact Check（事实核查）

触发: \`!fact check <cnt-id>\` 或 distill 自动

## 1. 提取主张
从内容中提取所有 factual claim:
- 数字 / 百分比
- 日期 / 时间
- 引述
- 引用

## 2. 验证
对每个 claim:
- 内部数据: 检查 memory-store
- 外部数据: 用 tavily / google search 检索
- 引述: 检查原文出处

## 3. 评级
- verified: 有可靠来源
- unverified: 找不到来源
- disputed: 来源相互矛盾

## 4. 输出
data/business/fact-check/<cnt-id>.json:
\`\`\`json
{
  "claims": [
    {"text": "X 公司增长 50%", "status": "verified", "source": "xxx"},
    {"text": "Y 功能上线", "status": "unverified", "note": "找不到公开来源"}
  ]
}
\`\`\``,

  'evidence-bind': `# Evidence Bind（证据绑定）

## 1. 任务
为每个 verified claim 绑定 evidence:
- URL
- 文档 ID
- 内部数据点

## 2. 存储
data/business/evidence/<claim-id>.json:
- claim
- sources (array)
- confidence (0-1)
- verifiedAt
- verifiedBy

## 3. 复用
下次 fact-check 时,优先查 evidence store。`,

  'citation': `# Citation（引用规范）

## 1. 格式
- 数字来源: [数据](url "来源名称, YYYY-MM-DD")
- 引述: > "原文" — 来源
- 内部: [内部数据: memory-id]

## 2. 检查
- 是否每条 claim 都有引用
- 引用是否可达(URL 不死链)
- 引用是否最新(< 1 年)

## 3. 自动补充
对没有引用的 claim,标记 neededCitation: true。`,

  // Sales
  'follow-up': `# Follow Up（跟进）

触发: \`!follow-up <lead-id>\`

## 1. 读取 lead
从 data/business/leads/<lead-id>.json:
- 公司 / 联系人 / 来源 / 需求
- 最近沟通记录
- 阶段

## 2. 生成跟进计划
按阶段:
- new: 24h 内首次联系
- qualified: 3 天内发 proposal 草稿
- proposal: 7 天内未回复则提醒
- negotiation: 每 2 天更新
- closed: 7 天后做 case study

## 3. 生成消息
- 中文: 简短,确认问题 + 时间
- 英文: 类似,但更正式

## 4. 推送
写跟进日志到 lead 记录,发提醒到 #销售线索 频道。`,

  // Coding
  'react-demo': `# React Demo（React Demo 生成）

触发: \`!demo new <alias> <industry> <一句话需求>\`

## 1. 加载 Skill 顺序
read-foundation → react-design → component-library → react-vite → react-router → tailwind-v4 → shadcn-ui → tanstack-query → msw-mock → react-testing → zenbuild-design-tokens → react-demo(本 skill)

## 2. 输入
- alias: 项目短名(英文)
- industry: 行业(参考 agent-core/enterprise/industries/)
- requirement: 一句话需求

## 3. 模板选择
使用 agent-core/enterprise/templates/demo-react/

## 4. 生成
- package.json (vite + react + ts)
- src/App.tsx (路由 + 主题)
- src/pages/ (首页 + 详情 + 表单)
- src/components/ (用 @zenbuild/design)
- src/mocks/ (MSW handlers)
- tailwind.config.ts (从 tokens)
- README.md

## 5. 验证
- pnpm install
- pnpm build
- pnpm dev(可选)

## 6. 输出
data/business/demos/<alias>/
- 完整项目

## 7. 推送
发到 #项目管理 频道 + 预览链接。`,

  'distill-privacy-redact': `# 兼容别名 - 跳转到 privacy/privacy-redact.skill.md`,
  'distill-fact-check': `# 兼容别名 - 跳转到 fact-check/fact-check.skill.md`,
};

// 简单模板(没在 SKILL_TEMPLATES 里的)
function defaultTemplate(skillName, agentDesc) {
  return `# ${skillName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}

> Agent: ${agentDesc}

## 1. 任务
执行 ${skillName} 操作。

## 2. 步骤
1. 加载上下文(memory + session)
2. 执行核心逻辑
3. 落盘 + 通知

## 3. 输出
- 返回结构化结果
- 写入对应 scope 的记忆
- 推送相关通知

## 4. 错误处理
- 失败时返回明确错误
- 记录到 agent-internal scope
- 通知用户`;
}

// 主流程
let created = 0;
let skipped = 0;

for (const m of missing) {
  const dir = dirname(m.skill);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const skillName = m.skill.split('/').pop().replace('.skill.md', '');
  const template = SKILL_TEMPLATES[skillName] ?? defaultTemplate(skillName, m.description);

  const content = `---
name: ${skillName}
agent: ${m.agent}
description: |
  Auto-generated skill for ${m.agent} agent.
  ${m.description}
---

${template}
`;

  if (existsSync(m.skill)) {
    skipped++;
    continue;
  }

  writeFileSync(m.skill, content, 'utf8');
  created++;
  console.log(`✅ ${m.agent}/skills/${skillName}.skill.md`);
}

console.log(`\n📊 共生成: ${created} 个,跳过: ${skipped} 个`);