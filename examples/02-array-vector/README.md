# 第 2 章 示例目录：数组 / 向量

> 配套章节：[docs/02-array-vector.md](../../docs/02-array-vector.md)（撰写中）

## 文件清单

| 文件 | 演示内容 | 依赖 |
|------|----------|------|
| `01_basic.py` | 1D / 2D / 3D 数组在文本 / 表格 / 图像中的角色 | 标准库 |
| `02_embedding.py` | Embedding 查表即"Hash 风格的数组" | numpy（可选） |

## 运行

```bash
python examples/02-array-vector/01_basic.py
```

## 预期输出

```
text shape:  (3,)
batch shape: (3, 3)
image shape: (3, 32, 32)
image dtype: uint8 (0-255)
```

> 02_embedding.py 待补。