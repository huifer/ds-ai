---
name: tailwind-v4
description: |
  Use this skill when configuring Tailwind v4 for a React project.
  Always pair with `zenbuild-design-tokens` and `component-library`.
---

# 1. 安装

```bash
pnpm add -D tailwindcss@4 @tailwindcss/vite
```

# 2. vite.config.ts

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

# 3. styles/tailwind.css

```css
@import 'tailwindcss';

@theme inline {
  --color-brand-primary: var(--brand-primary);
  --color-brand-accent: var(--brand-accent);
  --color-brand-highlight: var(--brand-highlight);
  --color-surface: var(--brand-surface);
  --color-muted: var(--brand-muted);
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-serif: 'Lora', Georgia, serif;
}
```

# 4. 与 Zenbuild token 同步

在 `src/main.tsx` 顶部：

```ts
import '@zenbuild/design/tokens.css';
import './styles/tailwind.css';
```

# 5. 失败回退

- 与 Tailwind v3 风格冲突 → 使用 `tailwind.config.js` + `postcss.config.js` 双配置；
- 主题变量失效 → 在 `tailwind.css` 中显式 `@theme` 声明。
