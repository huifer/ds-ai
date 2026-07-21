# examples/

本目录存放与各章节配套的**最小可运行示例**。

## 目录约定

```
examples/
├── README.md           ← 本文件
├── 02-array-vector/    ← 与 docs/02-array-vector.md 对应
│   ├── 01_basic.py
│   ├── 02_embedding.py
│   └── README.md
├── 04-heap/
│   ├── 01_topk.py
│   ├── 02_beam_search.py
│   └── README.md
└── ...
```

## 运行示例

每个示例都是独立的 Python 文件：

```bash
python examples/02-array-vector/01_basic.py
```

需要外部依赖时，文件顶部会注明：

```python
# Requirements: numpy>=1.24
# Requirements: torch>=2.0
```

## 贡献新示例

- 一个示例只演示**一个**概念
- 尽量使用标准库 + numpy，深度学习示例允许 torch
- 在所在目录添加 `README.md`，列出每个文件的功能

详细规范见根目录 [CONTRIBUTING.md](../CONTRIBUTING.md)。