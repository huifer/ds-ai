// ~/pi-discord-agents/scripts/generate-synthetic-skills.mjs
// 批量生成合成 agent 的 skill 文件

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const missing = JSON.parse(readFileSync('/tmp/missing-synth-skills.json', 'utf8'));

const SKILL_TEMPLATES = {
  // SEO
  'keyword-research': `# Keyword Research（关键词研究）

触发: 用户提到 "关键词"、"搜索量"、"难度"

## 1. 收集候选关键词
从用户上下文提取,或基于主题生成 10-20 个候选。

## 2. 多维度评估
对每个关键词:
- 搜索量(预估月搜索)
- 竞争度(0-100,越低越好)
- 商业价值(广告主愿意出价)
- 趋势(过去 12 个月变化)
- GEO 适配性(生成式引擎引用的概率)

## 3. 工具调用
用 web_search / tavily 检索:
- "X keyword difficulty"
- "X keyword volume"
- "X industry benchmark"

## 4. 输出建议
按"先易后难"原则给 5 个推荐关键词:
\`\`\`
| 关键词 | 月搜索量 | 难度 | 价值 | 趋势 |
| ... |
\`\`\`

## 5. 落盘
写到 data/business/seo/keywords-<date>.md`,

  'serp-analyze': `# SERP Analyze（SERP 分析）

## 1. 收集 SERP 数据
对目标关键词,抓取 Google 前 10 名的:
- 标题 / URL / 元描述
- 内容结构(H1/H2/H3)
- 字数 / 图片数 / 视频数
- 域名权威度(DR)

## 2. 内容缺口分析
对比 top 10,找出:
- 共性主题(都在讲什么)
- 差异化机会(谁都没覆盖的角度)
- 必答问题(PAA)

## 3. 报告输出
\`\`\`
# SERP 分析: <关键词>

## Top 10 概览
[表格]

## 共性主题
- ...

## 差异化建议
- ...

## 必答问题
1. ...
2. ...
\`\`\`

## 4. 落盘
data/business/seo/serp-<keyword>-<date>.md`,

  'geo-optimize': `# GEO Optimize（生成式引擎优化）

目标: 让内容被 ChatGPT / Claude / Perplexity / Gemini 引用。

## 1. GEO vs SEO 区别
- SEO: 排名 + 点击率
- GEO: 被引用 + 权威度
- 关键: 内容结构化 + 数据可验证

## 2. 优化清单
- [ ] 每个事实性陈述都有引用
- [ ] 用 schema.org 标记
- [ ] 提供 FAQ schema
- [ ] 内容开头直接给答案
- [ ] 用 bullet points 让 LLM 易于抽取
- [ ] 定期更新(LLM 偏好新鲜内容)

## 3. 检测工具
- Perplexity 搜索关键词,看是否引用你的内容
- ChatGPT 提问,看是否提到你
- Google SGE 截图

## 4. 报告
data/business/seo/geo-audit-<url>.md`,

  'backlink-strategy': `# Backlink Strategy（外链策略）

## 1. 分析现状
读取 data/business/seo/backlinks-<date>.csv 当前外链。

## 2. 分类
按 DR (Domain Rating):
- 高质量 (DR > 70): 5%
- 中等 (DR 30-70): 30%
- 低质量 (DR < 30): 65%

## 3. 策略
- 高质量: 主动联系,内容合作
- 中等: 投稿, 客座博客
- 低质量: 定期清理(disavow)

## 4. 新增机会
基于竞争对手外链,找出 10 个潜在目标站点。

## 5. 输出
data/business/seo/backlink-plan-<month>.md`,

  // Marketing
  'campaign-plan': `# Campaign Plan（营销活动策划）

## 1. 输入
- 目标(品牌曝光 / 线索获取 / 销售转化)
- 预算
- 时间窗口
- 目标受众

## 2. 渠道组合
- 国内: 公众号 / 小红书 / 抖音 / 视频号 / 知乎
- 海外: X / LinkedIn / YouTube / Newsletter / PH
- 付费: Google Ads / Meta Ads

## 3. 节奏
- 预热期(D-7): 话题铺垫
- 主推期(D-Day): 集中曝光
- 长尾期(D+7): 持续转化

## 4. KPI
- 曝光 / 点击 / 转化 / CAC / LTV

## 5. 输出
data/business/marketing/campaign-<id>.md`,

  'market-research': `# Market Research（市场调研）

## 1. 范围
- 行业规模(TAM/SAM/SOM)
- 主要玩家
- 客户画像
- 竞品对比
- 趋势分析

## 2. 数据源
- 行业报告(艾瑞 / 36氪 / Gartner)
- 竞品公开信息
- 客户访谈
- 内部数据

## 3. 输出
data/business/market/<industry>-research-<date>.md:
- 行业概述
- 玩家地图
- 机会窗口
- 风险信号

## 4. 复盘
每季度更新,识别趋势变化。`,

  'growth-review': `# Growth Review（增长复盘）

触发: 每周/每月 自动 或 手动

## 1. 关键指标
- 新增用户 / 活跃用户 / 留存率
- 线索转化漏斗
- 各渠道 ROI
- 客户 LTV

## 2. 对比
- vs 上周 / 上月
- vs 目标
- vs 行业基准

## 3. 洞察提取
- 什么做得好(可复制)
- 什么做得不好(需调整)
- A/B 测试结论

## 4. 行动项
- 下周 / 下月重点
- 责任人
- 衡量指标

## 5. 输出
data/business/marketing/growth-review-<period>.md`,

  // Dev
  'code-review': `# Code Review（代码评审）

## 1. 触发
- 用户贴代码请求评审
- PR / MR 通知
- 主动审查关键模块

## 2. 评审维度
- **正确性**: 逻辑是否对,边界是否处理
- **可读性**: 命名 / 注释 / 结构
- **可维护性**: 模块化 / 耦合度
- **性能**: 时间复杂度 / 内存 / I/O
- **安全**: 注入 / XSS / 认证 / 授权
- **测试**: 覆盖率 / 边界测试
- **文档**: README / 注释 / 变更日志

## 3. 反馈格式
\`\`\`
## 📋 评审总结
- 整体评价: ...
- 阻塞问题: N 个
- 建议项: M 个

## 🚨 阻塞(必须改)
1. ...
2. ...

## 💡 建议(可优化)
- ...
- ...

## ✨ 亮点
- ...
\`\`\`

## 4. 输出
data/business/code-reviews/<file>-<date>.md`,

  'debug': `# Debug（调试）

## 1. 收集信息
- 错误现象(报错信息 / 截图 / 日志)
- 复现步骤
- 预期行为 vs 实际
- 环境(OS / Node 版本 / 依赖版本)

## 2. 假设驱动
列出 3-5 个可能原因,按概率排序。

## 3. 验证
对每个假设:
- 检查相关代码
- 加日志 / breakpoint
- 单元测试

## 4. 修复
最小改动,优先 root cause 而非 patch。

## 5. 防止复发
- 加单元测试
- 加 lint 规则
- 写 postmortem`,

  'architecture': `# Architecture Design（架构设计）

## 1. 输入
- 业务需求(性能 / 可用性 / 扩展性)
- 约束(预算 / 时间 / 团队规模)
- 现有系统

## 2. 输出架构图
\`\`\`
[Client] → [CDN] → [API Gateway] → [Service A/B/C] → [DB]
                                ↓
                          [Cache] [Queue] [Search]
\`\`\`

## 3. 关键技术决策
- 前后端分离?
- 单体 vs 微服务?
- 数据库选型
- 部署方式
- 监控方案

## 4. ADR(架构决策记录)
\`\`\`
# ADR-001: 选择 PostgreSQL

## 背景
...

## 决策
...

## 后果
+ ...
- ...

## 替代方案
- MySQL: ...
- MongoDB: ...
\`\`\`

## 5. 落盘
data/architecture/ADR-<id>.md`,

  // Dreaming
  'lian-zhu': `# 莲·珠(Lian Zhu) - 联想碎片

触发: 遐思定时 / !xiasi 主动触发

## 1. 检索
从 memory-scope:
- agent-internal (跨 agent 笔记)
- company (公司)
- coding / content / sales (跨域)

找最近 7 天写入的记忆。

## 2. 联想
对每对记忆:
- 时间相近 → 同期关注
- 关键词重叠 → 同主题深入
- 主体不同 → 跨域连接

## 3. 输出
写入 data/dreaming/lian-zhu-YYYYMMDD-HHMM.md:
\`\`\`
# 莲·珠 联想碎片

## 灵感 1: <主题>
- 来源: memory-id1 + memory-id2
- 联想: ...
- 行动: ...
\`\`\``,

  'gui-cang': `# 归·藏(Gui Cang) - 归档沉淀

## 1. 筛选
从 lian-zhu 产物中,挑出价值密度高的:
- 有具体行动建议
- 涉及多个领域
- 有可执行的下一步

## 2. 提炼
把灵感整理成结构化笔记:
- 标题
- 上下文
- 核心洞察
- 行动建议
- 引用来源

## 3. 落盘
data/dreaming/gui-cang-<topic>.md

## 4. 同步
写入 company / business scope,让其他 agent 可检索。`,

  'ming-tai': `# 铭·台(Ming Tai) - 铭记台

## 1. 触发条件
- 重大决策
- 重要教训
- 价值观宣言
- 团队共识

## 2. 提炼
用一句话总结核心观点,加上下文。

## 3. 输出
\`\`\`
# 铭记

**日期**: 2024-01-15
**主题**: <一句话>

**上下文**: ...

**理由**: ...

**影响**: ...
\`\`\`

## 4. 写入
- data/dreaming/ming-tai-<date>.md
- memory-scope: company (永久保留)
- 推送到 #📜-夜游记 频道`,

  // Asset
  'file-manage': `# File Manage（文件管理）

## 1. 分类
按用途:
- 业务文件 (data/business/)
- 内容产物 (data/content/)
- 记忆归档 (data/memory/)
- 系统日志 (data/logs/)

## 2. 命名规范
YYYY-MM-DD_<category>_<id>_<title>.ext

## 3. 清理
- 30 天前的临时文件 → 归档
- 90 天前的归档 → 压缩存储
- 1 年前的 → 移到冷存储

## 4. 索引
data/business/INDEX.md 维护所有重要文件路径。`,

  'memory-manage': `# Memory Manage（记忆治理）

## 1. 质量检查
- 长度 < 50 字符 → 标记低质量
- 重复内容 → 合并
- 引用失效 → 标记
- 过期(>180 天未访问) → 评估删除

## 2. 整理
- 按 scope 分组
- 按 topic 聚类
- 按时间排序

## 3. 输出
data/memory/INDEX.md: 总览
data/memory/<scope>/SUMMARY.md: 各 scope 摘要`,

  'idea-capture': `# Idea Capture（灵感捕捉）

## 1. 触发
- 用户明确说 "记录这个想法"
- 检测到高价值洞察(对话中)
- 遐思产物中的可执行项

## 2. 结构化
\`\`\`
# 灵感: <标题>

## 灵感来源
- 触发: <对话/遐思/手动>
- 时间: <ISO>

## 描述
...

## 关联
- [相关记忆 1]
- [相关记忆 2]

## 下一步
- [ ] ...
\`\`\`

## 3. 落盘
data/ideas/<date>-<slug>.md

## 4. 同步
写入 asset-manager / agent-internal scope。`,

  'search': `# Search（语义检索）

## 1. 输入
用户查询 + scope 范围

## 2. 检索
- 关键词匹配
- 向量相似度(tavily / embedder)
- 跨 scope 联合

## 3. 排序
按相关性 + 时间新鲜度 + 来源权威度

## 4. 输出
\`\`\`
## 找到 N 条相关记忆

### 1. <标题>(<scope>, <date>)
摘要: ...
链接: memory://xxx

### 2. ...
\`\`\``,

  // Orchestrator
  'route': `# Route（路由）

## 1. 接收用户消息

## 2. 三层路由
- 频道映射(硬路由)
- 关键词匹配(软路由)
- 默认兜底

## 3. 决定 Agent
输出 { agentId, confidence, reason }

## 4. 移交
调用 session-pool.getOrCreate + agent.handleMessage`,

  'delegate': `# Delegate（任务委派）

## 1. 任务拆分
一个复杂任务 → 多个子任务

## 2. 子任务路由
每个子任务找到最合适的 agent

## 3. 串行 / 并行
- 有依赖: 串行
- 独立: 并行(用 Promise.all)

## 4. 汇总
把多个 agent 输出整合,给用户统一回复。

## 5. 错误处理
任一子任务失败 → 部分成功 + 失败明细`,

  'status': `# Status（状态查询）

## 1. 数据源
- 各 agent 的最近运行时间
- session-pool 的活跃 session
- memory-scope 的写入量
- 最近错误

## 2. 输出
\`\`\`
## Agent 状态

| Agent | State | Last Run | Sessions | Errors |
|-------|-------|----------|----------|--------|
| sales | idle  | 2m ago   | 3        | 0      |
| ... |
\`\`\``,

  'memory-read': `# Memory Read（记忆读取）

## 1. 范围
按 agent 的 readScopes 权限过滤

## 2. 检索
- RAG(基于 user query)
- 关键词
- 时间范围

## 3. 输出
按相关性排序,前 10 条摘要。`,
};

// 主流程
let created = 0;

for (const m of missing) {
  const dir = dirname(m.path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const template = SKILL_TEMPLATES[m.skill] ?? `# ${m.skill}\n\n通用 skill 实现。`;

  const content = `---
name: ${m.skill}
agent: ${m.agent}
description: |
  Synthetic agent skill for ${m.agent}: ${m.skill}.
  Auto-generated.
---

${template}
`;

  writeFileSync(m.path, content, 'utf8');
  created++;
  console.log(`✅ ${m.path}`);
}

console.log(`\n📊 共生成: ${created} 个合成 agent skill`);