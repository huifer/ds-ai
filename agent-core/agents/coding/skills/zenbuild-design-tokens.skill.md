---
name: zenbuild-design-tokens
description: |
  Use this skill whenever a React project needs colors, spacing, fonts, or radii.
  All design decisions come from `agent-core/design/tokens.css`.
  Do not introduce ad-hoc colors, fonts, or radii in the Demo project.
---

# 1. 来源

唯一来源：`agent-core/design/tokens.css`。

# 2. 颜色

- `--brand-primary` #0F172A
- `--brand-accent` #22D3EE
- `--brand-highlight` #FACC15
- `--brand-surface` #F8FAFC
- `--brand-muted` #475569
- `--brand-border` #E2E8F0
- `--brand-danger` #EF4444
- `--brand-success` #10B981
- `--brand-warn` #F59E0B

# 3. 字体

- `--font-sans` Inter
- `--font-serif` Lora
- `--font-mono` JetBrains Mono

# 4. 间距

- `--space-1` 4px ... `--space-16` 64px

# 5. 圆角

- `--radius-sm` 6px / `--radius-md` 12px / `--radius-lg` 18px / `--radius-pill` 9999px

# 6. 阴影

- `--shadow-sm` / `--shadow-md` / `--shadow-lg`

# 7. 使用方法

Demo 项目在 `src/styles/tailwind.css` 顶部 `@theme inline { --color-*: var(--*) }`；
组件库用 `clsx` + `tailwindcss` 直接引用 token 别名。

# 8. 失败回退

- 颜色不够 → 在 token 中追加新变量而不是散落使用；
- 字体缺失 → 在 `index.html` 引入 Google Fonts CDN。
