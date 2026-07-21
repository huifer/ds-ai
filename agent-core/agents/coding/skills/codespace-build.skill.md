---
name: codespace-build
description: |
  Use this skill when the Demo needs to be packaged for the customer to open in a browser.
  Produces a `dist/` folder and a `preview.html` that lists all artifacts.
---

# 1. 构建

```bash
pnpm build
```

输出 `dist/index.html` + assets。

# 2. 上传到客户

- 打包 `dist/` 为 `dist.zip`；
- 上传到 Discord `#fde-客户交付` 与 `#preview-公众号`；
- 同时附上 PDF 截图与 `preview.html`（含 `Open in Browser` 链接）。

# 3. 失败回退

- 构建失败 → 回滚到上一个通过版本；
- 体积过大 → 拆分 chunk，关闭 SourceMap。
