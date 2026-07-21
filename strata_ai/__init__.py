"""
strata-ai
==========

The strata beneath AI — connect classical data structures with AI/ML algorithms.

数据结构 × 人工智能：把数据结构当作 AI 算法的底层地层，一层一层铺给你看。

这是一个**文档 + 示例**项目，``strata_ai`` 这个 PyPI 包主要承载：
1. 可直接 ``import`` 的最小工具函数（避免读者复制示例时漏写片段）
2. 元数据（``__version__`` 等），方便在脚本里引用

典型用法：

    >>> import strata_ai
    >>> strata_ai.__version__
    '0.1.1'

更深入的内容请阅读 ``docs/`` 与 ``examples/`` 目录，或访问：
    https://github.com/huifer/strata-ai
    https://huifer.github.io/strata-ai/
"""

from __future__ import annotations

from typing import Final

__version__: Final[str] = "0.1.1"
__author__: Final[str] = "Zen Huifer"
__license__: Final[str] = "MIT"
__repository__: Final[str] = "https://github.com/huifer/strata-ai"
__docs_url__: Final[str] = "https://huifer.github.io/strata-ai/"


def version() -> str:
    """返回当前版本号。

    与直接读 ``__version__`` 等价，但以函数形式提供，方便在 REPL 中 ``import``。

    Returns:
        str: 形如 ``"0.1.1"`` 的版本号字符串。
    """
    return __version__


def info() -> str:
    """返回一行项目元信息，便于调试。"""
    return (
        f"strata-ai {__version__} | "
        f"author: {__author__} | "
        f"license: {__license__} | "
        f"repo: {__repository__}"
    )


__all__ = [
    "__version__",
    "__author__",
    "__license__",
    "__repository__",
    "__docs_url__",
    "version",
    "info",
]