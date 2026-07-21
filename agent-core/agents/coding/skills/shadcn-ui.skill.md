---
name: shadcn-ui
description: |
  Use this skill when adding shadcn/ui components to a React project.
  Always pair with `component-library` and `tailwind-v4`.
---

# 1. 初始化

```bash
pnpm dlx shadcn@latest init
```

# 2. 组件引入

```bash
pnpm dlx shadcn@latest add button card input table dialog toast tooltip breadcrumb
```

# 3. 与 Zenbuild 组件关系

- 简单交互优先用 `@zenbuild/design` 的 `Button`、`Card`、`Table`、`FormField`、`Modal`、`Toast`、`Tooltip`；
- 复杂组合（Combobox、DataTable、Sheet、Chart）用 shadcn/ui；
- shadcn 组件必须用 `tokens.css` 颜色覆盖。

# 4. 注意

- shadcn/ui 是源码复制，不引入新依赖；
- 默认会改 `components.json`；
- 默认会改 `tsconfig.json` 的 `paths`；
- 第一次 init 必须在 `pnpm install` 之后。

# 5. 失败回退

- 与 token 冲突 → 在 `globals.css` 用 `var(--brand-*)`；
- TypeScript 报错 → `tsconfig.json` 添加 `"baseUrl": "."` 与 `"paths": { "@/*": ["./src/*"] }`。
