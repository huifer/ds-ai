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

## [0.1.1] - 2025-XX-XX

### Added
- 🎨 **项目命名**：原 `ds-ai` 重命名为 **`strata-ai`**
  - 理念：数据结构是 AI 算法的"底层地层（strata）"
  - Tagline：**The Strata Beneath AI**
  - 副标语：**Data Structures, Layered for AI**
- 🖼️ **完整 Logo / Banner 资产**
  - `assets/banner.svg` + `assets/banner.png`（README 头部）
  - `assets/logo.png`（方形 logo，512×512）
  - `assets/favicon.png` + `favicon-16.png` + `favicon-32.png` + `favicon-64.png`
  - `assets/apple-touch-icon.png`（180×180）
  - `assets/social-card.png`（1280×640，Open Graph / Twitter Card）
- 📦 **PyPI 包发布**
  - `pip install strata-ai`
  - 包名：`strata-ai` / 导入名：`strata_ai`
  - Optional groups：`numpy` / `torch` / `graph` / `viz` / `docs` / `dev` / `all`
  - PEP 561 兼容（`py.typed`）
- 🌐 **GitHub Pages 文档站**
  - MkDocs Material 主题（暗/亮色切换）
  - 自动部署：`.github/workflows/docs.yml`
  - 站点地址：`https://huifer.github.io/strata-ai/`
- 🔧 **CI / 自动化**
  - `.github/workflows/lint.yml`：Markdown 链接 + Python 语法 + SVG XML 检查
  - `.github/workflows/docs.yml`：MkDocs 构建 + GitHub Pages 部署
  - `.github/workflows/release.yml`：PyPI 自动发布（Trusted Publishing / OIDC）
- 📝 **新文件**
  - `pyproject.toml`（PEP 621）+ `requirements.txt` + `requirements-dev.txt`
  - `mkdocs.yml` + `docs/index.md` + `docs/assets/css/extra.css` + `docs/assets/js/mathjax.js`
  - `strata_ai/__init__.py` + `strata_ai/py.typed` + `strata_ai/structures/__init__.py`
- 📖 README 重写：增加 banner、tagline、PyPI/Docs 徽章、3 种快速开始方式

### Action Required（手动）
- 在 GitHub 端 Settings → General → "Rename repository" 把 `ds-ai` 改为 `strata-ai`
- 在 GitHub 端 Settings → Pages → Source 选 "GitHub Actions"（启用 Pages）
- 在 PyPI 端配置 Trusted Publishing（Project → Publishing → Add pending publisher）
  - Owner：`huifer`
  - Repository：`strata-ai`
  - Workflow：`release.yml`
- 第一次手动发布：本地 `python -m build && twine upload dist/*`（或通过 Release event 触发）

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