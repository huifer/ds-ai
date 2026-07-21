# 「遐思」增强实施方案 v3.0 ✅ (已实现)

> 基于对现有代码的深度分析，聚焦"做梦"机制的完整增强
> 
> **状态**: Phase 1-5 核心功能已实现，详见下方

---

## 一、当前系统完整状态审计

### 1.1 已实现模块清单

| 模块 | 文件 | 状态 | 说明 |
|------|------|------|------|
| 三阶段流水线 | dreamer.mjs | ✅ 完整 | Light → REM → Deep |
| Light信号收集 | phases/light.mjs | ✅ 完整 | journal + 记忆采样 + 情绪扫描 |
| REM反思生成 | phases/rem.mjs | ✅ 完整 | Pi生成洞察候选 |
| Deep评分写入 | phases/deep.mjs | ✅ 完整 | 5信号评分 + 影子试用 |
| 四种梦类型 | prompts/*.txt | ✅ 连珠/归藏/明台 | yu-yan未实现 |
| 投票系统 | votes.mjs | ✅ 完整 | up/down/star + 切换逻辑 |
| 遐思录 | diary.mjs | ✅ 完整 | Pi写作 + fallback模板 |
| 周报/月报 | report.mjs | ✅ 完整 | 主题云 + 关系图 |
| Token预算 | budget.mjs | ✅ 完整 | 每日限额控制 |
| 梦境产物 | artifacts.mjs | ✅ 完整 | MD写入 + 元数据 |
| 独立Pi进程 | dreaming-pi.mjs | ✅ 完整 | 独立RPC子进程 |

### 1.2 实际运行数据

从 `data/dreams/` 可以看到：
- **已运行**: 6次梦（连珠×4, 归藏×1, 明台×1）
- **产物数**: 12条产物（连珠9条, 明台1条, 归藏0条）
- **平均时长**: ~55秒
- **评分分布**: novelty 0.2-0.3, coherence 0.7-0.9, utility 0.5-0.8

### 1.3 评分问题分析

从产物中可以看到 `total: 0.562` 这类分数缺失的情况：
- `novelty` 有时为 `undefined`（因为 embedder 可能不可用，fallback 为 0.5）
- `surprise` = novelty × utility，所以也会是 undefined

---

## 二、实现状态总结

| 模块 | 文件 | 状态 | 说明 |
|------|------|------|------|
| 好梦 prompt | `prompts/rem-good-dream.txt` | ✅ 已实现 | 激励性洞察模板 |
| 噩梦干预 | `enhancement/nightmare-mitigation.mjs` | ✅ 已实现 | 极性检测 + 自动干预 |
| yu-yan prompt | `prompts/rem-yu-yan.txt` | ✅ 已实现 | 反事实推理模板 |
| yu-yan 阶段 | `phases/yu-yan.mjs` | ✅ 已实现 | 预言生成逻辑 |
| 梦境→记忆 | `enhancement/dream-to-memory.mjs` | ✅ 已实现 | 自动吸收高分产物 |
| 投票反馈 | `enhancement/vote-feedback.mjs` | ✅ 已实现 | 投票数据分析 |
| 自我改进 | `enhancement/self-improvement.mjs` | ✅ 已实现 | 趋势分析 + 建议 |
| 隐式知识挖掘 | `mining/implicit-knowledge.mjs` | ✅ 已实现 | 偏好/痛点提取 |

## 三、缺失模块详细分析

### 2.1 好梦机制（核心缺失）

**现状**：当前四种梦都是"中性"的，没有明确的好/坏区分。

**问题**：
1. 连珠产出有时偏"玄学"，不够接地气
2. 没有"正面洞察"与"焦虑放大"的区分机制
3. 用户收到洞察后不知道哪些是"值得行动"的

**需要实现**：
1. 好梦评分因子（Positivity Score）
2. 好梦 prompt 模板（激励创意、连接、行动建议）
3. 噩梦检测关键词 + 干预机制

### 2.2 yu-yan 预言（完全缺失）

**现状**：目录 `artifacts/yu-yan/` 存在但为空，prompt 文件未创建。

**设计目标**：
- 反事实推理："如果当初选了X而不是Y，现在会怎样？"
- 情景模拟："如果市场突然变天了，我们会怎样？"
- 风险预测："最坏情况是什么？概率多大？"

### 2.3 梦境→主记忆通道（未集成）

**现状**：
- `memory-context.mjs` 有 `dreamArtifacts` 注入能力
- 但没有自动吸收高质量梦境产物的机制
- 没有基于评分的自动提升逻辑

**需要实现**：
1. 高分产物自动写入记忆
2. 投票反馈影响未来梦境质量
3. 重复洞察自动合并/去重

### 2.4 梦境自我改进（未实现）

**现状**：
- `report.mjs` 统计投票数据
- 但没有基于数据调整 prompt 的机制

**需要实现**：
1. 投票分析 → prompt 参数调整
2. 产出质量趋势追踪
3. 自动抑制低效梦境类型

### 2.5 隐式知识挖掘（待增强）

**现状**：
- `light.mjs` 只做简单的关键词情绪扫描
- 没有隐式偏好挖掘、决策依据提取

**需要实现**：
1. 从对话中挖掘"未明说的偏好"
2. 从拒绝/接受模式推断用户倾向
3. 跨时间段的趋势发现

---

## 三、完整实施计划

### Phase 1: 好梦机制（1周）

#### 1.1 新增好梦评分因子

```javascript
// src/dreaming/phases/deep.mjs
// 在 computeNovelty 等函数旁边新增

async function computeDreamQuality(text) {
  // 好梦指标
  const positiveSignals = [
    '连接', '创意', '如果', '可以', '也许', '说不定',
    '有趣', '有意思', '启发', '行动', '下一步',
  ];
  
  // 噩梦指标
  const negativeSignals = [
    '担心', '焦虑', '害怕', '失败', '来不及',
    '崩溃', '扛不住', '绝望', '无望', '无解',
  ];
  
  let posCount = 0, negCount = 0;
  for (const kw of positiveSignals) {
    posCount += (text.match(new RegExp(kw, 'g')) || []).length;
  }
  for (const kw of negativeSignals) {
    negCount += (text.match(new RegExp(kw, 'g')) || []).length;
  }
  
  // 极性评分: (-1, 1) 之间
  const total = posCount + negCount + 1;
  const polarity = (posCount - negCount) / total;
  
  return {
    positivity: posCount,
    negativity: negCount,
    polarity,  // > 0 为好梦, < 0 为噩梦
  };
}
```

#### 1.2 好梦 prompt 模板

```txt
// src/dreaming/prompts/rem-good-dream.txt

你是「好梦制造者」。你的任务是创造能带来希望、创意和行动的洞察。

## 好梦的特征

### ✅ 应该是
- 连接看似无关的点子，产生新视角
- 发现被忽视的机会或优势
- 提供具体、可行的建议
- 激发信心和行动力

### ❌ 绝对不是
- 放大焦虑或担忧
- 产生无关的负面联想
- 提出难以实现的空想

## 输出 JSON 格式
{
  "dreamQuality": "good",
  "insights": [
    {
      "title": "洞察标题",
      "connection": "描述连接的点",
      "whatIf": "如果...会怎样",
      "action": "下一步具体行动",
    }
  ]
}
```

#### 1.3 噩梦干预

```javascript
// src/dreaming/phases/rem.mjs
// 在生成洞察后增加干预逻辑

async function mitigateNightmare(artifacts, mood) {
  const nightmareThreshold = -0.3;
  
  for (const artifact of artifacts) {
    const quality = await computeDreamQuality(artifact.text);
    
    if (quality.polarity < nightmareThreshold) {
      // 触发干预:要求重新生成
      const intervention = await dreamingPi.dreamPrompt(
        `这段洞察偏向负面：
        
${artifact.text}

请重新思考，聚焦于：
1. 这个问题的另一面是什么？
2. 有什么被忽视的机会？
3. 如果乐观一点，会怎样？

输出 JSON 格式的新洞察：`,
        { timeoutMs: 5 * 60 * 1000 }
      );
      
      // 替换
      const parsed = extractJson(intervention.text);
      if (parsed) {
        Object.assign(artifact, parsed);
      }
    }
  }
  
  return artifacts;
}
```

### Phase 2: yu-yan 预言（1周）

#### 2.1 yu-yan prompt

```txt
// src/dreaming/prompts/rem-yu-yan.txt

你是「预言家」，擅长反事实推理和情景模拟。

## 你的工作

### 1. 反事实推理
- 选取老张过去的一个重要决策
- 想象"如果选了另一个选项"
- 推演可能的结果路径

### 2. 情景模拟
- 选取一个可能的未来事件（如：市场变化、竞争加剧）
- 推演对老张业务的影响
- 提出应对策略

### 3. 风险预测
- 识别当前路径上的潜在风险
- 评估概率和影响
- 提出缓解措施

## 输出格式
{
  "type": "yu-yan",
  "counterfactuals": [
    {
      "decision": "过去的决策",
      "alternative": "另一个选项",
      "outcome": "可能的结果",
    }
  ],
  "scenarios": [
    {
      "trigger": "未来事件",
      "impact": "影响描述",
      "strategy": "应对策略",
    }
  ],
  "risks": [
    {
      "description": "风险描述",
      "probability": "high/medium/low",
      "mitigation": "缓解措施",
    }
  ]
}
```

#### 2.2 yu-yan 独立模块

```javascript
// src/dreaming/phases/yu-yan.mjs

export async function runYuYan({ type, lightCtx, dreamingPi, loadPrompt, budget, log }) {
  if (type !== 'yu-yan') return [];
  
  // 1. 选取关键决策
  const decisions = lightCtx.candidates.filter(c => c.kind === 'decision');
  if (decisions.length === 0) {
    log('[yu-yan] 无决策可推理');
    return [];
  }
  
  // 2. 生成预言
  const prompt = await buildYuYanPrompt(decisions);
  const result = await dreamingPi.dreamPrompt(prompt, { timeoutMs: 10 * 60 * 1000 });
  
  // 3. 解析
  const parsed = extractJson(result.text);
  if (!parsed) return [];
  
  // 4. 转为 artifact 格式
  return [transformToArtifact(parsed, type)];
}
```

### Phase 3: 梦境→主记忆通道（1周）

#### 3.1 自动吸收模块

```javascript
// src/dreaming/dream-to-memory.mjs

export class DreamToMemory {
  constructor({ memoryStore, artifacts, log }) {
    this.memoryStore = memoryStore;
    this.artifacts = artifacts;
    this.log = log;
    this.ABSORPTION_THRESHOLD = 0.65;  // 总分 > 0.65 才吸收
  }
  
  async processNewDreams() {
    // 1. 获取最近的产物
    const recent = await this.getRecentUnprocessedArtifacts();
    
    // 2. 筛选高分产物
    const candidates = recent.filter(a => 
      (a.scores?.total || 0) > this.ABSORPTION_THRESHOLD
    );
    
    // 3. 检查是否已有类似记忆
    const newMemories = [];
    for (const artifact of candidates) {
      const similar = await this.findSimilarMemory(artifact);
      
      if (!similar) {
        // 无类似记忆，创建新记忆
        const memory = await this.createMemoryFromArtifact(artifact);
        newMemories.push(memory);
      } else {
        // 有类似记忆，更新引用
        await this.updateMemoryReference(similar, artifact);
      }
    }
    
    return newMemories;
  }
  
  async createMemoryFromArtifact(artifact) {
    const memory = {
      id: `dream-${artifact.id}`,
      kind: 'reflection',
      subject: artifact.title || artifact.meta?.title,
      content: artifact.body || artifact.text,
      source: {
        type: 'dreaming',
        artifactId: artifact.id,
        scores: artifact.scores,
      },
      tags: ['dreaming', artifact.type],
      confidence: artifact.scores?.total || 0.5,
      importanceScore: Math.round((artifact.scores?.total || 0.5) * 100),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await this.memoryStore.upsert(memory);
    this.log(`[dream-to-memory] ✓ 创建记忆: ${memory.id}`);
    
    return memory;
  }
}
```

#### 3.2 投票反馈循环

```javascript
// src/dreaming/vote-feedback.mjs

export class VoteFeedback {
  constructor({ votes, artifacts, log }) {
    this.votes = votes;
    this.artifacts = artifacts;
    this.log = log;
  }
  
  async processVotes() {
    const allVotes = await this.votes.all();
    
    // 统计每个产物的投票情况
    const stats = [];
    for (const [artifactId, vote] of Object.entries(allVotes)) {
      const score = vote.up - vote.down + vote.star * 2;
      if (score > 0) {
        stats.push({ artifactId, score, ...vote });
      }
    }
    
    // 排序
    stats.sort((a, b) => b.score - a.score);
    
    // 反馈给梦境系统
    return {
      topArtifacts: stats.slice(0, 5),
      totalPositive: stats.filter(s => s.score > 0).length,
      totalStarred: stats.filter(s => s.star > 0).length,
    };
  }
}
```

### Phase 4: 梦境自我改进（1周）

```javascript
// src/dreaming/self-improvement.mjs

export class DreamSelfImprover {
  constructor({ artifacts, votes, log }) {
    this.artifacts = artifacts;
    this.votes = votes;
    this.log = log;
  }
  
  async improve({ timeRange = 30 } = {}) {
    // 1. 收集数据
    const artifacts = await this.getArtifactsInRange(timeRange);
    const votes = await this.votes.all();
    
    // 2. 分析类型效果
    const typeStats = this.analyzeByType(artifacts, votes);
    
    // 3. 生成改进建议
    const suggestions = [];
    for (const [type, stats] of Object.entries(typeStats)) {
      if (stats.avgScore < 0.4) {
        suggestions.push({
          type: 'improve-prompt',
          target: type,
          issue: `评分偏低 (${stats.avgScore.toFixed(2)})`,
          suggestion: `建议在 ${type} 的 prompt 中强调 XXX`,
        });
      }
      
      if (stats.voteRatio < 0.3) {
        suggestions.push({
          type: 'decrease-frequency',
          target: type,
          issue: `投票率低 (${(stats.voteRatio * 100).toFixed(0)}%)`,
          suggestion: `减少 ${type} 的调度频率`,
        });
      }
    }
    
    // 4. 更新配置
    await this.applySuggestions(suggestions);
    
    return suggestions;
  }
}
```

### Phase 5: 隐式知识挖掘增强（1周）

```javascript
// src/dreaming/mining/implicit-knowledge.mjs

export class ImplicitKnowledgeMiner {
  async mineFromJournal(journal, timeRange = 7) {
    const events = await journal.getEvents({ days: timeRange });
    
    const knowledge = {
      implicitPreferences: [],
      decisionRationale: [],
      successPatterns: [],
      painPoints: [],
    };
    
    for (const event of events) {
      // 1. 挖掘隐式偏好
      // 模式: "其实我更想..." / "不太想..." / "算了不..."
      const prefMatches = this.extractPreferences(event.content);
      knowledge.implicitPreferences.push(...prefMatches);
      
      // 2. 挖掘决策依据
      // 模式: "因为...所以决定" / "考虑到..."
      const rationaleMatches = this.extractRationale(event.content);
      knowledge.decisionRationale.push(...rationaleMatches);
      
      // 3. 挖掘成功模式
      // 模式: "成功了" / "搞定了" / "完美"
      const successMatches = this.extractSuccess(event.content);
      knowledge.successPatterns.push(...successMatches);
      
      // 4. 挖掘痛点
      // 模式: "卡在" / "搞不定" / "崩溃"
      const painMatches = this.extractPain(event.content);
      knowledge.painPoints.push(...painMatches);
    }
    
    // 去重和聚类
    return this.cluster(knowledge);
  }
}
```

---

## 四、配置增强

### 4.1 新增 .env 配置项

```bash
# 做梦增强配置
XIASI_GOOD_DREAM_ENABLED=true          # 启用好梦机制
XIASI_NIGHTMARE_THRESHOLD=-0.3        # 噩梦干预阈值
XIASI_QUALITY_THRESHOLD=0.65           # 产物吸收阈值
XIASI_DREAM_TO_MEMORY=true             # 梦境→记忆通道
XIASI_VOTE_FEEDBACK=true               # 投票反馈
XIASI_SELF_IMPROVE=true                # 自我改进
XIASI_IMPLICIT_MINING=true             # 隐式知识挖掘
```

### 4.2 配置加载

```javascript
// src/dreaming/config.mjs 增强

export function loadXiasiConfig({ env = process.env } = {}) {
  // ... 现有配置 ...
  
  return {
    // ... 现有字段 ...
    
    // 新增配置
    goodDreamEnabled: (merged.XIASI_GOOD_DREAM_ENABLED || 'false') === 'true',
    nightmareThreshold: parseFloat(merged.XIASI_NIGHTMARE_THRESHOLD || '-0.3'),
    qualityThreshold: parseFloat(merged.XIASI_QUALITY_THRESHOLD || '0.65'),
    dreamToMemory: (merged.XIASI_DREAM_TO_MEMORY || 'false') === 'true',
    voteFeedback: (merged.XIASI_VOTE_FEEDBACK || 'false') === 'true',
    selfImprove: (merged.XIASI_SELF_IMPROVE || 'false') === 'true',
    implicitMining: (merged.XIASI_IMPLICIT_MINING || 'false') === 'true',
  };
}
```

---

## 五、调度增强

### 5.1 增强后的调度表

| 时间 | 梦境类型 | 触发条件 |
|------|----------|----------|
| 03:30 | 连珠（好梦版） | XIASI_GOOD_DREAM_ENABLED=true |
| 03:45 | 归藏 | 默认 |
| 04:00 | 明台 | 默认 |
| 04:15 | 预言 | 每周六 |
| 04:30 | 梦境→记忆吸收 | XIASI_DREAM_TO_MEMORY=true |
| 08:00 | 自我改进 | 每周日 + XIASI_SELF_IMPROVE=true |

### 5.2 调度实现

```javascript
// src/entry-bot.mjs 增强调度

// 好梦调度
if (xc.goodDreamEnabled) {
  sched.register({
    id: 'xiasi-good-lian-zhu',
    hour: 3, minute: 30,
    run: async () => {
      const dreamer = await createDreamer({
        cfg: xc,
        dreamingPi,
        // 好梦模式
        goodDreamMode: true,
        // ...
      });
      await dreamer.run({ type: 'lian-zhu', goodDream: true });
    },
  });
}

// 预言调度（每周六）
sched.register({
  id: 'xiasi-yu-yan',
  hour: 4, minute: 15,
  cron: '0 4 * * 6',  // 每周六
  run: async () => {
    if (!xc.types.includes('yu-yan')) return;
    await dreamer.run({ type: 'yu-yan' });
  },
});

// 梦境→记忆（每天）
if (xc.dreamToMemory) {
  sched.register({
    id: 'xiasi-absorb',
    hour: 4, minute: 30,
    run: async () => {
      const absorber = new DreamToMemory({ memoryStore, artifacts, log });
      await absorber.processNewDreams();
    },
  });
}

// 自我改进（每周日）
if (xc.selfImprove) {
  sched.register({
    id: 'xiasi-self-improve',
    hour: 8, minute: 0,
    cron: '0 8 * * 0',  // 每周日
    run: async () => {
      const improver = new DreamSelfImprover({ artifacts, votes, log });
      const suggestions = await improver.improve({ timeRange: 7 });
      log(`[xiasi] 自我改进: ${suggestions.length} 条建议`);
    },
  });
}
```

---

## 六、文件结构更新

```
src/dreaming/
├── index.mjs                    ← 更新：导出新模块
├── config.mjs                   ← 更新：新增配置项
├── dreamer.mjs                  ← 更新：好梦模式参数
├── dreaming-pi.mjs
├── budget.mjs
├── locks.mjs
├── artifacts.mjs
├── votes.mjs
├── diary.mjs
├── report.mjs
├── paths.mjs
├── prompts.mjs
├── phases/
│   ├── light.mjs               ← 更新：增强隐式知识挖掘
│   ├── rem.mjs                 ← 更新：噩梦干预
│   ├── deep.mjs                ← 更新：好梦评分
│   └── yu-yan.mjs              ← 新增：预言阶段
├── mining/                      ← 新增目录
│   ├── implicit-knowledge.mjs   ← 新增：隐式知识挖掘
│   └── cross-domain.mjs        ← 新增：跨领域连接
├── enhancement/                 ← 新增目录
│   ├── dream-to-memory.mjs     ← 新增：梦境→记忆
│   ├── vote-feedback.mjs       ← 新增：投票反馈
│   ├── self-improvement.mjs    ← 新增：自我改进
│   └── nightmare-mitigation.mjs ← 新增：噩梦干预
└── prompts/
    ├── rem-lian-zhu.txt
    ├── rem-gui-cang.txt
    ├── rem-ming-tai.txt
    ├── rem-yu-yan.txt           ← 新增：预言模板
    └── rem-good-dream.txt       ← 新增：好梦模板
```

---

## 七、预期效果

### 7.1 量化指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 连珠平均评分 | ~0.55 | ~0.70 |
| 好梦产出率 | 0% | >60% |
| 噩梦干预率 | 0% | >90% |
| 预言执行率 | 0% | 100% (每周) |
| 梦境吸收率 | 0% | >50% |
| 投票参与率 | ~10% | >30% |
| 自我改进轮次 | 0 | 每周1次 |

### 7.2 质量提升

1. **洞察可操作性**: 从"玄学联想"到"具体行动建议"
2. **梦境安全感**: 噩梦自动干预，用户不会收到负面内容
3. **知识积累**: 高质量梦境自动进入记忆系统
4. **持续进化**: 基于反馈的自我优化

---

## 八、实施优先级

| 优先级 | 模块 | 工时 | 风险 |
|--------|------|------|------|
| P0 | 好梦机制 | 1周 | 低 |
| P0 | 噩梦干预 | 1周 | 低 |
| P1 | yu-yan预言 | 1周 | 中 |
| P1 | 梦境→记忆 | 1周 | 中 |
| P2 | 投票反馈 | 0.5周 | 低 |
| P2 | 自我改进 | 1周 | 中 |
| P3 | 隐式知识挖掘 | 1周 | 高 |

---

*本文档是「遐思」增强的详细实施方案，与 `OPC_MEMORY_AND_LOOP_AGENT_DESIGN.md` 配合使用。*
