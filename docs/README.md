# docs/ 目录说明

本目录是项目的主体内容区，所有章节都按 `NN-name.md` 命名：

```
docs/
├── 01-overview.md          ← 项目总览与学习方法（建议先读）
├── 02-array-vector.md      ← 数组与向量
├── 03-stack-queue.md       ← 栈与队列
├── 04-heap.md              ← 堆
├── 05-tree.md              ← 树
├── 06-graph.md             ← 图
├── 07-hash.md              ← 哈希表
├── 08-advanced.md          ← 进阶结构合辑
├── 目录.md                 ← 完整章节索引（带状态）
└── README.md               ← 本文件
```

每个章节内的 `examples/` 子目录存放该章节的可运行示例：

```
docs/
├── 02-array-vector/
│   └── examples/
│       ├── 01_basic.py
│       └── 02_embedding.py
└── ...
```

如果你想为某章节补示例，推荐目录布局：

```
docs/<chapter>/
  ├── examples/
  │   ├── README.md           ← 描述每个示例的输入/输出
  │   ├── 01_<topic>.py
  │   └── 02_<topic>.py
  └── figures/                ← 可选：存放图示
      └── *.svg / *.mmd
```

更多写作约定见根目录的 [CONTRIBUTING.md](../CONTRIBUTING.md)。