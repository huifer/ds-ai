---
name: project-list
agent: pm
description: 列出所有项目
---

# Project List（项目清单）

> ⚙️ 本 skill 由**本地实现**提供（`agent-manager.mjs` 内联，读 index.yaml 原样输出）。
> 运行时不读本文件；本文件仅作人类参考文档。

触发：`!pr list`

## 真实行为
读 `data/business/projects/index.yaml`，**原样以文本输出**（文件不存在或为空则返回空串）。

## 备注
当前实现为「原样输出 YAML」，未做表格化展示。如需更友好的表格/筛选，可：
- 增强本地实现，或
- 改让本命令走 Pi RPC（届时本 SOP 会被 `_invokeViaPi` 读取作为指令）。
