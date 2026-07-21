# 更新日志

本项目的所有重要变更都会记录在此文件中。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

### 计划中
- 完成基础 7 章内容（数组 → 哈希）
- 完成进阶 5 章内容（Trie → B 树 / LSM）
- 增加 LLM 专题：KV-Cache、PagedAttention、RAG 检索
- 增加 GNN 专题：消息传递与图采样
- 引入交互式 Notebook 版本
- 国际化（English version）

---

## [0.1.0] - 2025-XX-XX

### Added
- 📝 项目初始化与开源资料搭建
  - 完整中文 README（含徽章、目录、快速开始、Roadmap）
  - MIT License
  - .gitignore（Python + Jupyter + 文档友好）
  - 贡献指南（CONTRIBUTING.md）
  - 行为准则（CODE_OF_CONDUCT.md）
  - 更新日志（CHANGELOG.md）
  - Issue 与 PR 模板
- 📚 docs/ 目录骨架与第一章《项目总览》
- 🎨 assets/ 目录用于存放图示素材（含 banner.svg）

### Notes
- 仓库正式从空仓进入内容建设阶段
- 欢迎以小步快跑方式提 PR：错别字、补充示例、新章节均可

---

## [0.1.1] - 计划中

### Changed
- 🎨 **项目命名**：原 `ds-ai` 重命名为 **`strata-ai`**
  - 理念：数据结构是 AI 算法的"底层地层（strata）"
  - Tagline：**The Strata Beneath AI**
  - 副标语：**Data Structures, Layered for AI**
- 🖼️ 重做 `assets/banner.svg`（左侧地层视觉 + 右侧 AI 节点视觉）
- 📝 README 重写：增加 banner、tagline、双语副标语

### Action Required（手动）
- 在 GitHub 端 Settings → General → "Rename repository" 把 `ds-ai` 改为 `strata-ai`
- GitHub 会自动把旧 URL 重定向到新 URL，无需修改 README 里的链接（已统一改完）