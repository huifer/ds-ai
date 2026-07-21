<div align="center">

# 🧠 ds-ai

### 数据结构 × 人工智能：从基础结构到 AI 算法的桥梁

[![Status](https://img.shields.io/badge/Status-Active-success.svg)]()
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Language](https://img.shields.io/badge/Language-中文%20%7C%20English-orange.svg)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Repo Size](https://img.shields.io/badge/Size-Lightweight-yellowgreen.svg)]()

[项目简介](#-项目简介) • [核心特色](#-核心特色) • [快速开始](#-快速开始) • [内容目录](#-内容目录) • [贡献](#-贡献) • [许可](#-许可协议)

</div>

---

## 📖 项目简介

**ds-ai** 是一个面向开发者与学习者的开源项目，专注于 **数据结构（Data Structures）与人工智能（AI）算法的结合**。

> 经典的数据结构不是 AI 的"历史包袱"，而是 AI 算法的**底层积木**：堆支撑优先队列、树支撑决策与语法、图支撑知识图谱与注意力、哈希支撑 Embedding 检索……本项目把这些连接一一摊开。

我们不重复造"教科书轮子"，而是回答一个具体的问题：

> **每一种经典数据结构，分别在 AI/ML 系统里扮演什么角色？**

如果你学过数据结构却看不懂 Transformer，或者学了 AI 却在面试时被问到"为什么 Attention 用 Softmax"，这里应该对你有用。

---

## ✨ 核心特色

- 🔗 **结构 ↔ 算法映射**：每个数据结构都附带"它在 AI 哪里出现"的对照表。
- 📊 **可视化优先**：优先使用图示、表格、动画思路而非大段公式推导。
- 🧪 **可运行示例**：所有示例均提供 Python / NumPy / PyTorch 最小可运行代码。
- 🇨🇳 **中文为主，英文并列**：术语同时给出中英文，方便对照阅读。
- 🛠️ **渐进式深度**：从"是什么"到"为什么"，再到"怎么用"，三段式。
- 📚 **持续更新**：跟踪 SOTA（2024+）的新结构，如 FlashAttention 的 Tiling、RAG 的 HNSW、KV-Cache 的 Ring Buffer。

---

## 🎯 适合谁

| 角色 | 收益 |
|------|------|
| 🎓 计算机专业学生 | 把"课本数据结构"和"前沿 AI"打通 |
| 💼 求职/面试者 | 系统复习"数据结构在 AI 中的应用"这一高频考点 |
| 🧑‍💻 算法工程师 | 理解底层结构对性能/内存/并发的实际影响 |
| 📖 自学者 | 用一个项目建立"结构 → AI"的心智模型 |

---

## 🚀 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/huifer/ds-ai.git
cd ds-ai
```

### 2. 阅读顺序建议

零基础读者建议按以下顺序阅读 `docs/` 目录：

1. `01-overview.md` —— 项目总览与学习方法
2. `02-array-vector.md` —— 数组/向量与 Embedding
3. `03-stack-queue.md` —— 栈/队列与 BFS/DFS
4. `04-heap.md` —— 堆与 Top-K、Beam Search
5. `05-tree.md` —— 树与决策树、AST、表达式树
6. `06-graph.md` —— 图与 GNN、知识图谱
7. `07-hash.md` —— 哈希与 Attention、近邻检索
8. `08-advanced.md` —— 高级结构与 SOTA 应用

### 3. 运行示例

```bash
# 推荐使用 uv / conda / venv 任一方式创建环境
python -m venv .venv
source .venv/bin/activate
pip install numpy torch matplotlib networkx  # 按需安装
```

每个章节的 `examples/` 子目录都包含可直接运行的最小示例。

---

## 📚 内容目录

> 完整目录持续更新中，下表为当前规划。

### 基础结构（Foundation）

| 章节 | 数据结构 | AI 中的典型应用 |
|------|----------|-----------------|
| 第 2 章 | 数组 / 向量 (Array / Vector) | Embedding、Token Sequence、Batch Tensor |
| 第 3 章 | 栈 / 队列 (Stack / Queue) | DFS / BFS、推理栈、Replay Buffer |
| 第 4 章 | 堆 (Heap) | Top-K、Beam Search、Priority Replay |
| 第 5 章 | 树 (Tree) | 决策树、AST、表达树、模型蒸馏树 |
| 第 6 章 | 图 (Graph) | GNN、知识图谱、State Machine |
| 第 7 章 | 哈希表 (Hash Table) | Attention、Embedding Lookup、HNSW |

### 进阶结构（Advanced）

| 章节 | 数据结构 | AI 中的典型应用 |
|------|----------|-----------------|
| 第 8 章 | Trie / 前缀树 | Tokenization、Autocomplete、检索 |
| 第 8 章 | 并查集 (Union-Find) | 连通域、聚类、Segment Anything |
| 第 8 章 | 跳表 (Skip List) | LevelDB、有序 Embedding 检索 |
| 第 8 章 | 线段树 / 树状数组 | 区间统计、Attention 范围裁剪 |
| 第 8 章 | B 树 / LSM 树 | 向量数据库、Feature Store 存储引擎 |

### 横切主题（Cross-Cutting）

- 🔥 **复杂度即性能**：如何用 Big-O 视角分析 LLM 推理
- 🧵 **并行与并发**：生产者-消费者、Ring Buffer、KV-Cache
- 💾 **内存布局**：连续 vs 链式、对 GPU 访存的影响
- 🔍 **可观测性**：如何给 AI 系统"装仪表盘"

> 详细目录见 [`docs/目录.md`](docs/目录.md)。

---

## 🧭 设计原则

1. **不重复造轮子**：经典结构有无数教科书，我们只做"连接"。
2. **代码即文档**：每个概念至少有 1 个最小可运行示例。
3. **可视化优于公式**：能画图的不写公式，能写公式的不写散文。
4. **保持中立**：不绑定单一框架（PyTorch / JAX / TF 都会涉及）。
5. **欢迎纠错**：发现错误请直接提 Issue / PR。

---

## 🛣️ Roadmap

- [x] 项目立项与开源资料初始化
- [ ] 完成基础 7 章内容（数组 → 哈希）
- [ ] 完成进阶 5 章内容（Trie → B 树 / LSM）
- [ ] 增加 LLM 专题：KV-Cache、PagedAttention、RAG 检索
- [ ] 增加 GNN 专题：消息传递与图采样
- [ ] 增加多模态专题：稀疏 Attention 与 FlashAttention
- [ ] 引入交互式 Notebook 版本
- [ ] 国际化（English version）

---

## 🤝 贡献

非常欢迎任何形式的贡献：

- 📝 完善文档、修正错别字、补充图示
- 🧪 提交可运行示例
- 💡 提出新章节、专题建议
- 🐛 反馈内容错误或不准确之处
- 🌐 协助翻译为英文

详细流程请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 📄 许可协议

本项目基于 **MIT 协议**开源，详见 [LICENSE](LICENSE)。

---

## 🙏 致谢

- 受经典数据结构教材（CLRS / 《数据结构》严蔚敏）启发
- 参考了大量优秀开源项目（NetworkX、Faiss、LangChain 等）
- 感谢所有贡献者的耐心打磨

---

## 📬 联系方式

- GitHub Issues: [提交问题](https://github.com/huifer/ds-ai/issues)
- 讨论群：见项目主页

---

<div align="center">

**如果这个项目对你有帮助，欢迎 ⭐ Star 支持一下！**

Made with ❤️ by [huifer](https://github.com/huifer)

</div>