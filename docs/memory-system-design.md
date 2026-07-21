# Discord 记忆系统全面设计文档

> 设计目标：构建一个智能、持久、可维护的长期记忆系统，让 Discord Agent 具备跨对话的知识积累能力。

---

## 📋 目录

1. [核心架构设计](#核心架构设计)
2. [记忆类型体系](#记忆类型体系)
3. [记忆生命周期](#记忆生命周期)
4. [记忆检索策略](#记忆检索策略)
5. [记忆蒸馏机制](#记忆蒸馏机制)
6. [向量检索优化](#向量检索优化)
7. [记忆镜像与同步](#记忆镜像与同步)
8. [记忆治理体系](#记忆治理体系)
9. [安全与权限](#安全与权限)
10. [性能优化](#性能优化)
11. [实施路线图](#实施路线图)

---

## 核心架构设计

### 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Discord Layer                           │
│  #记忆库 | #灵感 | #工程 | #系统 | #机会                        │
│  - 记忆镜像（只读展示）                                       │
│  - 用户交互界面                                              │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                  Memory Mirror Layer                        │
│  memory-mirror.mjs                                           │
│  - 双向同步：store ↔ Discord                                │
│  - 消息映射管理（mirror.json）                               │
│  - 一致性保证                                                │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                  Memory Store Layer                         │
│  memory-store.mjs                                            │
│  - 元数据存储（meta.json）                                   │
│  - 内容存储（content.md）                                    │
│  - 向量索引（vector/index.json）                             │
│  - 全局索引（index.json）                                    │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                 Intelligence Layer                          │
│  memory-distiller.mjs | memory-journal.mjs                  │
│  - 对话捕获（journal）                                       │
│  - 智能蒸馏（LLM + 规则）                                    │
│  - 上下文构建（buildContext）                                │
└─────────────────────────────────────────────────────────────┘
```

### 文件组织

```
data/memory/
├── store/
│   └── mem_<id>/
│       ├── meta.json           # 机器读：完整元数据
│       └── content.md          # 人读：YAML frontmatter + 正文
├── vector/
│   └── index.json              # 向量索引（简化 HNSW）
├── journal/
│   └── YYYY-MM-DD.jsonl        # 每日对话流
├── snapshots/
│   └── YYYY-MM-DD-HHmmss.json  # 定期快照
├── index.json                  # 全局轻量索引
├── mirror.json                 # 频道-消息映射
├── stats.json                  # 统计指标
└── config.json                 # 配置（蒸馏规则、保留策略等）
```

### 数据流

```
用户在 Discord 对话
        ↓
memory-journal 捕获（实时）
        ↓
每日 23:30 触发蒸馏
        ↓
memory-distiller 分析 journal
        ↓
提取有价值记忆 → memory_upsert
        ↓
memory-store 持久化
        ↓
memory-mirror 同步到 #记忆库
        ↓
下次对话 buildContext 注入相关记忆
```

---

## 记忆类型体系

### 核心类型（永久存储）

| Kind | 用途 | 生命周期 | 示例 |
|------|------|----------|------|
| `preference` | 长期偏好 | 永久 | "用 TypeScript 开发新项目" |
| `fact` | 稳定事实 | 永久 | "项目名称是 pi-discord-agents" |
| `decision` | 设计决策 | 永久 | "选择 RPC 模式而非 TUI" |
| `constraint` | 硬约束 | 永久 | "禁止使用 any 类型" |
| `definition` | 术语定义 | 永久 | "记忆蒸馏：从对话中提取永久知识" |
| `reflection` | 反思总结 | 永久 | "v1 → v2 架构迁移经验" |
| `build` | 工程结论 | 永久 | "Axum 路由优先级问题解决方案" |

### 上下文类型（短期存储）

| Kind | 用途 | 默认过期 | 可配置 |
|------|------|----------|--------|
| `context` | 当前上下文 | 30 天 | ✅ |
| `project` | 项目状态 | 90 天 | ✅ |
| `todo` | 未完成任务 | 60 天 | ✅ |
| `idea` | 产品想法 | 120 天 | ✅ |

### 元数据结构

```typescript
interface MemoryMetadata {
  id: string;                    // mem_<timestamp>_<slug>
  kind: MemoryKind;              // 类型
  scope: 'user' | 'project' | 'global';  // 作用域
  subject: string;               // 主题键（英文，2-4 词）
  content: string;               // 内容摘要
  tags: string[];                // 标签
  status: 'active' | 'superseded' | 'revoked' | 'expired' | 'archived';
  revision: number;              // 版本号
  supersedes: string[];          // 替代的旧版本 ID
  embedding: number[];           // 向量表示
  confidence: number;            // 置信度 [0-1]
  source: {                      // 来源追踪
    kind: 'user' | 'distiller' | 'tool' | 'import';
    ref?: string;                // 引用（Discord 消息 ID / journal 行号）
  };
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  expiresAt?: string;            // ISO 8601（可选）
  revokedReason?: string;        // 撤销原因
  accessCount: number;           // 访问次数
  lastAccessedAt: string;        // 最后访问时间
}
```

### 内容格式（content.md）

```yaml
---
id: mem_1721398400000_rpc_vs_tui
kind: decision
scope: user
subject: rpc-vs-tui
tags: [architecture, performance]
confidence: 0.95
status: active
revision: 2
supersedes: [mem_1721300000000_tui_decision]
createdAt: 2024-07-19T05:00:00.000Z
updatedAt: 2024-07-19T06:30:00.000Z
source: {"kind":"distiller","ref":"journal:2024-07-18#L42"}
---

# RPC vs TUI 架构决策

## 背景
v1 使用 TUI + tmux 方案，存在 ctx stale 错误和启动慢的问题。

## 决策
采用 Pi 官方的 RPC 子进程模式，不再使用 TUI。

## 理由
1. 零 ctx stale（RPC 设计就是 reload-safe）
2. 启动从 ~10s 降到 ~200ms
3. 支持流式输出（text_delta 实时转发）
4. 不需要 tmux / 假 TTY

## 影响
- entry-bot.mjs 需要用 RpcClient
- 扩展工具在子进程执行
- 定时任务改用内存 cron

## 变更记录
- **2024-07-19T06:30:00.000Z** revision 2: 补充影响分析
- **2024-07-19T05:00:00.000Z** revision 1: 初始决策
```

---

## 记忆生命周期

### 状态机

```
          upsert
             ↓
        ┌─────────┐
        │  active │ ←──────┐
        └────┬────┘        │
             │             │
  ┌──────────┼──────────┐  │
  ↓          ↓          │  │
superseded  revoked   expires  │
  │          │          │  │
  │          ↓          │  │
  │     (手动/自动)     │  │
  │          │          │  │
  └──────────┴──────────┘  │
             ↓             │
        archived ←─────────┘
             │
             ↓ (90+ 天未访问)
        deleted (compact)
```

### 生命周期规则

| 状态 | 触发条件 | 行为 | 可逆性 |
|------|----------|------|--------|
| `active` | 创建 / 更新 | 可查询、可编辑 | ✅ 通过撤销 |
| `superseded` | 同 subject + kind 的新版本 | 隐藏但保留历史 | ✅ 通过撤销新版本 |
| `revoked` | 显式撤销 / 规则匹配 | 隐藏、标记撤销原因 | ❌ |
| `expired` | 超过 expiresAt | 自动归档 | ✅ 通过更新 |
| `archived` | 365 天未更新 | 压缩存储 | ✅ 通过手动激活 |
| `deleted` | 90+ 天未访问（历史） | 物理删除 | ❌ |

### 自动撤销规则

```typescript
const AUTO_REVOKE_RULES = [
  {
    name: '过时技术栈',
    condition: (meta) =>
      meta.kind === 'preference' &&
      meta.subject.includes('typescript') &&
      meta.content.includes('JavaScript only'),
    reason: '技术栈已过时',
  },
  {
    name: '冲突决策',
    condition: (meta, allMetas) =>
      meta.kind === 'decision' &&
      allMetas.some(m =>
        m.kind === 'decision' &&
        m.subject === meta.subject &&
        m.revision > meta.revision &&
        m.status === 'active'
      ),
    reason: '存在更新版本决策',
  },
];
```

### 保留策略

| 记忆类型 | Active 保留 | Historical 保留 | Compact 策略 |
|----------|------------|----------------|--------------|
| preference | 365 天 | 永久 | 不删除 |
| fact | 365 天 | 永久 | 不删除 |
| decision | 365 天 | 永久 | 不删除 |
| constraint | 365 天 | 永久 | 不删除 |
| definition | 365 天 | 永久 | 不删除 |
| reflection | 365 天 | 永久 | 不删除 |
| build | 365 天 | 永久 | 不删除 |
| context | 30 天 | 90 天 | 删除 |
| project | 90 天 | 180 天 | 删除 |
| todo | 60 天 | 90 天 | 删除 |
| idea | 120 天 | 180 天 | 删除 |

---

## 记忆检索策略

### 检索模式

| 模式 | 适用场景 | 算法 | 精度 | 速度 |
|------|----------|------|------|------|
| `recent` | 无特定查询 | 按 updatedAt 排序 | ⭐ | ⭐⭐⭐⭐⭐ |
| `text` | 关键词搜索 | BM25 + 文本评分 | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| `vector` | 语义相似 | Cosine 相似度 | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| `hybrid` | 综合检索 | RRF (Reciprocal Rank Fusion) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| `filter` | 精确查询 | 过滤条件 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### 混合检索（RRF 算法）

```javascript
function hybridSearch({ query, kind, tags, scope, limit = 8 }) {
  // 1. 文本检索
  const textResults = textSearch(query, { kind, tags, scope, limit });
  const textScores = textResults.map((r, i) => ({
    id: r.id,
    score: 1 / (60 + i + 1),  // RRF K=60
  }));

  // 2. 向量检索
  const queryVec = embedder.embed(query);
  const vecResults = vectorSearch(queryVec, { kind, tags, scope, limit });
  const vecScores = vecResults.map((r, i) => ({
    id: r.id,
    score: 1 / (60 + i + 1),
  }));

  // 3. 融合
  const merged = new Map();
  textScores.forEach(({ id, score }) => {
    merged.set(id, (merged.get(id) || 0) + score);
  });
  vecScores.forEach(({ id, score }) => {
    merged.set(id, (merged.get(id) || 0) + score);
  });

  // 4. 排序返回
  return Array.from(merged.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

### 上下文构建

```javascript
async function buildContext({ userText, conversationHistory, limit = 8 }) {
  // 1. 从用户文本提取关键词
  const keywords = extractKeywords(userText);

  // 2. 混合检索
  const results = await hybridSearch({
    query: userText,
    kinds: PROMPT_INJECTION_KINDS,
    limit: Math.max(20, limit * 4),
  });

  // 3. 多样性重排（避免同类记忆过多）
  const diversified = diversifyResults(results, { limit, byKind: true });

  // 4. 记录访问
  diversified.forEach(m => recordAccess(m.id));

  // 5. 格式化注入
  const digest = formatMemoryDigest(diversified);
  return `<memory-digest>\n${digest}\n</memory-digest>`;
}
```

### 多样性重排（MMR）

```javascript
function diversifyResults(results, { limit, byKind = true }) {
  if (!byKind || results.length <= limit) return results;

  const selected = [];
  const kindCounts = {};
  const maxPerKind = Math.ceil(limit / 5);  // 最多 5 类，每类限制

  for (const item of results) {
    const kindCount = kindCounts[item.kind] || 0;
    if (kindCount >= maxPerKind) continue;

    selected.push(item);
    kindCounts[item.kind] = kindCount + 1;

    if (selected.length >= limit) break;
  }

  return selected;
}
```

---

## 记忆蒸馏机制

### 蒸馏流程

```
每日 23:30 触发
        ↓
加载当日 journal
        ↓
初步过滤（去重、长度过滤）
        ↓
构建蒸馏 Prompt
        ↓
调用 Pi 分析
        ↓
提取记忆候选项
        ↓
验证规则（重复检查、类型检查）
        ↓
批量 upsert
        ↓
更新 mirror
        ↓
发送总结到 #记忆库
```

### 蒸馏 Prompt 设计

```markdown
你是一个长期记忆蒸馏器。根据今日对话流，提取**真正值得永久记住**的事实。

## 严格规则

### 提取标准
- ✅ 跨时间仍然有用：偏好、决策、约束、定义、稳定的工程结论
- ✅ 高置信度：明确表达、非推测性
- ✅ 可验证：有明确依据（对话、工具调用结果）
- ❌ 临时任务（任务本身就是记忆）
- ❌ 已经过时的发现（短时效）
- ❌ 闲聊或情绪表达
- ❌ 重复的（检查 journal 里的 memory_event）

### 提取数量
- 0-5 条（宁缺毋滥）
- 优先级：decision > preference > constraint > fact > build > reflection

### 格式要求
- subject: 英文短键（2-4 个单词，小写，用 - 连接）
- kind: 从以下选择：preference, fact, decision, constraint, definition, build, reflection
- content: 一句话陈述，简洁明确
- tags: 2-4 个相关标签

### 流程
1. 通读 transcript
2. 标记候选点
3. 去重检查（对比 journal 里的 memory_event）
4. 调用 memory_upsert 工具
5. 完成后简短回复：✅ 蒸馏 N 条记忆：<subject list>

## 今日 transcript ({date})

{transcript}
```

### 规则引擎

```javascript
const DISTILLATION_RULES = [
  {
    name: '决策提取',
    pattern: /(决定|选择|采用|改为)/gi,
    extractor: (text) => {
      const match = text.match(/(?:决定|选择|采用|改为)[^。！？]*[。！？]/);
      return match ? match[0].trim() : null;
    },
    kind: 'decision',
  },
  {
    name: '偏好提取',
    pattern: /(偏好|习惯|通常|总是|喜欢)/gi,
    extractor: (text) => {
      const match = text.match(/(?:偏好|习惯|通常|总是|喜欢)[^。！？]*[。！？]/);
      return match ? match[0].trim() : null;
    },
    kind: 'preference',
  },
  {
    name: '约束提取',
    pattern: /(不能|禁止|必须|要求|限制)/gi,
    extractor: (text) => {
      const match = text.match(/(?:不能|禁止|必须|要求|限制)[^。！？]*[。！？]/);
      return match ? match[0].trim() : null;
    },
    kind: 'constraint',
  },
];
```

### 验证规则

```javascript
async function validateCandidate(candidate, existingMemories) {
  // 1. 重复检查（语义相似度）
  const similar = existingMemories.filter(m =>
    cosineSimilarity(candidate.embedding, m.embedding) > 0.85
  );
  if (similar.length > 0) {
    return { valid: false, reason: '与现有记忆相似度过高' };
  }

  // 2. 格式检查
  if (!candidate.subject || candidate.subject.length > 50) {
    return { valid: false, reason: 'subject 格式错误' };
  }

  // 3. 类型检查
  if (!MEMORY_KINDS.includes(candidate.kind)) {
    return { valid: false, reason: '非法 kind' };
  }

  // 4. 内容长度检查
  if (candidate.content.length < 5 || candidate.content.length > 500) {
    return { valid: false, reason: 'content 长度不合适' };
  }

  // 5. 冲突检查
  const conflicts = existingMemories.filter(m =>
    m.subject === candidate.subject &&
    m.kind === candidate.kind &&
    m.status === 'active'
  );
  if (conflicts.length > 0) {
    // 允许更新，但需要标注 supersedes
    candidate.supersedes = conflicts.map(m => m.id);
  }

  return { valid: true };
}
```

---

## 向量检索优化

### 当前实现

```javascript
// 简化版：暴力 cosine + 列表
function vectorSearch(queryVec, candidates, limit) {
  return candidates
    .map(id => ({
      id,
      score: cosine(queryVec, loadVector(id)),
    }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

### 优化方案 1：分层索引

```javascript
class LayeredVectorIndex {
  constructor() {
    this.layers = [
      { k: 10, vectors: [] },      // 精层：最近 10 个
      { k: 100, vectors: [] },     // 中层：最近 100 个
      { k: 1000, vectors: [] },    // 粗层：最近 1000 个
    ];
  }

  add(id, embedding) {
    // 添加到所有层
    this.layers.forEach(layer => {
      if (layer.vectors.length < layer.k) {
        layer.vectors.push({ id, embedding });
      } else {
        // 随机替换一个
        const idx = Math.floor(Math.random() * layer.k);
        layer.vectors[idx] = { id, embedding };
      }
    });
  }

  search(queryVec, limit) {
    // 从粗到精搜索
    let candidates = new Set();
    for (const layer of this.layers) {
      const results = this.bruteForceSearch(queryVec, layer.vectors, limit * 2);
      results.forEach(r => candidates.add(r.id));
    }
    return Array.from(candidates).slice(0, limit);
  }

  bruteForceSearch(queryVec, vectors, limit) {
    return vectors
      .map(v => ({
        id: v.id,
        score: cosine(queryVec, v.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
```

### 优化方案 2：IVF（倒排文件）

```javascript
class IVFIndex {
  constructor({ nlist = 100, nprobe = 10 } = {}) {
    this.nlist = nlist;      // 聚类中心数
    this.nprobe = nprobe;    // 搜索时检查的聚类数
    this.centroids = [];     // 聚类中心
    this.invertedLists = []; // 倒排列表
    this.trained = false;
  }

  async train(vectors) {
    // K-means 聚类
    const kmeans = new KMeans({ k: this.nlist });
    this.centroids = await kmeans.fit(vectors);

    // 初始化倒排列表
    this.invertedLists = Array.from({ length: this.nlist }, () => []);

    // 分配向量到聚类
    for (let i = 0; i < vectors.length; i++) {
      const vec = vectors[i];
      const clusterId = this.assignToCluster(vec);
      this.invertedLists[clusterId].push({ id: vec.id, embedding: vec.embedding });
    }

    this.trained = true;
  }

  assignToCluster(vec) {
    let bestId = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.centroids.length; i++) {
      const dist = euclideanDistance(vec, this.centroids[i]);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = i;
      }
    }
    return bestId;
  }

  search(queryVec, limit) {
    if (!this.trained) return [];

    // 找到最近的 nprobe 个聚类
    const clusterDistances = this.centroids.map((c, i) => ({
      id: i,
      dist: euclideanDistance(queryVec, c),
    }));
    const probeClusters = clusterDistances
      .sort((a, b) => a.dist - b.dist)
      .slice(0, this.nprobe)
      .map(c => c.id);

    // 在这些聚类中搜索
    const candidates = [];
    for (const clusterId of probeClusters) {
      const list = this.invertedLists[clusterId];
      for (const item of list) {
        candidates.push({
          id: item.id,
          score: cosine(queryVec, item.embedding),
        });
      }
    }

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
```

### 优化方案 3：HNSW（层次化小世界）

```javascript
class HNSWIndex {
  constructor({ M = 16, efConstruction = 200, maxM = 16 } = {}) {
    this.M = M;                   // 每层最大连接数
    this.efConstruction = efConstruction;  // 构建时候选队列大小
    this.maxM = maxM;             // 第 0 层最大连接数
    this.levels = [];             // 每层的图
    this.entryPoint = null;       // 入口节点
  }

  add(id, embedding) {
    // 1. 随机确定最大层数
    const maxLevel = Math.floor(-Math.log(Math.random()) * this.M);

    // 2. 从顶层到第 1 层，贪心搜索最近邻
    let closest = this.entryPoint;
    for (let level = this.levels.length - 1; level > maxLevel; level--) {
      closest = this.searchLayer(embedding, closest, 1, level);
    }

    // 3. 在各层插入节点
    for (let level = Math.min(maxLevel, this.levels.length - 1); level >= 0; level--) {
      const candidates = this.searchLayer(
        embedding,
        closest,
        this.efConstruction,
        level
      );
      this.insertNode(id, embedding, level, candidates);
    }

    // 4. 更新入口点
    if (maxLevel >= this.levels.length) {
      this.entryPoint = id;
    }
  }

  searchLayer(query, entry, ef, level) {
    const visited = new Set([entry]);
    const candidates = new MaxHeap([{ id: entry, dist: distance(query, entry) }]);
    const results = new MaxHeap([]);

    while (candidates.size > 0) {
      const current = candidates.pop();

      if (results.size >= ef && current.dist > results.peek().dist) {
        break;
      }

      const neighbors = this.getNeighbors(current.id, level);
      for (const neighbor of neighbors) {
        if (visited.has(neighbor.id)) continue;
        visited.add(neighbor.id);

        const dist = distance(query, neighbor.embedding);
        if (dist < results.peek()?.dist || results.size < ef) {
          candidates.push({ id: neighbor.id, dist });
          results.push({ id: neighbor.id, dist });
          if (results.size > ef) results.pop();
        }
      }
    }

    return results.toArray();
  }

  search(query, ef = 10) {
    if (!this.entryPoint) return [];

    // 1. 从顶层贪心搜索到第 1 层
    let closest = this.entryPoint;
    for (let level = this.levels.length - 1; level > 0; level--) {
      closest = this.searchLayer(query, closest, 1, level)[0]?.id;
    }

    // 2. 在第 0 层搜索
    const results = this.searchLayer(query, closest, ef, 0);
    return results;
  }
}
```

### 性能对比

| 方案 | 构建时间 | 查询时间（1000 条） | 查询时间（10000 条） | 内存占用 |
|------|----------|---------------------|----------------------|----------|
| 暴力 cosine | O(n) | ~1ms | ~10ms | O(n) |
| 分层索引 | O(n) | ~0.5ms | ~2ms | O(n) |
| IVF (nlist=100) | O(n) | ~2ms | ~5ms | O(n) |
| HNSW (M=16) | O(n log n) | ~0.2ms | ~0.5ms | O(n log n) |

**推荐**：当前系统（1000 条以内）使用 **分层索引**，未来扩展到 10000+ 条时升级到 **HNSW**。

---

## 记忆镜像与同步

### 镜像映射

```json
{
  "mem_1721398400000_rpc_vs_tui": {
    "channelId": "1527730714626490480",
    "messageId": "123456789012345678",
    "mirroredAt": "2024-07-19T05:00:00.000Z",
    "lastSyncedAt": "2024-07-19T06:30:00.000Z"
  }
}
```

### 同步策略

| 操作 | Discord → Store | Store → Discord | 冲突处理 |
|------|-----------------|-----------------|----------|
| 创建 | - | ✅ 立即同步 | - |
| 更新 | ⚠️ 手动触发 | ✅ 立即同步 | Store 优先 |
| 撤销 | ⚠️ 手动触发 | ✅ 立即同步 | Store 优先 |
| 重建 | - | ✅ 批量同步 | 覆盖 Discord |

### 消息格式

```markdown
🧠 [decision] **rpc-vs-tui**
采用 Pi 官方的 RPC 子进程模式，不再使用 TUI。
· tags: architecture, performance
· rev=2 · 2024-07-19
```

### 一致性保证

```javascript
async function syncWithRetry({ action, entry, maxRetries = 3 }) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await mirror.apply({ action, entry });
      if (result.ok) {
        updateMirrorMap(entry.id, result.messageId);
        return { ok: true };
      }
    } catch (e) {
      if (i === maxRetries - 1) {
        log(`[mirror] 同步失败: ${e.message}`);
        // 加入重试队列
        retryQueue.push({ action, entry, ts: Date.now() });
      }
      await sleep(1000 * (i + 1));  // 指数退避
    }
  }
}

// 定期重试失败队列
setInterval(async () => {
  const now = Date.now();
  for (const item of retryQueue) {
    if (now - item.ts > 5 * 60 * 1000) {  // 5 分钟后重试
      await syncWithRetry(item);
    }
  }
}, 60 * 1000);  // 每分钟检查
```

### 重建流程

```javascript
async function reconcile() {
  const result = { created: 0, updated: 0, deleted: 0, errors: 0 };

  // 1. 清理镜像中已不存在的记忆
  const mirrorMap = loadMirrorMap();
  for (const [id, mirror] of Object.entries(mirrorMap)) {
    const meta = memoryStore.readMeta(id);
    if (!meta || meta.status === 'revoked') {
      await deleteMirrorMessage(mirror.channelId, mirror.messageId);
      deleteMirror(id);
      result.deleted++;
    }
  }

  // 2. 补发缺失的镜像
  const activeMemories = await memoryStore.query({ status: 'active' });
  for (const memory of activeMemories.items) {
    const mirror = getMirror(memory.id);
    if (!mirror && isRecent(memory.updatedAt, 30)) {
      const r = await mirror.apply({ action: 'created', entry: memory });
      if (r.ok) result.created++; else result.errors++;
    }
  }

  return result;
}
```

---

## 记忆治理体系

### 统计指标

```json
{
  "total": 152,
  "byStatus": {
    "active": 120,
    "superseded": 20,
    "revoked": 8,
    "expired": 3,
    "archived": 1
  },
  "byKind": {
    "preference": 25,
    "fact": 35,
    "decision": 18,
    "constraint": 8,
    "definition": 12,
    "reflection": 10,
    "build": 12,
    "context": 15,
    "project": 8,
    "todo": 5,
    "idea": 4
  },
  "byScope": {
    "user": 140,
    "project": 10,
    "global": 2
  },
  "accessStats": {
    "totalAccess": 1250,
    "avgAccessPerMemory": 8.2,
    "mostAccessed": [
      { "id": "mem_xxx", "subject": "rpc-vs-tui", "count": 45 }
    ],
    "leastAccessed": [
      { "id": "mem_yyy", "subject": "old-preference", "count": 0 }
    ]
  },
  "distillationStats": {
    "totalDistilled": 120,
    "avgPerDay": 3.2,
    "lastDistilled": "2024-07-18T23:30:00.000Z"
  },
  "vectorStats": {
    "totalVectors": 152,
    "avgDimension": 768,
    "indexSize": "1.2MB"
  }
}
```

### 治理规则

```javascript
const GOVERNANCE_RULES = [
  {
    name: '记忆数量上限',
    check: (stats) => stats.total > 1000,
    action: 'alert',
    message: '记忆数量超过 1000 条，建议清理过期记忆',
  },
  {
    name: '低访问率记忆',
    check: (stats) => {
      const lowAccess = stats.accessStats.leastAccessed.filter(m => m.count === 0);
      return lowAccess.length > 50;
    },
    action: 'compact',
    message: '发现 50+ 条零访问记忆，建议归档',
  },
  {
    name: '过期记忆',
    check: (stats) => stats.byStatus.expired > 10,
    action: 'compact',
    message: '发现 10+ 条过期记忆，建议归档',
  },
  {
    name: '类型不平衡',
    check: (stats) => {
      const maxCount = Math.max(...Object.values(stats.byKind));
      const minCount = Math.min(...Object.values(stats.byKind));
      return maxCount / minCount > 10;
    },
    action: 'review',
    message: '记忆类型分布不均，建议检查',
  },
];
```

### 清理策略

```javascript
async function runCompaction() {
  const result = {
    expired: 0,
    archived: 0,
    deleted: 0,
  };

  const now = new Date();
  const histCutoff = new Date(now - 90 * 86400_000);
  const activeCutoff = new Date(now - 365 * 86400_000);

  const allMemories = await memoryStore.query({ includeSuperseded: true });

  for (const memory of allMemories.items) {
    if (memory.status === 'active') {
      // 处理过期
      if (memory.expiresAt && new Date(memory.expiresAt) <= now) {
        await memoryStore.revoke({ id: memory.id, reason: '已过期' });
        result.expired++;
      }
      // 归档长期未更新的
      else if (new Date(memory.updatedAt) <= activeCutoff) {
        memory.status = 'archived';
        await memoryStore.upsert(memory);
        result.archived++;
      }
    } else {
      // 删除历史记录
      if (new Date(memory.updatedAt) <= histCutoff) {
        await memoryStore.delete(memory.id);
        result.deleted++;
      }
    }
  }

  return result;
}
```

### 定期任务

| 任务 | 频率 | 时间 | 触发条件 |
|------|------|------|----------|
| 记忆蒸馏 | 每天 | 23:30 | cron |
| 统计更新 | 每天 | 00:00 | cron |
| 治理检查 | 每周 | 00:00 | cron + 规则触发 |
| 清理压缩 | 每月 | 00:00 | cron |
| 快照备份 | 每周 | 02:00 | cron |
| 镜像重建 | 按需 | 手动 | 数据不一致时 |

---

## 安全与权限

### 权限控制

```typescript
interface Permission {
  scope: 'read' | 'write' | 'delete' | 'admin';
  kinds?: MemoryKind[];
  tags?: string[];
}

interface UserPermissions {
  userId: string;
  permissions: Permission[];
}

// 示例配置
const PERMISSIONS: UserPermissions[] = [
  {
    userId: 'user_123',
    permissions: [
      { scope: 'read' },                          // 可读所有
      { scope: 'write', kinds: ['idea', 'todo'] }, // 可写 idea/todo
      { scope: 'delete' },                         // 可删除（有确认）
    ],
  },
];
```

### 数据脱敏

```javascript
function sanitizeMemory(memory, userPermissions) {
  const sanitized = { ...memory };

  // 检查读取权限
  const canRead = userPermissions.permissions.some(p => p.scope === 'read');
  if (!canRead) {
    return null;
  }

  // 脱敏敏感信息
  if (memory.tags?.includes('sensitive')) {
    const hasDeletePermission = userPermissions.permissions.some(p => p.scope === 'delete');
    if (!hasDeletePermission) {
      sanitized.content = '[敏感内容，无权限访问]';
    }
  }

  return sanitized;
}
```

### 审计日志

```javascript
function auditLog(action, userId, memoryId, details) {
  const entry = {
    ts: new Date().toISOString(),
    action,
    userId,
    memoryId,
    ip: details.ip,
    userAgent: details.userAgent,
    success: details.success,
    error: details.error,
  };

  appendFileSync('data/memory/audit.logl', JSON.stringify(entry) + '\n');
}
```

---

## 性能优化

### 缓存策略

```javascript
class MemoryCache {
  constructor({ ttl = 60000, maxSize = 100 } = {}) {
    this.cache = new Map();
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.ts > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      // LRU 淘汰
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, { ts: Date.now(), value });
  }

  invalidate(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}
```

### 批量操作

```javascript
async function batchUpsert(memories, { batchSize = 10 } = {}) {
  const results = [];

  for (let i = 0; i < memories.length; i += batchSize) {
    const batch = memories.slice(i, i + batchSize);
    const promises = batch.map(m => memoryStore.upsert(m));
    const batchResults = await Promise.allSettled(promises);
    results.push(...batchResults);

    // 避免速率限制
    if (i + batchSize < memories.length) {
      await sleep(100);
    }
  }

  return results;
}
```

### 索引预热

```javascript
async function warmupCache() {
  // 1. 加载索引
  const index = memoryStore.readIndex();

  // 2. 预热常用查询
  const recent = index.slice(0, 50);
  for (const memory of recent) {
    cache.set(memory.id, memory);
  }

  // 3. 预热向量索引
  const vectorIndex = memoryStore.loadVectorIndex();
  cache.set('vector_index', vectorIndex);

  log(`[cache] 预热完成: ${recent.length} 条记忆`);
}
```

---

## 实施路线图

### Phase 1: 基础设施（Week 1-2）
- [ ] 完善记忆类型体系
- [ ] 实现生命周期管理
- [ ] 建立统计指标系统
- [ ] 添加审计日志

### Phase 2: 检索优化（Week 3-4）
- [ ] 实现分层向量索引
- [ ] 优化混合检索算法
- [ ] 添加多样性重排
- [ ] 性能测试与调优

### Phase 3: 蒸馏增强（Week 5-6）
- [ ] 完善蒸馏规则引擎
- [ ] 添加验证规则
- [ ] 优化 Prompt 设计
- [ ] A/B 测试蒸馏效果

### Phase 4: 治理体系（Week 7-8）
- [ ] 实现治理规则引擎
- [ ] 建立清理策略
- [ ] 添加监控告警
- [ ] 定期任务编排

### Phase 5: 安全加固（Week 9-10）
- [ ] 权限控制系统
- [ ] 数据脱敏
- [ ] 备份恢复
- [ ] 安全审计

### Phase 6: 性能优化（Week 11-12）
- [ ] 缓存系统
- [ ] 批量操作
- [ ] 索引预热
- [ ] 负载测试

---

## 附录

### A. 配置示例

```json
{
  "distillation": {
    "schedule": "23:30",
    "timezone": "Asia/Shanghai",
    "maxPerDay": 5,
    "minConfidence": 0.8,
    "rules": ["decision", "preference", "constraint", "fact"]
  },
  "retention": {
    "preference": { "active": 365, "historical": "forever" },
    "fact": { "active": 365, "historical": "forever" },
    "decision": { "active": 365, "historical": "forever" },
    "context": { "active": 30, "historical": 90 }
  },
  "vector": {
    "dimension": 768,
    "indexType": "layered",
    "layered": {
      "layers": [
        { "k": 10 },
        { "k": 100 },
        { "k": 1000 }
      ]
    }
  },
  "governance": {
    "maxTotalMemories": 1000,
    "lowAccessThreshold": 0,
    "compactionSchedule": "0 0 1 * *"
  },
  "mirror": {
    "enabled": true,
    "channelId": "1527730714626490480",
    "syncOnCreate": true,
    "syncOnUpdate": true,
    "syncOnRevoke": true,
    "reconcileOnStartup": false
  }
}
```

### B. 监控指标

```javascript
const MONITORING_METRICS = [
  // 记忆数量
  'memory_total_count',
  'memory_active_count',
  'memory_superseded_count',
  'memory_revoked_count',

  // 按类型
  'memory_by_kind_preference',
  'memory_by_kind_fact',
  'memory_by_kind_decision',
  'memory_by_kind_constraint',

  // 检索性能
  'memory_query_duration_ms',
  'memory_query_count',
  'memory_query_cache_hit_rate',

  // 蒸馏性能
  'memory_distillation_duration_ms',
  'memory_distillation_count',
  'memory_distillation_rejected_count',

  // 镜像性能
  'memory_mirror_sync_duration_ms',
  'memory_mirror_sync_error_count',
  'memory_mirror_reconcile_duration_ms',

  // 清理性能
  'memory_compaction_duration_ms',
  'memory_compaction_deleted_count',
  'memory_compaction_archived_count',
];
```

### C. 故障排查

| 问题 | 可能原因 | 诊断方法 | 解决方案 |
|------|----------|----------|----------|
| 记忆未同步到 Discord | 网络问题 / 权限问题 | 检查 logs/orchestrator.log | 运行 reconcile |
| 蒸馏无结果 | journal 太短 / 规则太严 | 检查 journal 大小 | 调整蒸馏规则 |
| 检索结果不准 | 向量索引过期 | 检查 vector/index.json | 重建索引 |
| 记忆数量爆炸 | 无清理策略 | 检查 stats.json | 运行 compaction |
| 性能下降 | 索引太大 / 无缓存 | 检查查询耗时 | 升级索引 / 加缓存 |

---

**文档版本**: 1.0
**最后更新**: 2024-07-19
**维护者**: zhangsan