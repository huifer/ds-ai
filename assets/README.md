# assets/

存放项目图示与多媒体资源。

## 目录约定

```
assets/
├── README.md
├── SOURCES.md           ← 列出每个图示的来源与许可
├── banner.svg           ← 项目横幅（README 顶部用）
├── diagrams/            ← 各章节配图（SVG / Mermaid 源文件）
│   ├── heap-in-beam-search.svg
│   └── heap-in-beam-search.mmd
└── screenshots/         ← 截图（慎用，体积大）
```

## 图示规范

- **首选 SVG / Mermaid**：可版本化、可检索、体积小
- PNG / JPG 截图：放在 `screenshots/`，引用前请压缩
- 凡引用第三方图示：必须在 `SOURCES.md` 中注明来源、作者、许可协议

## 推荐工具

- 流程图：[Mermaid](https://mermaid.js.org/) / [draw.io](https://app.diagrams.net/)
- 内存布局图：手绘后扫描，或用 [excalidraw](https://excalidraw.com/)
- 时序图：Mermaid / PlantUML

更多约定见根目录 [CONTRIBUTING.md](../CONTRIBUTING.md)。