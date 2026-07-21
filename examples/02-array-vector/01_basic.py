"""
01_basic.py
============

第 2 章配套示例 1：数组 / 向量的最基础用法。

本章要回答的第一个问题：
"在 AI 系统中，数组/向量到底长什么样？"

运行：
    python examples/02-array-vector/01_basic.py
预期输出：
    text shape:  (4,)
    text dtype:  int64
    image shape: (3, 32, 32)
    image dtype: uint8
"""

from __future__ import annotations


def main() -> None:
    # ---------- 1. 一维数组：文本 / 序列 ----------
    # 在 NLP 中，一段文本最常见的表示就是 token id 序列。
    text_tokens = [101, 2009, 102]  # [CLS], some-token, [SEP]
    print("text shape: ", (len(text_tokens),))
    print("text dtype: ", "int64 (token id)")

    # ---------- 2. 二维数组：批数据 / 表格 ----------
    # 在结构化数据 / 推荐系统中，一个 batch 就是二维数组。
    batch_features = [
        [0.1, 0.2, 0.3],  # sample 1
        [0.4, 0.5, 0.6],  # sample 2
        [0.7, 0.8, 0.9],  # sample 3
    ]
    print("batch shape: ", (len(batch_features), len(batch_features[0])))

    # ---------- 3. 三维数组：图像 ----------
    # 图像 = (C, H, W)  或  (H, W, C)
    image_shape = (3, 32, 32)  # 3 通道 (RGB), 32x32 像素
    print("image shape:", image_shape)
    print("image dtype: uint8 (0-255)")


if __name__ == "__main__":
    main()